import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Config } from './config';
import { HttpClient } from './http-client';

import { Artist, ArtistType } from '../interfaces/artist';
import { Description } from '../interfaces/description';
import { Shop } from '../interfaces/shop';
import { Social } from '../interfaces/social';

/* =====================================================
   DB ROW TYPES
===================================================== */

interface ArtistRow {
  id: string;
  name: string;
  type: ArtistType;
  website: string | null;
  webmail_url: string;
  webmail_email: string;
  webmail_password: string;
  logos: string;
  favicons: string;
}

interface DescriptionRow {
  id: string;
  artistId: string;
  description: string;
  imageGallery: string;
}

interface ShopRow {
  id: string;
  artistId: string;
  name: string;
  website: string;
  imageGallery: string;
  shopFeed: string;
}

interface SocialRow {
  id: string;
  artistId: string;
  name: string;
  description: string;
  url: string;
}

/* =====================================================
   LOCAL DATABASE
===================================================== */

export class LocalDatabase {
  private static instance: LocalDatabase;

  private db: Database.Database;
  private http: HttpClient;
  private syncIntervalMs: number;
  private syncing = false;
  private readyPromise?: Promise<void>;

  private constructor() {
    const config = new Config();

    this.syncIntervalMs = Number(config.get('DATABASE_SYNC_INTERVAL_MS'));

    const dbPath = config.get('DATABASE_PATH');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, '');

    this.db = new Database(dbPath);

