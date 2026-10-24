import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { createRequire } from 'node:module';
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string;
import { MediaInspector } from './media-inspector.js';
const inspector = new MediaInspector();
let directory: string;
async function clip(
  name: string,
  duration: number,
  codec = 'libx264',
  size = '640x360',
) {
  const path = join(directory, name);
  const result = spawnSync(
    ffmpeg!,
    [
      '-nostdin',
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      `color=c=orange:s=${size}:r=2:d=${duration}`,
      '-an',
      '-c:v',
      codec,
      '-threads',
      '1',
      '-y',
      path,
    ],
    { timeout: 20_000 },
  );
  if (result.status !== 0)
    throw new Error('Synthetic video fixture creation failed');
  return readFile(path);
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'evidence-inspector-test-'));
});
afterAll(async () => {
  await rm(directory, { force: true, recursive: true });
});
it('decodes valid privacy-stripped JPEG and WebP pixels and reports actual bytes/dimensions', async () => {
  for (const format of ['jpeg', 'webp'] as const) {
    const bytes = await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#ee5f00' },
    })
      .toFormat(format)
      .toBuffer();
    expect(await inspector.inspect(bytes, 'IMAGE')).toEqual({
      mimeType: `image/${format}`,
      bytes: bytes.length,
      width: 640,
      height: 480,
      durationSeconds: null,
    });
  }
});
it('rejects fake signatures, unsupported formats, truncation, pixel limits and privacy metadata', async () => {
  const image = sharp({
    create: { width: 100, height: 100, channels: 3, background: 'orange' },
  });
  const valid = await image.clone().jpeg().toBuffer();
  const cases = [
    Buffer.from('not a jpeg'),
    Buffer.concat([Buffer.from([255, 216, 255]), Buffer.alloc(100)]),
    valid.subarray(0, valid.length - 20),
    await image.clone().png().toBuffer(),
    await image
      .clone()
      .withExif({ IFD0: { Artist: 'Private fixture' } })
      .jpeg()
      .toBuffer(),
    await sharp({
      create: { width: 1921, height: 1, channels: 3, background: 'orange' },
    })
      .jpeg()
      .toBuffer(),
    Buffer.alloc(1024 * 1024 + 1),
  ];
  for (const bytes of cases)
    await expect(inspector.inspect(bytes, 'IMAGE')).rejects.toMatchObject({
      response: { code: 'EVIDENCE_INVALID_FILE' },
    });
});
it('fully decodes bounded MP4/H.264 and WebM video', async () => {
  for (const [name, codec, mime] of [
    ['valid.mp4', 'libx264', 'video/mp4'],
    ['valid.webm', 'libvpx', 'video/webm'],
  ]) {
    const bytes = await clip(name, 1, codec);
    const actual = await inspector.inspect(bytes, 'VIDEO');
    expect(actual).toMatchObject({
      mimeType: mime,
      bytes: bytes.length,
      width: 640,
      height: 360,
    });
    expect(actual.durationSeconds).toBeGreaterThan(0);
    expect(actual.durationSeconds).toBeLessThanOrEqual(1.1);
  }
});
it('rejects malformed, over-duration, over-resolution and non-H264 MP4 videos', async () => {
  const cases = [
    Buffer.from('fake video'),
    Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from('ftyp'),
      Buffer.alloc(40),
    ]),
    await clip('long.mp4', 31),
    await clip('large.mp4', 1, 'libx264', '1922x1080'),
    await clip('codec.mp4', 1, 'mpeg4'),
  ];
  for (const bytes of cases)
    await expect(inspector.inspect(bytes, 'VIDEO')).rejects.toMatchObject({
      response: { code: 'EVIDENCE_INVALID_FILE' },
    });
}, 30_000);

it('derives duration from decoded frames when a browser-style WebM has no duration header', async () => {
  const result = spawnSync(
    ffmpeg,
    [
      '-nostdin',
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=orange:s=640x360:r=15:d=1',
      '-an',
      '-c:v',
      'libvpx',
      '-threads',
      '1',
      '-f',
      'webm',
      'pipe:1',
    ],
    { timeout: 20_000 },
  );
  expect(result.status).toBe(0);
  const actual = await inspector.inspect(result.stdout, 'VIDEO');
  expect(actual).toMatchObject({
    mimeType: 'video/webm',
    width: 640,
    height: 360,
  });
  expect(actual.durationSeconds).toBeGreaterThan(0.9);
  expect(actual.durationSeconds).toBeLessThanOrEqual(1.1);
});
