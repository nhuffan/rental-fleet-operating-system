import 'reflect-metadata';
import { createClient } from '@supabase/supabase-js';
import { loadConfig } from '../src/config.js';
import { Database } from '../src/database/database.js';
import { EvidenceService } from '../src/evidence/evidence.service.js';
import {
  IMAGE_BUCKET,
  VIDEO_BUCKET,
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
} from '../src/evidence/config.js';

async function main() {
  const config = loadConfig();
  const ref = new URL(config.supabaseUrl).hostname.split('.')[0];
  if (ref !== process.env.SUPABASE_PROJECT_REF)
    throw new Error('Project ref must match configured Supabase URL');
  const operation = process.argv[2];
  if (operation === 'provision') {
    // Stage implementation never provisions buckets against staging/production.
    if (config.environment !== 'development' || ref !== 'eeryymswcufnebibigqf')
      throw new Error(
        'Storage provisioning is restricted to the development project',
      );
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret) throw new Error('Server-only Supabase secret key is required');
    const client = createClient(config.supabaseUrl, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }),
      },
    });
    for (const [name, bytes, mimes] of [
      [IMAGE_BUCKET, IMAGE_MAX_BYTES, ['image/jpeg', 'image/webp']],
      [VIDEO_BUCKET, VIDEO_MAX_BYTES, ['video/mp4', 'video/webm']],
    ] as const) {
      const existing = await client.storage.getBucket(name);
      if (
        existing.error &&
        !['404', '400'].includes(String(existing.error.statusCode))
      )
        throw new Error('Unable to inspect private evidence bucket');
      const options = {
        public: false,
        fileSizeLimit: bytes,
        allowedMimeTypes: [...mimes],
      };
      const result = existing.data
        ? await client.storage.updateBucket(name, options)
        : await client.storage.createBucket(name, options);
      if (result.error)
        throw new Error('Private evidence bucket provisioning failed');
      const checked = await client.storage.getBucket(name);
      if (
        checked.error ||
        checked.data?.public !== false ||
        Number(checked.data.file_size_limit) !== bytes ||
        checked.data.allowed_mime_types?.slice().sort().join(',') !==
          [...mimes].sort().join(',')
      )
        throw new Error(
          'Private evidence bucket configuration verification failed',
        );
      console.log(
        `${name}: private, ${bytes} byte cap, allowed media types verified`,
      );
    }
  } else if (operation === 'cleanup') {
    const database = new Database();
    try {
      console.log(
        JSON.stringify(await new EvidenceService(database).cleanupExpired()),
      );
    } finally {
      await database.onModuleDestroy();
    }
  } else throw new Error('Use evidence:storage or evidence:cleanup');
}
main().catch(() => {
  // Provider/DB errors can embed request details or credentials; keep CLI output stable.
  console.error(
    'Evidence maintenance failed. Check server configuration, connectivity and private bucket settings.',
  );
  process.exitCode = 1;
});
