/* eslint-disable @typescript-eslint/no-var-requires */
// Namespaced requires: this file is a script, and destructured names would
// collide with sibling suites in the root tsc program.
const coverageGates = require('../run-branch-quality-gate.js');
const coverageMatrix = require('../run-full-test-matrix.js');
const coverageRootPackage = require('../../package.json');

/**
 * Every `ci:gate` step must run in some CI path (JUM-903).
 *
 * Hosted CI never executes the `ci:gate` script: the branch gate runs its
 * preflight list and then `ci:gate:task`, `test:unit` or the strict matrix.
 * Thirteen steps sat only in `ci:gate`, and one of them — the CLI template
 * freshness check — was failing on `dev` while every required check was green.
 * This suite fails the moment a step is added to `ci:gate` alone.
 */

/** Steps CI runs outside the branch-gate script, with where. */
const RUN_ELSEWHERE: Record<string, string> = {
  'check-bun-version': '.circleci/config.yml runs ci-cd/check-bun-version.js in every job',
  'frontend:test:coverage': '.circleci/config.yml coverage job (frontend patch coverage)',
  'frontend:coverage:check': '.circleci/config.yml coverage job, after frontend:test:coverage'
};

function scriptsOf(chain: string): string[] {
  return [...chain.matchAll(/bun run ([\w:.-]+)/g)].map((match) => match[1]);
}

type Step = { script: string };
type Gate = { script: string; preflight: Step[] };

const GATES: Gate[] = [
  coverageGates.TASK_QUALITY_GATE,
  coverageGates.UNIT_QUALITY_GATE,
  coverageGates.FULL_MATRIX_QUALITY_GATE,
  coverageGates.GENERATED_AUTOMATION_QUALITY_GATE
];

function ciRunnableScripts(): Set<string> {
  const gates = GATES;
  const preflight = gates.flatMap((gate) => gate.preflight.map((step) => step.script));
  const selected = gates.map((gate) => gate.script);
  const matrix = coverageMatrix.FULL_TEST_MATRIX.map((cell: Step) => cell.script);
  const staticSteps = scriptsOf(coverageRootPackage.scripts['ci:gate:static']);
  return new Set([
    ...preflight, ...selected, ...matrix, ...staticSteps, ...Object.keys(RUN_ELSEWHERE)
  ]);
}

describe('ci:gate coverage by CI (JUM-903)', () => {
  it('runs every ci:gate step in a preflight, the strict matrix, ci:gate:static or a named CI job', () => {
    expect.hasAssertions();
    const covered = ciRunnableScripts();

    expect(scriptsOf(coverageRootPackage.scripts['ci:gate']).filter((step) => !covered.has(step))).toStrictEqual([]);
  });

  it('runs ci:gate:static ahead of every gate', () => {
    expect.hasAssertions();
    const runsStatic = (gate: Gate) => gate.preflight.some((step) => step.script === 'ci:gate:static');

    expect(GATES.map(runsStatic)).toStrictEqual([true, true, true, true]);
  });

  it('would catch a step added to ci:gate alone (negative control)', () => {
    expect.hasAssertions();
    const covered = ciRunnableScripts();
    const chain = `${coverageRootPackage.scripts['ci:gate']} && bun run imaginary:new-check`;

    expect(scriptsOf(chain).filter((step) => !covered.has(step))).toStrictEqual(['imaginary:new-check']);
  });

  it('names only steps that still exist in ci:gate', () => {
    expect.hasAssertions();
    const gate = new Set(scriptsOf(coverageRootPackage.scripts['ci:gate']));

    expect(Object.keys(RUN_ELSEWHERE).filter((step) => !gate.has(step))).toStrictEqual([]);
  });
});
