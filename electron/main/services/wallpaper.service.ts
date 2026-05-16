import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loggerService } from './logger.service.js';
import { getErrorMessage } from '../../shared/utils/error.utils.js';

export interface WallpaperRequestOptions {
  switchSource?: boolean;
  currentSource?: WallpaperResult['source'];
}

export interface WallpaperResult {
  success: boolean;
  dataUrl: string | null;
  source: 'bing' | 'picsum' | 'cache' | 'fallback';
  title: string;
  description: string;
  author: string;
  originUrl: string;
  date: string;
  cached: boolean;
  refreshedAt: number;
  error?: string;
}

interface WallpaperCandidate {
  source: 'bing' | 'picsum';
  imageUrl: string;
  title: string;
  description: string;
  author: string;
  originUrl: string;
}

interface WallpaperCacheMetadata {
  source: WallpaperCandidate['source'];
  title: string;
  description: string;
  author: string;
  originUrl: string;
  date: string;
  mimeType: string;
  fileName: string;
  width: number;
  height: number;
  refreshedAt: number;
}

interface BingImageItem {
  url?: unknown;
  urlbase?: unknown;
  title?: unknown;
  copyright?: unknown;
  copyrightlink?: unknown;
}

interface BingArchiveResponse {
  images?: unknown;
}

const logger = loggerService.createLogger('Electron:Wallpaper Service');
const CACHE_DIR_NAME = 'wallpaper_cache';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const WALLPAPER_WIDTH = 897;
const WALLPAPER_HEIGHT = 408;
const BING_BASE_URL = 'https://www.bing.com';
const BING_ARCHIVE_URL = `${BING_BASE_URL}/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN`;
const DEFAULT_DESCRIPTION = 'Daily wallpaper';

function getCacheDirectory(): string {
  return path.join(app.getPath('userData'), CACHE_DIR_NAME);
}

function getTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMetadataPath(dateKey: string, source: WallpaperCandidate['source']): string {
  return path.join(getCacheDirectory(), `${dateKey}-${source}.json`);
}

function createImageFileName(dateKey: string, source: WallpaperCandidate['source'], mimeType: string): string {
  const extension = mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp'
      ? 'webp'
      : 'jpg';

  return `${dateKey}-${source}.${extension}`;
}

function createDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function isWallpaperSource(value: unknown): value is WallpaperCandidate['source'] {
  return value === 'bing' || value === 'picsum';
}

function normalizeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function isWallpaperCacheMetadata(value: unknown): value is WallpaperCacheMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const metadata = value as Record<string, unknown>;
  return isWallpaperSource(metadata.source)
    && typeof metadata.title === 'string'
    && typeof metadata.description === 'string'
    && typeof metadata.author === 'string'
    && typeof metadata.originUrl === 'string'
    && typeof metadata.date === 'string'
    && typeof metadata.mimeType === 'string'
    && typeof metadata.fileName === 'string'
    && metadata.width === WALLPAPER_WIDTH
    && metadata.height === WALLPAPER_HEIGHT
    && typeof metadata.refreshedAt === 'number';
}

function isWallpaperMetadataFile(fileName: string): boolean {
  return /^\d{4}-\d{2}-\d{2}-(?:bing|picsum)\.json$/.test(fileName)
    || /^\d{4}-\d{2}-\d{2}\.json$/.test(fileName);
}

function isWallpaperMetadataFileForDate(fileName: string, dateKey: string): boolean {
  return fileName === `${dateKey}.json` || fileName.startsWith(`${dateKey}-`);
}

async function readJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': `${app.getName()}/${app.getVersion()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function readImage(url: string): Promise<{ buffer: Buffer; mimeType: string; finalUrl: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
        'user-agent': `${app.getName()}/${app.getVersion()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Image request failed with status ${response.status}`);
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!mimeType.startsWith('image/')) {
      throw new Error(`Expected image response but received ${mimeType || 'unknown content type'}`);
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image is too large: ${contentLength} bytes`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Image response is empty');
    }

    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image is too large: ${arrayBuffer.byteLength} bytes`);
    }

    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType,
      finalUrl: response.url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseBingImageItem(data: unknown): BingImageItem | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const response = data as BingArchiveResponse;
  if (!Array.isArray(response.images) || response.images.length === 0) {
    return null;
  }

  const firstImage = response.images[0];
  return firstImage && typeof firstImage === 'object' ? firstImage as BingImageItem : null;
}

