import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

interface S3ProviderConfig {
  remotePath: string;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

interface S3ProviderFile {
  path: string;
  size: number;
  modifiedAt: number;
}

function normalizeEndpoint(endpoint: unknown): string {
  const trimmed = String(endpoint ?? '').trim();
  if (!trimmed) {
    return trimmed;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function trimPrefix(value: unknown): string {
  return String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
}

function joinKey(...parts: string[]): string {
  return parts.map((part) => trimPrefix(part)).filter(Boolean).join('/');
}

function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array | string> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

function toTextBody(resultBody: unknown): Promise<string> {
  if (!resultBody) {
    return Promise.resolve('');
  }

  if (typeof resultBody === 'object' && resultBody !== null && 'transformToString' in resultBody && typeof resultBody.transformToString === 'function') {
    return resultBody.transformToString();
  }

  if (typeof resultBody === 'string') {
    return Promise.resolve(resultBody);
  }

  return (async (): Promise<string> => {
    if (!isAsyncIterable(resultBody)) {
      return String(resultBody);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of resultBody) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  })();
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const errorRecord = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return errorRecord.name === 'NoSuchKey' || errorRecord.$metadata?.httpStatusCode === 404;
}

export function createS3Provider(config: S3ProviderConfig): {
  testConnection(): Promise<void>;
  listFiles(relativeDirectory?: string): Promise<S3ProviderFile[]>;
  readText(relativePath: string): Promise<string | null>;
  writeText(relativePath: string, content: string): Promise<void>;
  deleteFile(relativePath: string): Promise<void>;
} {
  const basePrefix = trimPrefix(config.remotePath);
  const bucket = String(config.bucket ?? '').trim();
  const client = new S3Client({
    region: String(config.region ?? '').trim(),
    endpoint: normalizeEndpoint(config.endpoint),
    forcePathStyle: Boolean(config.forcePathStyle),
    credentials: {
      accessKeyId: String(config.accessKeyId ?? ''),
      secretAccessKey: String(config.secretAccessKey ?? ''),
    },
  });

  return {
    async testConnection() {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: basePrefix ? `${basePrefix}/` : undefined,
        MaxKeys: 1,
      }));
    },

    async listFiles(relativeDirectory = ''): Promise<S3ProviderFile[]> {
      const files: S3ProviderFile[] = [];
      let continuationToken: string | undefined = undefined;
      const scanPrefix = joinKey(basePrefix, relativeDirectory);
      const requestPrefix = scanPrefix ? `${scanPrefix}/` : undefined;

      do {
        const response = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: requestPrefix,
          ContinuationToken: continuationToken,
        })) as ListObjectsV2CommandOutput;

        for (const item of response.Contents ?? []) {
          const key = String(item.Key ?? '');
          if (!key || key.endsWith('/')) {
            continue;
          }

          const relativePath = basePrefix ? key.slice(basePrefix.length + 1) : key;
          files.push({
            path: relativePath,
            size: Number(item.Size ?? 0),
            modifiedAt: item.LastModified ? item.LastModified.getTime() : Date.now(),
          });
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      return files;
    },

    async readText(relativePath: string): Promise<string | null> {
      try {
        const response = await client.send(new GetObjectCommand({
          Bucket: bucket,
          Key: joinKey(basePrefix, relativePath),
        }));
        return await toTextBody(response.Body);
      } catch (error: unknown) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },

    async writeText(relativePath: string, content: string): Promise<void> {
      const key = joinKey(basePrefix, relativePath);
      const extension = path.posix.extname(relativePath).toLowerCase();
      const contentType = extension === '.md'
        ? 'text/markdown; charset=utf-8'
        : 'application/json; charset=utf-8';

      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
      }));
    },

    async deleteFile(relativePath: string): Promise<void> {
      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: joinKey(basePrefix, relativePath),
      }));
    },
  };
}
