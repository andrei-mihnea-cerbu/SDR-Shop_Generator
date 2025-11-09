import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import compression from 'compression';

import { SeoHelper } from './utils/seo-helper';
import { Config } from './utils/config';
import { LocalDatabase } from './utils/local-database';

dotenv.config();

const config = new Config();
const db = LocalDatabase.getInstance();

const app = express();
app.use(express.json());

// 📁 Paths
const INDEX_HTML_PATH = config.get('INDEX_HTML_PATH');
const MAINTENANCE_HTML_PATH = config.get('MAINTENANCE_HTML_PATH');

// 🪣 S3 Bucket base URL
const S3_BASE_URL = config.get('S3_PUBLIC_BASE_URL');

// 🔒 CORS setup
function wildcardToRegex(domain: string): RegExp[] {
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const baseEscaped = clean.replace(/\./g, '\\.');
  return [
    new RegExp(`^https://${baseEscaped}$`, 'i'),
    new RegExp(`^https://www\\.${baseEscaped}$`, 'i'),
    new RegExp(`^https://[a-zA-Z0-9-]+\\.${baseEscaped}$`, 'i'),
    new RegExp(`^https://www\\.[a-zA-Z0-9-]+\\.${baseEscaped}$`, 'i'),
  ];
}

const corsAllowedRegex: RegExp[] = config
  .get('CORS_ALLOWED')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .flatMap(wildcardToRegex);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const match = corsAllowedRegex.find((regex) => regex.test(origin));
      if (match) return callback(null, true);
      console.error(`❌ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    allowedHeaders: '*',
  })
);

app.use((_, res, next) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use(compression());
app.disable('x-powered-by');

// 🖼 Static paths
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', '..', 'views'));
app.use('/assets', express.static(config.get('ASSETS_DIR')));
app.use(
  '/static',
  (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && corsAllowedRegex.some((regex) => regex.test(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    next();
  },
  express.static(config.get('STATIC_DIR'))
);

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// 🤖 Robots.txt
app.get('/robots.txt', (req: Request, res: Response) => {
  const baseUrl = `https://${req.hostname}`;
  res.type('text/plain');
  res.render('robots', { baseUrl });
});

// 🧠 Shop info endpoint
app.get('/info', async (req: Request, res: Response) => {
  let host = req.get('host') || '';
  host = host
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase();

  try {
    const allShops = db.getAllShops?.() || [];
    const shop = allShops.find((s) => s.website.includes(host));

    if (!shop) {
      console.warn(`❌ No shop found for host: ${host}`);
      res.status(404).json({ error: 'Shop not found' });
      return;
    }

    res.status(200).json(shop);
  } catch (error) {
    console.error('❌ Failed to get shop info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🌍 Catch-all for SEO rendering
app.get(/.*/, async (req: Request, res: Response) => {
  let host = req.get('host') || '';
  host = host
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase();

  const allShops = db.getAllShops?.() || [];
  const shop = allShops.find((s) => s.website.includes(host));

  if (!shop) {
    console.warn(`❌ No shop found for host: ${host}`);
    res.sendStatus(404);
    return;
  }

  // 🧩 Find artist and description
  const artist = db.getAllArtists?.().find((a) => a.id === shop.artistId);
  const artistDescription = db.getDescription(shop.artistId);

  if (!artist) {
    console.warn(`❌ No artist found for shop: ${shop.name}`);
    res.sendStatus(404);
    return;
  }

  const seo = new SeoHelper({
    siteName: `${shop.name} Shop`,
    rootTitle: shop.name,
    defaultPageTitle: 'Welcome',
    indexHtmlPath: INDEX_HTML_PATH,
    maintenanceHtmlPath: MAINTENANCE_HTML_PATH,
    faviconUrl: `https://${shop.website}/static/favicon.webp`,
    isServerDown: config.get('SERVER_MAINTENANCE_MODE') === 'true',
  });

  const url = `https://${req.get('host')}${req.originalUrl}`;

  // 🪣 Resolve image from S3 bucket (fallback to full URL)
  const rawImagePath = artistDescription?.imageGallery?.[0] || '';
  const encodedPath = encodeURI(rawImagePath);
  const imageUrl = `${S3_BASE_URL}/${encodedPath}`;

  let description = `Welcome to ${shop.name} — official shop of ${artist.name}. Discover exclusive merchandise and more!`;
  let customTitleSegment = '';

  if (req.path !== '/') {
    const formattedTitle = seo.formatTitle(req.path.split('/')[1] || '');
    description = `Explore '${formattedTitle}' on ${shop.name} Shop.`;
    customTitleSegment = formattedTitle;
  }

  const html = await seo.renderHtml({
    path: req.path,
    url,
    description,
    imageUrl,
    customTitleSegment,
  });

  res.send(html);
});

// 🚀 Startup
async function start() {
  await db.ready();

  const PORT = parseInt(config.get('PORT'));
  const HOST = config.get('HOST');

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server is running at http://${HOST}:${PORT}`);
  });
}

start();
