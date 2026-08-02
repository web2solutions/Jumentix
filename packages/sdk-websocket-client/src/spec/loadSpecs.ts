import { loadCanonicalSpec } from '@jumentix/shared-contracts';

export interface ILoadedSpecs {
  asyncApiWebSocket: Record<string, any>;
}

const SPEC_FILE_NAME = '1.0.0.websocket.yml';
const CANONICAL_SPEC_SEGMENTS = ['asyncapi', SPEC_FILE_NAME];

export const loadSpecs = (
  basePath?: string,
  moduleDirectory = __dirname
): ILoadedSpecs => ({
  asyncApiWebSocket: loadCanonicalSpec({
    basePath,
    moduleDirectory,
    specSegments: CANONICAL_SPEC_SEGMENTS,
    artifactLabel: 'AsyncAPI WebSocket spec'
  })
});
