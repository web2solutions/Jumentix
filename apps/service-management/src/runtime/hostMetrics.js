/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');

let previousCpuSample = null;

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function computeCpuUsage(previous, current) {
  if (!previous || !current || previous.length !== current.length) {
    return { usagePercent: null, perCore: [] };
  }
  const perCore = current.map((cpu, index) => {
    const before = previous[index].times;
    const after = cpu.times;
    const idle = after.idle - before.idle;
    const total = Object.keys(after).reduce((sum, key) => sum + (after[key] - before[key]), 0);
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (1 - idle / total) * 100));
  });
  const usagePercent = perCore.length
    ? perCore.reduce((sum, value) => sum + value, 0) / perCore.length
    : null;
  return { usagePercent, perCore };
}

function resolveDiskPaths(projectRoot) {
  const defaults = [
    path.resolve(projectRoot),
    os.tmpdir()
  ];
  const extra = String(process.env.JUMENTIX_SERVICE_MANAGEMENT_DISK_PATHS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
  return [...new Set([...defaults, ...extra])];
}

async function readDiskVolume(targetPath) {
  try {
    const stats = await fs.promises.statfs(targetPath);
    const blockSize = toFiniteNumber(stats.bsize || stats.blksize, 0);
    const blocks = toFiniteNumber(stats.blocks, 0);
    const blocksFree = toFiniteNumber(stats.bfree, 0);
    const blocksAvailable = toFiniteNumber(stats.bavail, blocksFree);
    const totalBytes = blockSize * blocks;
    const freeBytes = blockSize * blocksFree;
    const availableBytes = blockSize * blocksAvailable;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
    return {
      path: targetPath,
      blockSize,
      blocks,
      blocksFree,
      blocksAvailable,
      files: toFiniteNumber(stats.files, 0),
      filesFree: toFiniteNumber(stats.ffree, 0),
      totalBytes,
      freeBytes,
      availableBytes,
      usedBytes,
      usedPercent
    };
  } catch (error) {
    return {
      path: targetPath,
      error: error instanceof Error ? error.message : String(error),
      code: error instanceof Error && error.code ? String(error.code) : 'DISK_STAT_ERROR'
    };
  }
}

async function collectHostMetrics(options = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '../../../..');
  const processRssSumBytes = toFiniteNumber(options.processRssSumBytes, 0);
  const processCpuPercentSum = toFiniteNumber(options.processCpuPercentSum, 0);
  const cpus = os.cpus().map((cpu) => ({
    model: String(cpu.model || ''),
    speedMHz: toFiniteNumber(cpu.speed, 0),
    times: { ...cpu.times }
  }));
  const usage = computeCpuUsage(previousCpuSample, cpus);
  previousCpuSample = cpus;
  const totalBytes = toFiniteNumber(os.totalmem(), 0);
  const freeBytes = toFiniteNumber(os.freemem(), 0);
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  const otherBytes = Math.max(0, usedBytes - processRssSumBytes);
  const disk = await Promise.all(resolveDiskPaths(projectRoot).map(readDiskVolume));
  const loadAvg = os.loadavg();
  return {
    cpu: {
      coreCount: cpus.length,
      model: cpus[0]?.model || '',
      speedMHz: cpus[0]?.speedMHz || 0,
      loadAvg: {
        one: toFiniteNumber(loadAvg[0], 0),
        five: toFiniteNumber(loadAvg[1], 0),
        fifteen: toFiniteNumber(loadAvg[2], 0)
      },
      usagePercent: usage.usagePercent,
      perCore: usage.perCore,
      processCpuPercentSum,
      cpus
    },
    memory: {
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercent,
      processRssSumBytes,
      otherBytes
    },
    disk
  };
}

function resetHostCpuSampleForTests() {
  previousCpuSample = null;
}

module.exports = {
  collectHostMetrics,
  computeCpuUsage,
  resetHostCpuSampleForTests,
  resolveDiskPaths,
  toFiniteNumber
};
