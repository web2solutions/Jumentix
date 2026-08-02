import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export interface ILoadedSpecs {
  asyncApiWebSocket: Record<string, any>;
}

const SPEC_FILE_NAME = '1.0.0.websocket.yml';
const CANONICAL_SPEC_SEGMENTS = ['asyncapi', SPEC_FILE_NAME];

const candidateSpecPaths = (moduleDirectory: string): string[] => {
  const candidates: string[] = [];
  let directory = path.resolve(moduleDirectory);
  let previousDirectory: string | undefined;

  while (directory !== previousDirectory) {
    candidates.push(path.join(directory, 'spec', ...CANONICAL_SPEC_SEGMENTS));
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
    const asyncApiWebSocketPath = path.join(basePath, ...CANONICAL_SPEC_SEGMENTS);
    return {
      asyncApiWebSocket: YAML.parse(fs.readFileSync(asyncApiWebSocketPath, 'utf8'))
    };
  }

  const specPath = candidateSpecPaths(moduleDirectory)
    .find((candidate) => fs.existsSync(candidate));

  if (!specPath) {
    const artifact = CANONICAL_SPEC_SEGMENTS.join('/');
    throw new Error(
      `Canonical AsyncAPI WebSocket spec artifact "${artifact}" was not found from module directory: ${path.resolve(moduleDirectory)}`
    );
  }

  return {
    asyncApiWebSocket: YAML.parse(fs.readFileSync(specPath, 'utf8'))
  };
};
