import path from 'node:path';
import zlib from 'node:zlib';
import { promises as fs } from 'node:fs';

const ZIP_SIGNATURES = Object.freeze({
  localFileHeader: 0x04034b50,
  centralDirectoryHeader: 0x02014b50,
  endOfCentralDirectory: 0x06054b50,
});

const ZIP_COMPRESSION_METHOD = Object.freeze({
  store: 0,
  deflate: 8,
});

const ZIP_GENERAL_PURPOSE_UTF8 = 0x0800;
const ZIP_VERSION = 20;
const ZIP_MAX_COMMENT_LENGTH = 0xffff;

interface CollectedDirectoryEntry {
  type: 'directory' | 'file';
  absolutePath: string;
  zipPath: string;
  modifiedAt: Date;
}

interface LocalHeaderMetadata {
  zipPath: string;
  compressionMethod: number;
  dosDate: number;
  dosTime: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
}

interface CentralHeaderMetadata extends LocalHeaderMetadata {
  externalFileAttributes: number;
  localHeaderOffset: number;
}

let crc32Table: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
  if (crc32Table) {
    return crc32Table;
  }

  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let current = i;
    for (let j = 0; j < 8; j += 1) {
      current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
    }
    crc32Table[i] = current >>> 0;
  }

  return crc32Table;
}

function computeCrc32(buffer: Buffer): number {
  const table = getCrc32Table();
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toZipPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = Math.max(1, date.getMonth() + 1);
  const day = Math.max(1, date.getDate());
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = Math.floor(date.getSeconds() / 2);

  const dosTime = (hour << 11) | (minute << 5) | second;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

function sanitizeArchiveEntryPath(entryPath: string): string {
  const normalized = String(entryPath ?? '').replace(/\\/g, '/');
  const hasTrailingSlash = normalized.endsWith('/');
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) {
    throw new Error(`Unsafe archive entry path: ${entryPath}`);
  }

  const segments = normalized.split('/').filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`Unsafe archive entry path: ${entryPath}`);
  }

  const joined = segments.join('/');
  return hasTrailingSlash ? `${joined}/` : joined;
}