async function getBingCandidate(): Promise<WallpaperCandidate> {
  const data = await readJson(BING_ARCHIVE_URL);
  const image = parseBingImageItem(data);
  const rawUrl = normalizeText(image?.url);

  if (!image || !rawUrl) {
    throw new Error('Bing response did not include an image URL');
  }

  const imageUrl = normalizeBingImageSize(rawUrl.startsWith('http') ? rawUrl : `${BING_BASE_URL}${rawUrl}`);
  const originPath = normalizeText(image.copyrightlink);
  const title = normalizeText(image.title, 'Bing Daily Wallpaper');
  const description = normalizeText(image.copyright, title);

  return {
    source: 'bing',
    imageUrl,
    title,
    description,
    author: 'Bing',
    originUrl: originPath ? `${BING_BASE_URL}${originPath}` : imageUrl,
  };
}

function normalizeBingImageSize(imageUrl: string): string {
  try {
    const parsedUrl = new URL(imageUrl);
    parsedUrl.searchParams.set('w', String(WALLPAPER_WIDTH));
    parsedUrl.searchParams.set('h', String(WALLPAPER_HEIGHT));
    parsedUrl.searchParams.set('rs', '1');
    parsedUrl.searchParams.set('c', '4');
    return parsedUrl.toString();
  } catch {
    return imageUrl;
  }
}

async function getPicsumCandidate(dateKey = getTodayKey()): Promise<WallpaperCandidate> {
  return {
    source: 'picsum',
    imageUrl: `https://picsum.photos/seed/${dateKey}/${WALLPAPER_WIDTH}/${WALLPAPER_HEIGHT}`,
    title: `Picsum ${dateKey}`,
    description: 'Daily seeded image from Picsum Photos',
    author: 'Picsum Photos',
    originUrl: 'https://picsum.photos',
  };
}

async function readCachedWallpaper(metadataPath: string): Promise<WallpaperResult | null> {
  try {
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const parsedMetadata = JSON.parse(metadataContent);
    if (!isWallpaperCacheMetadata(parsedMetadata)) {
      return null;
    }

    const imagePath = path.join(getCacheDirectory(), parsedMetadata.fileName);
    const buffer = await fs.readFile(imagePath);

    return {
      success: true,
      dataUrl: createDataUrl(buffer, parsedMetadata.mimeType),
      source: parsedMetadata.source,
      title: parsedMetadata.title,
      description: parsedMetadata.description,
      author: parsedMetadata.author,
      originUrl: parsedMetadata.originUrl,
      date: parsedMetadata.date,
      cached: true,
      refreshedAt: parsedMetadata.refreshedAt,
    };
  } catch {
    return null;
  }
}

async function loadCachedWallpaper(dateKey: string, source: WallpaperCandidate['source']): Promise<WallpaperResult | null> {
  return readCachedWallpaper(getMetadataPath(dateKey, source));
}

async function findLatestCachedWallpaperForDate(dateKey: string): Promise<WallpaperResult | null> {
  try {
    const entries = await fs.readdir(getCacheDirectory());
    const metadataFiles = entries
      .filter((entry) => isWallpaperMetadataFileForDate(entry, dateKey) && isWallpaperMetadataFile(entry));
    let latestCached: WallpaperResult | null = null;

    for (const metadataFile of metadataFiles) {
      const cached = await readCachedWallpaper(path.join(getCacheDirectory(), metadataFile));
      if (cached) {
        latestCached = !latestCached || cached.refreshedAt > latestCached.refreshedAt ? cached : latestCached;
      }
    }

    return latestCached;
  } catch {
    return null;
  }
}

