/**
 * Contract sync for the frontend workspace (requirement 136).
 *
 * The only backend reference a frontend may know is the OpenAPI document.
 * This script reads the versioned YAML spec at the monorepo root
 * (`spec/1.0.0.yml`) and bakes it as JSON into `src/contracts/openapi.json`,
 * so the app and the tests consume the contract as bundled data — never as
 * backend source code.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const monorepoRoot = path.resolve(appRoot, '../..');
const specPath = path.join(monorepoRoot, 'spec', '1.0.0.yml');
const outputPath = path.join(appRoot, 'src', 'contracts', 'openapi.json');

const raw = await fs.readFile(specPath, 'utf8');
const openApi = YAML.parse(raw);

if (!openApi?.paths || Object.keys(openApi.paths).length === 0) {
  throw new Error(`sync-contracts: ${specPath} parsed but has no paths`);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(openApi, null, 2)}\n`, 'utf8');
console.log(`[sync-contracts] wrote ${Object.keys(openApi.paths).length} paths to src/contracts/openapi.json`);
