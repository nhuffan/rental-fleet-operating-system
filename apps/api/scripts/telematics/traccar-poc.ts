import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createPool } from '../../src/database/database.js';
import { loadConfig } from '../../src/config.js';
const image =
  'traccar/traccar:6.16.0@sha256:03ebb7ed2b219d4f25c326873bd022f5062f80bcae622a9d9422846b51951eda';
const config = loadConfig();
if (
  config.environment !== 'development' ||
  new URL(config.supabaseUrl).hostname !== 'eeryymswcufnebibigqf.supabase.co'
)
  throw Error('TEST feed is development-only');
const uid = process.argv.find((x) => x.startsWith('--uid='))?.slice(6);
if (!uid || !/^TEST-[A-Za-z0-9._:-]{1,123}$/.test(uid))
  throw Error('Use --uid=TEST-<registered Traccar device UID>');
const token = process.env.GPS_TRACCAR_TOKEN;
if (!token || token.length < 32)
  throw Error('Configure server-only GPS_TRACCAR_TOKEN first');
const escape = (v: string) =>
  v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const pool = createPool();
const dir = mkdtempSync(join(tmpdir(), 'rental-traccar-test-'));
const name = 'rental-traccar-test-' + process.pid;
let owned = false;
mkdirSync(join(dir, 'docker'));
writeFileSync(join(dir, 'docker/config.json'), '{"auths":{}}', { mode: 0o600 });
const docker = (args: string[], timeout = 30000) =>
  spawnSync('docker', ['--config', join(dir, 'docker'), ...args], {
    encoding: 'utf8',
    timeout,
  });
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let cleanupPromise: Promise<void> | undefined;
function cleanup(): Promise<void> {
  return (cleanupPromise ??= (async () => {
    if (owned) {
      const stopped = docker(['rm', '-f', name]);
      if (stopped.status !== 0)
        console.error('Owned TEST container cleanup failed: ' + name);
    } else {
      // Remove only this script's failed create (for example, publish-port conflict).
      const inspect = docker(['inspect', '--format', '{{.Name}}', name]);
      if (inspect.status === 0 && inspect.stdout.trim() === '/' + name)
        docker(['rm', '-f', name]);
    }
    rmSync(dir, { recursive: true, force: true });
    await pool.end();
  })());
}
const onInterrupt = () => {
  void cleanup().finally(() => process.exit(130));
};
const onTerminate = () => {
  void cleanup().finally(() => process.exit(143));
};
process.once('SIGINT', onInterrupt);
process.once('SIGTERM', onTerminate);
try {
  const assignment = await pool.query<{
    business_id: string;
    device_id: string;
    vehicle_id: string;
    assigned_at: Date;
  }>(
    `select a.business_id,a.device_id,a.vehicle_id,a.assigned_at from device_assignments a join gps_devices d on d.id=a.device_id and d.business_id=a.business_id where d.provider='traccar' and d.device_uid=$1 and d.status='ACTIVE' and a.unassigned_at is null`,
    [uid],
  );
  if (assignment.rowCount !== 1)
    throw Error(
      'Register and assign the TEST device to a development vehicle first',
    );
  const a = assignment.rows[0];
  const entries: Record<string, string> = {
    'database.memory': 'true',
    'database.registerUnknown': 'true',
    'database.registerUnknown.regex': 'TEST-[A-Za-z0-9._:-]{1,123}',
    'forward.type': 'json',
    'forward.url': `http://host.docker.internal:${config.port}/api/v1/integrations/traccar/positions`,
    'forward.header': 'X-Traccar-Token: ' + token,
    'forward.retry.enable': 'true',
    'forward.retry.count': '3',
    'filter.enable': 'false',
    'geocoder.enable': 'false',
    'geolocation.enable': 'false',
    'speedLimit.enable': 'false',
    'server.statistics': '',
    'protocols.enable': 'osmand',
    'osmand.port': '5055',
    'web.enable': 'false',
    'logger.console': 'true',
    'logger.level': 'warning',
  };
  const xml = join(dir, 'traccar.xml');
  writeFileSync(
    xml,
    `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd"><properties>${Object.entries(
      entries,
    )
      .map(([key, value]) => `<entry key="${key}">${escape(value)}</entry>`)
      .join('')}</properties>`,
    { mode: 0o600 },
  );
  // Docker refuses a port collision. Never stop or reuse another person's container.
  const run = docker(
    [
      'run',
      '-d',
      '--name',
      name,
      '--publish',
      '127.0.0.1:5055:5055',
      '--mount',
      `type=bind,source=${xml},target=/opt/traccar/conf/traccar.xml,readonly`,
      image,
    ],
    180000,
  );
  if (run.status !== 0)
    throw Error(
      'Cannot start isolated Traccar TEST container; check Docker/image and free port 5055',
    );
  owned = true;
  let ready = false;
  for (let n = 0; n < 30; n++) {
    try {
      await fetch('http://127.0.0.1:5055/', {
        signal: AbortSignal.timeout(1000),
      });
      ready = true;
      break;
    } catch {
      await delay(500);
    }
  }
  if (!ready) throw Error('Traccar startup timed out');
  const time = new Date();
  const send = async (at: Date, lat: string) => {
    const response = await fetch(
      'http://127.0.0.1:5055/?' +
        new URLSearchParams({
          id: uid,
          lat,
          lon: '106.7009',
          timestamp: at.toISOString(),
          speed: '12',
          bearing: '90',
          ignition: 'true',
        }),
    );
    if (response.status !== 200) throw Error('OsmAnd packet rejected');
  };
  await send(time, '10.7769');
  await send(time, '10.7769');
  // Delayed but still inside the actual historical assignment interval.
  const delayed = new Date(
    Math.max(a.assigned_at.getTime() + 1, time.getTime() - 60000),
  );
  if (delayed < time) await send(delayed, '10.7770');
  let verified = false;
  let evidence: unknown;
  for (let n = 0; n < 30; n++) {
    const rows = await pool.query<{
      recorded_at: Date;
      latitude: number;
      speed_kph: number;
      source_mode: string;
    }>(
      `select recorded_at,latitude,speed_kph,source_mode from gps_positions where business_id=$1 and device_id=$2 and recorded_at=any($3::timestamptz[]) order by recorded_at desc,received_at asc,id asc`,
      [a.business_id, a.device_id, [delayed, time]],
    );
    if (
      rows.rows.some((p) => p.recorded_at.getTime() === time.getTime()) &&
      rows.rowCount === (delayed < time ? 2 : 1)
    ) {
      const latest = rows.rows[0];
      if (
        latest.latitude !== 10.7769 ||
        Math.abs(latest.speed_kph - 22.224) > 0.00001 ||
        latest.source_mode !== 'TEST'
      )
        throw Error('Canonical verification failed');
      verified = true;
      evidence = {
        source: 'TEST FEED',
        image,
        packetStatus: 200,
        duplicateStoredOnce: true,
        delayedPreservesCurrent: true,
        vehicleId: a.vehicle_id,
        recordedAt: latest.recorded_at,
        speedKph: latest.speed_kph,
      };
      break;
    }
    await delay(500);
  }
  if (!verified)
    throw Error(
      `Forwarding not verified; check API localhost:${config.port}, token and Docker host.docker.internal connectivity`,
    );
  console.log(JSON.stringify(evidence));
} finally {
  await cleanup();
  process.removeListener('SIGINT', onInterrupt);
  process.removeListener('SIGTERM', onTerminate);
}
