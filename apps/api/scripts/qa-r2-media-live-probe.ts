/**
 * Live connectivity probe for mazare3-media only.
 * Never prints secrets, access keys, or authorization headers.
 * Does not touch the private KYC bucket.
 */
import '../src/env.js';
import { randomUUID } from 'crypto';
import {
  S3Client,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  getPublicPropertyMediaSafeDiagnostics,
  loadPublicR2MediaSettings,
} from '../src/config/property-media-storage.config.js';

function safeErr(e: unknown) {
  const err = e as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
    message?: string;
  };
  const code = err.Code ?? err.name ?? 'unknown';
  const status = err.$metadata?.httpStatusCode ?? null;
  return { code, httpStatusCode: status };
}

async function main() {
  const settings = loadPublicR2MediaSettings();
  const diag = getPublicPropertyMediaSafeDiagnostics();
  if (settings.bucket !== 'mazare3-media') {
    throw new Error('refusing probe: media bucket is not mazare3-media');
  }

  console.log('credential_source=' + diag.credentialSource);
  console.log('media_credentials_configured=' + diag.mediaCredentialsConfigured);
  console.log('media_bucket=' + diag.mediaBucket);
  console.log('public_url_host=' + diag.publicUrlHost);

  const client = new S3Client({
    region: settings.region,
    endpoint: settings.endpoint,
    forcePathStyle: settings.forcePathStyle,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });

  await client.send(new HeadBucketCommand({ Bucket: 'mazare3-media' }));
  console.log('head_bucket=OK');

  const key = `qa/r2-media-probe/${randomUUID()}.txt`;
  await client.send(
    new PutObjectCommand({
      Bucket: 'mazare3-media',
      Key: key,
      Body: Buffer.from('mazare3-media-probe'),
      ContentType: 'text/plain',
    }),
  );
  console.log('put=OK');

  const got = await client.send(new GetObjectCommand({ Bucket: 'mazare3-media', Key: key }));
  const body = Buffer.from((await got.Body?.transformToByteArray()) ?? []);
  if (body.toString('utf8') !== 'mazare3-media-probe') {
    throw new Error('get body mismatch');
  }
  console.log('get=OK');

  await client.send(new DeleteObjectCommand({ Bucket: 'mazare3-media', Key: key }));
  console.log('delete=OK');

  try {
    await client.send(new HeadObjectCommand({ Bucket: 'mazare3-media', Key: key }));
    throw new Error('probe object still present');
  } catch (e) {
    const mapped = safeErr(e);
    if (mapped.httpStatusCode !== 404 && mapped.code !== 'NotFound' && mapped.code !== 'NotFoundError') {
      throw new Error(`expected gone, got ${mapped.code}:${mapped.httpStatusCode}`);
    }
  }
  console.log('gone=OK');
}

main().catch((err) => {
  const mapped = safeErr(err);
  console.error(`PROBE_FAIL code=${mapped.code} status=${mapped.httpStatusCode}`);
  process.exit(1);
});
