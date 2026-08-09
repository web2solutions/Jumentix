import type { CSSProperties, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';

// The designer (apps/service-management) is a zero-build vanilla SPA — these
// stories mount its real markup and its real stylesheets (JUM-488), so the
// Storybook catalog covers the designer's key UI states without a bundler or
// a React rewrite. The stylesheets are token-driven (--jtx-*, same tokens as
// components/design-system/tokens.css), so the addon-themes light/dark switch
// applies to them exactly as it does to the website components.
import '../../../service-management/tokens.css';
import '../../../service-management/styles.css';

const meta = {
  title: 'Service Management Designer/Overview',
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/* The app shell scopes every element-level rule of the designer stylesheet;
   stories reproduce that wrapper so the exact app cascade applies. */
const Shell = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="service-management-shell" style={{ height: 'auto', ...style }}>
    {children}
  </div>
);

/* position: fixed surfaces (toast, PWA banner) are contained for display by a
   transform on the wrapper — the component CSS itself is untouched. */
const FixedSurfaceDemo = ({ children }: { children: ReactNode }) => (
  <div style={{ position: 'relative', height: 160, transform: 'translateZ(0)' }}>{children}</div>
);

export const TabShell: Story = {
  render: () => (
    <Shell>
      <nav className="tab-nav" role="tablist" aria-label="Service management tabs">
        <button
          className="tab-btn active"
          type="button"
          role="tab"
          aria-selected="true"
          aria-controls="tab-domain-designer"
          tabIndex={0}
        >
          Domain Designer
        </button>
        <button
          className="tab-btn"
          type="button"
          role="tab"
          aria-selected="false"
          aria-controls="tab-interface-designer"
          tabIndex={-1}
        >
          Communication Interface Designer
        </button>
        <button
          className="tab-btn"
          type="button"
          role="tab"
          aria-selected="false"
          aria-controls="tab-service-config"
          tabIndex={-1}
        >
          Service Configuration
        </button>
        <button
          className="tab-btn"
          type="button"
          role="tab"
          aria-selected="false"
          aria-controls="tab-deploy-management"
          tabIndex={-1}
        >
          Deploy Management
        </button>
      </nav>
    </Shell>
  ),
};

export const WorkspaceControls: Story = {
  render: () => (
    <Shell>
      <header className="workspace-header" style={{ border: '1px solid var(--jtx-line)' }}>
        <div role="status" aria-live="polite">
          Domain: Orders — 3 entities
        </div>
        <div className="workspace-actions">
          <button type="button" title="Zoom out" aria-label="Zoom out">
            -
          </button>
          <div className="zoom-indicator">
            110%
          </div>
          <button type="button" title="Zoom in" aria-label="Zoom in">
            +
          </button>
          <select title="Relationship routing style" aria-label="Relationship routing style" defaultValue="curved">
            <option value="curved">Curved</option>
            <option value="orthogonal">Orthogonal</option>
          </select>
          <button type="button" aria-pressed="false">
            Compact View
          </button>
          <button type="button" aria-pressed="true">
            Snap: On
          </button>
          <button type="button">
            Auto Layout
          </button>
          <button type="button" aria-pressed="false">
            Large Canvas: Off
          </button>
          <button type="button">
            Fit
          </button>
          <button type="button">
            Reset View
          </button>
        </div>
      </header>
    </Shell>
  ),
};

export const DomainCanvas: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => (
    <Shell style={{ height: 420 }}>
      <div className="workspace">
        <div
          className="canvas"
          role="region"
          tabIndex={0}
          aria-label="Domain model canvas. Select an entity from the Entities panel, then use the arrow keys to move it."
        >
          <div className="canvas-inner">
            <svg className="edges" aria-hidden="true" focusable="false">
              <path className="edge-line" d="M 190 128 Q 268 128 268 96 T 346 96" />
              <path className="edge-hit" d="M 190 128 Q 268 128 268 96 T 346 96" />
              <text className="edge-label" x={196} y={122}>
                1
              </text>
              <text className="edge-label" x={352} y={90}>
                N
              </text>
              <text className="edge-label" x={274} y={128}>
                places
              </text>
            </svg>
            <section
              className="domain selected"
              style={{ left: 32, top: 24, '--domain-color': '#60a5fa' } as CSSProperties}
            >
              <header className="domain-header">
                <div className="domain-title">Orders</div>
                <div className="entity-count">2 entities</div>
              </header>
              <div className="domain-body">
                <article className="entity selected" style={{ left: 16, top: 16 }}>
                  <header className="entity-header">
                    Order
                    <span className="entity-aggregate-tag">AR</span>
                  </header>
                  <ul className="entity-fields">
                    <li>id: uuid PK</li>
                    <li>status: string</li>
                    <li>total: number</li>
                  </ul>
                  <button type="button" className="entity-anchor entity-anchor-top" title="Drag from Order (top) to create relationship" />
                  <button type="button" className="entity-anchor entity-anchor-right" title="Drag from Order (right) to create relationship" />
                  <button type="button" className="entity-anchor entity-anchor-bottom" title="Drag from Order (bottom) to create relationship" />
                  <button type="button" className="entity-anchor entity-anchor-left" title="Drag from Order (left) to create relationship" />
                </article>
                <article className="entity" style={{ left: 320, top: 80 }}>
                  <header className="entity-header">OrderLine</header>
                  <ul className="entity-fields">
                    <li>id: uuid PK</li>
                    <li>quantity: integer</li>
                  </ul>
                  <button type="button" className="entity-anchor entity-anchor-top" title="Drag from OrderLine (top) to create relationship" />
                  <button type="button" className="entity-anchor entity-anchor-right" title="Drag from OrderLine (right) to create relationship" />
                  <button type="button" className="entity-anchor entity-anchor-bottom" title="Drag from OrderLine (bottom) to create relationship" />
                  <button type="button" className="entity-anchor entity-anchor-left" title="Drag from OrderLine (left) to create relationship" />
                </article>
              </div>
            </section>
          </div>
        </div>
        <div className="mini-map" aria-hidden="true">
          <div
            className="mini-map-domain active"
            style={{ left: 1.76, top: 1.32, width: 28.6, height: 15.4, borderColor: '#60a5fa' }}
            title="Orders"
          />
        </div>
      </div>
    </Shell>
  ),
};

