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
    expect(canvasSource).toContain('edge-name-label');
    expect(css).toContain('touch-action: none');
    expect(css).toContain('contain: layout style');
    expect(css).toContain('@media (max-width: 900px)');
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
    expect(script).toContain('renderMiniMap');
  });
});
