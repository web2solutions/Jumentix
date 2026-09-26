// The designer (apps/service-management) is a zero-build vanilla SPA — these
// stories mount its real markup and its real stylesheets (JUM-488), so the
// Storybook catalog covers the designer's key UI states without a bundler or
// a React rewrite. The stylesheets are token-driven (--jtx-*, same tokens as
// components/design-system/tokens.css), so the addon-themes light/dark switch
// applies to them exactly as it does to the website components.

import '@jumentix/service-management/styles.css';
import '@jumentix/service-management/tokens.css';

import type { Meta, StoryObj } from '@storybook/nextjs';
import type { CSSProperties, ReactNode } from 'react';

const meta = {
  title: 'Service Management Designer/Overview',
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs']
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
      <div aria-label="Service management tabs" className="tab-nav" role="tablist">
        <button
          aria-controls="tab-domain-designer"
          aria-selected="true"
          className="tab-btn active"
          role="tab"
          tabIndex={0}
          type="button"
        >
          Domain Designer
        </button>
        <button
          aria-controls="tab-interface-designer"
          aria-selected="false"
          className="tab-btn"
          role="tab"
          tabIndex={-1}
          type="button"
        >
          Communication Interface Designer
        </button>
        <button
          aria-controls="tab-service-config"
          aria-selected="false"
          className="tab-btn"
          role="tab"
          tabIndex={-1}
          type="button"
        >
          Service Configuration
        </button>
        <button
          aria-controls="tab-deploy-management"
          aria-selected="false"
          className="tab-btn"
          role="tab"
          tabIndex={-1}
          type="button"
        >
          Deploy Management
        </button>
      </div>
    </Shell>
  )
};

export const WorkspaceControls: Story = {
  render: () => (
    <Shell>
      <header className="workspace-header" style={{ border: '1px solid var(--jtx-line)' }}>
        <div aria-live="polite" role="status">
          Domain: Orders — 3 entities
        </div>
        <div className="workspace-actions">
          <button aria-label="Zoom out" title="Zoom out" type="button">
            -
          </button>
          <div className="zoom-indicator">110%</div>
          <button aria-label="Zoom in" title="Zoom in" type="button">
            +
          </button>
          <select
            aria-label="Relationship routing style"
            defaultValue="curved"
            title="Relationship routing style"
          >
            <option value="curved">Curved</option>
            <option value="orthogonal">Orthogonal</option>
          </select>
          <button aria-pressed="false" type="button">
            Compact View
          </button>
          <button aria-pressed="true" type="button">
            Snap: On
          </button>
          <button type="button">Auto Layout</button>
          <button aria-pressed="false" type="button">
            Large Canvas: Off
          </button>
          <button type="button">Fit</button>
          <button type="button">Reset View</button>
        </div>
      </header>
    </Shell>
  )
};

export const DomainCanvas: Story = {
  parameters: {
    layout: 'fullscreen'
  },
  render: () => (
    <Shell style={{ height: 420 }}>
      <div className="workspace">
        <div
          aria-label="Domain model canvas. Select an entity from the Entities panel, then use the arrow keys to move it."
          className="canvas"
          role="region"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- story mock of the interactive model canvas; arrow keys move the selected entity (see aria-label)
          tabIndex={0}
        >
          <div className="canvas-inner">
            <svg aria-hidden="true" className="edges" focusable="false">
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
                  <button
                    aria-label="Drag from Order (top) to create relationship"
                    className="entity-anchor entity-anchor-top"
                    title="Drag from Order (top) to create relationship"
                    type="button"
                  />
                  <button
                    aria-label="Drag from Order (right) to create relationship"
                    className="entity-anchor entity-anchor-right"
                    title="Drag from Order (right) to create relationship"
                    type="button"
                  />
                  <button
                    aria-label="Drag from Order (bottom) to create relationship"
                    className="entity-anchor entity-anchor-bottom"
                    title="Drag from Order (bottom) to create relationship"
                    type="button"
                  />
                  <button
                    aria-label="Drag from Order (left) to create relationship"
                    className="entity-anchor entity-anchor-left"
                    title="Drag from Order (left) to create relationship"
                    type="button"
                  />
                </article>
                <article className="entity" style={{ left: 320, top: 80 }}>
                  <header className="entity-header">OrderLine</header>
                  <ul className="entity-fields">
                    <li>id: uuid PK</li>
                    <li>quantity: integer</li>
                  </ul>
                  <button
                    aria-label="Drag from OrderLine (top) to create relationship"
                    className="entity-anchor entity-anchor-top"
                    title="Drag from OrderLine (top) to create relationship"
                    type="button"
                  />
                  <button
                    aria-label="Drag from OrderLine (right) to create relationship"
                    className="entity-anchor entity-anchor-right"
                    title="Drag from OrderLine (right) to create relationship"
                    type="button"
                  />
                  <button
                    aria-label="Drag from OrderLine (bottom) to create relationship"
                    className="entity-anchor entity-anchor-bottom"
                    title="Drag from OrderLine (bottom) to create relationship"
                    type="button"
                  />
                  <button
                    aria-label="Drag from OrderLine (left) to create relationship"
                    className="entity-anchor entity-anchor-left"
                    title="Drag from OrderLine (left) to create relationship"
                    type="button"
                  />
                </article>
              </div>
            </section>
          </div>
        </div>
        <div aria-hidden="true" className="mini-map">
          <div
            className="mini-map-domain active"
            style={{ left: 1.76, top: 1.32, width: 28.6, height: 15.4, borderColor: '#60a5fa' }}
            title="Orders"
          />
        </div>
      </div>
    </Shell>
  )
};

