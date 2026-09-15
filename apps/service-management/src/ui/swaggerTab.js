/**
 * swaggerTab — OpenAPI tab (JUM-818).
 * Loads vendored swagger-ui-dist and renders the current designer export.
 */

import { buildOasDocumentSet } from '@jumentix/designer-core/exporters/designerExporters.js';

let swaggerUiInstance = null;
let swaggerBundlePromise = null;

function loadSwaggerBundle() {
  if (globalThis.SwaggerUIBundle) return Promise.resolve(globalThis.SwaggerUIBundle);
  if (swaggerBundlePromise) return swaggerBundlePromise;
  swaggerBundlePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/swagger-ui/swagger-ui-bundle.js';
    script.onload = () => {
      if (globalThis.SwaggerUIBundle) resolve(globalThis.SwaggerUIBundle);
      else reject(new Error('SwaggerUIBundle missing after script load'));
    };
    script.onerror = () => reject(new Error('Failed to load swagger-ui-bundle.js'));
    document.head.appendChild(script);
    if (!document.querySelector('link[data-swagger-ui]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = './vendor/swagger-ui/swagger-ui.css';
      css.dataset.swaggerUi = 'true';
      document.head.appendChild(css);
    }
  });
  return swaggerBundlePromise;
}

export function selectOasForService(documentSet, serviceId) {
  if (!serviceId || serviceId === 'merged') return documentSet.merged;
  return documentSet.services[serviceId] || documentSet.merged;
}

export function createSwaggerTab({ dom, state }) {
  function fillSelector(documentSet) {
    if (!dom.openapiServiceSelect) return;
    const current = dom.openapiServiceSelect.value || 'merged';
    dom.openapiServiceSelect.innerHTML = '';
    const merged = document.createElement('option');
    merged.value = 'merged';
    merged.textContent = 'Merged Core document';
    dom.openapiServiceSelect.appendChild(merged);
    Object.keys(documentSet.services || {}).forEach((id) => {
      const option = document.createElement('option');
      option.value = id;
      const name = documentSet.services[id]?.info?.title || id;
      option.textContent = name;
      if (id === current) option.selected = true;
      dom.openapiServiceSelect.appendChild(option);
    });
    if (current === 'merged') merged.selected = true;
  }

  async function renderSwagger() {
    if (!dom.swaggerUi) return;
    const documentSet = buildOasDocumentSet(state);
    fillSelector(documentSet);
    const spec = selectOasForService(documentSet, dom.openapiServiceSelect?.value);
    try {
      const SwaggerUIBundle = await loadSwaggerBundle();
      if (swaggerUiInstance && typeof swaggerUiInstance.specActions?.updateSpec === 'function') {
        swaggerUiInstance.specActions.updateSpec(JSON.stringify(spec));
        return;
      }
      swaggerUiInstance = SwaggerUIBundle({
        spec,
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
        tryItOutEnabled: true
      });
    } catch (_error) {
      dom.swaggerUi.textContent = 'Swagger UI bundle is not vendored. Run service-management:vendor.';
    }
  }

  if (dom.openapiServiceSelect) {
    dom.openapiServiceSelect.addEventListener('change', () => {
      renderSwagger();
    });
  }
  if (dom.openapiRefreshBtn) {
    dom.openapiRefreshBtn.addEventListener('click', () => {
      renderSwagger();
    });
  }

  return { renderSwagger };
}
