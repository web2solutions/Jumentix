'use client';

import { useMemo, useState } from 'react';
import classes from './HexagonalArchitectureMap.module.css';

export type HexLocale = 'en' | 'pt-BR';

type LayerId =
  | 'domain'
  | 'application'
  | 'ports'
  | 'inbound'
  | 'outbound'
  | 'composition';

type LayerCopy = {
  id: LayerId;
  title: string;
  subtitle: string;
  role: string;
  paths: string[];
  examples: string[];
};

const COPY: Record<HexLocale, LayerCopy[]> = {
  en: [
    {
      id: 'domain',
      title: 'Domain (core)',
      subtitle: 'Entities, models, invariants, security policy',
      role: 'Pure business rules. No framework, DB, or HTTP imports.',
      paths: [
        'modules/Users/domain/',
        'modules/Catalogs/domain/',
        'modules/ddd/valueObjects/',
      ],
      examples: [
        'Entity / Model',
        'Organization (tenant)',
        'RBAC roles',
        'Value objects',
      ],
    },
    {
      id: 'application',
      title: 'Application',
      subtitle: 'Use cases, features, services, events',
      role: 'Orchestrates domain through ports. Defines what the system does.',
      paths: [
        'modules/*/application/',
        'modules/*/features/',
        'modules/*/service/',
        'modules/*/events/',
      ],
      examples: [
        'UserUseCases / AuthUseCases',
        'UserService / AuthService',
        'Feature operations',
        'Event contracts + listeners',
      ],
    },
    {
      id: 'ports',
      title: 'Ports',
      subtitle: 'Inbound and outbound contracts',
      role: 'Stable interfaces between application and the outside world.',
      paths: [
        'modules/*/application/ports/',
        'modules/port/',
        'infra/ports/',
        'interface/HTTP/ports/',
      ],
      examples: [
        'Repository ports',
        'BaseController contracts',
        'Mutex / persistence ports',
      ],
    },
    {
      id: 'inbound',
      title: 'Inbound adapters (driving)',
      subtitle: 'Protocols + GUI clients that drive the core',
      role: 'Translate external protocols and GUIs into application calls.',
      paths: [
        'interface/GUI/web/',
        'interface/GUI/desktop/',
        'interface/HTTP/adapters/',
        'interface/WebSocket/',
        'interface/gRPC/',
        'interface/CLI/',
        'modules/*/adapters/in/',
      ],
      examples: [
        'Web GUI (SPA/PWA/React/Vue) — slot ready',
        'Desktop GUI (Electron/GTK) — slot ready',
        'Express / Fastify / … handlers',
        'Socket.IO / gRPC / CLI',
      ],
    },
    {
      id: 'outbound',
      title: 'Outbound adapters (driven)',
      subtitle: 'Persistence, messaging, JWT, cache, mutex',
      role: 'Implement ports against real tech. Domain never sees these types.',
      paths: [
        'infra/persistence/',
        'infra/messages/',
        'infra/jwt/',
        'infra/cache/',
        'modules/*/adapters/out/',
      ],
      examples: [
        'In-memory / key-value / external DB',
        'Message mediator',
        'JwtService / MutexService',
      ],
    },
    {
      id: 'composition',
      title: 'Composition & shared',
      subtitle: 'Wiring, config, OpenAPI helpers',
      role: 'Composition root wires adapters to ports. Shared stays thin.',
      paths: [
        'modules/*/composition/',
        'config/',
        'shared/openapi/',
        'shared/decorators/',
      ],
      examples: [
        'composeUsersAuthServices',
        'jwt / redis / security config',
        'Authorize decorator',
      ],
    },
  ],
  'pt-BR': [
    {
      id: 'domain',
      title: 'Domínio (núcleo)',
      subtitle: 'Entidades, modelos, invariantes, política de segurança',
      role: 'Regras de negócio puras. Sem framework, banco ou HTTP.',
      paths: [
        'modules/Users/domain/',
        'modules/Catalogs/domain/',
        'modules/ddd/valueObjects/',
      ],
      examples: [
        'Entity / Model',
        'Organization (tenant)',
        'Papéis RBAC',
        'Value objects',
      ],
    },
    {
      id: 'application',
      title: 'Aplicação',
      subtitle: 'Casos de uso, features, services, eventos',
      role: 'Orquestra o domínio via ports. Define o que o sistema faz.',
      paths: [
        'modules/*/application/',
        'modules/*/features/',
        'modules/*/service/',
        'modules/*/events/',
      ],
      examples: [
        'UserUseCases / AuthUseCases',
        'UserService / AuthService',
        'Operações de feature',
        'Contratos e listeners de evento',
      ],
    },
    {
      id: 'ports',
      title: 'Ports',
      subtitle: 'Contratos de entrada e saída',
      role: 'Interfaces estáveis entre aplicação e o mundo externo.',
      paths: [
        'modules/*/application/ports/',
        'modules/port/',
        'infra/ports/',
        'interface/HTTP/ports/',
      ],
      examples: [
        'Ports de repositório',
        'Contratos de BaseController',
        'Ports de mutex / persistência',
      ],
    },
    {
      id: 'inbound',
      title: 'Adapters inbound (driving)',
      subtitle: 'Protocolos + GUIs que dirigem o núcleo',
      role: 'Traduzem protocolos e GUIs em chamadas de aplicação.',
      paths: [
        'interface/GUI/web/',
        'interface/GUI/desktop/',
        'interface/HTTP/adapters/',
        'interface/WebSocket/',
        'interface/gRPC/',
        'interface/CLI/',
        'modules/*/adapters/in/',
      ],
      examples: [
        'GUI Web (SPA/PWA/React/Vue) — slot pronto',
        'GUI Desktop (Electron/GTK) — slot pronto',
        'Handlers Express / Fastify / …',
        'Socket.IO / gRPC / CLI',
      ],
    },
    {
      id: 'outbound',
      title: 'Adapters outbound (driven)',
      subtitle: 'Persistência, messaging, JWT, cache, mutex',
      role: 'Implementam ports na tecnologia real. Domínio não vê esses tipos.',
      paths: [
        'infra/persistence/',
        'infra/messages/',
        'infra/jwt/',
        'infra/cache/',
        'modules/*/adapters/out/',
      ],
      examples: [
        'In-memory / key-value / DB externo',
        'Message mediator',
        'JwtService / MutexService',
      ],
    },
    {
      id: 'composition',
      title: 'Composition e shared',
      subtitle: 'Wiring, config, helpers OpenAPI',
      role: 'Composition root liga adapters aos ports. Shared permanece fino.',
      paths: [
        'modules/*/composition/',
        'config/',
        'shared/openapi/',
        'shared/decorators/',
      ],
      examples: [
        'composeUsersAuthServices',
        'config jwt / redis / security',
        'Decorator Authorize',
      ],
    },
  ],
};

