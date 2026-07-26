import fs from 'fs';
import path from 'path';

const PROTO_FILE_NAME = 'async-api.proto';
const CANONICAL_PROTO_SEGMENTS = ['spec', 'asyncapi', PROTO_FILE_NAME];

const candidatePaths = (moduleDirectory: string): string[] => {
  const candidates = [path.resolve(moduleDirectory, 'proto', PROTO_FILE_NAME)];
  let directory = path.resolve(moduleDirectory);
  let previousDirectory: string | undefined;

  while (directory !== previousDirectory) {
    candidates.push(path.join(directory, ...CANONICAL_PROTO_SEGMENTS));
    previousDirectory = directory;
    directory = path.dirname(directory);
  }

  return candidates;
};

export const resolveGrpcProtoPath = (
  explicitPath?: string,
  moduleDirectory = __dirname
): string => {
  if (explicitPath) {
    const resolvedExplicitPath = path.resolve(explicitPath);
    if (fs.existsSync(resolvedExplicitPath)) return resolvedExplicitPath;
    throw new Error(
      `gRPC proto file not found at configured path: ${resolvedExplicitPath}`
    );
  }

  const candidates = candidatePaths(moduleDirectory);
  const protoPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (protoPath) return protoPath;

  const canonicalArtifact = CANONICAL_PROTO_SEGMENTS.join('/');
  const packagedArtifact = `proto/${PROTO_FILE_NAME}`;
  throw new Error(
    `Canonical gRPC proto artifact "${canonicalArtifact}" or packaged artifact "${packagedArtifact}" was not found from module directory: ${path.resolve(moduleDirectory)}`
  );
};

export default resolveGrpcProtoPath;