export const StatusSurfaces: Story = {
  render: () => (
    <Shell>
      <FixedSurfaceDemo>
        <div className="status-region status-info" role="status" aria-live="polite">
          Model saved to the Cana store.
        </div>
      </FixedSurfaceDemo>
      <FixedSurfaceDemo>
        <div className="status-region status-error" role="status" aria-live="polite">
          Validation failed: entity Order requires a primary key field.
        </div>
      </FixedSurfaceDemo>
      <p className="hint status-line status-info" role="status" aria-live="polite">
        Loaded ecosystem.dev.cjs — 2 processes.
      </p>
      <p className="hint status-line status-error" role="status" aria-live="polite">
        Port 70000 is outside the accepted range (1-65535).
      </p>
    </Shell>
  ),
};

export const EntityInspector: Story = {
  render: () => (
    <Shell>
      <div className="sidebar" style={{ border: '1px solid var(--jtx-line)', maxWidth: 360 }}>
        <section className="panel">
          <h2>Entity Inspector</h2>
          <p className="hint">
            Editing: Order
          </p>
          <div className="row">
            <input type="text" placeholder="Entity name" aria-label="Entity name" defaultValue="Order" />
            <button type="button">
              Save Name
            </button>
          </div>
          <div className="column compact" style={{ marginTop: 12 }}>
            <label htmlFor="entity-rbac-action-select">RBAC Action</label>
            <select defaultValue="list">
              <option value="list">list</option>
              <option value="getById">getById</option>
              <option value="create">create</option>
            </select>
            <label className="check">
              <input type="checkbox" defaultChecked /> superadmin
            </label>
            <label className="check">
              <input type="checkbox" defaultChecked /> admin
            </label>
            <label className="check">
              <input type="checkbox" /> user
            </label>
            <label className="check">
              <input type="checkbox" disabled /> tenant scoped (derived from roles)
            </label>
          </div>
          <div className="field-row" style={{ marginTop: 12 }}>
            <input type="text" aria-label="Field name" defaultValue="total" />
            <select aria-label="Field type" defaultValue="number">
              <option value="string">string</option>
              <option value="number">number</option>
            </select>
            <label className="check">
              <input type="checkbox" /> required
            </label>
            <label className="check">
              <input type="checkbox" /> PK
            </label>
            <label className="check">
              <input type="checkbox" /> FK
            </label>
            <label className="check">
              <input type="checkbox" /> unique
            </label>
            <label className="check">
              <input type="checkbox" defaultChecked /> nullable
            </label>
            <button type="button" aria-label="Move field up">
              ↑
            </button>
            <button type="button" aria-label="Delete field">
              ×
            </button>
          </div>
        </section>
      </div>
    </Shell>
  ),
};

export const PanelsAndLists: Story = {
  render: () => (
    <Shell>
      <div className="sidebar" style={{ border: '1px solid var(--jtx-line)', maxWidth: 360 }}>
        <section className="panel">
          <h2>Domains</h2>
          <div className="row">
            <input type="text" placeholder="Domain name" aria-label="Domain name" />
            <button type="button">
              Add
            </button>
          </div>
          <ul className="list">
            <li>
              <button type="button" className="active">
                Orders
              </button>
            </li>
            <li>
              <button type="button">Billing</button>
            </li>
          </ul>
        </section>
        <section className="panel">
          <h2>Relationship</h2>
          <ul className="list">
            <li className="relationship-item">
              <span className="relationship-name">Order → OrderLine (1:N)</span>
              <button type="button" aria-label="Delete relationship places">
                ×
              </button>
            </li>
          </ul>
          <p className="hint">Pick mode off</p>
        </section>
      </div>
    </Shell>
  ),
};

export const CodePreviews: Story = {
  render: () => (
    <Shell>
      <pre className="code-preview">
        {`{
  "kind": "rest-api",
  "runMode": "container",
  "cloudProvider": "aws"
}`}
      </pre>
      <pre className="code-preview-output">
        {`export class Order {
  constructor(public readonly props: OrderProps) {}
}`}
      </pre>
    </Shell>
  ),
};

export const PwaUpdateBanner: Story = {
  render: () => (
    <Shell>
      <FixedSurfaceDemo>
        <div className="pwa-update-banner" role="alert">
          <p className="pwa-update-banner-message">
            A new version of Service Management is available.
          </p>
          <div className="pwa-update-banner-actions">
            <button type="button" className="pwa-update-banner-btn pwa-update-banner-btn-reload">
              Reload to update
            </button>
            <button type="button" className="pwa-update-banner-btn pwa-update-banner-btn-reset">
              Dismiss
            </button>
          </div>
        </div>
      </FixedSurfaceDemo>
    </Shell>
  ),
};
