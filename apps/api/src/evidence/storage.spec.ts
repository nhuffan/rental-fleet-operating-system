import { EvidenceStorage } from './storage.js';
import { IMAGE_MAX_BYTES } from './config.js';

function storage(
  stream: ReadableStream<Uint8Array> | null,
  error: unknown = null,
) {
  const value = new EvidenceStorage();
  Object.assign(value, {
    client: {
      storage: {
        from: () => ({
          download: () => ({ asStream: async () => ({ data: stream, error }) }),
        }),
      },
    },
  });
  return value;
}
const stream = (...chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
it('counts actual streamed bytes and preserves the complete bounded file', async () => {
  const value = storage(stream(Uint8Array.of(1, 2), Uint8Array.of(3, 4)));
  expect(
    await value.download('inspection-images', 'private/path', 'IMAGE'),
  ).toEqual(Buffer.from([1, 2, 3, 4]));
});
it('cancels an oversized stream before buffering its rest', async () => {
  let cancelled = false;
  let reads = 0;
  const incoming = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        reads++;
        controller.enqueue(new Uint8Array(IMAGE_MAX_BYTES / 2));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  await expect(
    storage(incoming).download('inspection-images', 'private/path', 'IMAGE'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_INVALID_FILE' } });
  expect(cancelled).toBe(true);
  expect(reads).toBe(3);
});
it('rejects an empty file independently of its declaration', async () => {
  await expect(
    storage(stream()).download('inspection-images', 'private/path', 'IMAGE'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_INVALID_FILE' } });
});
it('distinguishes an unfinished object from a provider outage without leaking details', async () => {
  await expect(
    storage(null, { status: 404 }).download(
      'inspection-images',
      'private/path',
      'IMAGE',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_NOT_READY' } });
  await expect(
    storage(null, { status: 400, statusCode: '404' }).download(
      'inspection-images',
      'private/path',
      'IMAGE',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_NOT_READY' } });
  await expect(
    storage(null, { status: 500, message: 'provider-secret-details' }).download(
      'inspection-images',
      'private/path',
      'IMAGE',
    ),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_UNAVAILABLE' } });
});
it('returns a safe retryable error when a download stream fails', async () => {
  const broken = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error('provider-secret-details'));
    },
  });
  await expect(
    storage(broken).download('inspection-images', 'private/path', 'IMAGE'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_UNAVAILABLE' } });
});
it('never uses a caller-selected bucket outside the private evidence allowlist', async () => {
  await expect(
    storage(stream(Uint8Array.of(1))).download('public', 'path', 'IMAGE'),
  ).rejects.toMatchObject({ response: { code: 'EVIDENCE_UNAVAILABLE' } });
});
