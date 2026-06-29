import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env.js';

const s3 = new S3Client({ region: env.AWS_REGION });

const PRESIGN_EXPIRES_IN = 300;

export async function createUploadUrl(
  key: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.UPLOAD_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRES_IN });
}

export async function createDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.UPLOAD_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRES_IN });
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(
      new HeadObjectCommand({ Bucket: env.UPLOAD_BUCKET, Key: key }),
    );
    return true;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'name' in err &&
      (err.name === 'NotFound' || err.name === 'NoSuchKey')
    ) {
      return false;
    }
    throw err;
  }
}

export async function getObjectText(key: string): Promise<string> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: env.UPLOAD_BUCKET, Key: key }),
  );

  if (!response.Body) {
    throw new Error(`S3 object ${key} has no body`);
  }

  return response.Body.transformToString('utf-8');
}
