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
    expect(canvasSource).toMatch(/window\.addEventListener\('pointermove', move\)/);
    expect(canvasSource).toContain('closeSidebarForCanvasWork');
    expect(canvasSource).toContain('attachRelationshipEndpointDrag');
    expect(canvasSource).toContain('relationshipAnchorFromField');
    expect(canvasSource).toContain('centerCanvasFromMiniMapPointer');
    expect(canvasSource).toContain('wireMiniMapEvents');
    expect(canvasSource).toMatch(/dom\.miniMap\.addEventListener\('pointerdown'/);
    expect(canvasSource).toMatch(/dom\.canvas\.addEventListener\('scroll'/);
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
    expect(css).toContain('z-index: 4');
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
    expect(sampleSource).toContain('width: 620');
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
