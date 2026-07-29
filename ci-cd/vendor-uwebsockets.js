/**
 * uWebSockets.js vendoring step.
 *
 * Runs as `postinstall`. Materializes `node_modules/uWebSockets.js` outside the
 * package manager, because Bun cannot deliver it. Two independent defects had
 * to be solved, and it is worth recording both — the first one masks the second,
 * so fixing only the visible one looks like progress and changes nothing.
 *
 * 1. Bun cannot LINK a GitHub-tarball dependency.
 *    `hyper-express@6.17.3` declares
 *    `"uWebSockets.js": "github:uNetworking/uWebSockets.js#v20.51.0"`.
 *    Bun downloads and extracts it correctly (127 MB in its cache) and then
 *    fails at the link step with `ENOENT ... (clonefileat)`, leaving a dangling
 *    symlink in the isolated store. Reproduced across all four install backends
 *    (clonefile, copyfile, hardlink, symlink) and both linkers, so it is not a
 *    copy-strategy problem. See BUN-INSTALL-COMPATIBILITY-AUDIT.md.
 *
 * 2. uWS v20.51.0 has no binary for Bun's ABI.
 *    `uws.js` resolves `./uws_<platform>_<arch>_<process.versions.modules>.node`
 *    with no fallback. Bun 1.3.14 reports ABI **137**; v20.51.0 ships only
 *    108/115/127/131. So even a perfectly linked v20.51.0 cannot load under Bun.
 *
 *    uWS **v20.69.0** ships `_137` (and `_147`), which is why this script pins
 *    forward rather than reproducing the version hyper-express asks for. Same
 *    major, so the hyper-express API surface is unchanged.
 *
 * Fixing both of those still does not make uWS work on Bun, and the reason is
 * worth stating here so nobody repeats the investigation:
 *
 *   TypeError: symbol 'napi_register_module_v1' not found in native module.
 *
 * uWebSockets.js compiles against the raw V8/Node internal ABI
 * (NODE_MODULE_VERSION), not against N-API. Bun implements N-API only, so it
 * cannot load these addons at any version, under any linker or install backend.
 * That is architectural and upstream; there is no configuration that reaches it.
 *
 * hyper-express is therefore a **declared Node-runtime target** under
 * Requirement 096 §4, not a Bun target. This script still runs under Bun and is
 * still required, because the Node path also depends on it: Bun's installer
 * cannot materialize the GitHub tarball at all, so without this step
 * `node_modules/uWebSockets.js` does not exist for *either* runtime.
 *
 * Why fetch-and-verify instead of committing the artifact: the tarball is 31 MB
 * compressed and expands to ~127 MB of prebuilt binaries for 15 platform/ABI
 * triples, of which any given machine needs one. The integrity guarantee that
 * matters — that we get exactly the reviewed bytes — comes from the pinned tag
 * plus the SHA-256 below, not from the file living in git history.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

/** Pinned upstream release. Changing this is a reviewed, deliberate act. */
const UWS_TAG = 'v20.69.0';
const UWS_TARBALL_SHA256 = '691f1f43cb6c4e30c56d7c11968c275130e57b52ac3327bc457c574dedc613d0';
const UWS_TARBALL_URL = `https://codeload.github.com/uNetworking/uWebSockets.js/tar.gz/refs/tags/${UWS_TAG}`;
/** Directory name inside the tarball. */
const UWS_TARBALL_ROOT = `uWebSockets.js-${UWS_TAG.replace(/^v/, '')}`;

const repoRoot = path.resolve(__dirname, '..');
const targetDir = path.join(repoRoot, 'node_modules', 'uWebSockets.js');
const stampFile = path.join(targetDir, '.jumentix-vendored');

/** Files that are not platform binaries but are required at runtime. */
const PORTABLE_FILES = ['uws.js', 'package.json', 'LICENSE', 'ESM_wrapper.mjs'];

function log(message) {
  console.log(`[vendor-uwebsockets] ${message}`);
}

function fail(message) {
  console.error(`[vendor-uwebsockets] ${message}`);
  process.exit(1);
}

/**
 * The binary this runtime will ask for. `uws.js` builds the name from
 * process.platform, process.arch and the ABI, so the vendored copy is only
 * usable if that exact file is present.
 */
function requiredBinaryName() {
  return `uws_${process.platform}_${process.arch}_${process.versions.modules}.node`;
}

/** Already vendored at the pinned tag, with the binary this runtime needs. */
function isUpToDate() {
  if (!fs.existsSync(stampFile)) {
    return false;
  }
  if (fs.readFileSync(stampFile, 'utf8').trim() !== UWS_TAG) {
    return false;
  }
  return fs.existsSync(path.join(targetDir, requiredBinaryName()));
}

