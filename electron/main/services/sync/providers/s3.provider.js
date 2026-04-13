import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

function normalizeEndpoint(endpoint) {
  const trimmed = String(endpoint ?? '').trim();
  if (!trimmed) {
    return trimmed;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function trimPrefix(value) {
  return String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
}

function joinKey(...parts) {
  return parts.map((part) => trimPrefix(part)).filter(Boolean).join('/');
}

function toTextBody(resultBody) {
  if (!resultBody) {
    return Promise.resolve('');
  }

  if (typeof resultBody.transformToString === 'function') {
    return resultBody.transformToString();
  }

  if (typeof resultBody === 'string') {
    return Promise.resolve(resultBody);
  }

  return (async () => {
    const chunks = [];
    for await (const chunk of resultBody) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  })();
}

function isNotFoundError(error) {
  return error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404;
}

export function createS3Provider(config) {
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

    async listFiles(relativeDirectory = '') {
      const files = [];
      let continuationToken = undefined;
      const scanPrefix = joinKey(basePrefix, relativeDirectory);
      const requestPrefix = scanPrefix ? `${scanPrefix}/` : undefined;

      do {
        const response = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: requestPrefix,
          ContinuationToken: continuationToken,
        }));

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

    async readText(relativePath) {
      try {
        const response = await client.send(new GetObjectCommand({
          Bucket: bucket,
          Key: joinKey(basePrefix, relativePath),
        }));
        return await toTextBody(response.Body);
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },

    async writeText(relativePath, content) {
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

    async deleteFile(relativePath) {
      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: joinKey(basePrefix, relativePath),
      }));
    },
  };
}