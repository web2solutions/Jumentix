import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export interface ICanonicalSpecLoaderOptions {
  basePath?: string;
  moduleDirectory: string;
  specSegments: string[];
  artifactLabel: string;
}

export const candidateSpecPaths = (
  moduleDirectory: string,
  specSegments: string[]
): string[] => {
  const candidates: string[] = [];
  let directory = path.resolve(moduleDirectory);
  let previousDirectory: string | undefined;

  while (directory !== previousDirectory) {
    candidates.push(path.join(directory, 'spec', ...specSegments));
    previousDirectory = directory;
    directory = path.dirname(directory);
  }

  return candidates;
};

export const loadCanonicalSpec = ({
  basePath,
  moduleDirectory,
  specSegments,
  artifactLabel
}: ICanonicalSpecLoaderOptions): Record<string, any> => {
  if (basePath) {
    const specPath = path.join(basePath, ...specSegments);
    return YAML.parse(fs.readFileSync(specPath, 'utf8'));
  }

  const specPath = candidateSpecPaths(moduleDirectory, specSegments)
    .find((candidate) => fs.existsSync(candidate));

  if (!specPath) {
    throw new Error(
      `Canonical ${artifactLabel} artifact "${specSegments.join('/')}" was not found from module directory: ${path.resolve(moduleDirectory)}`
    );
  }

  return YAML.parse(fs.readFileSync(specPath, 'utf8'));
};
