/**
 * Remap an LCOV record from a built `dist/*.js` file back to the TypeScript
 * source it was compiled from, using the adjacent `.js.map` sidecar (Req 065).
 *
 * `packages/cli-init` (and any other `tsc`-built package tested against its
 * own `dist/`, per that package's own convention) writes coverage keyed to
 * the compiled file. `check-patch-coverage.js` matches by the exact `.ts`
 * path in the git diff, so every line in such a package always reads as
 * "no coverage data" — not because it is untested, but because the data
 * lives under a path the checker never looks at. This module is the fix:
 * a minimal source-map-v3 decoder (no dependency — see below) that turns a
 * dist-keyed LCOV record into one keyed by the original source line numbers.
 *
 * No source-map library is used deliberately. `source-map`/`@jridgewell/*`
 * are only present here as transitive, unhoisted dependencies of other
 * tooling (istanbul-lib-source-maps, ts-jest); requiring one directly would
 * be a name that happens to resolve today through someone else's dependency
 * tree, not a real dependency of this package, and a bun install elsewhere
 * in the tree can move or drop it. Decoding a VLQ mappings string is a small,
 * fully-specified problem, and only line numbers are needed here (no
 * generated-column precision, no names) — segment 0 of each generated line
 * gives the answer, so the decoder ends after that.
 */
const fs = require('fs');
const path = require('path');

const BASE64_VLQ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VLQ_BASE_SHIFT = 5;
const VLQ_BASE = 1 << VLQ_BASE_SHIFT;
const VLQ_BASE_MASK = VLQ_BASE - 1;
const VLQ_CONTINUATION_BIT = VLQ_BASE;

const CHAR_TO_INT = new Map(BASE64_VLQ_CHARS.split('').map((char, index) => [char, index]));

/** One VLQ-encoded, zig-zag signed value per spec, and where it ended. */
function decodeVlq(segment, startAt) {
  let result = 0;
  let shift = 0;
  let index = startAt;
  let continues = true;
  while (continues) {
    const digit = CHAR_TO_INT.get(segment[index]);
    if (digit === undefined) {
      throw new Error(`Invalid base64 VLQ character at offset ${index}`);
    }
    index += 1;
    continues = Boolean(digit & VLQ_CONTINUATION_BIT);
    result += (digit & VLQ_BASE_MASK) * (2 ** shift);
    shift += VLQ_BASE_SHIFT;
  }
  const isNegative = (result & 1) === 1;
  const magnitude = Math.floor(result / 2);
  return { value: isNegative ? -magnitude : magnitude, endAt: index };
}

/**
 * Decode a source-map-v3 `mappings` string into, for each 1-indexed
 * generated line, the 1-indexed original line in `sources[sourceIndex]` that
 * its first segment points to. Generated lines with no segment, or whose
 * first segment carries no source (a 1-field, generated-only segment), are
 * absent from the result — there is nothing truthful to attribute them to.
 */
function firstOriginalLinePerGeneratedLine(mappings) {
  const perLine = new Map();
  let sourceIndex = 0;
  let sourceLine = 0;
  let generatedLine = 1;

  for (const lineText of String(mappings || '').split(';')) {
    if (lineText === '') {
      generatedLine += 1;
      continue;
    }
    let firstSegmentSeen = false;
    for (const segment of lineText.split(',')) {
      if (segment === '') continue;
      // Every segment's generated column is relative to the previous one on
      // the same line, but decoding it is only needed to advance the cursor.
      let cursor = decodeVlq(segment, 0).endAt;
      if (cursor < segment.length) {
        const decodedSourceIndex = decodeVlq(segment, cursor);
        sourceIndex += decodedSourceIndex.value;
        cursor = decodedSourceIndex.endAt;
        const decodedSourceLine = decodeVlq(segment, cursor);
        sourceLine += decodedSourceLine.value;
        // Column and (optional) name fields are decoded to be spec-correct
        // about cursor position, even though only the line is kept.
        cursor = decodeVlq(segment, decodedSourceLine.endAt).endAt;
        if (cursor < segment.length) cursor = decodeVlq(segment, cursor).endAt;
        if (!firstSegmentSeen) {
          perLine.set(generatedLine, { sourceIndex, sourceLine: sourceLine + 1 });
          firstSegmentSeen = true;
        }
      }
    }
    generatedLine += 1;
  }

  return perLine;
}

