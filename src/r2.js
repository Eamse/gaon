import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import fsp from 'fs/promises';

dotenv.config();

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

if (!R2_BUCKET || !R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  throw new Error(
    'R2 환경변수(R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)가 설정되지 않았습니다.',
  );
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/** URL 또는 키를 사용하여 R2 버킷에서 파일을 삭제합니다. */
export const deleteFileFromR2 = async (urlOrKey) => {
  if (!urlOrKey) return;
  let key = urlOrKey;
  if (R2_PUBLIC_BASE_URL && urlOrKey.startsWith(R2_PUBLIC_BASE_URL)) {
    key = urlOrKey
      .replace(R2_PUBLIC_BASE_URL.replace(/\/$/, ''), '')
      .replace(/^\//, '');
  }

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      }),
    );
  } catch (error) {
    console.error(`Error deleting file from R2: ${key}`, error);
  }
};

/** 로컬 파일을 R2 버킷에 업로드하고 공개 URL을 반환합니다. */
export const uploadFileToR2 = async (localPath, key, contentType) => {
  const fileBuffer = await fsp.readFile(localPath);

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read',
    }),
  );

  if (!R2_PUBLIC_BASE_URL) {
    return { key };
  }

  const url = `${R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  return { key, url };
};