const FLOW: Record<HexLocale, string[]> = {
  en: [
    'GUI or protocol client',
    'Handler',
    'Controller',
    'Use case',
    'Domain',
    'Port',
    'Outbound adapter',
  ],
  'pt-BR': [
    'GUI ou cliente de protocolo',
    'Handler',
    'Controller',
    'Caso de uso',
    'Domínio',
    'Port',
    'Adapter outbound',
  ],
};

const RING: Record<LayerId, number> = {
  domain: 0,
  application: 1,
  ports: 2,
  inbound: 3,
  outbound: 4,
  composition: 5,
};

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

export function HexagonalArchitectureMap({ locale = 'en' }: { locale?: HexLocale }) {
  const layers = COPY[locale];
  const [active, setActive] = useState<LayerId>('inbound');
  const selected = useMemo(
    () => layers.find((layer) => layer.id === active) ?? layers[0],
    [active, layers],
  );

  const cx = 220;
  const cy = 210;
  const radii = [46, 78, 110, 142, 174, 206];
  const paintOrder: LayerId[] = [
    'composition',
    'outbound',
    'inbound',
    'ports',
    'application',
    'domain',
  ];

  const labels = locale === 'pt-BR'
    ? {
      heading: 'Mapa hexagonal do backend-template',
      lead: 'Clique em um anel para ver pastas reais em apps/backend-template/src. GUIs web e desktop ficam no lado inbound (driving).',
      flow: 'Fluxo de chamada',
      paths: 'Pastas',
      examples: 'Peças concretas',
      source: 'Fonte: apps/backend-template · contrato Spec Architecture',
    }
    : {
      heading: 'Backend-template hexagonal map',
      lead: 'Click a ring to inspect real folders under apps/backend-template/src. Web and desktop GUIs sit on the inbound (driving) side.',
      flow: 'Call flow',
      paths: 'Folders',
      examples: 'Concrete pieces',
      source: 'Source: apps/backend-template · Spec Architecture contract',
    };

  return (
    <section
      className={classes.root}
      aria-label={labels.heading}
      data-testid="hexagonal-architecture-map"
    >
      <div className={classes.intro}>
        <p className={classes.eyebrow}>
          {locale === 'pt-BR' ? 'Arquitetura hexagonal' : 'Hexagonal architecture'}
        </p>
        <h2 className={classes.title}>{labels.heading}</h2>
        <p className={classes.lead}>{labels.lead}</p>
      </div>

      <div className={classes.grid}>
        <div className={classes.diagramPane}>
          {/*
            Diagram is a mouse affordance only. Keyboard/AT selection lives in the
            tablist below — putting role=button polygons inside role=img fails
            axe nested-interactive (CommercialPages.a11y architecture page).
          */}
          <svg
            className={classes.svg}
            viewBox="0 0 440 430"
            aria-hidden="true"
            focusable="false"
          >
            {paintOrder.map((id) => {
              const ring = RING[id];
              const isActive = active === id;
              return (
                <polygon
                  key={id}
                  points={hexPoints(cx, cy, radii[ring])}
                  className={`${classes.ring} ${classes[`ring${ring}`]} ${isActive ? classes.ringActive : ''}`}
                  onClick={() => setActive(id)}
                />
              );
            })}
            <text x={cx} y={cy - 4} textAnchor="middle" className={classes.centerLabel}>
              {locale === 'pt-BR' ? 'Domínio' : 'Domain'}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className={classes.centerSub}>
              Users · Catalogs
            </text>
          </svg>

          <div className={classes.pills} role="tablist" aria-label={labels.heading}>
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                role="tab"
                aria-selected={active === layer.id}
                className={`${classes.pill} ${active === layer.id ? classes.pillActive : ''}`}
                onClick={() => setActive(layer.id)}
              >
                {layer.title.split(' (')[0]}
              </button>
            ))}
          </div>
        </div>

        <aside className={classes.detail} aria-live="polite">
          <p className={classes.detailEyebrow}>
            {locale === 'pt-BR' ? `Anel ${RING[selected.id]}` : `Ring ${RING[selected.id]}`}
          </p>
          <h3 className={classes.detailTitle}>{selected.title}</h3>
          <p className={classes.detailSubtitle}>{selected.subtitle}</p>
          <p className={classes.detailRole}>{selected.role}</p>

          <h4 className={classes.detailSection}>{labels.paths}</h4>
          <ul className={classes.pathList}>
            {selected.paths.map((path) => (
              <li key={path}><code>{path}</code></li>
            ))}
          </ul>

          <h4 className={classes.detailSection}>{labels.examples}</h4>
          <ul className={classes.exampleList}>
            {selected.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </aside>
      </div>

      <div className={classes.flow}>
        <p className={classes.flowLabel}>{labels.flow}</p>
        <ol className={classes.flowList}>
          {FLOW[locale].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <p className={classes.source}>{labels.source}</p>
    </section>
  );
}
