/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'fs';
import path from 'path';

describe('service management mvp roadmap features', () => {
  const indexPath = path.resolve(process.cwd(), 'apps/service-management/index.html');
  const scriptPath = path.resolve(process.cwd(), 'apps/service-management/script.js');

  it('exposes schema diff controls in UI', () => {
    expect.hasAssertions();
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('id="save-baseline-btn"');
    expect(html).toContain('id="run-schema-diff-btn"');
    expect(html).toContain('id="schema-diff-list"');
  });

  it('exposes RBAC and message contract controls in UI', () => {
    expect.hasAssertions();
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('id="entity-rbac-action-select"');
    expect(html).toContain('id="entity-contract-name-input"');
    expect(html).toContain('id="entity-contract-list"');
  });

  it('includes OAS composition, package IO and export quality gate logic in script', () => {
    expect.hasAssertions();
    const script = fs.readFileSync(scriptPath, 'utf-8');
    expect(script).toContain('entity-oas-composition-mode-select');
    expect(script).toContain('saveSelectedEntityOasComposition');
    expect(script).toContain('canExportModel');
    expect(script).toContain('exportAsPackage');
    expect(script).toContain('importDomainPackage');
  });

  it('includes request/response example generator and JSON Schema exporter hooks', () => {
    expect.hasAssertions();
    const html = fs.readFileSync(indexPath, 'utf-8');
    const script = fs.readFileSync(scriptPath, 'utf-8');
    expect(html).toContain('id="generate-examples-btn"');
    expect(html).toContain('id="examples-preview-output"');
    expect(html).toContain('id="export-jsonschema-btn"');
    expect(script).toContain('generateExamplesPreview');
    expect(script).toContain('buildEntityRequestExample');
    expect(script).toContain('exportAsJsonSchema');
  });

  it('exposes a generated-code IDE workspace instead of a flat preview pane', () => {
    expect.hasAssertions();
    const html = fs.readFileSync(indexPath, 'utf-8');
    const script = fs.readFileSync(scriptPath, 'utf-8');
    const server = fs.readFileSync(path.resolve(process.cwd(), 'apps/service-management/server.js'), 'utf-8');
    expect(html).toContain('class="code-activity-bar"');
    expect(html).toContain('id="code-workspace-search-input"');
    expect(html).toContain('id="code-workspace-breadcrumbs"');
    expect(html).toContain('id="code-workspace-language"');
    expect(html).toContain('id="code-workspace-file-count"');
    expect(html).toContain('id="code-workspace-conflict-count"');
    expect(html).toContain('id="code-workspace-open-tabs"');
    expect(html).toContain('id="code-workspace-close-tab-btn"');
    expect(script).toContain('collapsedCodeWorkspaceFolders');
    expect(script).toContain('codeWorkspaceBreadcrumbLabel');
    expect(script).toContain('codeWorkspaceFileKind');
    expect(script).toContain('codeWorkspaceSearchInput.oninput');
    expect(script).toContain('openPaths');
    expect(script).toContain('renderCodeWorkspaceOpenTabs');
    expect(script).toContain('activeClosed');
    expect(script).toContain('closeActiveCodeWorkspaceTab');
    expect(script).toContain('closeCodeWorkspaceTab(file.path)');
    expect(script).toContain('readOnly: !file');
    expect(script).toContain('file:///jumentix-generated/');
    expect(script).toContain('syncCodeWorkspaceMonacoModels');
    expect(script).toContain('moduleResolution');
    expect(script).toContain('setEagerModelSync');
    expect(script).toContain('openCodeWorkspaceImport');
    expect(script).toContain('importSpecifierAtCodePosition');
    expect(script).toContain('codeWorkspaceImportCandidates');
    expect(script).toContain('onMouseDown');
    expect(script).toContain('/vendor/requirejs/require.js');
    expect(script).toContain('/vendor/monaco/min/vs');
    expect(server).toContain('/vendor/requirejs/require.js');
    expect(server).toContain('/vendor/monaco/');
  });

  it('includes advanced roadmap controls: relationship path, templates, OpenAPI advanced, mini-map', () => {
    expect.hasAssertions();
    const html = fs.readFileSync(indexPath, 'utf-8');
    const script = fs.readFileSync(scriptPath, 'utf-8');
    expect(html).toContain('id="relationship-bend-x-input"');
    expect(html).toContain('id="entity-template-select"');
    expect(html).toContain('id="entity-oas-external-refs-input"');
    expect(html).toContain('id="mini-map"');
    expect(script).toContain('renderMiniMap');
    expect(script).toContain('exportAsAsyncApi');
    expect(script).toContain('exportBoilerplateBundle');
  });
});
