import { createPool } from './database.js';
vi.mock('../config.js', () => ({
  loadConfig: () => ({
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    ca: 'test-ca',
  }),
}));
it('handles idle pool errors without throwing or logging credentials/client details', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const pool = createPool();
  try {
    const error = Object.assign(new Error('sensitive connection details'), {
      password: 'never-log-this',
    });
    expect(() =>
      pool.emit('error', error, {
        connectionParameters: { password: 'never-log-this' },
      }),
    ).not.toThrow();
    const output = JSON.stringify(log.mock.calls);
    expect(output).toContain('database.pool.error');
    expect(output).not.toContain('never-log-this');
    expect(output).not.toContain('sensitive connection details');
    expect(output).not.toContain('connectionParameters');
  } finally {
    await pool.end();
    log.mockRestore();
  }
});