async function findLatestCachedWallpaper(): Promise<WallpaperResult | null> {
  try {
    const entries = await fs.readdir(getCacheDirectory());
    const metadataFiles = entries.filter((entry) => isWallpaperMetadataFile(entry));
    let latestCached: WallpaperResult | null = null;

    for (const metadataFile of metadataFiles) {
      const cached = await readCachedWallpaper(path.join(getCacheDirectory(), metadataFile));
      if (cached) {
        latestCached = !latestCached || cached.refreshedAt > latestCached.refreshedAt ? cached : latestCached;
      }
    }

    return latestCached
      ? {
        ...latestCached,
        source: 'cache',
        cached: true,
      }
      : null;
  } catch {
    return null;
  }
}

async function writeWallpaperCache(
  dateKey: string,
  candidate: WallpaperCandidate,
  image: { buffer: Buffer; mimeType: string; finalUrl: string },
): Promise<WallpaperResult> {
  await fs.mkdir(getCacheDirectory(), { recursive: true });
  const fileName = createImageFileName(dateKey, candidate.source, image.mimeType);
  const imagePath = path.join(getCacheDirectory(), fileName);
  const refreshedAt = Date.now();
  const metadata: WallpaperCacheMetadata = {
    source: candidate.source,
    title: candidate.title,
    description: candidate.description,
    author: candidate.author,
    originUrl: candidate.originUrl || image.finalUrl,
    date: dateKey,
    mimeType: image.mimeType,
    fileName,
    width: WALLPAPER_WIDTH,
    height: WALLPAPER_HEIGHT,
    refreshedAt,
  };

  await fs.writeFile(imagePath, image.buffer);
  await fs.writeFile(getMetadataPath(dateKey, candidate.source), JSON.stringify(metadata, null, 2), 'utf-8');

  return {
    success: true,
    dataUrl: createDataUrl(image.buffer, image.mimeType),
    source: candidate.source,
    title: candidate.title,
    description: candidate.description,
    author: candidate.author,
    originUrl: metadata.originUrl,
    date: dateKey,
    cached: false,
    refreshedAt,
  };
}

const sourceLoaders: Array<(dateKey: string) => Promise<WallpaperCandidate>> = [
  () => getBingCandidate(),
  (dateKey: string) => getPicsumCandidate(dateKey),
];

function getRefreshSourceLoaders(currentSource: WallpaperResult['source'] | undefined): Array<(dateKey: string) => Promise<WallpaperCandidate>> {
  if (currentSource === 'bing') {
    return [
      (dateKey: string) => getPicsumCandidate(dateKey),
      () => getBingCandidate(),
    ];
  }
  if (currentSource === 'picsum') {
    return [
      () => getBingCandidate(),
      (dateKey: string) => getPicsumCandidate(dateKey),
    ];
  }

  return sourceLoaders;
}

export const wallpaperService = {
  async getDailyWallpaper(options: WallpaperRequestOptions = {}): Promise<WallpaperResult> {
    const dateKey = getTodayKey();

    if (!options.switchSource) {
      const cached = await findLatestCachedWallpaperForDate(dateKey);
      if (cached) {
        return cached;
      }
    }

    const failures: string[] = [];
    const loaders = options.switchSource
      ? getRefreshSourceLoaders(options.currentSource)
      : sourceLoaders;

    for (const loadCandidate of loaders) {
      try {
        const candidate = await loadCandidate(dateKey);
        const cached = await loadCachedWallpaper(dateKey, candidate.source);
        if (cached) {
          return cached;
        }

        const image = await readImage(candidate.imageUrl);
        return await writeWallpaperCache(dateKey, candidate, image);
      } catch (error) {
        const message = getErrorMessage(error);
        failures.push(message);
        logger.warn('Wallpaper source failed', { error: message });
      }
    }

    const latestCached = await findLatestCachedWallpaper();
    if (latestCached) {
      return {
        ...latestCached,
        error: failures.join('; '),
      };
    }

    return {
      success: false,
      dataUrl: null,
      source: 'fallback',
      title: 'Default wallpaper',
      description: DEFAULT_DESCRIPTION,
      author: app.getName(),
      originUrl: '',
      date: dateKey,
      cached: false,
      refreshedAt: Date.now(),
      error: failures.join('; '),
    };
  },
};
