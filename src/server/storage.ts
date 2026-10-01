import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export function getAccessKeyId(): string | undefined {
  return process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
}

export function getSecretAccessKey(): string | undefined {
  return process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACC;
}

export function getMissingStorageEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.S3_ENDPOINT) missing.push('S3_ENDPOINT');
  if (!process.env.S3_BUCKET) missing.push('S3_BUCKET');
  if (!getAccessKeyId()) missing.push('S3_ACCESS_KEY_ID (ou S3_ACCESS_KEY)');
  if (!getSecretAccessKey()) missing.push('S3_SECRET_ACCESS_KEY (ou S3_SECRET_ACC)');
  if (!process.env.S3_REGION) missing.push('S3_REGION');
  return missing;
}

export function isStorageConfigured(): boolean {
  return getMissingStorageEnv().length === 0;
}

let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  const missing = getMissingStorageEnv();
  if (missing.length > 0) {
    throw new Error(
      `STORAGE_CONFIG_MISSING: Variáveis do Supabase Storage (S3 Protocol) ausentes: ${missing.join(', ')}. Configure S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3`
    );
  }

  const endpoint = process.env.S3_ENDPOINT!.trim();
  if (!endpoint.includes('/storage/v1/s3')) {
    console.warn(`[Supabase Storage S3] Aviso: S3_ENDPOINT "${endpoint}" não contém o caminho padrão '/storage/v1/s3'.`);
  }

  const accessKey = getAccessKeyId()!;
  const secretKey = getSecretAccessKey()!;

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      endpoint,
      region: process.env.S3_REGION || 'us-east-1',
      forcePathStyle: true, // OBRIGATÓRIO: Supabase Storage requer forcePathStyle=true para resolução de buckets
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
  }

  return s3ClientInstance;
}

export const storageService = {
  getBucket(): string {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error('S3_BUCKET não está configurado.');
    }
    return bucket;
  },

  async generatePresignedPutUrl(params: {
    storageKey: string;
    byteSize: number;
    sha256Hex: string;
  }): Promise<string> {
    const client = getS3Client();
    const bucket = this.getBucket();
    const sha256Base64 = Buffer.from(params.sha256Hex, 'hex').toString('base64');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: params.storageKey,
      ContentType: 'model/gltf-binary',
      ContentLength: params.byteSize,
      ChecksumSHA256: sha256Base64,
    });

    return getSignedUrl(client, command, {
      expiresIn: 900,
      signableHeaders: new Set(['content-type', 'content-length', 'x-amz-checksum-sha256']),
    });
  },

  async headObject(storageKey: string): Promise<{ contentLength: number; etag: string; checksumSha256?: string }> {
    const client = getS3Client();
    const bucket = this.getBucket();

    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ChecksumMode: 'ENABLED',
    });

    const res = await client.send(command);

    if (res.ContentLength === undefined || !res.ETag) {
      throw new Error('STORAGE_EMPTY_OR_UNAVAILABLE');
    }

    return {
      contentLength: res.ContentLength,
      etag: res.ETag.replace(/"/g, ''),
      checksumSha256: res.ChecksumSHA256,
    };
  },

  async generatePresignedGetUrl(params: {
    storageKey: string;
    filename: string;
  }): Promise<string> {
    const client = getS3Client();
    const bucket = this.getBucket();

    const sanitized = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFilename = sanitized.toLowerCase().endsWith('.glb') ? sanitized : `${sanitized}.glb`;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: params.storageKey,
      ResponseContentType: 'model/gltf-binary',
      ResponseContentDisposition: `inline; filename="${safeFilename}"`,
    });

    return getSignedUrl(client, command, {
      expiresIn: 600,
    });
  },
};
