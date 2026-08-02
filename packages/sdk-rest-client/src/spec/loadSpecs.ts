import { loadCanonicalSpec } from '@jumentix/shared-contracts';

export interface ILoadedSpecs {
  openApi: Record<string, any>;
}

const SPEC_FILE_NAME = '1.0.0.yml';
const CANONICAL_SPEC_SEGMENTS = [SPEC_FILE_NAME];

export const loadSpecs = (
  basePath?: string,
  moduleDirectory = __dirname
): ILoadedSpecs => ({
  openApi: loadCanonicalSpec({
    basePath,
    moduleDirectory,
    specSegments: CANONICAL_SPEC_SEGMENTS,
    artifactLabel: 'OpenAPI spec'
  })
});
