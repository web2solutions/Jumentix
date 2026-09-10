#!/usr/bin/env python3
"""Read Darwin per-process disk I/O via libproc.proc_pid_rusage (ctypes)."""
from __future__ import annotations

import ctypes
import json
import sys


class RusageInfoV2(ctypes.Structure):
    _fields_ = [
        ("ri_user_time", ctypes.c_uint64),
        ("ri_system_time", ctypes.c_uint64),
        ("ri_pkg_idle_wkups", ctypes.c_uint64),
        ("ri_interrupt_wkups", ctypes.c_uint64),
        ("ri_pageins", ctypes.c_uint64),
        ("ri_wired_size", ctypes.c_uint64),
        ("ri_resident_size", ctypes.c_uint64),
        ("ri_phys_footprint", ctypes.c_uint64),
        ("ri_proc_start_abstime", ctypes.c_uint64),
        ("ri_proc_exit_abstime", ctypes.c_uint64),
        ("ri_child_user_time", ctypes.c_uint64),
        ("ri_child_system_time", ctypes.c_uint64),
        ("ri_child_pkg_idle_wkups", ctypes.c_uint64),
        ("ri_child_interrupt_wkups", ctypes.c_uint64),
        ("ri_child_pageins", ctypes.c_uint64),
        ("ri_child_elapsed_abstime", ctypes.c_uint64),
        ("ri_diskio_bytesread", ctypes.c_uint64),
        ("ri_diskio_byteswritten", ctypes.c_uint64),
    ]


RUSAGE_INFO_V2 = 2


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "pid required", "code": "MISSING_PID"}))
        return 2
    try:
        pid = int(sys.argv[1])
    except ValueError:
        print(json.dumps({"error": "invalid pid", "code": "INVALID_PID"}))
        return 2

    libproc = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
    info = RusageInfoV2()
    result = libproc.proc_pid_rusage(ctypes.c_int(pid), ctypes.c_int(RUSAGE_INFO_V2), ctypes.byref(info))
    if result != 0:
        print(json.dumps({
            "error": f"proc_pid_rusage failed ({result})",
            "code": "PROC_PID_RUSAGE_FAILED"
        }))
        return 1

    print(json.dumps({
        "supported": True,
        "platform": "darwin",
        "readBytes": int(info.ri_diskio_bytesread),
        "writeBytes": int(info.ri_diskio_byteswritten)
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