    this.http = new HttpClient(config.get('API_URL'), {
      Authorization: `Bearer ${config.get('TRUSTED_CLIENT_AUTH_TOKEN')}`,
    });
  }

  public static getInstance(): LocalDatabase {
    if (!LocalDatabase.instance) {
      LocalDatabase.instance = new LocalDatabase();
    }
    return LocalDatabase.instance;
  }

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  public async ready(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      this.createTables();
      await this.fetchAndStoreAll();
      this.startSyncSchedule();
    })();

    return this.readyPromise;
  }

  /* =====================================================
     TABLES
  ===================================================== */

  private createTables() {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        website TEXT,
        webmail_url TEXT NOT NULL,
        webmail_email TEXT NOT NULL,
        webmail_password TEXT NOT NULL,
        logos TEXT NOT NULL,
        favicons TEXT NOT NULL
      )
    `
      )
      .run();

    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS descriptions (
        id TEXT PRIMARY KEY,
        artistId TEXT NOT NULL,
        description TEXT NOT NULL,
        imageGallery TEXT NOT NULL
      )
    `
      )
      .run();

    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS shops (
        id TEXT PRIMARY KEY,
        artistId TEXT NOT NULL,
        name TEXT NOT NULL,
        website TEXT NOT NULL,
        imageGallery TEXT NOT NULL,
        shopFeed TEXT NOT NULL
      )
    `
      )
      .run();

    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS socials (
        id TEXT PRIMARY KEY,
        artistId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        url TEXT NOT NULL
      )
    `
      )
      .run();
  }

  /* =====================================================
     SYNC
  ===================================================== */

  private async fetchAndStoreAll() {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const artistsRes = await this.http.get<Artist[]>('/artists');
      const artists = artistsRes.status === 200 ? artistsRes.body : [];

      const wipeTx = this.db.transaction(() => {
        this.db.prepare('DELETE FROM artists').run();
        this.db.prepare('DELETE FROM descriptions').run();
        this.db.prepare('DELETE FROM socials').run();
        this.db.prepare('DELETE FROM shops').run();
      });
      wipeTx();

      for (const artist of artists) {
        this.upsertArtist(artist);

        const [descRes, socialsRes, shopRes] = await Promise.all([
          this.http.get<Description>(`/descriptions?artistId=${artist.id}`),
          this.http.get<Social[]>(`/socials?artistId=${artist.id}`),
          this.http.get<Shop>(`/shops?artistId=${artist.id}`),
        ]);

        const insertTx = this.db.transaction(() => {
          if (descRes.status === 200 && descRes.body) {
            this.upsertDescription(descRes.body);
          }

          for (const s of socialsRes.body || []) {
            this.upsertSocial(s, artist.id);
          }

          if (shopRes.status === 200 && shopRes.body) {
            this.upsertShop(shopRes.body);
          }
        });

        insertTx();
      }
    } finally {
      this.syncing = false;
    }
  }

  private startSyncSchedule() {
    setTimeout(async () => {
      await this.fetchAndStoreAll();
      this.startSyncSchedule();
    }, this.syncIntervalMs);
  }

  /* =====================================================
     UPSERT HELPERS
  ===================================================== */

  private upsertArtist(a: Artist) {
    this.db
      .prepare(
        `
      INSERT INTO artists (
        id, name, type, website,
        webmail_url, webmail_email, webmail_password,
        logos, favicons
      )
      VALUES (
        @id, @name, @type, @website,
        @webmail_url, @webmail_email, @webmail_password,
        @logos, @favicons
      )
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        type=excluded.type,
        website=excluded.website,
        webmail_url=excluded.webmail_url,
        webmail_email=excluded.webmail_email,
        webmail_password=excluded.webmail_password,
        logos=excluded.logos,
        favicons=excluded.favicons
    `
      )
      .run({
        id: a.id,
        name: a.name,
        type: a.type,
        website: a.website ?? null,
        webmail_url: a.webmail.url,
        webmail_email: a.webmail.email,
        webmail_password: a.webmail.password,
        logos: JSON.stringify(a.logos),
        favicons: JSON.stringify(a.favicons),
      });
  }

  private upsertDescription(d: Description) {
    this.db
      .prepare(
        `
      INSERT INTO descriptions (id, artistId, description, imageGallery)
      VALUES (@id, @artistId, @description, @imageGallery)
      ON CONFLICT(id) DO UPDATE SET
        description=excluded.description,
        imageGallery=excluded.imageGallery
    `
      )
      .run({
        ...d,
        imageGallery: JSON.stringify(d.imageGallery),
      });
  }

  private upsertShop(s: Shop) {
    this.db
      .prepare(
        `
      INSERT INTO shops (id, artistId, name, website, imageGallery, shopFeed)
      VALUES (@id, @artistId, @name, @website, @imageGallery, @shopFeed)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        website=excluded.website,
        imageGallery=excluded.imageGallery,
        shopFeed=excluded.shopFeed
    `
      )
      .run({
        ...s,
        imageGallery: JSON.stringify(s.imageGallery),
      });
  }

  private upsertSocial(s: Social, artistId: string) {
    this.db
      .prepare(
        `
      INSERT INTO socials (id, artistId, name, description, url)
      VALUES (@id, @artistId, @name, @description, @url)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        description=excluded.description,
        url=excluded.url
    `
      )
      .run({ ...s, artistId });
  }

  /* =====================================================
     QUERY HELPERS
  ===================================================== */

  public getArtistByWebsite(host: string): Artist | null {
    const clean = host.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const row = this.db
      .prepare(
        `SELECT * FROM artists WHERE website IS NOT NULL AND website LIKE ?`
      )
      .get(`%${clean}%`) as ArtistRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      website: row.website ?? undefined,
      webmail: {
        url: row.webmail_url,
        email: row.webmail_email,
        password: row.webmail_password,
      },
      logos: JSON.parse(row.logos || '[]'),
      favicons: JSON.parse(row.favicons || '[]'),
    };
  }

  public getDescription(artistId: string): Description | null {
    const row = this.db
      .prepare(`SELECT * FROM descriptions WHERE artistId = ?`)
      .get(artistId) as DescriptionRow | undefined;

    return row
      ? {
          id: row.id,
          artistId: row.artistId,
          description: row.description,
          imageGallery: JSON.parse(row.imageGallery || '[]'),
        }
      : null;
  }

  public getSocials(artistId: string): Social[] {
    return this.db
      .prepare(`SELECT * FROM socials WHERE artistId = ?`)
      .all(artistId)
      .map((r: SocialRow) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        url: r.url,
      }));
  }

  public getAllArtists(): Artist[] {
    return this.db
      .prepare(`SELECT * FROM artists`)
      .all()
      .map((r: ArtistRow) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        website: r.website ?? undefined,
        webmail: {
          url: r.webmail_url,
          email: r.webmail_email,
          password: r.webmail_password,
        },
        logos: JSON.parse(r.logos || '[]'),
        favicons: JSON.parse(r.favicons || '[]'),
      }));
  }

  public getAllShops(): Shop[] {
    return this.db
      .prepare(`SELECT * FROM shops`)
      .all()
      .map((r: ShopRow) => ({
        ...r,
        imageGallery: JSON.parse(r.imageGallery || '[]'),
      }));
  }
}
