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

interface PicsumListItem {
  id: string;
  author: string;
}

interface PicsumPoolEntry {
  id: string;
  title: string;
  description: string;
  author: string;
  originUrl: string;
  mimeType: string;
  fileName: string;
  width: number;
  height: number;
  refreshedAt: number;
}

interface PicsumPoolMetadata {
  version: number;
  currentIndex: number;
  entries: PicsumPoolEntry[];
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
const PICSUM_BASE_URL = 'https://picsum.photos';
const PICSUM_POOL_SIZE = 10;
const PICSUM_POOL_VERSION = 1;
const PICSUM_POOL_METADATA_FILE = 'picsum_pool.json';
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

function getPicsumPoolMetadataPath(): string {
  return path.join(getCacheDirectory(), PICSUM_POOL_METADATA_FILE);
}

function getImageExtension(mimeType: string): string {
  return mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp'
      ? 'webp'
      : 'jpg';
}

function sanitizeCacheSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function createImageFileName(dateKey: string, source: WallpaperCandidate['source'], mimeType: string): string {
  return `${dateKey}-${source}.${getImageExtension(mimeType)}`;
}

function createPicsumPoolFileName(id: string, mimeType: string): string {
  return `picsum-${sanitizeCacheSegment(id)}.${getImageExtension(mimeType)}`;
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

function isPicsumPoolEntry(value: unknown): value is PicsumPoolEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string'
    && typeof entry.title === 'string'
    && typeof entry.description === 'string'
    && typeof entry.author === 'string'
    && typeof entry.originUrl === 'string'
    && typeof entry.mimeType === 'string'
    && typeof entry.fileName === 'string'
    && entry.width === WALLPAPER_WIDTH
    && entry.height === WALLPAPER_HEIGHT
    && typeof entry.refreshedAt === 'number';
}

function isPicsumPoolMetadata(value: unknown): value is PicsumPoolMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const metadata = value as Record<string, unknown>;
  return metadata.version === PICSUM_POOL_VERSION
    && typeof metadata.currentIndex === 'number'
    && Array.isArray(metadata.entries)
    && metadata.entries.length === PICSUM_POOL_SIZE
    && metadata.entries.every((entry) => isPicsumPoolEntry(entry))
    && typeof metadata.refreshedAt === 'number';
}

function isWallpaperMetadataFile(fileName: string): boolean {
  return /^\d{4}-\d{2}-\d{2}-(?:bing|picsum)\.json$/.test(fileName)
    || /^\d{4}-\d{2}-\d{2}\.json$/.test(fileName);
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

function parsePicsumList(data: unknown): PicsumListItem[] {
  if (!Array.isArray(data)) {
    throw new Error('Picsum response was not a list');
  }

  return data
    .map((item): PicsumListItem | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const entry = item as Record<string, unknown>;
      const id = normalizeText(entry.id);
      if (!id) {
        return null;
      }

      return {
        id,
        author: normalizeText(entry.author, 'Picsum Photos'),
      };
    })
    .filter((item): item is PicsumListItem => item !== null)
    .slice(0, PICSUM_POOL_SIZE);
}

function normalizeBingOriginUrl(value: string, fallbackUrl: string): string {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return fallbackUrl;
  }

  if (normalizedValue.startsWith('http://') || normalizedValue.startsWith('https://')) {
    return normalizedValue;
  }

  try {
    return new URL(normalizedValue, BING_BASE_URL).toString();
  } catch {
    return fallbackUrl;
  }
}

function isTrustedBingOriginUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'https:' && (parsedUrl.hostname === 'www.bing.com' || parsedUrl.hostname === 'bing.com');
  } catch {
    return false;
  }
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
  const originUrl = normalizeBingOriginUrl(originPath, imageUrl);

  return {
    source: 'bing',
    imageUrl,
    title,
    description,
    author: 'Bing',
    originUrl,
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

function createPicsumCandidate(item: PicsumListItem): WallpaperCandidate {
  return {
    source: 'picsum',
    imageUrl: `${PICSUM_BASE_URL}/id/${encodeURIComponent(item.id)}/${WALLPAPER_WIDTH}/${WALLPAPER_HEIGHT}`,
    title: `Picsum ${item.id}`,
    description: `Photo by ${item.author}`,
    author: item.author,
    originUrl: `${PICSUM_BASE_URL}/id/${encodeURIComponent(item.id)}/info`,
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

    if (parsedMetadata.source === 'bing' && !isTrustedBingOriginUrl(originUrl)) {
      return null;
    }

    return {
      success: true,
      dataUrl: createDataUrl(buffer, parsedMetadata.mimeType),
      source: parsedMetadata.source,
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

async function loadCachedWallpaper(dateKey: string, source: WallpaperCandidate['source']): Promise<WallpaperResult | null> {
  return readCachedWallpaper(getMetadataPath(dateKey, source));
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

function createWallpaperResultFromPicsumEntry(entry: PicsumPoolEntry, buffer: Buffer, cached: boolean): WallpaperResult {
  return {
    success: true,
    dataUrl: createDataUrl(buffer, entry.mimeType),
    source: 'picsum',
    title: entry.title,
    description: entry.description,
    author: entry.author,
    originUrl: entry.originUrl,
    date: 'picsum-pool',
    cached,
    refreshedAt: entry.refreshedAt,
  };
}

async function readPicsumPoolMetadata(): Promise<PicsumPoolMetadata | null> {
  try {
    const content = await fs.readFile(getPicsumPoolMetadataPath(), 'utf-8');
    const parsed = JSON.parse(content);
    if (!isPicsumPoolMetadata(parsed)) {
      return null;
    }

    for (const entry of parsed.entries) {
      await fs.access(path.join(getCacheDirectory(), entry.fileName));
    }

    return parsed;
  } catch {
    return null;
  }
}

async function writePicsumPoolMetadata(metadata: PicsumPoolMetadata): Promise<void> {
  await fs.mkdir(getCacheDirectory(), { recursive: true });
  await fs.writeFile(getPicsumPoolMetadataPath(), JSON.stringify(metadata, null, 2), 'utf-8');
}

async function buildPicsumPool(): Promise<PicsumPoolMetadata> {
  const data = await readJson(`${PICSUM_BASE_URL}/v2/list?page=1&limit=${PICSUM_POOL_SIZE}`);
  const list = parsePicsumList(data);
  if (list.length < PICSUM_POOL_SIZE) {
    throw new Error(`Picsum returned ${list.length} images`);
  }

  await fs.mkdir(getCacheDirectory(), { recursive: true });
  const entries: PicsumPoolEntry[] = [];

  for (const item of list) {
    const candidate = createPicsumCandidate(item);
    const image = await readImage(candidate.imageUrl);
    const fileName = createPicsumPoolFileName(item.id, image.mimeType);
    await fs.writeFile(path.join(getCacheDirectory(), fileName), image.buffer);

    entries.push({
      id: item.id,
      title: candidate.title,
      description: candidate.description,
      author: candidate.author,
      originUrl: candidate.originUrl,
      mimeType: image.mimeType,
      fileName,
      width: WALLPAPER_WIDTH,
      height: WALLPAPER_HEIGHT,
      refreshedAt: Date.now(),
    });
  }

  const metadata: PicsumPoolMetadata = {
    version: PICSUM_POOL_VERSION,
    currentIndex: 0,
    entries,
    refreshedAt: Date.now(),
  };
  await writePicsumPoolMetadata(metadata);
  return metadata;
}

async function getPicsumPool(): Promise<PicsumPoolMetadata> {
  const cached = await readPicsumPoolMetadata();
  return cached ?? buildPicsumPool();
}

async function getPicsumWallpaper(index: number, updateIndex: boolean): Promise<WallpaperResult> {
  const pool = await getPicsumPool();
  const normalizedIndex = ((index % pool.entries.length) + pool.entries.length) % pool.entries.length;
  const entry = pool.entries[normalizedIndex];
  const buffer = await fs.readFile(path.join(getCacheDirectory(), entry.fileName));

  if (updateIndex && pool.currentIndex !== normalizedIndex) {
    await writePicsumPoolMetadata({
      ...pool,
      currentIndex: normalizedIndex,
    });
  }

  return createWallpaperResultFromPicsumEntry(entry, buffer, true);
}

async function getBingWallpaper(dateKey: string): Promise<WallpaperResult> {
  const cached = await loadCachedWallpaper(dateKey, 'bing');
  if (cached) {
    return cached;
  }

  const candidate = await getBingCandidate();
  const image = await readImage(candidate.imageUrl);
  return writeWallpaperCache(dateKey, candidate, image);
}

async function getNextWallpaper(currentSource: WallpaperResult['source'] | undefined, dateKey: string): Promise<WallpaperResult> {
  if (currentSource === 'picsum') {
    const pool = await getPicsumPool();
    const nextIndex = pool.currentIndex + 1;
    if (nextIndex >= pool.entries.length) {
      return getBingWallpaper(dateKey);
    }

    return getPicsumWallpaper(nextIndex, true);
  }

  return getPicsumWallpaper(0, true);
}

export const wallpaperService = {
  async getDailyWallpaper(options: WallpaperRequestOptions = {}): Promise<WallpaperResult> {
    const dateKey = getTodayKey();

    const failures: string[] = [];

    try {
      return options.switchSource
        ? await getNextWallpaper(options.currentSource, dateKey)
        : await getBingWallpaper(dateKey);
    } catch (error) {
      const message = getErrorMessage(error);
      failures.push(message);
      logger.warn('Wallpaper source failed', { error: message });
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