function isPathInside(basePath: string, candidatePath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedCandidate = path.resolve(candidatePath);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function collectDirectoryEntries(
  currentAbsolutePath: string,
  currentZipPath: string,
  collectedEntries: CollectedDirectoryEntry[],
): Promise<void> {
  const stat = await fs.stat(currentAbsolutePath);
  const directoryZipPath = currentZipPath.endsWith('/') ? currentZipPath : `${currentZipPath}/`;
  collectedEntries.push({
    type: 'directory',
    absolutePath: currentAbsolutePath,
    zipPath: directoryZipPath,
    modifiedAt: stat.mtime,
  });

  const children = await fs.readdir(currentAbsolutePath, { withFileTypes: true });
  children.sort((left, right) => left.name.localeCompare(right.name, 'en'));

  for (const child of children) {
    const absoluteChildPath = path.join(currentAbsolutePath, child.name);
    const zipChildPath = `${directoryZipPath}${child.name}`;

    if (child.isDirectory()) {
      await collectDirectoryEntries(absoluteChildPath, zipChildPath, collectedEntries);
      continue;
    }

    if (!child.isFile()) {
      continue;
    }

    const childStat = await fs.stat(absoluteChildPath);
    collectedEntries.push({
      type: 'file',
      absolutePath: absoluteChildPath,
      zipPath: zipChildPath,
      modifiedAt: childStat.mtime,
    });
  }
}

async function buildZipEntries(sourceDirectoryPath: string, rootDirectoryName: string): Promise<CollectedDirectoryEntry[]> {
  const entries: CollectedDirectoryEntry[] = [];
  await collectDirectoryEntries(sourceDirectoryPath, rootDirectoryName, entries);
  return entries;
}

function createLocalHeaderBuffer(metadata: LocalHeaderMetadata): Buffer {
  const fileNameBuffer = Buffer.from(metadata.zipPath, 'utf8');
  const localHeaderBuffer = Buffer.alloc(30 + fileNameBuffer.length);

  localHeaderBuffer.writeUInt32LE(ZIP_SIGNATURES.localFileHeader, 0);
  localHeaderBuffer.writeUInt16LE(ZIP_VERSION, 4);
  localHeaderBuffer.writeUInt16LE(ZIP_GENERAL_PURPOSE_UTF8, 6);
  localHeaderBuffer.writeUInt16LE(metadata.compressionMethod, 8);
  localHeaderBuffer.writeUInt16LE(metadata.dosTime, 10);
  localHeaderBuffer.writeUInt16LE(metadata.dosDate, 12);
  localHeaderBuffer.writeUInt32LE(metadata.crc32, 14);
  localHeaderBuffer.writeUInt32LE(metadata.compressedSize, 18);
  localHeaderBuffer.writeUInt32LE(metadata.uncompressedSize, 22);
  localHeaderBuffer.writeUInt16LE(fileNameBuffer.length, 26);
  localHeaderBuffer.writeUInt16LE(0, 28);
  fileNameBuffer.copy(localHeaderBuffer, 30);

  return localHeaderBuffer;
}

function createCentralHeaderBuffer(metadata: CentralHeaderMetadata): Buffer {
  const fileNameBuffer = Buffer.from(metadata.zipPath, 'utf8');
  const centralHeaderBuffer = Buffer.alloc(46 + fileNameBuffer.length);

  centralHeaderBuffer.writeUInt32LE(ZIP_SIGNATURES.centralDirectoryHeader, 0);
  centralHeaderBuffer.writeUInt16LE(ZIP_VERSION, 4);
  centralHeaderBuffer.writeUInt16LE(ZIP_VERSION, 6);
  centralHeaderBuffer.writeUInt16LE(ZIP_GENERAL_PURPOSE_UTF8, 8);
  centralHeaderBuffer.writeUInt16LE(metadata.compressionMethod, 10);
  centralHeaderBuffer.writeUInt16LE(metadata.dosTime, 12);
  centralHeaderBuffer.writeUInt16LE(metadata.dosDate, 14);
  centralHeaderBuffer.writeUInt32LE(metadata.crc32, 16);
  centralHeaderBuffer.writeUInt32LE(metadata.compressedSize, 20);
  centralHeaderBuffer.writeUInt32LE(metadata.uncompressedSize, 24);
  centralHeaderBuffer.writeUInt16LE(fileNameBuffer.length, 28);
  centralHeaderBuffer.writeUInt16LE(0, 30);
  centralHeaderBuffer.writeUInt16LE(0, 32);
  centralHeaderBuffer.writeUInt16LE(0, 34);
  centralHeaderBuffer.writeUInt16LE(0, 36);
  centralHeaderBuffer.writeUInt32LE(metadata.externalFileAttributes, 38);
  centralHeaderBuffer.writeUInt32LE(metadata.localHeaderOffset, 42);
  fileNameBuffer.copy(centralHeaderBuffer, 46);

  return centralHeaderBuffer;
}

function findEndOfCentralDirectoryOffset(zipBuffer: Buffer): number {
  const minOffset = Math.max(0, zipBuffer.length - (22 + ZIP_MAX_COMMENT_LENGTH));
  for (let offset = zipBuffer.length - 22; offset >= minOffset; offset -= 1) {
    if (zipBuffer.readUInt32LE(offset) === ZIP_SIGNATURES.endOfCentralDirectory) {
      return offset;
    }
  }
  return -1;
}

export async function createZipArchiveFromDirectory({
  sourceDirectoryPath,
  targetArchivePath,
  rootDirectoryName,
}: {
  sourceDirectoryPath: string;
  targetArchivePath: string;
  rootDirectoryName: string;
}): Promise<void> {
  const sourceStat = await fs.stat(sourceDirectoryPath);
  if (!sourceStat.isDirectory()) {
    throw new Error(`Source path is not a directory: ${sourceDirectoryPath}`);
  }

  await fs.mkdir(path.dirname(targetArchivePath), { recursive: true });
  const zipEntries = await buildZipEntries(sourceDirectoryPath, toZipPath(rootDirectoryName));

  const fileHandle = await fs.open(targetArchivePath, 'w');
  const centralEntries: CentralHeaderMetadata[] = [];
  let offset = 0;

  try {
    for (const entry of zipEntries) {
      const safeZipPath = sanitizeArchiveEntryPath(entry.zipPath);
      const { dosDate, dosTime } = toDosDateTime(entry.modifiedAt ?? new Date());

      let compressionMethod: number = ZIP_COMPRESSION_METHOD.store;
      let compressedData = Buffer.alloc(0);
      let uncompressedSize = 0;
      let crc32 = 0;

      if (entry.type === 'file') {
        const rawContent = await fs.readFile(entry.absolutePath);
        uncompressedSize = rawContent.length;
        crc32 = computeCrc32(rawContent);

        const deflated = rawContent.length > 0 ? zlib.deflateRawSync(rawContent) : Buffer.alloc(0);
        if (deflated.length < rawContent.length) {
          compressionMethod = ZIP_COMPRESSION_METHOD.deflate;
          compressedData = deflated;
        } else {
          compressionMethod = ZIP_COMPRESSION_METHOD.store;
          compressedData = rawContent;
        }
      }

      const localHeaderOffset = offset;
      const localHeaderBuffer = createLocalHeaderBuffer({
        zipPath: safeZipPath,
        compressionMethod,
        dosDate,
        dosTime,
        crc32,
        compressedSize: compressedData.length,
        uncompressedSize,
      });

      await fileHandle.write(localHeaderBuffer, 0, localHeaderBuffer.length, offset);
      offset += localHeaderBuffer.length;

      if (compressedData.length > 0) {
        await fileHandle.write(compressedData, 0, compressedData.length, offset);
        offset += compressedData.length;
      }

      centralEntries.push({
        zipPath: safeZipPath,
        compressionMethod,
        dosDate,
        dosTime,
        crc32,
        compressedSize: compressedData.length,
        uncompressedSize,
        externalFileAttributes: entry.type === 'directory' ? 0x10 : 0,
        localHeaderOffset,
      });
    }

    const centralDirectoryOffset = offset;
    for (const centralEntry of centralEntries) {
      const centralHeaderBuffer = createCentralHeaderBuffer(centralEntry);
      await fileHandle.write(centralHeaderBuffer, 0, centralHeaderBuffer.length, offset);
      offset += centralHeaderBuffer.length;
    }

    const centralDirectorySize = offset - centralDirectoryOffset;
    const endRecordBuffer = Buffer.alloc(22);
    endRecordBuffer.writeUInt32LE(ZIP_SIGNATURES.endOfCentralDirectory, 0);
    endRecordBuffer.writeUInt16LE(0, 4);
    endRecordBuffer.writeUInt16LE(0, 6);
    endRecordBuffer.writeUInt16LE(centralEntries.length, 8);
    endRecordBuffer.writeUInt16LE(centralEntries.length, 10);
    endRecordBuffer.writeUInt32LE(centralDirectorySize, 12);
    endRecordBuffer.writeUInt32LE(centralDirectoryOffset, 16);
    endRecordBuffer.writeUInt16LE(0, 20);

    await fileHandle.write(endRecordBuffer, 0, endRecordBuffer.length, offset);
  } finally {
    await fileHandle.close();
  }
}

export async function extractZipArchiveToDirectory({
  archivePath,
  targetDirectoryPath,
}: {
  archivePath: string;
  targetDirectoryPath: string;
}): Promise<void> {
  const archiveBuffer = await fs.readFile(archivePath);
  const endOfCentralDirectoryOffset = findEndOfCentralDirectoryOffset(archiveBuffer);
  if (endOfCentralDirectoryOffset < 0) {
    throw new Error('Invalid ZIP file: end-of-central-directory record not found');
  }

  const signature = archiveBuffer.readUInt32LE(endOfCentralDirectoryOffset);
  if (signature !== ZIP_SIGNATURES.endOfCentralDirectory) {
    throw new Error('Invalid ZIP file: malformed end-of-central-directory record');
  }

  const totalEntries = archiveBuffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  const centralDirectoryOffset = archiveBuffer.readUInt32LE(endOfCentralDirectoryOffset + 16);

  await fs.mkdir(targetDirectoryPath, { recursive: true });

  let cursor = centralDirectoryOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    if (archiveBuffer.readUInt32LE(cursor) !== ZIP_SIGNATURES.centralDirectoryHeader) {
      throw new Error('Invalid ZIP file: malformed central directory header');
    }

    const generalPurposeFlag = archiveBuffer.readUInt16LE(cursor + 8);
    const compressionMethod = archiveBuffer.readUInt16LE(cursor + 10);
    const compressedSize = archiveBuffer.readUInt32LE(cursor + 20);
    const uncompressedSize = archiveBuffer.readUInt32LE(cursor + 24);
    const fileNameLength = archiveBuffer.readUInt16LE(cursor + 28);
    const extraLength = archiveBuffer.readUInt16LE(cursor + 30);
    const commentLength = archiveBuffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = archiveBuffer.readUInt32LE(cursor + 42);

    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileNameBuffer = archiveBuffer.subarray(fileNameStart, fileNameEnd);
    const entryName = (generalPurposeFlag & ZIP_GENERAL_PURPOSE_UTF8) !== 0
      ? fileNameBuffer.toString('utf8')
      : fileNameBuffer.toString('binary');

    const safeEntryPath = sanitizeArchiveEntryPath(entryName);
    const outputPath = path.resolve(targetDirectoryPath, safeEntryPath);
    if (!isPathInside(targetDirectoryPath, outputPath)) {
      throw new Error(`Unsafe ZIP entry output path: ${entryName}`);
    }

    if (safeEntryPath.endsWith('/')) {
      await fs.mkdir(outputPath, { recursive: true });
      cursor = fileNameEnd + extraLength + commentLength;
      continue;
    }

    if (archiveBuffer.readUInt32LE(localHeaderOffset) !== ZIP_SIGNATURES.localFileHeader) {
      throw new Error(`Invalid ZIP file: local header missing for ${entryName}`);
    }

    const localFileNameLength = archiveBuffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = archiveBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > archiveBuffer.length) {
      throw new Error(`Invalid ZIP file: truncated data for ${entryName}`);
    }

    const compressedData = archiveBuffer.subarray(dataStart, dataEnd);
    let decompressedData: Buffer;
    if (compressionMethod === ZIP_COMPRESSION_METHOD.store) {
      decompressedData = compressedData;
    } else if (compressionMethod === ZIP_COMPRESSION_METHOD.deflate) {
      decompressedData = zlib.inflateRawSync(compressedData);
    } else {
      throw new Error(`Unsupported ZIP compression method (${compressionMethod}) for ${entryName}`);
    }

    if (decompressedData.length !== uncompressedSize) {
      throw new Error(`Invalid ZIP file: size mismatch for ${entryName}`);
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, decompressedData);

    cursor = fileNameEnd + extraLength + commentLength;
  }
}
