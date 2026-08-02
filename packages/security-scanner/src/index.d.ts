/**
 * Types for the first-party Bun install-time vulnerability scanner (JUM-540).
 *
 * The implementation is plain ESM JavaScript — it runs inside `bun install`,
 * before anything in this repository has been built, so it cannot be
 * TypeScript. These declarations exist so consumers and its own suite get the
 * contract checked rather than inferred as `any`.
 *
 * Kept deliberately close to Bun's security scanner API v1: `level` has exactly
 * two values because Bun has exactly two, and both stop CI.
 */

/** A package as Bun resolves it, name and exact version. */
export interface IResolvedPackage {
  name: string;
  version: string;
}

/**
 * What Bun does with each level: `fatal` exits immediately; `warn` prompts
 * interactively and cancels automatically in a non-interactive terminal. There
 * is no level that merely logs.
 */
export type TAdvisoryLevel = 'fatal' | 'warn';

export interface IAdvisory {
  level: TAdvisoryLevel;
  package: string;
  url: string;
  description: string;
}

/** An OSV vulnerability record, of which only the parts read here are declared. */
export interface IOsvVulnerability {
  id?: string;
  summary?: string;
  database_specific?: { severity?: string };
  severity?: Array<{ type?: string; score?: string }>;
}

/** The seams that let the scanner be exercised without reaching the network. */
export interface IEvaluateIo {
  batch?: (queries: Array<{ package: { name: string; ecosystem: string }; version: string }>)
  => Promise<{ results?: Array<{ vulns?: Array<{ id?: string }> }> }>;
  detail?: (id: string) => Promise<IOsvVulnerability>;
  now?: Date;
}

export declare const ACCEPTED_RISK: Record<string, { until: string; reason: string }>;
export declare const FATAL_SEVERITIES: Set<string>;
export declare const NON_BLOCKING_SEVERITIES: Set<string>;

export declare function isAcceptedRisk(id: string, now?: Date): boolean;
export declare function severityOf(vulnerability: IOsvVulnerability | undefined | null): string;
export declare function evaluatePackages(
  packages: IResolvedPackage[],
  io?: IEvaluateIo
): Promise<IAdvisory[]>;

export declare const scanner: {
  version: '1';
  scan(input: { packages: IResolvedPackage[] }): Promise<IAdvisory[]>;
};
