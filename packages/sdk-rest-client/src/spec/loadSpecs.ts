import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export interface ILoadedSpecs {
  openApi: Record<string, any>;
}

const SPEC_FILE_NAME = '1.0.0.yml';

const candidateSpecPaths = (moduleDirectory: string): string[] => {
  const candidates: string[] = [];
  let directory = path.resolve(moduleDirectory);
  let previousDirectory: string | undefined;

  while (directory !== previousDirectory) {
    candidates.push(path.join(directory, 'spec', SPEC_FILE_NAME));
    previousDirectory = directory;
    directory = path.dirname(directory);
  }

  return candidates;
};

export const loadSpecs = (
  basePath?: string,
  moduleDirectory = __dirname
): ILoadedSpecs => {
  if (basePath) {
    const openApiPath = path.join(basePath, SPEC_FILE_NAME);
    return {
      openApi: YAML.parse(fs.readFileSync(openApiPath, 'utf8'))
    };
  }

  const specPath = candidateSpecPaths(moduleDirectory)
    .find((candidate) => fs.existsSync(candidate));

  if (!specPath) {
    const artifact = SPEC_FILE_NAME;
    throw new Error(
      `Canonical OpenAPI spec artifact "${artifact}" was not found from module directory: ${path.resolve(moduleDirectory)}`
    );
  }

  return {
    openApi: YAML.parse(fs.readFileSync(specPath, 'utf8'))
  };
};
