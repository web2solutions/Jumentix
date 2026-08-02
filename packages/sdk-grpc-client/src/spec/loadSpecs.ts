import { loadCanonicalSpec } from '@jumentix/shared-contracts';

export interface ILoadedSpecs {
  asyncApiGrpc: Record<string, any>;
}

const SPEC_FILE_NAME = '1.0.0.grpc.yml';
const CANONICAL_SPEC_SEGMENTS = ['asyncapi', SPEC_FILE_NAME];

export const loadSpecs = (
  basePath?: string,
  moduleDirectory = __dirname
): ILoadedSpecs => ({
  asyncApiGrpc: loadCanonicalSpec({
    basePath,
    moduleDirectory,
    specSegments: CANONICAL_SPEC_SEGMENTS,
    artifactLabel: 'AsyncAPI gRPC spec'
  })
});
