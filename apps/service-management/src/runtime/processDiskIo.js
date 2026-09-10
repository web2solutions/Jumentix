/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const DEFAULT_TIMEOUT_MS = 80;
const DARWIN_HELPER = path.join(__dirname, 'darwinProcessDiskIo.py');

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseLinuxIoText(text) {
  const fields = {};
  String(text || '').split('\n').forEach((line) => {
    const match = /^(\w+):\s+(\d+)\s*$/.exec(line.trim());
    if (!match) return;
    fields[match[1]] = toFiniteNumber(match[2]);
  });
  return {
    supported: true,
    platform: 'linux',
    readBytes: toFiniteNumber(fields.read_bytes),
    writeBytes: toFiniteNumber(fields.write_bytes),
    rchar: toFiniteNumber(fields.rchar),
    wchar: toFiniteNumber(fields.wchar),
    syscr: toFiniteNumber(fields.syscr),
    syscw: toFiniteNumber(fields.syscw),
    collectedAt: new Date().toISOString()
  };
}

function readLinuxDiskIo(pid) {
  try {
    const text = fs.readFileSync(`/proc/${pid}/io`, 'utf8');
    return parseLinuxIoText(text);
  } catch (error) {
    return {
      supported: true,
      platform: 'linux',
      error: error instanceof Error ? error.message : String(error),
      code: error instanceof Error && error.code ? String(error.code) : 'LINUX_IO_READ_ERROR',
      collectedAt: new Date().toISOString()
    };
  }
}

function execFileJson(command, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(command, args, {
      timeout: timeoutMs,
      encoding: 'utf8',
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          ok: false,
          error: error.message || String(error),
          code: error.code ? String(error.code) : 'EXEC_ERROR',
          stderr: String(stderr || '')
        });
        return;
      }
      try {
        resolve({ ok: true, payload: JSON.parse(String(stdout || '{}')) });
      } catch (parseError) {
        resolve({
          ok: false,
          error: parseError instanceof Error ? parseError.message : String(parseError),
          code: 'JSON_PARSE_ERROR',
          stdout: String(stdout || '')
        });
      }
    });
  });
}

async function readDarwinDiskIo(pid, timeoutMs) {
  const result = await execFileJson('python3', [DARWIN_HELPER, String(pid)], timeoutMs);
  if (!result.ok) {
    return {
      supported: true,
      platform: 'darwin',
      error: result.error,
      code: result.code,
      collectedAt: new Date().toISOString()
    };
  }
  const payload = result.payload || {};
  if (payload.error) {
    return {
      supported: true,
      platform: 'darwin',
      error: String(payload.error),
      code: String(payload.code || 'DARWIN_IO_ERROR'),
      collectedAt: new Date().toISOString()
    };
  }
  return {
    supported: true,
    platform: 'darwin',
    readBytes: toFiniteNumber(payload.readBytes),
    writeBytes: toFiniteNumber(payload.writeBytes),
    collectedAt: new Date().toISOString()
  };
}

async function readWindowsDiskIo(pid, timeoutMs) {
  const script = [
    `$p = Get-Process -Id ${Number(pid)} -ErrorAction Stop;`,
    `@{ supported = $true; platform = 'win32';`,
    `  readBytes = [int64]$p.IOReadBytes; writeBytes = [int64]$p.IOWriteBytes`,
    `} | ConvertTo-Json -Compress`
  ].join(' ');
  const result = await execFileJson('powershell', ['-NoProfile', '-Command', script], timeoutMs);
  if (!result.ok) {
    return {
      supported: true,
      platform: 'win32',
      error: result.error,
      code: result.code,
      collectedAt: new Date().toISOString()
    };
  }
  const payload = result.payload || {};
  return {
    supported: true,
    platform: 'win32',
    readBytes: toFiniteNumber(payload.readBytes),
    writeBytes: toFiniteNumber(payload.writeBytes),
    collectedAt: new Date().toISOString()
  };
}

async function readProcessDiskIo(pid, options = {}) {
  const timeoutMs = toFiniteNumber(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const platform = options.platform || process.platform;
  const numericPid = toFiniteNumber(pid, NaN);
  if (!Number.isFinite(numericPid) || numericPid <= 0) {
    return {
      supported: false,
      platform,
      error: 'pid required',
      code: 'INVALID_PID',
      collectedAt: new Date().toISOString()
    };
  }
  if (platform === 'linux') return readLinuxDiskIo(numericPid);
  if (platform === 'darwin') return readDarwinDiskIo(numericPid, timeoutMs);
  if (platform === 'win32') return readWindowsDiskIo(numericPid, timeoutMs);
  return {
    supported: false,
    platform,
    error: `disk I/O unsupported on ${platform}`,
    code: 'UNSUPPORTED_PLATFORM',
    collectedAt: new Date().toISOString()
  };
}

async function attachProcessDiskIo(processes, options = {}) {
  const list = Array.isArray(processes) ? processes : [];
  return Promise.all(list.map(async (processEntry) => {
    const diskIo = await readProcessDiskIo(processEntry?.pid, options);
    return { ...processEntry, diskIo };
  }));
}

module.exports = {
  attachProcessDiskIo,
  parseLinuxIoText,
  readProcessDiskIo,
  DEFAULT_TIMEOUT_MS
};
