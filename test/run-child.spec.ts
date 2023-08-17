import { ChildProcess, spawnSync } from 'child_process';

describe('running the child', () => {
  it('fires twice to stderr without including DUMP_STACKS_STDOUT_OUTPUT', async () => {
    const child = spawnSync(
      process.argv[0],
      [require.resolve('./child'), '250'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf-8',
        env: {
          DUMP_STACKS_OBSERVE_MS: '10',
          DUMP_STACKS_CHECK_MS: '10',
          DUMP_STACKS_REPORT_ONCE_MS: '100',
          DUMP_STACKS_IGNORE_INITIAL_SPINS: '0',
        },
      },
    );
    if (child.error) {
      throw child.error;
    }
    expect([child.status, child.signal]).toEqual([0, null]);
    const prefix = '{"name":"dump-stacks"';
    expect(child.stderr).toContain(prefix);
    const lines = child.stderr
      .split('\n')
      .filter((line) => line.startsWith(prefix))
      .map((line) => JSON.parse(line));
    expect(lines).toHaveLength(2);

    expect(lines[0]).toMatchObject({
      name: 'dump-stacks',
      blockedMs: expect.any(Number),
      stack: expect.stringContaining('burnFor'),
    });

    expect(lines[0].blockedMs).toBeGreaterThan(250 - 10 - 10);
    expect(lines[0].blockedMs).toBeLessThan(500);

    expect(lines[1]).toMatchObject({
      name: 'dump-stacks',
      blockedMs: expect.any(Number),
      stack: expect.stringContaining('burnFor'),
    });

    expect(lines[1].blockedMs).toBeGreaterThan(250 - 10 - 10);
    expect(lines[1].blockedMs).toBeLessThan(500);
  });

  it('fires twice to stdout when DUMP_STACKS_STDOUT_OUTPUT=1', async () => {
    const child = spawnSync(
      process.argv[0],
      [require.resolve('./child'), '250'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf-8',
        env: {
          DUMP_STACKS_OBSERVE_MS: '10',
          DUMP_STACKS_CHECK_MS: '10',
          DUMP_STACKS_REPORT_ONCE_MS: '100',
          DUMP_STACKS_IGNORE_INITIAL_SPINS: '0',
          DUMP_STACKS_STDOUT_OUTPUT: '1'
        },
      },
    );
    if (child.error) {
      throw child.error;
    }
    expect([child.status, child.signal]).toEqual([0, null]);
    const prefix = '{"name":"dump-stacks"';
    expect(child.stdout).toContain(prefix);
    const lines = child.stdout
      .split('\n')
      .filter((line) => line.startsWith(prefix))
      .map((line) => JSON.parse(line));
    expect(lines).toHaveLength(2);

    expect(lines[0]).toMatchObject({
      name: 'dump-stacks',
      blockedMs: expect.any(Number),
      stack: expect.stringContaining('burnFor'),
    });

    expect(lines[0].blockedMs).toBeGreaterThan(250 - 10 - 10);
    expect(lines[0].blockedMs).toBeLessThan(500);

    expect(lines[1]).toMatchObject({
      name: 'dump-stacks',
      blockedMs: expect.any(Number),
      stack: expect.stringContaining('burnFor'),
    });

    expect(lines[1].blockedMs).toBeGreaterThan(250 - 10 - 10);
    expect(lines[1].blockedMs).toBeLessThan(500);
  });

  it('captures total block time', async () => {
    const child = spawnSync(
      process.argv[0],
      [require.resolve('./child'), '500'],
      {
        stdio: ['ignore', 'inherit', 'pipe'],
        encoding: 'utf-8',
        env: {
          DUMP_STACKS_OBSERVE_MS: '10',
          DUMP_STACKS_CHECK_MS: '10',
          DUMP_STACKS_REPORT_ONCE_MS: '100',
          DUMP_STACKS_IGNORE_INITIAL_SPINS: '0',
        },
      },
    );
    if (child.error) {
      throw child.error;
    }
    const prefix = '{"name":"dump-stacks"';
    const lines = child.stderr
      .split('\n')
      .filter((line) => line.startsWith(prefix))
      .map((line) => JSON.parse(line));

    expect(lines).toHaveLength(2);
    expect(lines[0].blockedMs).toBeGreaterThan(400);
    expect(lines[0].blockedMs).toBeLessThan(800);
    expect(lines[1].blockedMs).toBeGreaterThan(400);
    expect(lines[1].blockedMs).toBeLessThan(800);
  });

  it('ignores an import-time block', () => {
    const child = spawnSync(
      process.argv[0],
      [require.resolve('./child-slow-import'), '500'],
      {
        stdio: ['ignore', 'inherit', 'pipe'],
        encoding: 'utf-8',
        env: {
          DUMP_STACKS_OBSERVE_MS: '10',
          DUMP_STACKS_CHECK_MS: '10',
          DUMP_STACKS_REPORT_ONCE_MS: '100',
          DUMP_STACKS_IGNORE_INITIAL_SPINS: '0',
        },
      },
    );
    if (child.error) {
      throw child.error;
    }
    expect(child.stderr).toEqual('');
  });

  it('ignores initial spins by default', () => {
    const child = spawnSync(
      process.argv[0],
      [require.resolve('./child-initial-delays'), '200'],
      {
        stdio: ['ignore', 'inherit', 'pipe'],
        encoding: 'utf-8',
        env: {
          DUMP_STACKS_OBSERVE_MS: '10',
          DUMP_STACKS_CHECK_MS: '10',
          DUMP_STACKS_REPORT_ONCE_MS: '100',
        },
      },
    );
    if (child.error) {
      throw child.error;
    }
    const prefix = '{"name":"dump-stacks"';
    const lines = child.stderr
      .split('\n')
      .filter((line) => line.startsWith(prefix))
      .map((line) => JSON.parse(line));
    expect(lines).toHaveLength(1);
  });

  it('can observe initial spins', () => {
    const child = spawnSync(
      process.argv[0],
      [require.resolve('./child-initial-delays'), '200'],
      {
        stdio: ['ignore', 'inherit', 'pipe'],
        encoding: 'utf-8',
        env: {
          DUMP_STACKS_OBSERVE_MS: '10',
          DUMP_STACKS_CHECK_MS: '10',
          DUMP_STACKS_REPORT_ONCE_MS: '100',
          DUMP_STACKS_IGNORE_INITIAL_SPINS: '0',
        },
      },
    );
    if (child.error) {
      throw child.error;
    }
    const prefix = '{"name":"dump-stacks"';
    const lines = child.stderr
      .split('\n')
      .filter((line) => line.startsWith(prefix))
      .map((line) => JSON.parse(line));
    expect(lines).toHaveLength(2);
  });
});
