import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loggerService } from './logger.service.js';
import { getErrorMessage } from '../../shared/utils/error.utils.js';

export interface WallpaperRequestOptions {
  nextArchive?: boolean;
  currentArchiveIndex?: number;
}

export interface WallpaperResult {
  success: boolean;
  dataUrl: string | null;
  source: 'bing' | 'cache' | 'fallback';
  archiveIndex: number;
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
  source: 'bing';
  archiveIndex: number;
  imageUrl: string;
  title: string;
  description: string;
  author: string;
  originUrl: string;
}

interface WallpaperCacheMetadata {
  source: WallpaperCandidate['source'];
  archiveIndex: number;
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
  title?: unknown;
  copyright?: unknown;
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
const BING_ARCHIVE_LIMIT = 10;
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

function getLegacyMetadataPath(dateKey: string): string {
  return path.join(getCacheDirectory(), `${dateKey}-bing.json`);
}

function getMetadataPath(dateKey: string, archiveIndex: number): string {
  return path.join(getCacheDirectory(), `${dateKey}-bing-${normalizeArchiveIndex(archiveIndex)}.json`);
}

function getImageExtension(mimeType: string): string {
  return mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp'
      ? 'webp'
      : 'jpg';
}

function createImageFileName(dateKey: string, archiveIndex: number, mimeType: string): string {
  return `${dateKey}-bing-${normalizeArchiveIndex(archiveIndex)}.${getImageExtension(mimeType)}`;
}

function createDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function normalizeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeArchiveIndex(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < BING_ARCHIVE_LIMIT
    ? value
    : 0;
}

function getNextArchiveIndex(currentArchiveIndex: unknown): number {
  return (normalizeArchiveIndex(currentArchiveIndex) + 1) % BING_ARCHIVE_LIMIT;
}

function isWallpaperCacheMetadata(value: unknown): value is WallpaperCacheMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const metadata = value as Record<string, unknown>;
  return metadata.source === 'bing'
    && typeof metadata.title === 'string'
    && typeof metadata.description === 'string'
    && typeof metadata.author === 'string'
    && typeof metadata.originUrl === 'string'
    && typeof metadata.date === 'string'
    && typeof metadata.mimeType === 'string'
    && typeof metadata.fileName === 'string'
    && metadata.width === WALLPAPER_WIDTH
    && metadata.height === WALLPAPER_HEIGHT
    && typeof metadata.refreshedAt === 'number'
    && (metadata.archiveIndex === undefined || typeof metadata.archiveIndex === 'number');
}

function isWallpaperMetadataFile(fileName: string): boolean {
  return /^\d{4}-\d{2}-\d{2}-bing(?:-\d+)?\.json$/.test(fileName)
    || /^\d{4}-\d{2}-\d{2}\.json$/.test(fileName);
}

function getBingArchiveUrl(archiveIndex: number): string {
  const normalizedArchiveIndex = normalizeArchiveIndex(archiveIndex);
  return `${BING_BASE_URL}/HPImageArchive.aspx?format=js&idx=${normalizedArchiveIndex}&n=1&mkt=zh-CN`;
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

function isTrustedBingImageUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'https:'
      && (parsedUrl.hostname === 'www.bing.com' || parsedUrl.hostname === 'bing.com')
      && parsedUrl.pathname === '/th';
  } catch {
    return false;
  }
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

async function getBingCandidate(archiveIndex: number): Promise<WallpaperCandidate> {
  const normalizedArchiveIndex = normalizeArchiveIndex(archiveIndex);
  const data = await readJson(getBingArchiveUrl(normalizedArchiveIndex));
  const image = parseBingImageItem(data);
  const rawUrl = normalizeText(image?.url);

  if (!image || !rawUrl) {
    throw new Error('Bing response did not include an image URL');
  }

  const imageUrl = normalizeBingImageSize(rawUrl.startsWith('http') ? rawUrl : `${BING_BASE_URL}${rawUrl}`);
  const title = normalizeText(image.title, 'Bing Daily Wallpaper');
  const description = normalizeText(image.copyright, title);

  return {
    source: 'bing',
    archiveIndex: normalizedArchiveIndex,
    imageUrl,
    title,
    description,
    author: 'Bing',
    originUrl: imageUrl,
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
    const originUrl = parsedMetadata.originUrl;

    if (!isTrustedBingImageUrl(originUrl)) {
      return null;
    }

    return {
      success: true,
      dataUrl: createDataUrl(buffer, parsedMetadata.mimeType),
      source: parsedMetadata.source,
      archiveIndex: normalizeArchiveIndex(parsedMetadata.archiveIndex),
      title: parsedMetadata.title,
      description: parsedMetadata.description,
      author: parsedMetadata.author,
      originUrl,
      date: parsedMetadata.date,
      cached: true,
      refreshedAt: parsedMetadata.refreshedAt,
    };
  } catch {
    return null;
  }
}

async function loadCachedBingWallpaper(dateKey: string, archiveIndex: number): Promise<WallpaperResult | null> {
  const normalizedArchiveIndex = normalizeArchiveIndex(archiveIndex);
  return readCachedWallpaper(getMetadataPath(dateKey, normalizedArchiveIndex))
    ?? (normalizedArchiveIndex === 0 ? readCachedWallpaper(getLegacyMetadataPath(dateKey)) : null);
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
  const fileName = createImageFileName(dateKey, candidate.archiveIndex, image.mimeType);
  const imagePath = path.join(getCacheDirectory(), fileName);
  const refreshedAt = Date.now();
  const metadata: WallpaperCacheMetadata = {
    source: candidate.source,
    archiveIndex: candidate.archiveIndex,
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
  await fs.writeFile(getMetadataPath(dateKey, candidate.archiveIndex), JSON.stringify(metadata, null, 2), 'utf-8');
  if (candidate.archiveIndex === 0) {
    await fs.writeFile(getLegacyMetadataPath(dateKey), JSON.stringify(metadata, null, 2), 'utf-8');
  }

  return {
    success: true,
    dataUrl: createDataUrl(image.buffer, image.mimeType),
    source: candidate.source,
    archiveIndex: candidate.archiveIndex,
    title: candidate.title,
    description: candidate.description,
    author: candidate.author,
    originUrl: metadata.originUrl,
    date: dateKey,
    cached: false,
    refreshedAt,
  };
}

async function getBingWallpaper(dateKey: string, archiveIndex: number): Promise<WallpaperResult> {
  const cached = await loadCachedBingWallpaper(dateKey, archiveIndex);
  if (cached) {
    return cached;
  }

  const candidate = await getBingCandidate(archiveIndex);
  const image = await readImage(candidate.imageUrl);
  return writeWallpaperCache(dateKey, candidate, image);
}

export const wallpaperService = {
  async getDailyWallpaper(options: WallpaperRequestOptions = {}): Promise<WallpaperResult> {
    const dateKey = getTodayKey();
    const archiveIndex = options.nextArchive
      ? getNextArchiveIndex(options.currentArchiveIndex)
      : normalizeArchiveIndex(options.currentArchiveIndex);
    const failures: string[] = [];

    try {
      return await getBingWallpaper(dateKey, archiveIndex);
    } catch (error) {
      const message = getErrorMessage(error);
      failures.push(message);
      logger.warn('Wallpaper source failed', { archiveIndex, error: message });
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
      archiveIndex,
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
