#!/usr/bin/env bun
/**
 * JUM-158 — exercise every discovered route, and every internal link they emit.
 *
 * The four Cypress specs this complements visit four routes. `discover-routes`
 * finds 157. A browser run over 157 routes would be slow enough that nobody
 * runs it, so the split is deliberate:
 *
 *  - this sweep answers "does every public URL resolve, and does every internal
 *    link point at something real" over HTTP, in seconds;
 *  - Cypress keeps the questions that need a browser — console errors,
 *    hydration, accessibility, responsive navigation.
 *
 * Fails on 404 and 5xx by route, and on any internal link that resolves to
 * neither. A link is checked once however many pages emit it.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverRoutes } from './discover-routes.mjs';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sitePort = Number(process.env.JUMENTIX_WEBSITE_PORT ?? '3010');
const baseUrl = process.env.JUMENTIX_WEBSITE_BASE_URL || `http://127.0.0.1:${sitePort}`;
const bunCommand = process.platform === 'win32' ? 'bun.exe' : 'bun';
const externalServer = Boolean(process.env.JUMENTIX_WEBSITE_BASE_URL);
const concurrency = Number(process.env.JUMENTIX_WEBSITE_SWEEP_CONCURRENCY ?? '8');

const startServer = () => spawn(bunCommand, ['run', 'start'], {
  stdio: 'inherit',
  cwd: websiteRoot,
  env: { ...process.env, PORT: String(sitePort) }
});

const waitForServer = async () => {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) });
      if (response.ok || response.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await delay(1_000);
  }
  throw new Error(`website did not start on ${baseUrl} within 90s`);
};

/**
 * Internal `href`s only. `/_next` is build output rather than a route, and
 * anchors and query strings address a place inside a page, not another page.
 */
const extractInternalLinks = (html) => {
  const links = new Set();
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (!href?.startsWith('/') || href.startsWith('/_next')) continue;
    const [pathname] = href.replaceAll('&amp;', '&').split(/[?#]/);
    if (pathname) links.add(pathname.replace(/\/+$/, '') || '/');
  }
  return [...links];
};

async function mapWithConcurrency(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

const fetchRoute = async (route) => {
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: 'text/html' }
    });
    const html = response.headers.get('content-type')?.includes('text/html')
      ? await response.text()
      : '';
    return { route, status: response.status, html };
  } catch (error) {
    return { route, status: 0, html: '', error: error instanceof Error ? error.message : String(error) };
  }
};

async function sweep() {
  const routes = discoverRoutes();
  process.stdout.write(`[website] sweeping ${routes.length} discovered routes\n`);

  const responses = await mapWithConcurrency(routes, concurrency, fetchRoute);
  const failures = [];

  for (const { route, status, error } of responses) {
    if (status === 0) failures.push(`route ${route} could not be reached: ${error}`);
    else if (status === 404) failures.push(`route ${route} returned 404`);
    else if (status >= 500) failures.push(`route ${route} returned ${status}`);
    else if (status >= 400) failures.push(`route ${route} returned ${status}`);
  }

  // Every internal link, deduplicated across the whole site, and never
  // re-checking a URL that is itself a discovered route we just fetched.
  const known = new Map(responses.map((entry) => [entry.route, entry.status]));
  const linkOrigins = new Map();
  for (const { route, html } of responses) {
    for (const link of extractInternalLinks(html)) {
      if (known.has(link)) continue;
      if (!linkOrigins.has(link)) linkOrigins.set(link, route);
    }
  }

  const links = [...linkOrigins.keys()];
  process.stdout.write(`[website] checking ${links.length} internal links not already swept\n`);
  const linkResults = await mapWithConcurrency(links, concurrency, fetchRoute);

  for (const { route: link, status, error } of linkResults) {
    const origin = linkOrigins.get(link);
    if (status === 0) failures.push(`broken internal link ${link} (linked from ${origin}): ${error}`);
    else if (status >= 400) failures.push(`broken internal link ${link} (linked from ${origin}) returned ${status}`);
  }

  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`[website] ${failure}\n`);
    throw new Error(`website route sweep failed: ${failures.length} problem(s)`);
  }

  process.stdout.write(
    `[website] route sweep passed: ${routes.length} routes, ${links.length} additional internal links\n`
  );
}

async function main() {
  let server;
  if (!externalServer) {
    server = startServer();
    await waitForServer();
  }
  try {
    await sweep();
  } finally {
    server?.kill('SIGTERM');
  }
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
