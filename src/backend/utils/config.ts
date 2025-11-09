// src/backend/config/config.service.ts
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

export class Config {
  private readonly config: Record<string, string>;

  constructor(envPath = path.resolve(__dirname, '../../../.env')) {
    dotenv.config({ path: envPath });

    const schema = z.object({
      SERVER_MAINTENANCE_MODE: z.string().default('false'),
      HOST: z.string().default('0.0.0.0'),
      PORT: z.string().default('80'),
      CORS_ALLOWED: z.string(),

      INDEX_HTML_PATH: z.string(),
      MAINTENANCE_HTML_PATH: z.string(),

      API_URL: z.string(),
      API_AUTH_TOKEN: z.string(),

      STATIC_DIR: z.string(),
      ASSETS_DIR: z.string(),

      DATABASE_PATH: z.string(),
      DATABASE_SYNC_INTERVAL_MS: z.string().default('300000'),

      S3_PUBLIC_BASE_URL: z.string().url(),
    });

    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      console.error('❌ Invalid environment variables:');
      console.error(parsed.error.format());
      process.exit(1);
    }

    this.config = parsed.data;
  }

  get(key: keyof typeof this.config): string {
    return this.config[key];
  }

  getAll(): Record<string, string> {
    return { ...this.config };
  }
}
