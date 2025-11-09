import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Config } from './config';
import { Artist } from '../interfaces/artist';
import { Description } from '../interfaces/description';
import { Shop } from '../interfaces/shop';
import { Social } from '../interfaces/social';
import { HttpClient } from './http-client';

interface ArtistRow {
  id: string;
  name: string;
  type: string;
  website: string;
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

interface SocialRow {
  id: string;
  artistId: string;
  name: string;
  description: string;
  url: string;
  originalUrl: string;
  socialLabelsList: string;
}

export class LocalDatabase {
  private static instance: LocalDatabase;
  private db: Database.Database;
  private config: Config;
  private http: HttpClient;
  private syncIntervalMs: number;
  private syncing: boolean = false;
  private readyPromise?: Promise<void>;

  private constructor() {
    this.config = new Config();
    this.syncIntervalMs = parseInt(
      this.config.get('DATABASE_SYNC_INTERVAL_MS'),
      10
    );

    const dbPath = this.config.get('DATABASE_PATH');
    const dbDir = path.dirname(dbPath);

    // 🧱 Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 🧩 Ensure database file exists
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, '');
    }

    this.db = new Database(dbPath);

    this.http = new HttpClient(this.config.get('API_URL'), {
      Authorization: `Bearer ${this.config.get('TRUSTED_CLIENT_AUTH_TOKEN')}`,
    });
  }

  public static getInstance(): LocalDatabase {
    if (!LocalDatabase.instance) {
      LocalDatabase.instance = new LocalDatabase();
    }
    return LocalDatabase.instance;
  }

  // 🟢 Initialize tables and perform first sync
  public async ready(): Promise<void> {
    if (this.readyPromise) return this.readyPromise; // Avoid double init

    this.readyPromise = (async () => {
      console.log('[LocalDB] 🧱 Initializing local database...');
      this.createTables();
      await this.fetchAndStoreAll();
      this.startSyncSchedule();
      console.log('[LocalDB] ✅ Ready and scheduled for periodic sync.');
    })();

    return this.readyPromise;
  }

  // 🧱 Create all required tables
  private createTables() {
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS artists (
          id TEXT PRIMARY KEY,
          name TEXT,
          type TEXT,
          website TEXT,
          webmail_url TEXT,
          webmail_email TEXT,
          webmail_password TEXT,
          logos TEXT,
          favicons TEXT
        )`
      )
      .run();

    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS descriptions (
          id TEXT PRIMARY KEY,
          artistId TEXT,
          description TEXT,
          imageGallery TEXT
        )`
      )
      .run();

    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS shops (
          id TEXT PRIMARY KEY,
          artistId TEXT,
          name TEXT,
          website TEXT,
          imageGallery TEXT,
          shopFeed TEXT
        )`
      )
      .run();

    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS socials (
          id TEXT PRIMARY KEY,
          artistId TEXT,
          name TEXT,
          description TEXT,
          url TEXT,
          originalUrl TEXT,
          socialLabelsList TEXT
        )`
      )
      .run();
  }

  // 🔁 Fetch all from API and store locally
  private async fetchAndStoreAll() {
    console.log('[LocalDB] 🔄 Syncing with main API...');
    try {
      const artistsRes = await this.http.get<Artist[]>('/artists');
      const artists = artistsRes.status === 200 ? artistsRes.body : [];

      if (!artists.length) {
        console.warn('[LocalDB] ⚠️ No artists received from API');
        return;
      }

      let totalDescriptions = 0;
      let totalSocials = 0;
      let totalShops = 0;

      for (const artist of artists) {
        this.upsertArtist(artist);

        // Fetch each set in parallel
        const [descRes, socialsRes, shopRes] = await Promise.all([
          this.http.get<Description>(`/descriptions?artistId=${artist.id}`),
          this.http.get<Social[]>(`/socials?artistId=${artist.id}`),
          this.http.get<Shop>(`/shops?artistId=${artist.id}`),
        ]);

        const desc = descRes.status === 200 ? descRes.body : null;

        const socials = socialsRes.body;

        const shop = shopRes.status === 200 ? shopRes.body : null;

        const insertTx = this.db.transaction(() => {
          if (desc) {
            this.upsertDescription(desc);
            totalDescriptions++;
          }
          for (const s of socials) this.upsertSocial(s, artist.id);
          totalSocials += socials.length;
          if (shop) {
            this.upsertShop(shop);
            totalShops++;
          }
        });

        insertTx();
      }

      console.log(
        `[LocalDB] ✅ Synced ${artists.length} artists, ${totalDescriptions} descriptions, ${totalSocials} socials, ${totalShops} shops`
      );
    } catch (err: any) {
      console.warn(`[LocalDB] ❌ Sync failed: ${err.message}`);
    }
  }

  // 🔁 Schedule background sync
  private startSyncSchedule() {
    const runSync = async () => {
      if (this.syncing) return;
      this.syncing = true;
      await this.fetchAndStoreAll();
      this.syncing = false;
      setTimeout(runSync, this.syncIntervalMs);
    };
    setTimeout(runSync, this.syncIntervalMs);
  }

  // 🧩 Upsert helpers
  private upsertArtist(artist: Artist) {
    const stmt = this.db.prepare(`
      INSERT INTO artists (id, name, type, website, webmail_url, webmail_email, webmail_password, logos, favicons)
      VALUES (@id, @name, @type, @website, @webmail_url, @webmail_email, @webmail_password, @logos, @favicons)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        type=excluded.type,
        website=excluded.website,
        webmail_url=excluded.webmail_url,
        webmail_email=excluded.webmail_email,
        webmail_password=excluded.webmail_password,
        logos=excluded.logos,
        favicons=excluded.favicons
    `);
    stmt.run({
      ...artist,
      webmail_url: artist.webmail?.url || '',
      webmail_email: artist.webmail?.email || '',
      webmail_password: artist.webmail?.password || '',
      logos: JSON.stringify(artist.logos),
      favicons: JSON.stringify(artist.favicons),
    });
  }

  private upsertDescription(desc: Description) {
    const stmt = this.db.prepare(`
      INSERT INTO descriptions (id, artistId, description, imageGallery)
      VALUES (@id, @artistId, @description, @imageGallery)
      ON CONFLICT(id) DO UPDATE SET
        description=excluded.description,
        imageGallery=excluded.imageGallery
    `);
    stmt.run({
      ...desc,
      imageGallery: JSON.stringify(desc.imageGallery),
    });
  }

  private upsertShop(shop: Shop) {
    const stmt = this.db.prepare(`
      INSERT INTO shops (id, artistId, name, website, imageGallery, shopFeed)
      VALUES (@id, @artistId, @name, @website, @imageGallery, @shopFeed)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        website=excluded.website,
        imageGallery=excluded.imageGallery,
        shopFeed=excluded.shopFeed
    `);
    stmt.run({
      ...shop,
      imageGallery: JSON.stringify(shop.imageGallery),
    });
  }

  private upsertSocial(social: Social, artistId: string) {
    const stmt = this.db.prepare(`
      INSERT INTO socials (id, artistId, name, description, url, originalUrl, socialLabelsList)
      VALUES (@id, @artistId, @name, @description, @url, @originalUrl, @socialLabelsList)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        description=excluded.description,
        url=excluded.url,
        originalUrl=excluded.originalUrl,
        socialLabelsList=excluded.socialLabelsList
    `);
    stmt.run({
      ...social,
      artistId,
      socialLabelsList: JSON.stringify(social.socialLabelsList),
    });
  }

  // 🔍 Query helpers
  public getArtistByWebsite(host: string): Artist | null {
    const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const row = this.db
      .prepare('SELECT * FROM artists WHERE website LIKE ?')
      .get(`%${cleanHost}%`) as ArtistRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      type: row.type as any,
      website: row.website,
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
      .prepare('SELECT * FROM descriptions WHERE artistId = ?')
      .get(artistId) as DescriptionRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      artistId: row.artistId,
      description: row.description,
      imageGallery: JSON.parse(row.imageGallery || '[]'),
    };
  }

  public getSocials(artistId: string): Social[] {
    const rows = this.db
      .prepare('SELECT * FROM socials WHERE artistId = ?')
      .all(artistId) as SocialRow[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      url: r.url,
      originalUrl: r.originalUrl,
      socialLabelsList: JSON.parse(r.socialLabelsList || '[]'),
    }));
  }

  public getAllArtists(): Artist[] {
    const rows = this.db.prepare('SELECT * FROM artists').all() as ArtistRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as any,
      website: row.website,
      webmail: {
        url: row.webmail_url,
        email: row.webmail_email,
        password: row.webmail_password,
      },
      logos: JSON.parse(row.logos || '[]'),
      favicons: JSON.parse(row.favicons || '[]'),
    }));
  }

  public getAllShops(): Shop[] {
    const rows = this.db.prepare('SELECT * FROM shops').all() as {
      id: string;
      artistId: string;
      name: string;
      website: string;
      imageGallery: string;
      shopFeed: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      artistId: row.artistId,
      name: row.name,
      website: row.website,
      imageGallery: JSON.parse(row.imageGallery || '[]'),
      shopFeed: row.shopFeed,
    }));
  }
}
