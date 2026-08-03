import type { ReactNode } from 'react';
import {
  IconApi,
  IconArrowRight,
  IconBolt,
  IconBrandGithub,
  IconBuildingFactory2,
  IconCloud,
  IconCode,
  IconDatabase,
  IconDeviceDesktop,
  IconGitBranch,
  IconHierarchy3,
  IconLock,
  IconMessages,
  IconPackage,
  IconRocket,
  IconRoute,
  IconShieldCheck,
  IconTopologyStar3,
  IconUsers,
} from '@tabler/icons-react';
import {
  ActionLink,
  ArchitectureFlow,
  CapabilityTable,
  CodeShowcase,
  FeatureGrid,
  MetricStrip,
  SectionHeading,
  StatusBadge,
} from '../design-system';
import classes from './CommercialPages.module.css';

export type CommercialLocale = 'en' | 'pt-BR';
export type CommercialPageName =
  | 'home'
  | 'product'
  | 'use-cases'
  | 'integrations'
  | 'architecture'
  | 'security'
  | 'engagement'
  | 'contact'
  | 'community'
  | 'roadmap';

export type UseCaseName =
  | 'rest-api'
  | 'realtime-api'
  | 'saas-monolith'
  | 'saas-microservices'
  | 'spa-pwa';

const localize = (href: string, locale: CommercialLocale) =>
  href.startsWith('/docs') || href.startsWith('http')
    ? href
    : locale === 'pt-BR'
      ? `/pt-BR${href === '/' ? '' : href}`
      : href;

const t = <T,>(locale: CommercialLocale, en: T, pt: T) => (locale === 'pt-BR' ? pt : en);

const repositoryUrl = 'https://github.com/XpertMinds/Jumentix';

const codeSamples = {
  start: [
    {
      label: 'Install',
      language: 'shell',
      code: `pnpm install
pnpm run cli
pnpm run dev:express`,
    },
    {
      label: 'Service contract',
      language: 'typescript',
      code: `export const CreateTaskContract = {
  subject: 'tasks.create',
  request: CreateTaskInput,
  response: TaskOutput,
} as const;

const task = await mediator.request(
  CreateTaskContract,
  { title: 'Ship with confidence' },
);`,
    },
    {
      label: 'Environment',
      language: 'dotenv',
      code: `JUMENTIX_HTTP_FRAMEWORK=express
JUMENTIX_DATABASE_DRIVER=postgresql
JUMENTIX_REALTIME_API=yes
JUMENTIX_REALTIME_API_PROTOCOL=websocket`,
    },
  ],
  rest: [
    {
      label: 'Controller',
      language: 'typescript',
      code: `export class TaskController {
  constructor(private readonly createTask: CreateTaskUseCase) {}

  async create(input: CreateTaskInput): Promise<TaskOutput> {
    return this.createTask.execute(input);
  }
}`,
    },
    {
      label: 'OpenAPI 3.1',
      language: 'yaml',
      code: `paths:
  /tasks:
    post:
      operationId: createTask
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTaskInput'
      responses:
        '201':
          description: Task created`,
    },
    {
      label: 'Fetch client',
      language: 'typescript',
      code: `const response = await fetch('/tasks', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: \`Bearer \${token}\`,
  },
  body: JSON.stringify({ title: 'Ship the release' }),
});`,
    },
  ],
  realtime: [
    {
      label: 'WebSocket',
      language: 'typescript',
      code: `const socket = io('http://localhost:3001');

socket.emit('request', {
  id: crypto.randomUUID(),
  subject: 'tasks.create',
  payload: { title: 'Realtime task' },
});

socket.on('response', ({ id, payload }) => {
  console.log(id, payload);
});`,
    },
    {
      label: 'gRPC',
      language: 'typescript',
      code: `const client = new TasksClient(
  'localhost:50051',
  credentials.createInsecure(),
);

client.createTask(
  { title: 'Contract-first task' },
  (error, task) => console.log(error ?? task),
);`,
    },
    {
      label: 'AsyncAPI',
      language: 'yaml',
      code: `channels:
  tasks.create:
    address: tasks.create
    messages:
      request:
        $ref: '#/components/messages/CreateTaskRequest'
      response:
        $ref: '#/components/messages/CreateTaskResponse'`,
    },
  ],
  persistence: [
    {
      label: 'Driver selection',
      language: 'typescript',
      code: `const database = await compileDatabaseClient({
  driver: process.env.JUMENTIX_DATABASE_DRIVER,
});

const taskStore = database.stores.Tasks;
await taskStore.create(task);`,
    },
    {
      label: 'Relationship',
      language: 'typescript',
      code: `class Organization extends BaseModel {
  @hasMany(() => User)
  users: HasMany<typeof User>;

  createAddress(input: AddressValueObject): void {
    this.address.push(input);
  }
}`,
    },
    {
      label: 'Docker',
      language: 'shell',
      code: `pnpm run db:postgresql:up
JUMENTIX_DATABASE_DRIVER=postgresql pnpm run test:smoke:database
pnpm run db:postgresql:down`,
    },
  ],
  deploy: [
    {
      label: 'PM2',
      language: 'shell',
      code: `pnpm run pm2:dev
pnpm run pm2:staging
pnpm run pm2:production`,
    },
    {
      label: 'Functions',
      language: 'yaml',
      code: `functions:
  createTask:
    handler: src/functions/tasks/create.handler
    events:
      - httpApi:
          path: /tasks
          method: post`,
    },
    {
      label: 'Quality gate',
      language: 'shell',
      code: `pnpm run lint
pnpm run test:unit
pnpm run test:integration
pnpm run ci:gate`,
    },
  ],
};

