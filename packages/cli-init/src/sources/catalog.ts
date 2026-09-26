import { planFromDesignerDocument } from './designerExport';
import SOURCE_MESSAGES from './messages';
import { isDesignerExport, isHttpUrl, isOpenApiDocument, parseDocumentText } from './oas';
import { buildPlanFromOasDocument } from './planBuilder';
import { SourceResolutionError } from './types';

import type { InterfaceDefaults } from './planBuilder';
import type { GenerationPlan } from './types';

/**
 * Fetch a catalog URL and normalize the payload to a GenerationPlan.
 * Accepts OpenAPI documents or designer suite exports.
 */
async function loadCatalogSource(
  url: string,
  defaults: InterfaceDefaults,
  fetchImpl: typeof fetch = fetch
): Promise<GenerationPlan> {
  if (!isHttpUrl(url)) {
    throw new SourceResolutionError(SOURCE_MESSAGES.INVALID_FROM(url));
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json, application/yaml, text/yaml, */*' }
    });
  } catch (error) {
    throw new SourceResolutionError(
      SOURCE_MESSAGES.CATALOG_FETCH_FAILED(
        url,
        error instanceof Error ? error.message : String(error)
      )
    );
  }

  if (!response.ok) {
    throw new SourceResolutionError(
      SOURCE_MESSAGES.CATALOG_FETCH_FAILED(url, `HTTP ${response.status}`)
    );
  }

  const text = await response.text();
  const doc = parseDocumentText(text, url);

  if (isDesignerExport(doc)) {
    return planFromDesignerDocument(doc, defaults);
  }
  if (isOpenApiDocument(doc)) {
    return buildPlanFromOasDocument(doc, defaults);
  }

  throw new SourceResolutionError(
    SOURCE_MESSAGES.CATALOG_FETCH_FAILED(url, 'payload is neither OAS nor designer export')
  );
}

export default loadCatalogSource;
