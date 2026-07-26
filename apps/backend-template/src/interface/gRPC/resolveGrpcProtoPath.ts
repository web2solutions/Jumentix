import fs from 'fs';
import path from 'path';

const CANONICAL_PROTO_SEGMENTS = ['spec', 'asyncapi', 'async-api.proto'];

const findCanonicalProtoFrom = (moduleDirectory: string): string | undefined => {
  let directory = path.resolve(moduleDirectory);
  let previousDirectory: string | undefined;

  while (directory !== previousDirectory) {
    const candidate = path.join(directory, ...CANONICAL_PROTO_SEGMENTS);
    if (fs.existsSync(candidate)) return candidate;

    previousDirectory = directory;
    directory = path.dirname(directory);
  }

  return undefined;
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

  const canonicalPath = findCanonicalProtoFrom(moduleDirectory);
  if (canonicalPath) return canonicalPath;

  throw new Error(
    `Canonical gRPC proto artifact "${CANONICAL_PROTO_SEGMENTS.join('/')}" `
    + `was not found from module directory: ${path.resolve(moduleDirectory)}`
  );
};

export default resolveGrpcProtoPath;
