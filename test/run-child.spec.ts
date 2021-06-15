import { ChildProcess, spawnSync } from 'child_process';

describe('running the child', () => {
  it('fires twice', async () => {
    const child = spawnSync(
      process.argv[0],
      [require.resolve('./child'), '250'],
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
        },
      },
    );
    if (child.error) {
      throw child.error;
    }
    expect(child.stderr).toEqual("");
  })
});

async function success(child: ChildProcess) {
  await new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (0 !== code || signal) {
        return reject(`exit status: ${code} / ${signal}`);
      }
      resolve();
    });
  });
}
