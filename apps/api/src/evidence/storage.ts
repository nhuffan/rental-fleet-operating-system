import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from '../config.js';
import { IMAGE_BUCKET, VIDEO_BUCKET, mediaCap } from './config.js';

export function evidenceUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'EVIDENCE_UNAVAILABLE',
    message: 'Private evidence storage is unavailable; please retry later',
  });
}
/** The server-only service key never appears in metadata or upload authorization. */
export class EvidenceStorage {
  private client?: SupabaseClient;
  private getClient() {
    if (this.client) return this.client;
    const config = loadConfig();
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret)
      throw new ServiceUnavailableException({
        code: 'EVIDENCE_NOT_CONFIGURED',
        message: 'Private evidence storage is not configured',
      });
    this.client = createClient(config.supabaseUrl, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
              : AbortSignal.timeout(15_000),
          }),
      },
    });
    return this.client;
  }
  assertConfigured() {
    this.getClient();
  }
  private bucket(name: string) {
    if (![IMAGE_BUCKET, VIDEO_BUCKET].includes(name))
      throw evidenceUnavailable();
    return this.getClient().storage.from(name);
  }
  async authorize(bucket: string, key: string) {
    const result = await this.bucket(bucket).createSignedUploadUrl(key, {
      upsert: false,
    });
    if (result.error || !result.data) throw evidenceUnavailable();
    return { token: result.data.token, signedUrl: result.data.signedUrl };
  }
  async download(bucket: string, key: string, kind: string) {
    // Stream and enforce the actual byte count before buffering the whole object.
    // Bucket limits are a second defense, rather than a trusted client declaration.
    const result = await this.bucket(bucket).download(key).asStream();
    if (result.error?.status === 404 || result.error?.statusCode === '404')
      throw new ConflictException({
        code: 'EVIDENCE_NOT_READY',
        message: 'The media upload has not completed',
      });
    if (result.error || !result.data) throw evidenceUnavailable();
    const reader = (result.data as ReadableStream<Uint8Array>).getReader();
    const chunks: Buffer[] = [];
    let bytes = 0;
    let completed = false;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > mediaCap(kind))
          throw new BadRequestException({
            code: 'EVIDENCE_INVALID_FILE',
            message: 'Uploaded media exceeds its allowed size',
          });
        chunks.push(Buffer.from(chunk.value));
      }
      completed = true;
      if (!bytes)
        throw new BadRequestException({
          code: 'EVIDENCE_INVALID_FILE',
          message: 'Uploaded media is empty',
        });
      return Buffer.concat(chunks, bytes);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw evidenceUnavailable();
    } finally {
      if (!completed) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
  async copy(bucket: string, source: string, destination: string) {
    const result = await this.bucket(bucket).copy(source, destination);
    // A previous verification can have copied successfully before losing its
    // response. Final keys are server-generated, immutable and never client-writeable.
    if (
      result.error &&
      result.error.status !== 409 &&
      !['409', 'Duplicate'].includes(
        String(result.error.statusCode ?? result.error.name),
      )
    )
      throw evidenceUnavailable();
  }
  async signRead(bucket: string, key: string, seconds: number) {
    const result = await this.bucket(bucket).createSignedUrl(key, seconds);
    if (result.error || !result.data) throw evidenceUnavailable();
    return result.data.signedUrl;
  }
  async remove(bucket: string, keys: string[]) {
    if (!keys.length) return;
    const result = await this.bucket(bucket).remove(keys);
    if (result.error) throw evidenceUnavailable();
  }
}