function PageHero({
  locale,
  eyebrow,
  title,
  description,
  children,
}: {
  locale: CommercialLocale;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className={classes.pageHero}>
      <div className={`${classes.container} ${classes.pageHeroGrid}`}>
        <div>
          <StatusBadge tone="attention">{eyebrow}</StatusBadge>
          <h1>{title}</h1>
          <p>{description}</p>
          {children}
        </div>
        <img
          className={classes.mascot}
          src="/brand/jumentix-mascot.png"
          alt={t(locale, 'Jumentix open-source mascot', 'Mascote open source do Jumentix')}
        />
      </div>
    </section>
  );
}

function Band({
  children,
  alternate = false,
}: {
  children: ReactNode;
  alternate?: boolean;
}) {
  return (
    <section className={`${classes.band} ${alternate ? classes.bandAlt : ''}`}>
      <div className={classes.container}>{children}</div>
    </section>
  );
}

function FinalCta({ locale }: { locale: CommercialLocale }) {
  return (
    <Band>
      <div className={classes.cta}>
        <div>
          <h2>{t(locale, 'Build the product. Keep the architecture.', 'Construa o produto. Preserve a arquitetura.')}</h2>
          <p>
            {t(
              locale,
              'Explore the source, run the factory locally, and turn your next Node.js service into a repeatable platform capability.',
              'Explore o código, execute a fábrica localmente e transforme seu próximo serviço Node.js em uma capacidade repetível de plataforma.',
            )}
          </p>
        </div>
        <div className={classes.sectionActions}>
          <ActionLink href="/docs/jumentix">{t(locale, 'Read the docs', 'Leia a documentação')}</ActionLink>
          <ActionLink href={repositoryUrl} variant="secondary" external>
            GitHub
          </ActionLink>
        </div>
      </div>
    </Band>
  );
}

const useCases: Array<{
  name: UseCaseName;
  icon: ReactNode;
  en: [string, string];
  pt: [string, string];
}> = [
  {
    name: 'rest-api',
    icon: <IconApi size={24} />,
    en: ['REST API', 'Ship OpenAPI 3.1 services with interchangeable native HTTP adapters.'],
    pt: ['API REST', 'Entregue serviços OpenAPI 3.1 com adaptadores HTTP nativos intercambiáveis.'],
  },
  {
    name: 'realtime-api',
    icon: <IconMessages size={24} />,
    en: ['Realtime API', 'Run Socket.IO or gRPC beside a REST fallback and AsyncAPI documentation.'],
    pt: ['API em tempo real', 'Execute Socket.IO ou gRPC ao lado de fallback REST e documentação AsyncAPI.'],
  },
  {
    name: 'saas-monolith',
    icon: <IconBuildingFactory2 size={24} />,
    en: ['Modular SaaS', 'Launch one deployable with domain boundaries ready to become services.'],
    pt: ['SaaS modular', 'Lance um deploy com limites de domínio prontos para virar serviços.'],
  },
  {
    name: 'saas-microservices',
    icon: <IconTopologyStar3 size={24} />,
    en: ['Microservices', 'Keep service communication contract-based with the Message Mediator.'],
    pt: ['Microsserviços', 'Mantenha a comunicação entre serviços baseada em contratos com o Message Mediator.'],
  },
  {
    name: 'spa-pwa',
    icon: <IconDeviceDesktop size={24} />,
    en: ['SPA and offline PWA', 'Build frontend products that share generated SDKs and work offline.'],
    pt: ['SPA e PWA offline', 'Crie produtos frontend que compartilham SDKs gerados e funcionam offline.'],
  },
];

function UseCaseLinks({ locale }: { locale: CommercialLocale }) {
  return (
    <div className={classes.linkGrid}>
      {useCases.map((item) => {
        const [title, description] = locale === 'pt-BR' ? item.pt : item.en;
        return (
          <a className={classes.linkCard} href={localize(`/use-cases/${item.name}`, locale)} key={item.name}>
            {item.icon}
            <h3>{title}</h3>
            <p>{description}</p>
            <span>
              {t(locale, 'Explore the blueprint', 'Explore o blueprint')} <IconArrowRight size={16} />
            </span>
          </a>
        );
      })}
    </div>
  );
}

