import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { mediaCap } from './config.js';

const require = createRequire(import.meta.url);
const ffmpegPath: unknown = require('ffmpeg-static');
const invalid = () =>
  new BadRequestException({
    code: 'EVIDENCE_INVALID_FILE',
    message:
      'Media must be a valid JPEG/WebP image or MP4/H.264/WebM video within the inspection limits',
  });
const unavailable = () =>
  new ServiceUnavailableException({
    code: 'EVIDENCE_DECODER_UNAVAILABLE',
    message: 'Media verification is unavailable; retry later',
  });
// Bound concurrent native decoders across all service instances, without an
// unbounded in-memory work queue. A busy upload can retry its existing object.
let activeDecoders = 0;
const MAX_DECODERS = 2;
async function run(binary: string, args: string[], timeout: number) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let outputBytes = 0,
      errorBytes = 0,
      settled = false;
    const finish = (error?: Error, value = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    const stop = () => {
      child.kill('SIGKILL');
      finish(invalid());
    };
    const timer = setTimeout(stop, timeout);
    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 256 * 1024) stop();
      else chunks.push(chunk);
    });
    // Consume stderr but never return/log untrusted decoder diagnostics or tags.
    child.stderr.on('data', (chunk: Buffer) => {
      errorBytes += chunk.length;
      if (errorBytes > 64 * 1024) stop();
    });
    child.on('error', () => finish(unavailable()));
    child.on('close', (code) =>
      code === 0
        ? finish(undefined, Buffer.concat(chunks).toString('utf8'))
        : finish(invalid()),
    );
  });
}
type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
};
type Probe = {
  streams?: ProbeStream[];
  format?: {
    format_name?: string;
    duration?: string;
    tags?: Record<string, string>;
  };
};
const positive = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const rate = (value?: string) => {
  if (!value || value === '0/0') return 0;
  const parts = value.split('/').map(Number);
  return parts.length === 2 ? parts[0] / parts[1] : parts[0];
};
export class MediaInspector {
  async inspect(buffer: Buffer, kind: string) {
    if (
      !['IMAGE', 'VIDEO'].includes(kind) ||
      !buffer.length ||
      buffer.length > mediaCap(kind)
    )
      throw invalid();
    if (activeDecoders >= MAX_DECODERS)
      throw new ServiceUnavailableException({
        code: 'EVIDENCE_VERIFIER_BUSY',
        message: 'Media verification is busy; retry this upload shortly',
      });
    activeDecoders++;
    try {
      return kind === 'IMAGE'
        ? await this.image(buffer)
        : await this.video(buffer);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw invalid();
    } finally {
      activeDecoders--;
    }
  }
  private async image(buffer: Buffer) {
    const jpeg = buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const webp =
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!jpeg && !webp) throw invalid();
    const image = sharp(buffer, {
      failOn: 'warning',
      limitInputPixels: 1920 * 1920,
      animated: true,
    }).timeout({ seconds: 5 });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'webp'].includes(metadata.format ?? '') ||
      !metadata.width ||
      !metadata.height ||
      Math.max(metadata.width, metadata.height) > 1920 ||
      (metadata.pages ?? 1) > 1 ||
      metadata.exif ||
      metadata.xmp ||
      metadata.iptc
    )
      throw invalid();
    // metadata() reads headers only. Decode every pixel to catch truncated or
    // corrupt payloads and decompression bombs before attaching the object.
    await image.raw().toBuffer();
    return {
      mimeType: jpeg ? 'image/jpeg' : 'image/webp',
      bytes: buffer.length,
      width: metadata.width,
      height: metadata.height,
      durationSeconds: null,
    };
  }
  private async video(buffer: Buffer) {
    const mp4 =
      buffer.length >= 16 && buffer.toString('ascii', 4, 8) === 'ftyp';
    const webm = buffer
      .subarray(0, 4)
      .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (!mp4 && !webm) throw invalid();
    // Resolve lazily: unsupported server platforms fail closed without breaking
    // unrelated rental reads or requiring a global ffmpeg installation.
    let probeModule: unknown;
    try {
      probeModule = require('@ffprobe-installer/ffprobe');
    } catch {
      throw unavailable();
    }
    const probePath = (probeModule as { path?: unknown })?.path;
    if (typeof probePath !== 'string' || typeof ffmpegPath !== 'string')
      throw unavailable();
    const directory = await mkdtemp(join(tmpdir(), 'rental-evidence-'));
    try {
      const path = join(directory, mp4 ? 'input.mp4' : 'input.webm');
      await writeFile(path, buffer, { mode: 0o600 });
      const output = await run(
        probePath,
        [
          '-v',
          'error',
          '-protocol_whitelist',
          'file',
          '-probesize',
          String(mediaCap('VIDEO')),
          '-show_entries',
          'stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,duration:format=format_name,duration:format_tags=location,location-eng,com.apple.quicktime.location.ISO6709',
          '-of',
          'json',
          '-f',
          mp4 ? 'mov' : 'matroska',
          path,
        ],
        10_000,
      );
      const probe = JSON.parse(output) as Probe;
      const streams = probe.streams ?? [];
      const videos = streams.filter((stream) => stream.codec_type === 'video');
      const audios = streams.filter((stream) => stream.codec_type === 'audio');
      const stream = videos[0];
      if (
        videos.length !== 1 ||
        audios.length > 1 ||
        audios.some(
          (audio) =>
            !['aac', 'opus', 'vorbis', 'mp3'].includes(audio.codec_name ?? ''),
        ) ||
        streams.length !== videos.length + audios.length ||
        !stream ||
        !positive(stream.width) ||
        !positive(stream.height) ||
        Math.max(stream.width!, stream.height!) > 1920 ||
        stream.width! * stream.height! > 1920 * 1080 ||
        rate(stream.avg_frame_rate) > 60.1 ||
        (mp4
          ? stream.codec_name !== 'h264' ||
            !probe.format?.format_name?.split(',').includes('mp4')
          : !['vp8', 'vp9'].includes(stream.codec_name ?? '') ||
            !probe.format?.format_name?.split(',').includes('webm')) ||
        Object.keys(probe.format?.tags ?? {}).length
      )
        throw invalid();
      const declared = Number(probe.format?.duration ?? stream.duration ?? 0);
      if (!Number.isFinite(declared) || declared < 0 || declared > 30)
        throw invalid();
      // Decode the entire video, rather than trusting container duration. Only
      // local file input is permitted; no playlists or network protocols.
      const progress = await run(
        ffmpegPath,
        [
          '-nostdin',
          '-hide_banner',
          '-v',
          'error',
          '-xerror',
          '-threads',
          '1',
          '-protocol_whitelist',
          'file',
          '-f',
          mp4 ? 'mov' : 'matroska',
          '-i',
          path,
          '-map',
          '0:v:0',
          '-map',
          '0:a?',
          '-sn',
          '-dn',
          '-threads',
          '1',
          '-progress',
          'pipe:1',
          '-nostats',
          '-f',
          'null',
          '-',
        ],
        25_000,
      );
      const frames = [...progress.matchAll(/^frame=(\d+)$/gm)].map((match) =>
        Number(match[1]),
      );
      const times = [...progress.matchAll(/^out_time_us=(-?\d+)$/gm)].map(
        (match) => Number(match[1]) / 1_000_000,
      );
      const duration = Math.max(declared, ...times);
      if (
        !positive(duration) ||
        duration > 30 ||
        !frames.length ||
        Math.max(...frames) > 1801 ||
        Math.max(...frames) < 1
      )
        throw invalid();
      return {
        mimeType: mp4 ? 'video/mp4' : 'video/webm',
        bytes: buffer.length,
        width: stream.width!,
        height: stream.height!,
        durationSeconds: Math.round(duration * 1000) / 1000,
      };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
