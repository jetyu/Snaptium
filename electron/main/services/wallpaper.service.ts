import { app, nativeImage } from 'electron';
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
const WALLPAPER_WIDTH = 1280;
const WALLPAPER_HEIGHT = 576;
const BING_UHD_WIDTH = 3840;
const BING_UHD_HEIGHT = 2160;
const BING_BASE_URL = 'https://www.bing.com';
const BING_ARCHIVE_LIMIT = 10;
const DEFAULT_DESCRIPTION = 'Daily wallpaper';
const MAX_WALLPAPER_TEXT_LENGTH = 512;
const ALLOWED_WALLPAPER_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const WALLPAPER_IMAGE_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}-bing-\d+\.(?:jpg|png|webp)$/;

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

function stripDisallowedControlChars(text: string): string {
  let output = '';

  for (const char of text) {
    const code = char.charCodeAt(0);
    const isAllowedWhitespace = code === 9 || code === 10 || code === 13;
    const isPrintable = code >= 32 && code !== 127;

    if (isAllowedWhitespace || isPrintable) {
      output += char;
    }
  }

  return output;
}

function sanitizeWallpaperText(value: unknown, fallback: string): string {
  const normalized = stripDisallowedControlChars(normalizeText(value, fallback)).trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, MAX_WALLPAPER_TEXT_LENGTH).trim() || fallback;
}

function isAllowedWallpaperMimeType(mimeType: string): boolean {
  return ALLOWED_WALLPAPER_MIME_TYPES.has(mimeType);
}

function isTrustedBingHost(hostname: string): boolean {
  return hostname === 'www.bing.com' || hostname === 'bing.com';
}

function isTrustedBingImageUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'https:'
      && isTrustedBingHost(parsedUrl.hostname)
      && parsedUrl.pathname === '/th'
      && (parsedUrl.searchParams.get('id') ?? '').length > 0
      && !parsedUrl.username
      && !parsedUrl.password;
  } catch {
    return false;
  }
}

function normalizeAndValidateBingOriginUrl(value: string): string {
  const normalizedUrl = normalizeBingOriginUrl(value);
  if (!isTrustedBingOriginUrl(normalizedUrl)) {
    throw new Error(`Untrusted Bing wallpaper origin URL: ${value}`);
  }

  return normalizedUrl;
}

function isWallpaperImageFileName(fileName: string): boolean {
  return WALLPAPER_IMAGE_FILE_PATTERN.test(fileName);
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
  return `${BING_BASE_URL}/HPImageArchive.aspx?format=js&idx=${normalizedArchiveIndex}&n=1&mkt=zh-CN&uhd=1&uhdwidth=${BING_UHD_WIDTH}&uhdheight=${BING_UHD_HEIGHT}`;
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
        accept: 'image/webp,image/png,image/jpeg,image/jpg,image/*;q=0.8',
        'user-agent': `${app.getName()}/${app.getVersion()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Image request failed with status ${response.status}`);
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!isAllowedWallpaperMimeType(mimeType)) {
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

function isTrustedBingOriginUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    const imageId = parsedUrl.searchParams.get('id') ?? '';
    return parsedUrl.protocol === 'https:'
      && (parsedUrl.hostname === 'www.bing.com' || parsedUrl.hostname === 'bing.com')
      && parsedUrl.pathname === '/th'
      && imageId.endsWith('_UHD.jpg')
      && !parsedUrl.searchParams.has('w')
      && !parsedUrl.searchParams.has('h')
      && !parsedUrl.searchParams.has('c');
  } catch {
    return false;
  }
}

function createAbsoluteBingImageUrl(imageUrl: string): string {
  return imageUrl.startsWith('http') ? imageUrl : `${BING_BASE_URL}${imageUrl}`;
}