function Home({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <section className={classes.hero}>
        <div className={classes.heroMedia} />
        <div className={`${classes.container} ${classes.heroContent}`}>
          <StatusBadge tone="success">{t(locale, 'Open-source software factory', 'Fábrica de software open source')}</StatusBadge>
          <h1>Jumentix</h1>
          <p>
            {t(
              locale,
              'Design, generate, govern, and deploy enterprise Node.js products from one architecture system, from the first modular monolith to an unlimited service landscape.',
              'Projete, gere, governe e publique produtos Node.js enterprise a partir de um único sistema de arquitetura, do primeiro monólito modular a um ecossistema ilimitado de serviços.',
            )}
          </p>
          <div className={classes.heroActions}>
            <ActionLink href="/docs/jumentix">{t(locale, 'Start building', 'Comece a construir')}</ActionLink>
            <ActionLink href={localize('/product', locale)} variant="secondary">
              {t(locale, 'Explore the platform', 'Explore a plataforma')}
            </ActionLink>
          </div>
          <ul className={classes.heroProof}>
            <li><IconShieldCheck size={17} /> 99% quality threshold</li>
            <li><IconGitBranch size={17} /> DDD + Hexagonal</li>
            <li><IconPackage size={17} /> pnpm monorepo</li>
            <li><IconBrandGithub size={17} /> Open source</li>
          </ul>
        </div>
      </section>
      <Band>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'One factory, many products', 'Uma fábrica, muitos produtos')}
            title={t(locale, 'Move from idea to governed software without rebuilding the foundation', 'Vá da ideia ao software governado sem reconstruir a fundação')}
            description={t(
              locale,
              'Jumentix combines visual domain design, contract-first runtimes, reusable adapters, developer automation, and deployment governance.',
              'O Jumentix combina design visual de domínios, runtimes orientados a contratos, adaptadores reutilizáveis, automação de desenvolvimento e governança de deploy.',
            )}
          />
          <MetricStrip metrics={[
            { value: '12+', label: t(locale, 'HTTP and function adapters', 'adaptadores HTTP e functions') },
            { value: '10+', label: t(locale, 'persistence targets', 'destinos de persistência') },
            { value: '3', label: t(locale, 'API interface styles', 'estilos de interface de API') },
            { value: '99%', label: t(locale, 'coverage standard', 'padrão de cobertura') },
          ]} />
        </div>
      </Band>
      <Band alternate>
        <div className={classes.twoColumn}>
          <div className={classes.prose}>
            <StatusBadge>{t(locale, 'Architecture you can see', 'Arquitetura que você pode ver')}</StatusBadge>
            <h2>{t(locale, 'Design bounded contexts as a living system', 'Projete contextos delimitados como um sistema vivo')}</h2>
            <p>
              {t(
                locale,
                'The Domain Designer turns domains, entities, fields, validation, and relationships into a navigable model. The same contracts guide code generation and API documentation.',
                'O Domain Designer transforma domínios, entidades, campos, validações e relacionamentos em um modelo navegável. Os mesmos contratos orientam geração de código e documentação de API.',
              )}
            </p>
            <div className={classes.sectionActions}>
              <ActionLink href={localize('/product', locale)}>{t(locale, 'See the product', 'Veja o produto')}</ActionLink>
              <ActionLink href="/docs/jumentix/architecture-structure" variant="secondary">{t(locale, 'Architecture docs', 'Docs de arquitetura')}</ActionLink>
            </div>
          </div>
          <figure className={classes.productShot}>
            <img src="/product/domain-designer.png" alt={t(locale, 'Jumentix Domain Designer displaying bounded contexts and entity relationships', 'Domain Designer do Jumentix exibindo contextos delimitados e relações entre entidades')} />
            <figcaption>{t(locale, 'The real Jumentix Domain Designer interface.', 'A interface real do Domain Designer do Jumentix.')}</figcaption>
          </figure>
        </div>
      </Band>
      <Band>
        <div className={classes.twoColumn}>
          <div className={classes.prose}>
            <SectionHeading
              eyebrow={t(locale, 'Code is part of the product', 'Código faz parte do produto')}
              title={t(locale, 'Start locally. Keep every production option open.', 'Comece localmente. Mantenha todas as opções de produção abertas.')}
              description={t(
                locale,
                'The same application contracts work across a modular monolith, realtime server, functions, and distributed services.',
                'Os mesmos contratos de aplicação funcionam em monólito modular, servidor em tempo real, functions e serviços distribuídos.',
              )}
            />
          </div>
          <CodeShowcase samples={codeSamples.start} title={t(locale, 'Start Jumentix', 'Inicie o Jumentix')} />
        </div>
      </Band>
      <Band alternate>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Choose a delivery path', 'Escolha uma jornada')}
            title={t(locale, 'One architecture, five practical starting points', 'Uma arquitetura, cinco pontos de partida práticos')}
          />
          <UseCaseLinks locale={locale} />
        </div>
      </Band>
      <Band>
        <blockquote className={classes.quote}>
          {t(
            locale,
            'Jumentix is for teams that want framework speed without surrendering domain ownership, portability, or operational evidence.',
            'O Jumentix é para equipes que querem velocidade de framework sem abrir mão da propriedade do domínio, portabilidade ou evidências operacionais.',
          )}
        </blockquote>
      </Band>
      <FinalCta locale={locale} />
    </>
  );
}

