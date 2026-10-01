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

export function sanitizeErrorMessage(err: unknown): string {
  if (!err) return 'Erro interno do servidor';
  let msg = typeof err === 'string' ? err : (err as any).message || String(err);

  // Remove senhas de connection strings (ex: postgresql://user:PASSWORD@host...)
  msg = msg.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1***$3');

  // Remove secrets de chaves S3
  const secretKey = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACC;
  if (secretKey && secretKey.length > 3) {
    msg = msg.split(secretKey).join('***');
  }
  const accessKey = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
  if (accessKey && accessKey.length > 3) {
    msg = msg.split(accessKey).join('***');
  }

  // Remove assinaturas AWS
  msg = msg.replace(/(X-Amz-Signature=|Signature=)[a-zA-Z0-9_-]+/gi, '$1***');

  return msg;
}

export function getMissingRequiredEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.S3_ENDPOINT || !process.env.S3_ENDPOINT.trim()) missing.push('S3_ENDPOINT');
  if (!process.env.S3_BUCKET || !process.env.S3_BUCKET.trim()) missing.push('S3_BUCKET');
  if (!getAccessKeyId()) missing.push('S3_ACCESS_KEY_ID');
  if (!getSecretAccessKey()) missing.push('S3_SECRET_ACCESS_KEY');
  if (!process.env.S3_REGION || !process.env.S3_REGION.trim()) missing.push('S3_REGION');
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) missing.push('DATABASE_URL');
  return missing;
}

export function getMissingStorageEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.S3_ENDPOINT || !process.env.S3_ENDPOINT.trim()) missing.push('S3_ENDPOINT');
  if (!process.env.S3_BUCKET || !process.env.S3_BUCKET.trim()) missing.push('S3_BUCKET');
  if (!getAccessKeyId()) missing.push('S3_ACCESS_KEY_ID');
  if (!getSecretAccessKey()) missing.push('S3_SECRET_ACCESS_KEY');
  if (!process.env.S3_REGION || !process.env.S3_REGION.trim()) missing.push('S3_REGION');
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
      `STORAGE_CONFIG_MISSING: Variáveis do Supabase Storage (S3 Protocol) ausentes no servidor: ${missing.join(', ')}.`
    );
  }

  let endpoint = process.env.S3_ENDPOINT!.trim();
  // Se for endpoint do Supabase e não tiver o sufixo /storage/v1/s3, anexa automaticamente
  if (endpoint.includes('supabase.co') && !endpoint.includes('/storage/v1/s3')) {
    endpoint = endpoint.replace(/\/+$/, '') + '/storage/v1/s3';
  }

  const accessKey = getAccessKeyId()!;
  const secretKey = getSecretAccessKey()!;

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      endpoint,
      region: process.env.S3_REGION?.trim() || 'us-east-1',
      forcePathStyle: true, // OBRIGATÓRIO: Supabase Storage requer forcePathStyle=true para resolução de buckets
      credentials: {
        accessKeyId: accessKey.trim(),
        secretAccessKey: secretKey.trim(),
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
    const baseName = sanitized.replace(/(\.glb)+$/i, '');
    const safeFilename = `${baseName}.glb`;

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
