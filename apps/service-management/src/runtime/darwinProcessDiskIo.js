/**
 * Darwin per-process disk I/O via libproc.proc_pid_rusage (Bun FFI).
 * Layout matches Apple rusage_info_v2 (starts with ri_uuid[16]).
 */

const RUSAGE_INFO_V2 = 2;
/** sizeof(rusage_info_v2): uuid(16) + 9*u64 (v0) + 6*u64 (v1) + 2*u64 (v2) */
const RUSAGE_INFO_V2_SIZE = 152;
const OFFSET_DISKIO_BYTESREAD = 136;
const OFFSET_DISKIO_BYTESWRITTEN = 144;

let libprocBindings = null;
let libprocLoadError = null;

function loadLibproc() {
  if (libprocBindings) return libprocBindings;
  if (libprocLoadError) throw libprocLoadError;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const { dlopen, FFIType } = require('bun:ffi');
    const lib = dlopen('/usr/lib/libproc.dylib', {
      proc_pid_rusage: {
        args: [FFIType.i32, FFIType.i32, FFIType.ptr],
        returns: FFIType.i32
      }
    });
    libprocBindings = lib.symbols;
    return libprocBindings;
  } catch (error) {
    libprocLoadError = error instanceof Error ? error : new Error(String(error));
    throw libprocLoadError;
  }
}

function readUInt64LE(buffer, offset) {
  // Node/Bun Buffer: readBigUInt64LE when available
  if (typeof buffer.readBigUInt64LE === 'function') {
    return Number(buffer.readBigUInt64LE(offset));
  }
  const low = buffer.readUInt32LE(offset);
  const high = buffer.readUInt32LE(offset + 4);
  return high * 0x100000000 + low;
}

/**
 * @param {number} pid
 * @returns {{ supported: boolean, platform: string, readBytes?: number, writeBytes?: number, error?: string, code?: string, collectedAt: string }}
 */
function readDarwinDiskIo(pid) {
  const collectedAt = new Date().toISOString();
  try {
    const symbols = loadLibproc();
    const buffer = Buffer.alloc(RUSAGE_INFO_V2_SIZE);
    const result = symbols.proc_pid_rusage(pid | 0, RUSAGE_INFO_V2, buffer);
    if (result !== 0) {
      return {
        supported: true,
        platform: 'darwin',
        error: `proc_pid_rusage failed (${result})`,
        code: 'PROC_PID_RUSAGE_FAILED',
        collectedAt
      };
    }
    return {
      supported: true,
      platform: 'darwin',
      readBytes: readUInt64LE(buffer, OFFSET_DISKIO_BYTESREAD),
      writeBytes: readUInt64LE(buffer, OFFSET_DISKIO_BYTESWRITTEN),
      collectedAt
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unavailable = /Cannot find module ['"]bun:ffi['"]|bun:ffi/i.test(message)
      || message.includes('dlopen');
    return {
      supported: !unavailable,
      platform: 'darwin',
      error: message,
      code: unavailable ? 'DARWIN_FFI_UNAVAILABLE' : 'DARWIN_IO_ERROR',
      collectedAt
    };
  }
}

module.exports = {
  readDarwinDiskIo,
  RUSAGE_INFO_V2_SIZE,
  OFFSET_DISKIO_BYTESREAD,
  OFFSET_DISKIO_BYTESWRITTEN
};