function Product({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <PageHero
        locale={locale}
        eyebrow={t(locale, 'Product', 'Produto')}
        title={t(locale, 'A software factory your teams can evolve', 'Uma fábrica de software que suas equipes podem evoluir')}
        description={t(
          locale,
          'Jumentix packages architecture, automation, runtime adapters, documentation, and governance into one open platform.',
          'O Jumentix empacota arquitetura, automação, adaptadores de runtime, documentação e governança em uma plataforma aberta.',
        )}
      >
        <div className={classes.sectionActions}>
          <ActionLink href="/docs/jumentix">{t(locale, 'Read technical docs', 'Leia os docs técnicos')}</ActionLink>
          <ActionLink href={repositoryUrl} variant="secondary" external>{t(locale, 'Inspect the source', 'Inspecione o código')}</ActionLink>
        </div>
      </PageHero>
      <Band>
        <div className={classes.sectionStack}>
          <SectionHeading eyebrow={t(locale, 'Platform capabilities', 'Capacidades da plataforma')} title={t(locale, 'The full delivery lifecycle, connected', 'Todo o ciclo de entrega, conectado')} />
          <FeatureGrid features={[
            { title: t(locale, 'Service Management', 'Gerenciamento de serviços'), description: t(locale, 'Visual tools for domains, interfaces, environments, and deployments.', 'Ferramentas visuais para domínios, interfaces, ambientes e deploys.'), icon: <IconBuildingFactory2 /> },
            { title: t(locale, 'Contract-first runtimes', 'Runtimes orientados a contratos'), description: t(locale, 'OpenAPI and AsyncAPI align handlers, clients, validation, and docs.', 'OpenAPI e AsyncAPI alinham handlers, clientes, validação e docs.'), icon: <IconRoute /> },
            { title: t(locale, 'Reusable package ecosystem', 'Ecossistema de pacotes reutilizáveis'), description: t(locale, 'Generic adapters become distributable packages shared by services.', 'Adaptadores genéricos viram pacotes distribuíveis compartilhados por serviços.'), icon: <IconPackage /> },
            { title: t(locale, 'Portable persistence', 'Persistência portável'), description: t(locale, 'One store contract spans relational, document, key-value, and queue-backed adapters.', 'Um contrato de store cobre adaptadores relacionais, documentos, chave-valor e filas.'), icon: <IconDatabase /> },
            { title: t(locale, 'Service communication', 'Comunicação entre serviços'), description: t(locale, 'Message Mediator request/response and events avoid domain coupling.', 'Request/response e eventos do Message Mediator evitam acoplamento de domínios.'), icon: <IconMessages /> },
            { title: t(locale, 'Governed delivery', 'Entrega governada'), description: t(locale, 'Coverage, security, CI, traceability, and evidence are product defaults.', 'Cobertura, segurança, CI, rastreabilidade e evidências são padrões do produto.'), icon: <IconShieldCheck /> },
          ]} />
        </div>
      </Band>
      <Band alternate>
        <div className={classes.twoColumn}>
          <div className={classes.prose}>
            <h2>{t(locale, 'Compose the runtime instead of marrying it', 'Componha o runtime em vez de ficar preso a ele')}</h2>
            <p>{t(locale, 'Choose the interface and infrastructure that fit each service. Domain and use-case code stay behind stable ports.', 'Escolha a interface e a infraestrutura adequadas a cada serviço. Domínio e casos de uso permanecem atrás de ports estáveis.')}</p>
          </div>
          <CodeShowcase samples={codeSamples.persistence} title={t(locale, 'Portable persistence', 'Persistência portável')} />
        </div>
      </Band>
      <Band>
        <div className={classes.sectionStack}>
          <SectionHeading eyebrow={t(locale, 'Architecture flow', 'Fluxo de arquitetura')} title={t(locale, 'Changes stay close to the feature', 'Mudanças permanecem próximas da feature')} />
          <ArchitectureFlow steps={[
            { title: t(locale, 'Interface adapter', 'Adaptador de interface'), description: t(locale, 'Validates and translates external requests.', 'Valida e traduz requests externos.') },
            { title: t(locale, 'Controller', 'Controller'), description: t(locale, 'Selects the application use case.', 'Seleciona o caso de uso da aplicação.') },
            { title: t(locale, 'Use case and domain', 'Caso de uso e domínio'), description: t(locale, 'Enforces business behavior and contracts.', 'Aplica comportamento de negócio e contratos.') },
            { title: t(locale, 'Output adapter', 'Adaptador de saída'), description: t(locale, 'Persists, publishes, or integrates.', 'Persiste, publica ou integra.') },
          ]} />
        </div>
      </Band>
      <FinalCta locale={locale} />
    </>
  );
}

function UseCases({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <PageHero locale={locale} eyebrow={t(locale, 'Use cases', 'Casos de uso')} title={t(locale, 'Start with the product you need now', 'Comece com o produto de que você precisa agora')} description={t(locale, 'Every blueprint uses the same contracts and boundaries, so today’s architecture does not block tomorrow’s scale.', 'Cada blueprint usa os mesmos contratos e limites, para que a arquitetura de hoje não bloqueie a escala de amanhã.')} />
      <Band><UseCaseLinks locale={locale} /></Band>
      <FinalCta locale={locale} />
    </>
  );
}

