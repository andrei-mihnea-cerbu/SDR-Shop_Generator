import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Config } from './config';
import { HttpClient } from './http-client';

import { ArtistApiDto, ArtistEntity, ArtistRow } from '../interfaces/artist';
import { ShopApiDto, ShopEntity, ShopRow } from '../interfaces/shop';
import { SocialApiDto, SocialEntity, SocialRow } from '../interfaces/social';
import {
  LatestReleasesApiDto,
  LatestReleasesEntity,
  LatestReleasesRow,
} from '../interfaces/latest-releases';

export class LocalDatabase {
  private static instance: LocalDatabase;
  private db: Database.Database;
  private config: Config;
  private http: HttpClient;
  private syncIntervalMs: number;
  private syncing = false;
  private readyPromise?: Promise<void>;

  private constructor() {
    this.config = new Config();
    this.syncIntervalMs = parseInt(
      this.config.get('DATABASE_SYNC_INTERVAL_MS'),
      10
    );
    const dbPath = this.config.get('DATABASE_PATH');
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    this.db = new Database(dbPath);

    this.http = new HttpClient(this.config.get('API_URL'), {
      Authorization: `Bearer ${this.config.get('TRUSTED_CLIENT_AUTH_TOKEN')}`,
    });
  }

  public static getInstance(): LocalDatabase {
    if (!LocalDatabase.instance) LocalDatabase.instance = new LocalDatabase();
    return LocalDatabase.instance;
  }

  public async ready(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = (async () => {
      this.createTables();
      await this.fetchAndStoreAll();
      this.startSyncSchedule();
    })();
    return this.readyPromise;
  }

