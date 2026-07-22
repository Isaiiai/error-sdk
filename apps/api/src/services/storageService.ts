import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { config } from '../config';

let client: S3Client | null = null;

function getClient(): S3Client | null {
  const { accessKey, secretKey, endpoint, region } = config.spaces;
  if (!accessKey || !secretKey || !endpoint) {
    return null;
  }
  if (!client) {
    client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: false,
    });
  }
  return client;
}

export function isSpacesConfigured(): boolean {
  return !!(config.spaces.accessKey && config.spaces.secretKey && config.spaces.bucket);
}

function publicUrlForKey(key: string): string {
  const base = (config.spaces.cdnUrl || config.spaces.url).replace(/\/$/, '');
  return `${base}/${key}`;
}

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export interface UploadedScreenshot {
  url: string;
  key: string;
  contentType: string;
  width?: number;
  height?: number;
  capturedAt: Date;
  storage: 'spaces' | 'inline';
  data?: string;
}

/**
 * Upload a screenshot data URL to DigitalOcean Spaces.
 * Falls back to inline storage if Spaces is not configured or upload fails.
 */
export async function uploadScreenshot(params: {
  projectId: string;
  dataUrl: string;
  contentType?: string;
  width?: number;
  height?: number;
  capturedAt?: Date;
}): Promise<UploadedScreenshot> {
  const capturedAt = params.capturedAt || new Date();
  const parsed = parseDataUrl(params.dataUrl);

  if (!parsed) {
    return {
      url: '',
      key: '',
      contentType: params.contentType || 'image/jpeg',
      width: params.width,
      height: params.height,
      capturedAt,
      storage: 'inline',
      data: params.dataUrl,
    };
  }

  const s3 = getClient();
  if (!s3 || !isSpacesConfigured()) {
    return {
      url: '',
      key: '',
      contentType: parsed.contentType,
      width: params.width,
      height: params.height,
      capturedAt,
      storage: 'inline',
      data: params.dataUrl,
    };
  }

  const ext = parsed.contentType.includes('png') ? 'png' : 'jpg';
  const prefix = config.spaces.basePath.replace(/^\/|\/$/g, '');
  const key = `${prefix}/${params.projectId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.spaces.bucket,
        Key: key,
        Body: parsed.buffer,
        ContentType: parsed.contentType,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: {
          projectId: params.projectId,
        },
      })
    );

    return {
      url: publicUrlForKey(key),
      key,
      contentType: parsed.contentType,
      width: params.width,
      height: params.height,
      capturedAt,
      storage: 'spaces',
    };
  } catch (err) {
    console.error('[Spaces] Screenshot upload failed, storing inline:', err);
    return {
      url: '',
      key: '',
      contentType: parsed.contentType,
      width: params.width,
      height: params.height,
      capturedAt,
      storage: 'inline',
      data: params.dataUrl,
    };
  }
}

export async function uploadFile(params: {
  projectId: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
  folder?: string;
}): Promise<{
  url: string;
  key: string;
  contentType: string;
  size: number;
  storage: 'spaces' | 'inline';
  data?: string;
  filename: string;
}> {
  const folder = (params.folder || 'attachments').replace(/^\/|\/$/g, '');
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const prefix = config.spaces.basePath.replace(/^\/|\/$/g, '');
  const key = `${prefix}/${folder}/${params.projectId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
  const size = params.buffer.length;

  const s3 = getClient();
  if (!s3 || !isSpacesConfigured()) {
    const dataUrl = `data:${params.contentType};base64,${params.buffer.toString('base64')}`;
    return {
      url: '',
      key: '',
      contentType: params.contentType,
      size,
      storage: 'inline',
      data: dataUrl,
      filename: safeName,
    };
  }

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.spaces.bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: { projectId: params.projectId, filename: safeName },
      })
    );
    return {
      url: publicUrlForKey(key),
      key,
      contentType: params.contentType,
      size,
      storage: 'spaces',
      filename: safeName,
    };
  } catch (err) {
    console.error('[Spaces] File upload failed, storing inline:', err);
    return {
      url: '',
      key: '',
      contentType: params.contentType,
      size,
      storage: 'inline',
      data: `data:${params.contentType};base64,${params.buffer.toString('base64')}`,
      filename: safeName,
    };
  }
}

export async function uploadDataUrlFile(params: {
  projectId: string;
  filename: string;
  dataUrl: string;
  folder?: string;
}) {
  const match = params.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid attachment data URL');
  }
  return uploadFile({
    projectId: params.projectId,
    filename: params.filename,
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
    folder: params.folder,
  });
}

export async function deleteScreenshot(key: string): Promise<void> {
  const s3 = getClient();
  if (!s3 || !key) return;
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: config.spaces.bucket,
        Key: key,
      })
    );
  } catch (err) {
    console.error('[Spaces] Delete failed:', err);
  }
}