const useCaseDetails: Record<UseCaseName, {
  en: { eyebrow: string; title: string; description: string; outcomes: string[]; sample: keyof typeof codeSamples };
  pt: { eyebrow: string; title: string; description: string; outcomes: string[]; sample: keyof typeof codeSamples };
}> = {
  'rest-api': {
    en: { eyebrow: 'REST API blueprint', title: 'Contract-first REST APIs without domain lock-in', description: 'Use OpenAPI 3.1 to bind request validation, handlers, controllers, SDK clients, and documentation.', outcomes: ['Native adapters for multiple Node.js HTTP runtimes', 'Swagger documentation and static asset serving', 'Two validation layers: interface and domain'], sample: 'rest' },
    pt: { eyebrow: 'Blueprint de API REST', title: 'APIs REST orientadas a contratos sem aprisionar o domínio', description: 'Use OpenAPI 3.1 para conectar validação, handlers, controllers, SDKs e documentação.', outcomes: ['Adaptadores nativos para vários runtimes HTTP Node.js', 'Documentação Swagger e arquivos estáticos', 'Duas camadas de validação: interface e domínio'], sample: 'rest' },
  },
  'realtime-api': {
    en: { eyebrow: 'Realtime blueprint', title: 'Bidirectional APIs with a built-in fallback', description: 'Run Socket.IO or gRPC as the primary interface while a separate REST process provides fallback and AsyncAPI documentation.', outcomes: ['Correlated request/response messages', 'Redis Streams and cluster resilience for Socket.IO', 'AsyncAPI contracts shared with generated clients'], sample: 'realtime' },
    pt: { eyebrow: 'Blueprint realtime', title: 'APIs bidirecionais com fallback incorporado', description: 'Execute Socket.IO ou gRPC como interface principal enquanto um processo REST separado oferece fallback e documentação AsyncAPI.', outcomes: ['Mensagens request/response correlacionadas', 'Redis Streams e resiliência em cluster para Socket.IO', 'Contratos AsyncAPI compartilhados com clientes gerados'], sample: 'realtime' },
  },
  'saas-monolith': {
    en: { eyebrow: 'Modular SaaS blueprint', title: 'Launch one deployable, preserve every domain boundary', description: 'Ship faster as a modular monolith with multi-tenancy, RBAC, organizations, users, and event-driven collaboration already modeled.', outcomes: ['Lower first-release operating cost', 'Feature-driven modules keep changes local', 'Message contracts support later extraction'], sample: 'start' },
    pt: { eyebrow: 'Blueprint SaaS modular', title: 'Lance um deploy, preserve cada limite de domínio', description: 'Entregue mais rápido como monólito modular com multitenancy, RBAC, organizações, usuários e colaboração orientada a eventos já modelados.', outcomes: ['Menor custo operacional na primeira versão', 'Módulos por feature mantêm mudanças locais', 'Contratos de mensagem suportam extração futura'], sample: 'start' },
  },
  'saas-microservices': {
    en: { eyebrow: 'Distributed SaaS blueprint', title: 'Scale services without rewriting communication', description: 'Use independent workers and contract-based mediation so in-process requests can move to RabbitMQ, BullMQ, or another transport.', outcomes: ['Independent service ownership', 'Request/response and publish/listen patterns', 'Per-service runtimes, tests, and deployment'], sample: 'deploy' },
    pt: { eyebrow: 'Blueprint SaaS distribuído', title: 'Escale serviços sem reescrever a comunicação', description: 'Use workers independentes e mediação baseada em contratos para mover requests em processo para RabbitMQ, BullMQ ou outro transporte.', outcomes: ['Propriedade independente por serviço', 'Padrões request/response e publish/listen', 'Runtime, testes e deploy por serviço'], sample: 'deploy' },
  },
  'spa-pwa': {
    en: { eyebrow: 'Frontend blueprint', title: 'Build installable products that keep working offline', description: 'Pair generated SDK clients with a SPA or PWA architecture, IndexedDB persistence, and the same contract vocabulary as the backend.', outcomes: ['Offline-first data workflows', 'REST, Socket.IO, and gRPC client packages', 'Shared governance across frontend and backend'], sample: 'start' },
    pt: { eyebrow: 'Blueprint frontend', title: 'Crie produtos instaláveis que continuam funcionando offline', description: 'Combine SDKs gerados com arquitetura SPA ou PWA, persistência IndexedDB e o mesmo vocabulário de contratos do backend.', outcomes: ['Fluxos de dados offline-first', 'Pacotes cliente REST, Socket.IO e gRPC', 'Governança compartilhada entre frontend e backend'], sample: 'start' },
  },
};