/**
 * Load `${jsPath}.map`, resolve its (single-source) `sources` entry to a
 * repository-relative `.ts` path, and return the generated→original line
 * table. Returns `null` when there is no sidecar map, or the map names more
 * than one source — multi-source dist bundles are not this package's shape,
 * and guessing which source a line belongs to would be worse than leaving it
 * unmapped.
 */
function loadDistSourceMap(jsPath, repoRoot) {
  const mapPath = `${jsPath}.map`;
  if (!fs.existsSync(mapPath)) return null;
  let map;
  try {
    map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(map.sources) || map.sources.length !== 1) return null;

  const sourceRoot = map.sourceRoot || '';
  const resolvedSource = path.resolve(path.dirname(mapPath), sourceRoot, map.sources[0]);
  const relativeSource = path.relative(repoRoot, resolvedSource).replace(/\\/g, '/');
  if (!relativeSource.endsWith('.ts') || relativeSource.startsWith('..')) return null;

  return {
    sourcePath: relativeSource,
    generatedToOriginal: firstOriginalLinePerGeneratedLine(map.mappings)
  };
}

/** `DA:<line>,<hits>` → `{ line, hits }`, or `null` for any other line. */
function parseDaLine(line) {
  if (!line.startsWith('DA:')) return null;
  const [lineNumberRaw, hitsRaw] = line.slice(3).split(',');
  const lineNumber = Number(lineNumberRaw);
  const hits = Number(hitsRaw);
  if (Number.isNaN(lineNumber) || Number.isNaN(hits)) return null;
  return { line: lineNumber, hits };
}

/**
 * Rewrite one `SF:.../dist/**.js` … `end_of_record` LCOV record to
 * `SF:` the original `.ts` source, remapping every `DA:` line through the
 * sidecar source map and recomputing `LF`/`LH`. Two generated lines mapping
 * to the same original line take the higher hit count — an OR of "was this
 * line reached", not a sum, so one source line compiled into several
 * generated statements is not counted as though it ran that many times more.
 *
 * Records with no sidecar map, an unusable one, or no `DA:` lines at all are
 * returned unchanged: this is a remap, not a filter, and a file this cannot
 * help is exactly as informative as it was before.
 */
function remapDistLcovRecord(record, repoRoot) {
  const lines = record.split('\n');
  const sfLine = lines.find((line) => line.startsWith('SF:'));
  if (!sfLine) return record;
  const jsRelativePath = sfLine.slice(3);
  const jsAbsolutePath = path.isAbsolute(jsRelativePath)
    ? jsRelativePath
    : path.join(repoRoot, jsRelativePath);

  const sourceMap = loadDistSourceMap(jsAbsolutePath, repoRoot);
  if (!sourceMap) return record;

  const originalHits = new Map();
  for (const line of lines) {
    const da = parseDaLine(line);
    if (!da) continue;
    const mapped = sourceMap.generatedToOriginal.get(da.line);
    if (!mapped) continue;
    const previous = originalHits.get(mapped.sourceLine) || 0;
    originalHits.set(mapped.sourceLine, Math.max(previous, da.hits));
  }
  if (originalHits.size === 0) return record;

  const sortedLines = [...originalHits.keys()].sort((a, b) => a - b);
  const daLines = sortedLines.map((lineNumber) => `DA:${lineNumber},${originalHits.get(lineNumber)}`);
  const hitLines = sortedLines.filter((lineNumber) => originalHits.get(lineNumber) > 0);

  // FN:/FNDA:/BRDA: carry generated line numbers this function does not
  // remap (check-patch-coverage.js reads only SF:/DA:, so there is no
  // consumer to remap them for); left in place they would misattribute to
  // the wrong source line, so they are dropped rather than passed through
  // stale. FNF:/FNH:/BRF:/BRH: are plain counts with no line reference and
  // stay accurate regardless.
  const passthroughLines = lines.filter((line) => (
    line !== '' && line !== 'end_of_record'
    && !line.startsWith('SF:') && !line.startsWith('DA:')
    && !line.startsWith('LF:') && !line.startsWith('LH:')
    && !line.startsWith('FN:') && !line.startsWith('FNDA:') && !line.startsWith('BRDA:')
  ));

  return [
    `SF:${sourceMap.sourcePath}`,
    ...passthroughLines,
    ...daLines,
    `LF:${sortedLines.length}`,
    `LH:${hitLines.length}`,
    'end_of_record'
  ].join('\n');
}

module.exports = {
  decodeVlq,
  firstOriginalLinePerGeneratedLine,
  loadDistSourceMap,
  parseDaLine,
  remapDistLcovRecord
};
