import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SCRIPT = join(ROOT, 'ci-cd/start-compose-service.sh');

function runWithDockerFailures(failuresBeforeSuccess: number, attempts: number) {
  const bin = mkdtempSync(join(tmpdir(), 'jumentix-redis-compose-'));
  const state = join(bin, 'up-attempts');
  const docker = join(bin, 'docker');

  writeFileSync(
    docker,
    `#!/usr/bin/env bash
set -euo pipefail
state="${state}"
if [[ " $* " == *" up "* ]]; then
  count=0
  [[ -f "$state" ]] && count=$(cat "$state")
  count=$((count + 1))
  printf '%s' "$count" > "$state"
  [[ "$count" -le "${failuresBeforeSuccess}" ]] && exit 1
fi
exit 0
`
  );
  chmodSync(docker, 0o755);

  try {
    const result = spawnSync('bash', [SCRIPT, 'jumentix-test', 'test-compose.yml'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        JUMENTIX_DOCKER_PULL_ATTEMPTS: String(attempts),
        JUMENTIX_DOCKER_PULL_RETRY_DELAY_SECONDS: '0'
      }
    });

    return {
      attempts: Number(readFileSync(state, 'utf8')),
      result
    };
  } finally {
    rmSync(bin, { force: true, recursive: true });
  }
}

describe('start-compose-service', () => {
  it('retries a transient compose startup failure', () => {
    expect.hasAssertions();
    const { attempts, result } = runWithDockerFailures(1, 3);

    expect(result.status).toBe(0);
    expect(attempts).toBe(2);
    expect(result.stderr).toContain('startup attempt 1/3 failed');
  });

  it('fails after the configured retry budget is exhausted', () => {
    expect.hasAssertions();
    const { attempts, result } = runWithDockerFailures(3, 2);

    expect(result.status).toBe(1);
    expect(attempts).toBe(2);
    expect(result.stderr).toContain('startup failed after 2 attempt(s)');
  });
});
