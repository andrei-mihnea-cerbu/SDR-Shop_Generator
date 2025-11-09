import axios from 'axios';
import { imageSize } from 'image-size';
import fs from 'fs';

interface SeoHelperOptions {
  siteName: string;
  rootTitle: string;
  defaultPageTitle: string;
  indexHtmlPath: string;
  maintenanceHtmlPath: string;
  faviconUrl: string;
  isServerDown: boolean;
}

interface SeoRenderOptions {
  path: string;
  url: string;
  description: string;
  imageUrl: string;
  customTitleSegment?: string;
  analyticsId?: string;
}

export class SeoHelper {
  private siteName: string;
  private rootTitle: string;
  private defaultPageTitle: string;
  private indexHtmlPath: string;
  private maintenanceHtmlPath: string;
  private faviconUrl: string;
  private isServerDown: boolean;

  constructor({
    siteName,
    rootTitle,
    defaultPageTitle,
    indexHtmlPath,
    maintenanceHtmlPath,
    faviconUrl,
    isServerDown,
  }: SeoHelperOptions) {
    this.siteName = siteName;
    this.rootTitle = rootTitle;
    this.defaultPageTitle = defaultPageTitle;
    this.indexHtmlPath = indexHtmlPath;
    this.maintenanceHtmlPath = maintenanceHtmlPath;
    this.faviconUrl = faviconUrl;
    this.isServerDown = isServerDown;
  }

  formatTitle(pathSegment: string): string {
    return pathSegment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private async fetchImageMeta(
    url: string
  ): Promise<{ type: string; width: number; height: number }> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const dimensions = imageSize(response.data as Buffer);

      return {
        type: response.headers['content-type'] || 'image/png',
        width: dimensions.width ?? 1920,
        height: dimensions.height ?? 1080,
      };
    } catch (error: unknown) {
      console.error(
        `Error fetching image metadata for URL ${url}:`,
        (error as Error).message
      );
      return {
        type: 'image/png',
        width: 1920,
        height: 1080,
      };
    }
  }

  async renderHtml({
    path,
    url,
    description,
    imageUrl,
    customTitleSegment = '',
  }: SeoRenderOptions): Promise<string> {
    const isRoot = path === '/';
    const titleSegment = isRoot
      ? this.defaultPageTitle
      : this.formatTitle(path.split('/')[1] || '');
    const pageTitle = `${this.rootTitle} - ${customTitleSegment || titleSegment}`;

    const { type, width, height } = await this.fetchImageMeta(imageUrl);
    const metaTags = `
    <meta name="description" content="${description}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${this.siteName}">
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:height" content="${height}">
    <meta property="og:image:width" content="${width}">
    <meta property="og:image:type" content="${type}">`;

    let html = fs.readFileSync(
      this.isServerDown ? this.maintenanceHtmlPath : this.indexHtmlPath,
      'utf8'
    );
    html = html.replace('{metaTags}', metaTags);
    html = html.replace('{favicon_url}', this.faviconUrl);
    if (!this.isServerDown) html = html.replace('{title}', pageTitle);

    return html;
  }
}
