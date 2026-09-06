/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'fs';
import path from 'path';

describe('serviceManagement domain designer smoke', () => {
  const htmlPath = path.resolve(process.cwd(), 'apps/service-management/index.html');
  const scriptPath = path.resolve(process.cwd(), 'apps/service-management/script.js');

  it('has create/edit/export/import controls required for MVP workflow', () => {
    expect.hasAssertions();
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('id="add-domain-btn"');
    expect(html).toContain('id="add-entity-btn"');
    expect(html).toContain('id="save-relationship-btn"');
    expect(html).toContain('id="export-oas-btn"');
    expect(html).toContain('id="export-proto-btn"');
    expect(html).toContain('id="import-json-btn"');
    expect(html).toContain('id="import-package-btn"');
    expect(html).toContain('id="relationship-bend-x-input"');
    expect(html).toContain('id="entity-template-select"');
    expect(html).toContain('id="mini-map"');
  });

  it('exposes direct manipulation affordances for a responsive diagram canvas', () => {
    expect.hasAssertions();
    const canvasSource = fs.readFileSync(
      path.resolve(process.cwd(), 'apps/service-management/src/ui/canvas.js'),
      'utf-8'
    );
    const css = fs.readFileSync(path.resolve(process.cwd(), 'apps/service-management/styles.css'), 'utf-8');
    expect(canvasSource).toContain('scheduleEdgesRender');
    expect(canvasSource).toContain('edge-bend-handle');
    expect(canvasSource).toContain('edge-end-handle');
    expect(canvasSource).toContain('domain-drag-grip');
    expect(canvasSource).toContain('entity-drag-grip');
    expect(canvasSource).toMatch(/ownerDocument\.addEventListener\('pointermove', move, true\)/);
    expect(canvasSource).toMatch(/ownerDocument\.removeEventListener\('pointermove', move, true\)/);
    expect(canvasSource).toContain('closeSidebarForCanvasWork');
    expect(canvasSource).toContain('attachRelationshipEndpointDrag');
    expect(canvasSource).toContain('relationshipAnchorFromField');
    expect(canvasSource).toContain('centerCanvasFromMiniMapPointer');
    expect(canvasSource).toContain('wireMiniMapEvents');
    expect(canvasSource).toMatch(/dom\.miniMap\.addEventListener\('pointerdown'/);
    expect(canvasSource).toMatch(/dom\.canvas\.addEventListener\('scroll'/);
    expect(canvasSource).toContain('totalDx');
    expect(canvasSource).toContain('domainDragOrigin');
    expect(canvasSource).toContain('entityDragOrigin');
    expect(canvasSource).toContain('CANVAS_ORIGIN_X');
    expect(canvasSource).toContain('VIRTUAL_CANVAS_WIDTH');
    expect(canvasSource).toContain('routeExitPenalty');
    expect(canvasSource).toContain('routeSelfCrossPenalty');
    expect(canvasSource).toContain('domFieldAnchorPoint');
    expect(canvasSource).toContain('const entityRect = entityEl.getBoundingClientRect()');
    expect(canvasSource).toContain('const rowRect = row.getBoundingClientRect()');
    expect(canvasSource).toContain('edgeX - canvasRect.left');
    expect(canvasSource).toContain('pointOutsideEndpoint');
    expect(canvasSource).toContain('edgeHitRoutePoints');
    expect(canvasSource).toContain('hit.setAttribute(\'d\', hitPathD)');
    expect(canvasSource).toContain('handlePoint: useCenter ? from : pointOutsideEndpoint(from, fromEndpoint.side, to)');
    expect(canvasSource).toContain('dataset.fieldName');
    expect(canvasSource).toContain('relationship-field-connected');
    expect(canvasSource).toMatch(/entityEl\.style\.left = `\$\{entity\.x\}px`/);
    expect(canvasSource).toMatch(/entityEl\.style\.top = `\$\{entity\.y\}px`/);
    expect(canvasSource).toContain('liveTransformOrigin');
    expect(canvasSource).toMatch(/translate3d\(\$\{dx\}px, \$\{dy\}px, 0\)/);
    expect(canvasSource).toContain('afterPaint');
    expect(canvasSource).toContain('scheduleEdgesRender(aligned.guides, { afterPaint: Boolean(target.liveTransformOrigin) })');
    expect(canvasSource).toContain('entityEl.style.transform = \'\'');
    expect(canvasSource).toContain('domain.x = origin.x + drag.totalDx');
    expect(canvasSource).toContain('note.x = origin.x + drag.totalDx');
    expect(canvasSource).not.toContain('domain.x = Math.max(0');
    expect(canvasSource).not.toContain('note.x = Math.max(0');
    expect(canvasSource).not.toContain('entity.x = Math.max(0');
    expect(canvasSource).not.toContain('Math.max(8, x)');
    expect(canvasSource).toContain('nameEl.addEventListener(\'pointerup\', () => nameEl.focus())');
    expect(canvasSource).toContain('resizeHandleForEntity');
    expect(canvasSource).toContain('entity-resize-handle');
    expect(canvasSource).toContain('resizeEntityBox');
    expect(canvasSource).toContain('entityBoxHeight');
    expect(canvasSource).toContain('zoomAtPointer');
    expect(canvasSource).toContain('typeEl.addEventListener(\'pointerdown\'');
    expect(canvasSource).toContain('addFieldBtn.addEventListener(\'pointerdown\'');
    expect(canvasSource).toContain('event.preventDefault()');
    expect(canvasSource).toContain('event.stopPropagation()');
    expect(canvasSource).toContain('capture: true');
    expect(canvasSource).toContain('align: false');
    expect(canvasSource).toContain('canvasMenuItems');
    expect(canvasSource).toMatch(/dom\.canvas\.addEventListener\('contextmenu'/);
    expect(canvasSource).toContain('createFieldSchemaEditor');
    expect(canvasSource).toContain('field-schema-editor');
    expect(canvasSource).toContain('indexed');
    expect(canvasSource).toContain('buildRoutedEdgePathD');
    expect(canvasSource).toContain('routeCollisionCount');
    expect(canvasSource).toContain('relationshipRouteOrdinal');
    expect(canvasSource).toContain('routeLabelOffset');
    expect(canvasSource).toContain('compactRelationshipFieldLabel');
    expect(canvasSource).toContain('cardinalityLabelPoint');
    expect(canvasSource).toContain('relationshipFieldLabel');
    expect(canvasSource).toMatch(/bendHandle\.addEventListener\('dblclick'/);
    expect(canvasSource).toContain('edge-name-label');
    expect(css).toContain('touch-action: none');
    expect(css).toContain('contain: layout style');
    expect(css).toContain('Diagram workbench skin');
    expect(css).toContain('.service-management-shell:has(#tab-domain-designer.active)');
    expect(css).toContain('scrollbar-color: #3a3e47 #0d0f12');
    expect(css).toContain('.service-management-shell *::-webkit-scrollbar-thumb:hover');
    expect(css).toContain('line-height: 1.35');
    expect(css).toContain('radial-gradient(circle, rgba(255, 255, 255, 0.075) 1px');
    expect(css).toContain('paint-order: stroke');
    expect(css).toContain('pointer-events: stroke');
    expect(css).toContain('cursor: grab');
    expect(css).toContain('grid-template-columns: 0 minmax(0, 1fr)');
    expect(css).toContain('.app-shell:has(.sidebar.open)');
    expect(css).toMatch(/\.sidebar\s*\{[\s\S]*position:\s*relative/);
    expect(css).toContain('min-width: 96px');
    expect(css).toContain('.entity-resize-handle');
    expect(css).toContain('.entity.resizing');
    expect(css).toContain('position: absolute');
    expect(css).toContain('grid-template-columns: auto minmax(104px, 1fr) minmax(78px, 96px) auto auto auto 30px');
    expect(css).toContain('right: -9px');
    expect(css).toContain('transform: translateY(-50%)');
    expect(css).toMatch(/\.entity-field-add\s*\{[\s\S]*z-index:\s*8/);
    expect(css).toMatch(/\.entity-field-add button\s*\{[\s\S]*z-index:\s*9/);
    expect(css).toContain('grid-template-rows: 42px minmax(0, 1fr)');
    expect(css).toMatch(/\.mini-map\s*\{[\s\S]*position:\s*absolute/);
    expect(css).toMatch(/\.status-region\s*\{[\s\S]*pointer-events:\s*none/);
    expect(css).toMatch(/\.pwa-update-banner\s*\{[\s\S]*pointer-events:\s*none/);
    expect(css).toMatch(/\.pwa-update-banner-btn\s*\{[\s\S]*pointer-events:\s*auto/);
    expect(css).toMatch(/\.edges\s*\{[\s\S]*z-index:\s*2/);
    expect(css).toMatch(/\.edges\s*\{[\s\S]*overflow:\s*visible/);
    expect(css).toMatch(/\.domain\s*\{[\s\S]*z-index:\s*5/);
    expect(css).toContain('.domain.dragging');
    expect(css).toContain('.entity-field-row.relationship-field-connected');
    expect(css).toContain('.domain-drag-grip');
    expect(css).toContain('.entity-drag-grip');
    expect(css).toContain('.mini-map-viewport');
    expect(css).toContain('.field-schema-grid');
    expect(css).toContain('cursor: crosshair');
    expect(css).toContain('cursor: pointer');
    expect(css).toContain('z-index: 1');
    expect(css).toContain('width: min(340px, 30vw)');
    expect(css).toContain('.edge-end-handle-from');
    expect(css).toContain('.edge-end-handle-to');
    expect(css).toContain('@media (max-width: 900px)');
  });

  it('keeps the first-run sample visually spread out instead of stacked', () => {
    expect.hasAssertions();
    const sampleSource = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/designer-core/src/model/sampleModel.js'),
      'utf-8'
    );
    expect(sampleSource).toContain('width: 780');
    expect(sampleSource).toContain('height: 900');
    expect(sampleSource).toMatch(/name: 'ContactPoint'/);
    expect(sampleSource).toMatch(/name: 'Tasks'/);
    expect(sampleSource).toMatch(/name: 'Project'/);
    expect(sampleSource).toMatch(/name: 'Task'/);
    expect(sampleSource).toMatch(/name: 'Comment'/);
    expect(sampleSource).toContain('id: \'sample-rel-task-project\'');
    expect(sampleSource).toContain('fromField: \'projectId\'');
    expect(sampleSource).toContain('y: 650');
  });

  it('wires export and package features in runtime script', () => {
    expect.hasAssertions();
    const script = fs.readFileSync(scriptPath, 'utf-8');
    expect(script).toContain('exportAsOas');
    expect(script).toContain('exportAsAsyncApi');
    expect(script).toContain('exportAsProto');
    expect(script).toContain('exportBoilerplateBundle');
    expect(script).toContain('exportAsPackage');
    expect(script).toContain('importDomainPackage');
    expect(script).toContain('repairLegacySampleDiagramLayout');
    expect(script).toContain('isIsolatedLegacySample');
    expect(script).toContain('sample-domain-tasks');
    expect(script).toContain('renderMiniMap');
  });
});