  private createTables() {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY, name TEXT, type TEXT, website TEXT, bio TEXT,
        isActive INTEGER, archivePath TEXT, productionPrice REAL,
        hasAvatar INTEGER, hasLogo INTEGER, hasFavicon INTEGER
      )
    `
      )
      .run();

    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS shops (
        id TEXT PRIMARY KEY, artistId TEXT UNIQUE, name TEXT, website TEXT,
        hasImage INTEGER, shopFeed TEXT
      )
    `
      )
      .run();

    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS socials (
        id TEXT PRIMARY KEY, artistId TEXT, name TEXT, description TEXT, url TEXT
      )
    `
      )
      .run();

    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS latest_releases (
        artistId TEXT PRIMARY KEY, youtube TEXT, spotify TEXT
      )
    `
      )
      .run();
  }

  private async fetchAndStoreAll() {
    try {
      const artistsRes = await this.http.get<ArtistApiDto[]>('/artists', {
        headers: { active: 'true' },
      });
      const artists = artistsRes.status === 200 ? artistsRes.body : [];
      if (!artists.length) return;

      this.db.transaction(() => {
        this.db.prepare('DELETE FROM artists').run();
        this.db.prepare('DELETE FROM socials').run();
        this.db.prepare('DELETE FROM shops').run();
        this.db.prepare('DELETE FROM latest_releases').run();
      })();

      for (const artist of artists) {
        this.upsertArtist(artist);
        const [soc, shp, rel] = await Promise.all([
          this.http.get<SocialApiDto[]>(`/socials?artistId=${artist.id}`),
          this.http.get<ShopApiDto>(`/shops?artistId=${artist.id}`),
          this.http.get<LatestReleasesApiDto>(
            `/music-platforms/releases/latest?artistId=${artist.id}`
          ),
        ]);

        this.db.transaction(() => {
          (soc.body || []).forEach((s) => this.upsertSocial(s, artist.id));

          if (shp.body) {
            const shopData = Array.isArray(shp.body) ? shp.body[0] : shp.body;
            if (shopData) this.upsertShop(shopData, artist.id);
          }

          if (rel.body) this.upsertLatestReleases(artist.id, rel.body);
        })();
      }
      console.log(`[LocalDB] Sync completed for ${artists.length} artists.`);
    } catch (err: any) {
      console.error('[LocalDB] Sync failed:', err.message);
    }
  }

  private startSyncSchedule() {
    const run = async () => {
      if (this.syncing) return;
      this.syncing = true;
      await this.fetchAndStoreAll();
      this.syncing = false;
      setTimeout(run, this.syncIntervalMs);
    };
    setTimeout(run, this.syncIntervalMs);
  }

  private upsertArtist(a: ArtistApiDto) {
    this.db
      .prepare(
        `
      INSERT INTO artists (id, name, type, website, bio, isActive, archivePath, productionPrice, hasAvatar, hasLogo, hasFavicon)
      VALUES (@id, @name, @type, @website, @bio, @isActive, @archivePath, @productionPrice, @hasAvatar, @hasLogo, @hasFavicon)
    `
      )
      .run({
        id: a.id,
        name: a.name,
        type: a.type,
        website: a.website ?? null,
        bio: a.bio ?? null,
        isActive: a.isActive ? 1 : 0,
        archivePath: a.archivePath ?? null,
        productionPrice: a.productionPrice ?? 0,
        hasAvatar: a.avatarDataUri ? 1 : 0,
        hasLogo: a.logoDataUri ? 1 : 0,
        hasFavicon: a.faviconDataUri ? 1 : 0,
      });
  }

  private upsertShop(s: ShopApiDto, artistId: string) {
    this.db
      .prepare(
        `
      INSERT INTO shops (id, artistId, name, website, hasImage, shopFeed)
      VALUES (@id, @artistId, @name, @website, @hasImage, @shopFeed)
    `
      )
      .run({
        id: s.id,
        artistId: artistId,
        name: s.name,
        website: s.website ?? null,
        hasImage: s.imageDataUri ? 1 : 0,
        shopFeed: s.shopFeed ?? null,
      });
  }

  private upsertSocial(s: SocialApiDto, artistId: string) {
    this.db
      .prepare(
        `
      INSERT INTO socials (id, artistId, name, description, url)
      VALUES (@id, @artistId, @name, @description, @url)
    `
      )
      .run({
        id: s.id,
        artistId: artistId,
        name: s.name,
        description: s.description ?? null,
        url: s.url,
      });
  }

  private upsertLatestReleases(artistId: string, l: LatestReleasesApiDto) {
    this.db
      .prepare(
        `
      INSERT INTO latest_releases (artistId, youtube, spotify)
      VALUES (?, ?, ?)
    `
      )
      .run(
        artistId,
        l.youtube ? JSON.stringify(l.youtube) : null,
        l.spotify ? JSON.stringify(l.spotify) : null
      );
  }

  public getAllArtists(): ArtistEntity[] {
    const rows = this.db.prepare(`SELECT * FROM artists`).all() as ArtistRow[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      website: r.website ?? undefined,
      bio: r.bio ?? undefined,
      isActive: Boolean(r.isActive),
      hasAvatar: Boolean(r.hasAvatar),
      hasLogo: Boolean(r.hasLogo),
      hasFavicon: Boolean(r.hasFavicon),
    }));
  }

  public getArtistByWebsite(host: string): ArtistEntity | undefined {
    const clean = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const row = this.db
      .prepare(`SELECT * FROM artists WHERE website LIKE ?`)
      .get(`%${clean}%`) as ArtistRow | undefined;

    if (!row) return undefined;
    return this.getAllArtists().find((a) => a.id === row.id);
  }

  public getShopByArtist(artistId: string): ShopEntity | undefined {
    const r = this.db
      .prepare(`SELECT * FROM shops WHERE artistId = ?`)
      .get(artistId) as ShopRow | undefined;

    if (!r) return undefined;
    return {
      id: r.id,
      artistId: r.artistId,
      name: r.name,
      website: r.website ?? undefined,
      hasImage: Boolean(r.hasImage),
      shopFeed: r.shopFeed ?? undefined,
    };
  }

  public getSocials(artistId: string): SocialEntity[] {
    const rows = this.db
      .prepare(`SELECT * FROM socials WHERE artistId = ?`)
      .all(artistId) as SocialRow[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      url: r.url,
    }));
  }

  public getLatestReleases(artistId: string): LatestReleasesEntity | undefined {
    const row = this.db
      .prepare(`SELECT * FROM latest_releases WHERE artistId = ?`)
      .get(artistId) as LatestReleasesRow | undefined;

    if (!row) return undefined;
    return {
      youtube: row.youtube ? JSON.parse(row.youtube) : undefined,
      spotify: row.spotify ? JSON.parse(row.spotify) : undefined,
    };
  }
}