export const StatusSurfaces: Story = {
  render: () => (
    <Shell>
      <FixedSurfaceDemo>
        <div aria-live="polite" className="status-region status-info" role="status">
          Model saved to the Cana store.
        </div>
      </FixedSurfaceDemo>
      <FixedSurfaceDemo>
        <div aria-live="polite" className="status-region status-error" role="status">
          Validation failed: entity Order requires a primary key field.
        </div>
      </FixedSurfaceDemo>
      <p aria-live="polite" className="hint status-line status-info" role="status">
        Loaded ecosystem.dev.config.cjs — 2 processes.
      </p>
      <p aria-live="polite" className="hint status-line status-error" role="status">
        Port 70000 is outside the accepted range (1-65535).
      </p>
    </Shell>
  )
};

export const EntityInspector: Story = {
  render: () => (
    <Shell>
      <div className="sidebar" style={{ border: '1px solid var(--jtx-line)', maxWidth: 360 }}>
        <section className="panel">
          <h2>Entity Inspector</h2>
          <p className="hint">Editing: Order</p>
          <div className="row">
            <input
              aria-label="Entity name"
              defaultValue="Order"
              placeholder="Entity name"
              type="text"
            />
            <button type="button">Save Name</button>
          </div>
          <div className="column compact" style={{ marginTop: 12 }}>
            <label htmlFor="entity-rbac-action-select" style={{ display: 'contents' }}>
              RBAC Action
              <select defaultValue="list" id="entity-rbac-action-select">
                <option value="list">list</option>
                <option value="getById">getById</option>
                <option value="create">create</option>
              </select>
            </label>
            <label className="check" htmlFor="entity-rbac-superadmin">
              <input defaultChecked id="entity-rbac-superadmin" type="checkbox" /> superadmin
            </label>
            <label className="check" htmlFor="entity-rbac-admin">
              <input defaultChecked id="entity-rbac-admin" type="checkbox" /> admin
            </label>
            <label className="check" htmlFor="entity-rbac-user">
              <input id="entity-rbac-user" type="checkbox" /> user
            </label>
            <label className="check" htmlFor="entity-rbac-tenant-scoped">
              <input disabled id="entity-rbac-tenant-scoped" type="checkbox" /> tenant scoped
              (derived from roles)
            </label>
          </div>
          <div className="field-row" style={{ marginTop: 12 }}>
            <input aria-label="Field name" defaultValue="total" type="text" />
            <select aria-label="Field type" defaultValue="number">
              <option value="string">string</option>
              <option value="number">number</option>
            </select>
            <label className="check" htmlFor="entity-field-required">
              <input id="entity-field-required" type="checkbox" /> required
            </label>
            <label className="check" htmlFor="entity-field-pk">
              <input id="entity-field-pk" type="checkbox" /> PK
            </label>
            <label className="check" htmlFor="entity-field-fk">
              <input id="entity-field-fk" type="checkbox" /> FK
            </label>
            <label className="check" htmlFor="entity-field-unique">
              <input id="entity-field-unique" type="checkbox" /> unique
            </label>
            <label className="check" htmlFor="entity-field-nullable">
              <input defaultChecked id="entity-field-nullable" type="checkbox" /> nullable
            </label>
            <button aria-label="Move field up" type="button">
              ↑
            </button>
            <button aria-label="Delete field" type="button">
              ×
            </button>
          </div>
        </section>
      </div>
    </Shell>
  )
};

export const PanelsAndLists: Story = {
  render: () => (
    <Shell>
      <div className="sidebar" style={{ border: '1px solid var(--jtx-line)', maxWidth: 360 }}>
        <section className="panel">
          <h2>Domains</h2>
          <div className="row">
            <input aria-label="Domain name" placeholder="Domain name" type="text" />
            <button type="button">Add</button>
          </div>
          <ul className="list">
            <li>
              <button className="active" type="button">
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
              <button aria-label="Delete relationship places" type="button">
                ×
              </button>
            </li>
          </ul>
          <p className="hint">Pick mode off</p>
        </section>
      </div>
    </Shell>
  )
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
  )
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
            <button className="pwa-update-banner-btn pwa-update-banner-btn-reload" type="button">
              Reload to update
            </button>
            <button className="pwa-update-banner-btn pwa-update-banner-btn-reset" type="button">
              Dismiss
            </button>
          </div>
        </div>
      </FixedSurfaceDemo>
    </Shell>
  )
};