function download(destination) {
  log(`fetching uWebSockets.js ${UWS_TAG}`);
  // curl rather than fetch(): this runs as postinstall under whichever runtime
  // invoked the install, and curl is already a hard requirement of the CI images.
  execFileSync('curl', ['-sSL', '--fail', '-o', destination, UWS_TARBALL_URL], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

function verify(tarballPath) {
  const digest = crypto.createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex');
  if (digest !== UWS_TARBALL_SHA256) {
    fail(
      `checksum mismatch for ${UWS_TAG}.\n`
        + `  expected ${UWS_TARBALL_SHA256}\n`
        + `  actual   ${digest}\n`
        + 'Refusing to vendor unverified bytes. If the upstream tag was moved, that is itself '
        + 'the finding — do not update the checksum without establishing why it changed.',
    );
  }
  log(`checksum verified (sha256 ${digest.slice(0, 12)}…)`);
}

/**
 * Extract only what this platform needs: the portable files plus every ABI
 * variant for the current platform/arch. Keeping the sibling ABIs means the
 * same tree works under both Bun (137) and the Node compatibility target (127)
 * without a second fetch — which is exactly what JUM-37's consumer fixtures need.
 */
function extract(tarballPath, stagingDir) {
  const platformGlob = `${UWS_TARBALL_ROOT}/uws_${process.platform}_${process.arch}_*.node`;
  const args = ['-xzf', tarballPath, '-C', stagingDir, '--include', platformGlob];
  for (const file of PORTABLE_FILES) {
    args.push('--include', `${UWS_TARBALL_ROOT}/${file}`);
  }
  // BSD tar (macOS) and GNU tar both accept --include with this ordering.
  execFileSync('tar', args, { stdio: ['ignore', 'ignore', 'inherit'] });
}

/**
 * Repair the dangling symlinks the isolated linker left behind.
 *
 * Vendoring the top-level `node_modules/uWebSockets.js` is not sufficient under
 * `--linker=isolated`: each dependent resolves through its own store directory,
 * `node_modules/.bun/<pkg>@<version>/node_modules/uWebSockets.js`, and Bun
 * created those symlinks pointing at a store entry it then failed to populate.
 * A dependent therefore never reaches the top-level copy — it hits ENOENT on a
 * link that exists but resolves to nothing.
 *
 * Repointing them at the vendored directory is what actually makes
 * `require('uWebSockets.js')` work from inside hyper-express.
 */
function repairIsolatedLinks() {
  const storeRoot = path.join(repoRoot, 'node_modules', '.bun');
  if (!fs.existsSync(storeRoot)) {
    return 0;
  }

  let repaired = 0;
  for (const entry of fs.readdirSync(storeRoot)) {
    const linkPath = path.join(storeRoot, entry, 'node_modules', 'uWebSockets.js');
    const parentDir = path.dirname(linkPath);
    if (!fs.existsSync(parentDir)) {
      continue;
    }

    // `existsSync` follows symlinks, so a dangling link reports false here while
    // `lstatSync` still sees it. That asymmetry is the detection.
    let isDangling = false;
    try {
      fs.lstatSync(linkPath);
      isDangling = !fs.existsSync(linkPath);
    } catch {
      isDangling = false;
    }

    if (!isDangling) {
      continue;
    }

    fs.rmSync(linkPath, { recursive: true, force: true });
    fs.symlinkSync(path.relative(parentDir, targetDir), linkPath, 'dir');
    repaired += 1;
  }

  if (repaired > 0) {
    log(`repaired ${repaired} dangling isolated-store link(s)`);
  }
  return repaired;
}

function main() {
  if (isUpToDate()) {
    log(`already vendored at ${UWS_TAG} with ${requiredBinaryName()}; nothing to do`);
    repairIsolatedLinks();
    return;
  }

  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-uws-'));
  const tarballPath = path.join(stagingRoot, 'uws.tar.gz');

  try {
    download(tarballPath);
    verify(tarballPath);
    extract(tarballPath, stagingRoot);

    const extractedDir = path.join(stagingRoot, UWS_TARBALL_ROOT);
    if (!fs.existsSync(extractedDir)) {
      fail(`extraction produced no ${UWS_TARBALL_ROOT} directory.`);
    }

    // Fail closed *before* replacing a working tree: if this runtime's binary
    // is absent, an unusable copy is worse than the previous state, because the
    // failure moves from install time to the first request served.
    const required = requiredBinaryName();
    if (!fs.existsSync(path.join(extractedDir, required))) {
      const available = fs
        .readdirSync(extractedDir)
        .filter((entry) => entry.endsWith('.node'))
        .join(', ') || '(none)';
      fail(
        `uWebSockets.js ${UWS_TAG} has no ${required} for this runtime `
          + `(${process.platform}/${process.arch}, ABI ${process.versions.modules}).\n`
          + `  available for this platform: ${available}\n`
          + 'A newer uWS release may be required, or this runtime is unsupported. Do not skip '
          + 'this check: hyper-express would install cleanly and then fail at request time.',
      );
    }

    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.renameSync(extractedDir, targetDir);
    fs.writeFileSync(stampFile, `${UWS_TAG}\n`);

    const binaries = fs.readdirSync(targetDir).filter((entry) => entry.endsWith('.node'));
    log(`vendored ${UWS_TAG} with ${binaries.length} binary(ies) for ${process.platform}/${process.arch}`);
    log(`runtime ABI ${process.versions.modules} satisfied by ${required}`);

    repairIsolatedLinks();
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

main();