export function CommercialUseCasePage({ locale, name }: { locale: CommercialLocale; name: UseCaseName }) {
  const content = locale === 'pt-BR' ? useCaseDetails[name].pt : useCaseDetails[name].en;
  return (
    <main className={classes.page}>
      <PageHero locale={locale} eyebrow={content.eyebrow} title={content.title} description={content.description}>
        <div className={classes.sectionActions}>
          <ActionLink href="/docs/jumentix">{t(locale, 'Implementation guide', 'Guia de implementação')}</ActionLink>
          <ActionLink href={localize('/contact', locale)} variant="secondary">{t(locale, 'Discuss your architecture', 'Converse sobre sua arquitetura')}</ActionLink>
        </div>
      </PageHero>
      <Band>
        <div className={classes.twoColumn}>
          <div className={classes.prose}>
            <h2>{t(locale, 'What this blueprint gives your team', 'O que este blueprint entrega à sua equipe')}</h2>
            <ul>{content.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
          </div>
          <CodeShowcase samples={codeSamples[content.sample]} title={content.title} />
        </div>
      </Band>
      <Band alternate>
        <div className={classes.sectionStack}>
          <SectionHeading eyebrow={t(locale, 'Keep exploring', 'Continue explorando')} title={t(locale, 'Related delivery paths', 'Jornadas relacionadas')} />
          <UseCaseLinks locale={locale} />
        </div>
      </Band>
      <FinalCta locale={locale} />
    </main>
  );
}

const integrations = [
  ['HTTP runtimes', 'Express, Fastify, Restify, Hono, Vercel, LoopBack, Sails, Feathers, Derby, AdonisJS, Total.js', <IconApi key="http" />],
  ['Realtime', 'Socket.IO, Redis Streams, cluster adapter, gRPC, AsyncAPI', <IconMessages key="realtime" />],
  ['SQL', 'PostgreSQL, MySQL, SQL Server, Oracle, SQLite, Aurora DSQL, RDS through Sequelize and Postgres.js', <IconDatabase key="sql" />],
  ['NoSQL', 'MongoDB, DynamoDB, Cassandra, Firebase and in-memory reference adapter', <IconDatabase key="nosql" />],
  ['Messaging', 'In-memory Message Mediator, RabbitMQ and BullMQ-compatible contracts', <IconTopologyStar3 key="messaging" />],
  ['Deployment', 'PM2, Docker, Serverless, AWS, Azure, Google Cloud, Vercel and Cloudflare', <IconCloud key="deployment" />],
] as const;

function Integrations({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <PageHero locale={locale} eyebrow={t(locale, 'Integrations', 'Integrações')} title={t(locale, 'Choose infrastructure per service, not per platform', 'Escolha a infraestrutura por serviço, não por plataforma')} description={t(locale, 'Jumentix keeps technology decisions at the adapter boundary, where they can be tested and replaced.', 'O Jumentix mantém decisões de tecnologia no limite dos adaptadores, onde podem ser testadas e substituídas.')} />
      <Band>
        <div className={classes.integrationGrid}>
          {integrations.map(([title, description, icon]) => <article className={classes.integration} key={title}>{icon}<h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </Band>
      <Band alternate>
        <div className={classes.twoColumn}>
          <div className={classes.prose}><h2>{t(locale, 'Change the driver, preserve the application', 'Troque o driver, preserve a aplicação')}</h2><p>{t(locale, 'Bootstrap adapters read environment configuration, compile the selected database and key-value clients, and inject contracts into the application composition root.', 'Adaptadores de bootstrap leem a configuração do ambiente, compilam os clientes de banco e chave-valor escolhidos e injetam contratos na raiz de composição.')}</p></div>
          <CodeShowcase samples={codeSamples.persistence} title={t(locale, 'Infrastructure adapter selection', 'Seleção de adaptadores de infraestrutura')} />
        </div>
      </Band>
      <FinalCta locale={locale} />
    </>
  );
}

function Architecture({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <PageHero locale={locale} eyebrow={t(locale, 'Architecture', 'Arquitetura')} title={t(locale, 'Domain ownership at the center, technology at the edges', 'Domínio no centro, tecnologia nas bordas')} description={t(locale, 'DDD, Hexagonal Architecture, Event-Driven Design, SOLID, and feature-driven modules are operational constraints, not presentation labels.', 'DDD, Arquitetura Hexagonal, Event-Driven Design, SOLID e módulos por feature são restrições operacionais, não apenas rótulos.')} />
      <Band>
        <div className={classes.sectionStack}>
          <ArchitectureFlow steps={[
            { title: t(locale, 'External request', 'Request externo'), description: t(locale, 'HTTP, WebSocket, gRPC, message, function.', 'HTTP, WebSocket, gRPC, mensagem, function.') },
            { title: t(locale, 'Input adapter', 'Adaptador de entrada'), description: t(locale, 'Validates contract and maps transport.', 'Valida o contrato e mapeia o transporte.') },
            { title: t(locale, 'Application core', 'Núcleo da aplicação'), description: t(locale, 'Controller calls a use case; domain owns rules.', 'Controller chama caso de uso; domínio possui regras.') },
            { title: t(locale, 'Output port', 'Port de saída'), description: t(locale, 'Repository, mediator, cache, or provider.', 'Repository, mediator, cache ou provider.') },
          ]} />
          <CapabilityTable rows={[
            { capability: 'Domain isolation', implementation: 'Feature-driven bounded contexts and domain contracts', status: 'Implemented' },
            { capability: 'Interface portability', implementation: 'Native HTTP, Socket.IO, gRPC, function adapters', status: 'Implemented' },
            { capability: 'Persistence portability', implementation: 'IDatabaseClient and IStore ports', status: 'Implemented' },
            { capability: 'Service decoupling', implementation: 'Message Mediator request/response and events', status: 'Implemented' },
          ]} />
        </div>
      </Band>
      <Band alternate><div className={classes.twoColumn}><div className={classes.prose}><h2>{t(locale, 'Contracts survive topology changes', 'Contratos sobrevivem a mudanças de topologia')}</h2><p>{t(locale, 'A domain service can consume and produce messages as an independent worker. Move it out of process without making its consumers import the implementation.', 'Um serviço de domínio pode consumir e produzir mensagens como worker independente. Retire-o do processo sem obrigar consumidores a importar a implementação.')}</p></div><CodeShowcase samples={codeSamples.start.slice(1, 2)} title="Message Mediator" /></div></Band>
      <FinalCta locale={locale} />
    </>
  );
}

function Security({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <PageHero locale={locale} eyebrow={t(locale, 'Security and compliance', 'Segurança e compliance')} title={t(locale, 'Controls your audit can verify', 'Controles que sua auditoria pode verificar')} description={t(locale, 'Secure defaults connect authentication, authorization, secret handling, error disclosure, dependency scanning, and delivery evidence.', 'Padrões seguros conectam autenticação, autorização, segredos, exposição de erros, análise de dependências e evidências de entrega.')} />
      <Band><div className={classes.sectionStack}><FeatureGrid features={[
        { title: 'RBAC', description: t(locale, 'Superadmin, admin, and user policies with organization boundaries.', 'Políticas de superadmin, admin e user com limites de organização.'), icon: <IconUsers /> },
        { title: 'PCI-oriented controls', description: t(locale, 'Production hides internal failures while dev and staging preserve diagnostics.', 'Produção oculta falhas internas enquanto dev e staging preservam diagnóstico.'), icon: <IconLock /> },
        { title: t(locale, 'Secret-safe outputs', 'Saídas sem segredos'), description: t(locale, 'Password and salt fields are shaped out at the service boundary.', 'Campos de senha e salt são removidos no limite do serviço.'), icon: <IconShieldCheck /> },
        { title: t(locale, 'Continuous evidence', 'Evidência contínua'), description: t(locale, 'OSV dependency scanning, SonarCloud, Codecov, lint, tests, and CI gates protect delivery.', 'Scan de dependências OSV, SonarCloud, Codecov, lint, testes e gates de CI protegem a entrega.'), icon: <IconGitBranch /> },
      ]} /><CodeShowcase samples={codeSamples.deploy.slice(2)} title={t(locale, 'Local quality gate', 'Gate local de qualidade')} /></div></Band>
      <FinalCta locale={locale} />
    </>
  );
}

function Engagement({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <PageHero locale={locale} eyebrow={t(locale, 'Adoption', 'Adoção')} title={t(locale, 'Open source foundation. Enterprise operating model.', 'Fundação open source. Modelo operacional enterprise.')} description={t(locale, 'Adopt the repository directly, run a focused pilot, or standardize Jumentix as an internal platform across teams.', 'Adote o repositório diretamente, execute um piloto focado ou padronize o Jumentix como plataforma interna entre equipes.')} />
      <Band><div className={classes.journeyGrid}>
        <article className={classes.journey}><IconBrandGithub size={26} /><h3>{t(locale, 'Community adoption', 'Adoção pela comunidade')}</h3><p>{t(locale, 'Clone, inspect, contribute, and evolve the open-source platform.', 'Clone, inspecione, contribua e evolua a plataforma open source.')}</p></article>
        <article className={classes.journey}><IconRocket size={26} /><h3>{t(locale, 'Product pilot', 'Piloto de produto')}</h3><p>{t(locale, 'Prove one API or SaaS journey with measurable delivery outcomes.', 'Valide uma API ou jornada SaaS com resultados mensuráveis.')}</p></article>
        <article className={classes.journey}><IconBuildingFactory2 size={26} /><h3>{t(locale, 'Platform rollout', 'Expansão como plataforma')}</h3><p>{t(locale, 'Create reusable golden paths, packages, and governance across squads.', 'Crie golden paths, pacotes e governança reutilizáveis entre squads.')}</p></article>
      </div></Band>
      <FinalCta locale={locale} />
    </>
  );
}

function Contact({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <PageHero locale={locale} eyebrow={t(locale, 'Contact', 'Contato')} title={t(locale, 'Bring your architecture challenge', 'Traga seu desafio de arquitetura')} description={t(locale, 'Start in the open with a GitHub discussion or contact the maintainers for an adoption conversation.', 'Comece em público com uma discussão no GitHub ou converse com os mantenedores sobre adoção.')} />
      <Band><div className={classes.linkGrid}>
        <a className={classes.linkCard} href={`${repositoryUrl}/discussions`}><IconMessages size={26} /><h3>GitHub Discussions</h3><p>{t(locale, 'Ask architecture and adoption questions in public.', 'Faça perguntas públicas sobre arquitetura e adoção.')}</p><span>{t(locale, 'Start a discussion', 'Inicie uma discussão')} <IconArrowRight size={16} /></span></a>
        <a className={classes.linkCard} href={`${repositoryUrl}/issues`}><IconGitBranch size={26} /><h3>GitHub Issues</h3><p>{t(locale, 'Report bugs and propose traceable features.', 'Reporte bugs e proponha features rastreáveis.')}</p><span>{t(locale, 'Open an issue', 'Abra uma issue')} <IconArrowRight size={16} /></span></a>
        <a className={classes.linkCard} href="mailto:web2solucoes@gmail.com"><IconUsers size={26} /><h3>{t(locale, 'Enterprise conversation', 'Conversa enterprise')}</h3><p>{t(locale, 'Discuss pilots, governance, and platform adoption.', 'Converse sobre pilotos, governança e adoção da plataforma.')}</p><span>{t(locale, 'Send an email', 'Envie um email')} <IconArrowRight size={16} /></span></a>
      </div></Band>
    </>
  );
}

function Community({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <PageHero locale={locale} eyebrow={t(locale, 'Community', 'Comunidade')} title={t(locale, 'Build the factory with us', 'Construa a fábrica conosco')} description={t(locale, 'Jumentix grows through documented proposals, focused epics, tested changes, and reusable packages.', 'O Jumentix cresce por meio de propostas documentadas, épicos focados, mudanças testadas e pacotes reutilizáveis.')} />
      <Band><div className={classes.twoColumn}><div className={classes.prose}><h2>{t(locale, 'Every contribution has a path', 'Toda contribuição tem um caminho')}</h2><ul><li>{t(locale, 'Discuss the problem before implementation.', 'Discuta o problema antes da implementação.')}</li><li>{t(locale, 'Connect work to an issue, epic, milestone, estimate, and evidence.', 'Conecte o trabalho a issue, épico, milestone, estimativa e evidência.')}</li><li>{t(locale, 'Keep specs, documentation, and behavior synchronized.', 'Mantenha specs, documentação e comportamento sincronizados.')}</li><li>{t(locale, 'Prove quality locally before CI.', 'Comprove a qualidade localmente antes do CI.')}</li></ul><div className={classes.sectionActions}><ActionLink href={`${repositoryUrl}/blob/dev/CONTRIBUTING.md`} external>{t(locale, 'Contribution guide', 'Guia de contribuição')}</ActionLink><ActionLink href={`${repositoryUrl}/issues`} variant="secondary" external>{t(locale, 'Find an issue', 'Encontre uma issue')}</ActionLink></div></div><CodeShowcase samples={codeSamples.deploy.slice(2)} title={t(locale, 'Contribution gate', 'Gate de contribuição')} /></div></Band>
      <FinalCta locale={locale} />
    </>
  );
}

function Roadmap({ locale }: { locale: CommercialLocale }) {
  const phases = [
    ['Now', t(locale, 'Monorepo consolidation', 'Consolidação do monorepo'), t(locale, 'Package boundaries, commercial website, documentation UX, and governance automation.', 'Limites de pacotes, site comercial, UX da documentação e automação de governança.')],
    ['Next', t(locale, 'Service factory workflows', 'Fluxos da fábrica de serviços'), t(locale, 'Complete visual configuration, scaffolding journeys, and deployment management.', 'Completar configuração visual, jornadas de scaffolding e gerenciamento de deploy.')],
    ['Later', t(locale, 'Ecosystem distribution', 'Distribuição do ecossistema'), t(locale, 'Publish reusable packages, templates, SDK generators, and provider integrations.', 'Publicar pacotes reutilizáveis, templates, geradores de SDK e integrações com provedores.')],
  ];
  return (
    <>
      <PageHero locale={locale} eyebrow="Roadmap" title={t(locale, 'A public path from boilerplate to software factory', 'Um caminho público de boilerplate a fábrica de software')} description={t(locale, 'The GitHub project remains the source of truth. This view explains the product direction without hiding the implementation backlog.', 'O projeto no GitHub permanece como fonte da verdade. Esta visão explica a direção do produto sem ocultar o backlog de implementação.')} />
      <Band><ol className={classes.timeline}>{phases.map(([phase, title, description]) => <li key={phase}><strong>{phase}</strong><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol><div className={classes.sectionActions}><ActionLink href="https://github.com/users/web2solutions/projects/1" external>{t(locale, 'Open live roadmap', 'Abra o roadmap ao vivo')}</ActionLink></div></Band>
      <FinalCta locale={locale} />
    </>
  );
}

export function CommercialPage({ locale = 'en', page }: { locale?: CommercialLocale; page: CommercialPageName }) {
  const content = {
    home: <Home locale={locale} />,
    product: <Product locale={locale} />,
    'use-cases': <UseCases locale={locale} />,
    integrations: <Integrations locale={locale} />,
    architecture: <Architecture locale={locale} />,
    security: <Security locale={locale} />,
    engagement: <Engagement locale={locale} />,
    contact: <Contact locale={locale} />,
    community: <Community locale={locale} />,
    roadmap: <Roadmap locale={locale} />,
  }[page];

  return <main className={classes.page}>{content}</main>;
}