function normalizeBingPreviewImageUrl(imageUrl: string): string {
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

function normalizeBingOriginUrl(imageUrl: string): string {
  try {
    const parsedUrl = new URL(imageUrl);
    const imageId = parsedUrl.searchParams.get('id');
    if (imageId) {
      parsedUrl.searchParams.set('id', imageId.replace(/_\d+x\d+\.jpg$/i, '_UHD.jpg'));
    }
    parsedUrl.searchParams.delete('w');
    parsedUrl.searchParams.delete('h');
    parsedUrl.searchParams.delete('rs');
    parsedUrl.searchParams.delete('c');
    parsedUrl.searchParams.delete('rf');
    return parsedUrl.toString();
  } catch {
    return imageUrl;
  }
}

function sanitizeWallpaperCandidate(candidate: WallpaperCandidate): WallpaperCandidate {
  const originUrl = normalizeAndValidateBingOriginUrl(candidate.originUrl);
  if (!isTrustedBingImageUrl(candidate.imageUrl)) {
    throw new Error(`Untrusted Bing wallpaper image URL: ${candidate.imageUrl}`);
  }

  if (normalizeAndValidateBingOriginUrl(candidate.imageUrl) !== originUrl) {
    throw new Error('Bing wallpaper image URL does not match the expected origin URL.');
  }

  return {
    ...candidate,
    title: sanitizeWallpaperText(candidate.title, 'Bing Daily Wallpaper'),
    description: sanitizeWallpaperText(candidate.description, DEFAULT_DESCRIPTION),
    author: sanitizeWallpaperText(candidate.author, 'Bing'),
    originUrl,
  };
}

function sanitizeDownloadedWallpaper(
  image: { buffer: Buffer; mimeType: string; finalUrl: string },
): { buffer: Buffer; mimeType: string; finalUrl: string } {
  const finalUrl = normalizeAndValidateBingOriginUrl(image.finalUrl);
  if (!isAllowedWallpaperMimeType(image.mimeType)) {
    throw new Error(`Unsupported Bing wallpaper MIME type: ${image.mimeType}`);
  }

  // Re-encode the downloaded image so cached files are derived from a decoded image,
  // not raw network bytes.
  const decodedImage = nativeImage.createFromBuffer(image.buffer);
  if (decodedImage.isEmpty()) {
    throw new Error('Downloaded Bing wallpaper image is invalid.');
  }

  const sanitizedImage = image.mimeType === 'image/png'
    ? {
      buffer: decodedImage.toPNG(),
      mimeType: 'image/png',
    }
    : {
      buffer: decodedImage.toJPEG(90),
      mimeType: 'image/jpeg',
    };

  if (sanitizedImage.buffer.length === 0) {
    throw new Error('Downloaded Bing wallpaper image could not be normalized.');
  }

  if (sanitizedImage.buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`Normalized Bing wallpaper image is too large: ${sanitizedImage.buffer.length} bytes`);
  }

  return {
    ...sanitizedImage,
    finalUrl,
  };
}

async function getBingCandidate(archiveIndex: number): Promise<WallpaperCandidate> {
  const normalizedArchiveIndex = normalizeArchiveIndex(archiveIndex);
  const data = await readJson(getBingArchiveUrl(normalizedArchiveIndex));
  const image = parseBingImageItem(data);
  const rawUrl = normalizeText(image?.url);

  if (!image || !rawUrl) {
    throw new Error('Bing response did not include an image URL');
  }

  const rawImageUrl = createAbsoluteBingImageUrl(rawUrl);
  const imageUrl = normalizeBingPreviewImageUrl(rawImageUrl);
  const originUrl = normalizeBingOriginUrl(rawImageUrl);
  const title = normalizeText(image.title, 'Bing Daily Wallpaper');
  const description = normalizeText(image.copyright, title);

  return {
    source: 'bing',
    archiveIndex: normalizedArchiveIndex,
    imageUrl,
    title,
    description,
    author: 'Bing',
    originUrl,
  };
}

async function readCachedWallpaper(metadataPath: string): Promise<WallpaperResult | null> {
  try {
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const parsedMetadata = JSON.parse(metadataContent);
    if (!isWallpaperCacheMetadata(parsedMetadata)) {
      return null;
    }

    if (!isAllowedWallpaperMimeType(parsedMetadata.mimeType) || !isWallpaperImageFileName(parsedMetadata.fileName)) {
      return null;
    }

    const imagePath = path.join(getCacheDirectory(), parsedMetadata.fileName);
    const buffer = await fs.readFile(imagePath);
    const originUrl = normalizeAndValidateBingOriginUrl(parsedMetadata.originUrl);

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
  const sanitizedCandidate = sanitizeWallpaperCandidate(candidate);
  const sanitizedImage = sanitizeDownloadedWallpaper(image);
  const fileName = createImageFileName(dateKey, sanitizedCandidate.archiveIndex, sanitizedImage.mimeType);
  const imagePath = path.join(getCacheDirectory(), fileName);
  const refreshedAt = Date.now();
  const metadata: WallpaperCacheMetadata = {
    source: sanitizedCandidate.source,
    archiveIndex: sanitizedCandidate.archiveIndex,
    title: sanitizedCandidate.title,
    description: sanitizedCandidate.description,
    author: sanitizedCandidate.author,
    originUrl: sanitizedCandidate.originUrl || sanitizedImage.finalUrl,
    date: dateKey,
    mimeType: sanitizedImage.mimeType,
    fileName,
    width: WALLPAPER_WIDTH,
    height: WALLPAPER_HEIGHT,
    refreshedAt,
  };

  await fs.writeFile(imagePath, sanitizedImage.buffer);
  await fs.writeFile(getMetadataPath(dateKey, sanitizedCandidate.archiveIndex), JSON.stringify(metadata, null, 2), 'utf-8');
  if (sanitizedCandidate.archiveIndex === 0) {
    await fs.writeFile(getLegacyMetadataPath(dateKey), JSON.stringify(metadata, null, 2), 'utf-8');
  }

  return {
    success: true,
    dataUrl: createDataUrl(sanitizedImage.buffer, sanitizedImage.mimeType),
    source: sanitizedCandidate.source,
    archiveIndex: sanitizedCandidate.archiveIndex,
    title: sanitizedCandidate.title,
    description: sanitizedCandidate.description,
    author: sanitizedCandidate.author,
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
