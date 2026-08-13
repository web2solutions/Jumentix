import type { ReactNode } from 'react';
import {
  IconApi,
  IconArrowRight,
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
import { DocsPlayground } from '../docs-playground/DocsPlayground';
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
      code: `bun install
bun run cli
bun run dev:express`,
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
      code: `bun run docker:up:postgresql
JUMENTIX_DATABASE_DRIVER=PostgreSQL bun run test:smoke:db:postgresql
bun run docker:down:postgresql`,
    },
  ],
  deploy: [
    {
      label: 'PM2',
      language: 'shell',
      code: `bun run pm2:start:dev:restapi
bun run pm2:start:staging:restapi
bun run pm2:start:prod:restapi`,
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
      code: `bun run lint
bun run test:unit
bun run test:integration
bun run ci:gate`,
    },
  ],
  tooling: [
    {
      label: 'Fast local loop',
      language: 'shell',
      code: `bun install
bun run website:dev
bun run ci:affected`,
    },
    {
      label: 'Workspace gates',
      language: 'shell',
      code: `bun run check-bun-version
bun run requirements:check
bun run test-map:check
bun run ci:gate:branch`,
    },
    {
      label: 'Package workflow',
      language: 'shell',
      code: `bun run packages:check-suites
bun run npm:publish:dry-run:packages
bun run release:governance:check`,
    },
  ],
  quality: [
    {
      label: 'Requirements',
      language: 'shell',
      code: `bun run requirements:check
bun run docs:consumers:package-scripts
bun run website:test:prepublish`,
    },
    {
      label: 'Tests',
      language: 'shell',
      code: `bun run test:unit
bun run test:integration
bun run website:test:routes
bun run website:test:cypress`,
    },
    {
      label: 'Architecture',
      language: 'shell',
      code: `bun run deps:check-cycles
bun run arch:check-boundaries
bun run arch:check-workspace-boundaries
bun run oas:check-routes`,
    },
  ],
  pm2: [
    {
      label: 'Profiles',
      language: 'shell',
      code: `bun run pm2:start:dev:restapi
bun run pm2:start:staging:websocket-rest
bun run pm2:start:prod:grpc-rest`,
    },
    {
      label: 'Ecosystem',
      language: 'javascript',
      code: `module.exports = {
  apps: [
    {
      name: 'jumentix-prod-restapi',
      script: '.build/apps/backend-template/src/main.js',
      interpreter: 'bun',
      args: '--env-file=apps/backend-template/.env.production'
    },
    {
      name: 'jumentix-prod-service-management',
      script: '.build/apps/service-management-ui/server.js',
      interpreter: 'bun'
    }
  ]
};`,
    },
    {
      label: 'Operate',
      language: 'shell',
      code: `bun run pm2:list
bun run pm2:logs
pm2 reload jumentix-prod-restapi
pm2 save`,
    },
  ],
  ai: [
    {
      label: 'UI blueprint',
      language: 'json',
      code: `{
  "boundedContext": "Tasks",
  "entities": [
    { "name": "Category", "fields": ["id", "name", "color"] },
    { "name": "Task", "fields": ["id", "title", "categoryId", "completed"] }
  ],
  "interfaces": ["REST", "WebSocket"],
  "deploymentProfiles": ["dev", "staging", "production"],
  "requirements": ["REQ-TASK-CATEGORY", "REQ-TASK-LIVE-UPDATES"],
  "governanceChecks": [
    "requirements:check",
    "test-map:check",
    "arch:check-workspace-boundaries"
  ]
}`,
    },
    {
      label: 'Agent brief',
      language: 'markdown',
      code: `# Agent task: Tasks service

Use the Service Management UI blueprint as source of truth.

- Preserve the Category and Task bounded context.
- Generate REST and WebSocket contracts from the same model.
- Keep domain code behind use-cases and repository ports.
- Add tests mapped to REQ-TASK-CATEGORY and REQ-TASK-LIVE-UPDATES.
- Run governance checks before publishing the PR.`,
    },
    {
      label: 'Agent context',
      language: 'typescript',
      code: `export async function loadAgentContext() {
  const [llms, docsIndex] = await Promise.all([
    fetch('/llms-full.txt').then((response) => response.text()),
    fetch('/docs-index.json').then((response) => response.json())
  ]);

  const canaDocs = docsIndex.filter((entry) => entry.href.includes('/cana'));
  return {
    contextBytes: llms.length,
    canaDocPages: canaDocs.length,
    firstPage: canaDocs[0]?.href
  };
}`,
    },
    {
      label: 'Governance',
      language: 'shell',
      code: `bun run requirements:check
bun run test-map:check
bun run arch:check-workspace-boundaries
bun run website:test:prepublish`,
    },
    {
      label: 'UI model',
      language: 'typescript',
      code: `const serviceModel = {
  boundedContext: 'Tasks',
  entities: [
    { name: 'Category', fields: ['id', 'name', 'color'] },
    { name: 'Task', fields: ['id', 'title', 'categoryId', 'completed'] }
  ],
  interfaces: ['REST', 'WebSocket'],
  deploymentProfiles: ['dev', 'staging', 'production']
};

export async function generateGovernedService(generator, governance) {
  await governance.assertRequirements(serviceModel);
  await generator.emitOpenApi(serviceModel);
  await generator.emitSdkClients(serviceModel);
  return serviceModel;
}`,
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

function BunToolingBand({
  locale,
  alternate = false,
}: {
  locale: CommercialLocale;
  alternate?: boolean;
}) {
  const packageScriptsHref = locale === 'pt-BR'
    ? '/docs/pt-BR/jumentix/reference/package-scripts'
    : '/docs/jumentix/reference/package-scripts';

  return (
    <Band alternate={alternate}>
      <div className={classes.sectionStack}>
        <SectionHeading
          eyebrow={t(locale, 'Bun-powered tooling', 'Tooling movido a Bun')}
          title={t(locale, 'The fast path is the default path', 'O caminho rápido é o caminho padrão')}
          description={t(
            locale,
            'Jumentix standardizes on Bun as the pinned monorepo runtime, package manager, script runner, test runner and browser-spec bundler. That keeps local work, CI gates, package checks and website publishing on one toolchain.',
            'O Jumentix padroniza Bun como runtime, gerenciador de pacotes, executor de scripts, test runner e bundler das specs de browser do monorepo. Isso mantém trabalho local, gates de CI, checagens de pacote e publicação do site em uma ferramenta só.',
          )}
        />
        <div className={classes.twoColumn}>
          <div className={classes.prose}>
            <h2>{t(locale, 'Why Bun matters here', 'Por que Bun importa aqui')}</h2>
            <p>
              {t(
                locale,
                'The repository uses Bun where it actually reduces friction: fast installs with workspaces, direct TypeScript execution, repeatable package scripts, focused branch gates, and browser-test bundling before Cypress runs against real IndexedDB and DOM APIs.',
                'O repositório usa Bun onde ele realmente reduz atrito: installs rápidos com workspaces, execução direta de TypeScript, scripts repetíveis, gates focados por branch e bundling das specs de browser antes de o Cypress rodar contra IndexedDB e DOM reais.',
              )}
            </p>
            <ProofList items={[
              t(locale, 'One pinned version, `bun@1.3.14`, protects every workspace from “works on my machine” drift.', 'Uma versão pinada, `bun@1.3.14`, protege todos os workspaces contra drift de ambiente.'),
              t(locale, '`bun run --filter` lets package checks stay scoped while full gates remain available for release work.', '`bun run --filter` mantém checagens de pacote focadas enquanto gates completos seguem disponíveis para release.'),
              t(locale, 'Bun bundles Cana browser specs before Cypress, avoiding Cypress webpack fragility while preserving real-browser evidence.', 'Bun empacota specs browser do Cana antes do Cypress, evitando fragilidade do webpack do Cypress sem perder evidência em browser real.'),
              t(locale, 'The same CLI drives local dev, docs sync, package dry-runs, security checks and production website publishing.', 'A mesma CLI move dev local, sync de docs, dry-runs de pacote, checagens de segurança e publicação do site em produção.'),
            ]} />
            <div className={classes.sectionActions}>
              <ActionLink href={packageScriptsHref} variant="secondary">
                {t(locale, 'See Jumentix scripts', 'Ver scripts Jumentix')}
              </ActionLink>
              <ActionLink href="https://bun.sh/docs" variant="quiet" external>
                Bun docs
              </ActionLink>
            </div>
          </div>
          <CodeShowcase samples={codeSamples.tooling} title={t(locale, 'Bun tooling commands', 'Comandos Bun do tooling')} />
        </div>
        <MetricStrip metrics={[
          { value: '1', label: t(locale, 'runtime/package/test/bundle tool', 'ferramenta de runtime/pacote/teste/bundle') },
          { value: '1.3.14+', label: t(locale, 'pinned Bun version', 'versão Bun pinada') },
          { value: '3', label: t(locale, 'workspace roots: apps, packages, tooling', 'raízes: apps, packages, tooling') },
          { value: '30x', label: t(locale, 'official Bun install-speed ceiling vs npm', 'teto oficial de velocidade de install vs npm') },
        ]} />
      </div>
    </Band>
  );
}

function QualityEvidenceBand({
  locale,
  alternate = false,
}: {
  locale: CommercialLocale;
  alternate?: boolean;
}) {
  return (
    <Band alternate={alternate}>
      <div className={classes.sectionStack}>
        <SectionHeading
          eyebrow={t(locale, 'Quality as product surface', 'Qualidade como superfície do produto')}
          title={t(locale, 'Requirements, tests and evidence are not hidden plumbing', 'Requisitos, testes e evidências não ficam escondidos')}
          description={t(
            locale,
            'Jumentix treats quality as part of the user-facing promise. Requirements are checked, tests are mapped, architecture rules are executable, and publish paths carry evidence instead of relying on ceremony.',
            'O Jumentix trata qualidade como parte da promessa visível do produto. Requisitos são checados, testes são mapeados, regras de arquitetura são executáveis e caminhos de publicação carregam evidências em vez de depender de cerimônia.',
          )}
        />
        <MetricStrip metrics={[
          { value: '99/90', label: t(locale, 'statement/branch quality standard', 'padrão de statements/branches') },
          { value: 'reqs', label: t(locale, 'requirements tied to executable checks', 'requisitos ligados a checagens executáveis') },
          { value: '0', label: t(locale, 'tolerance for hidden docs drift', 'tolerância a drift oculto de docs') },
          { value: 'real', label: t(locale, 'browser tests for browser APIs', 'testes browser para APIs browser') },
        ]} />
        <DetailGrid items={[
          { title: t(locale, 'Requirement registry', 'Registro de requisitos'), description: t(locale, 'Delivery work is expected to connect behavior, docs, tests and release evidence so “done” is auditable.', 'O trabalho de entrega conecta comportamento, docs, testes e evidência de release para que “pronto” seja auditável.'), meta: 'requirements:check', icon: <IconShieldCheck /> },
          { title: t(locale, 'Reliable tests', 'Testes confiáveis'), description: t(locale, 'Unit, integration, Cypress route sweeps, browser specs and Storybook smoke checks cover the surface each layer actually owns.', 'Unit, integração, route sweep Cypress, specs de browser e smoke de Storybook cobrem a superfície real de cada camada.'), meta: 'test-map:check', icon: <IconGitBranch /> },
          { title: t(locale, 'Executable architecture', 'Arquitetura executável'), description: t(locale, 'Boundary scripts reject imports and shortcuts that would leak frameworks, databases or infrastructure into domain code.', 'Scripts de limite rejeitam imports e atalhos que vazariam frameworks, bancos ou infraestrutura para o domínio.'), meta: 'arch:check-*', icon: <IconHierarchy3 /> },
          { title: t(locale, 'Publish discipline', 'Disciplina de publicação'), description: t(locale, 'Content sync, route checks, package dry-runs and release governance run before public artifacts move.', 'Sync de conteúdo, checagens de rota, dry-runs de pacote e governança de release rodam antes de artefatos públicos avançarem.'), meta: 'website:test:prepublish', icon: <IconRocket /> },
        ]} />
        <CodeShowcase samples={codeSamples.quality} title={t(locale, 'Quality commands', 'Comandos de qualidade')} />
      </div>
    </Band>
  );
}

function BrowserInMemoryLabBand({
  locale,
  alternate = false,
}: {
  locale: CommercialLocale;
  alternate?: boolean;
}) {
  return (
    <Band alternate={alternate}>
      <div className={classes.sectionStack}>
        <SectionHeading
          eyebrow={t(locale, 'Browser in-memory playgrounds', 'Playgrounds in-memory no browser')}
          title={t(locale, 'The package contracts run without servers', 'Os contratos dos pacotes rodam sem servidores')}
          description={t(
            locale,
            'These runnable examples use Category and Task records across contract-compatible in-memory adapters and browser-native local storage. They execute entirely in the browser, so teams can inspect package behavior before adding Redis, RabbitMQ, databases, PM2 processes or a backend runtime.',
            'Estes exemplos executáveis usam registros Category e Task em adaptadores in-memory compatíveis com contrato e armazenamento local nativo do browser. Tudo roda no browser, para o time inspecionar o comportamento dos pacotes antes de adicionar Redis, RabbitMQ, bancos, processos PM2 ou runtime backend.',
          )}
        />
        <MetricStrip metrics={[
          { value: '100%', label: t(locale, 'browser execution', 'execução no browser') },
          { value: '0', label: t(locale, 'servers required for the lab', 'servidores exigidos no lab') },
          { value: '8', label: t(locale, 'package contracts showcased', 'contratos de pacote demonstrados') },
          { value: '2', label: t(locale, 'apps represented: Service Management and Backend Template', 'apps representados: Service Management e Backend Template') },
        ]} />
        <DetailGrid items={[
          { title: t(locale, 'Service Management UI', 'Service Management UI'), description: t(locale, 'The full lab starts from a visual service model, validates the domain shape, then feeds runtime contracts from the same Category and Task vocabulary.', 'O lab completo parte de um modelo visual de serviço, valida o formato do domínio e alimenta contratos de runtime com o mesmo vocabulário Category e Task.'), meta: t(locale, 'App surface', 'Superfície de app'), icon: <IconHierarchy3 /> },
          { title: t(locale, 'Backend Template', 'Backend Template'), description: t(locale, 'The request path mirrors controller, use-case, repository, mediator and client boundaries without exposing users to infrastructure setup.', 'O caminho de request espelha limites de controller, caso de uso, repository, mediator e client sem expor usuários a setup de infraestrutura.'), meta: t(locale, 'App runtime', 'Runtime de app'), icon: <IconBuildingFactory2 /> },
          { title: t(locale, 'Persistence and cache', 'Persistência e cache'), description: t(locale, 'In-memory stores and key/value state keep Category filters, Task records and UI preferences in the same service-result shape as external adapters.', 'Stores in-memory e estado chave/valor mantêm filtros de Category, registros Task e preferências de UI no mesmo formato de resposta dos adaptadores externos.'), meta: '@jumentix/key-value-storage', icon: <IconDatabase /> },
          { title: t(locale, 'Messaging and locks', 'Mensageria e locks'), description: t(locale, 'Message Mediator, Mutex Service and Dead Letter Queue show request/response, events, write protection and recoverable rejection before durable infrastructure is introduced.', 'Message Mediator, Mutex Service e Dead Letter Queue mostram request/response, eventos, proteção de escrita e rejeição recuperável antes de infraestrutura durável entrar.'), meta: '@jumentix/message-mediator', icon: <IconMessages /> },
          { title: t(locale, 'Bulk write recovery', 'Recuperação de escrita em massa'), description: t(locale, 'The DLQ playground sends rejected bulk Task requests back through the controller workflow, so replay still reacquires the Category mutex before writing.', 'O playground de DLQ envia requests Task rejeitados em massa de volta pelo fluxo do controller, então o replay ainda readquire o mutex da Category antes de escrever.'), meta: '@jumentix/dead-letter-queue', icon: <IconShieldCheck /> },
        ]} />
        <div className={classes.playgroundGrid}>
          <div className={classes.playgroundWide}>
            <DocsPlayground runtime="jumentix-browser-lab" id="getting-started" />
          </div>
          <div className={classes.playgroundWide}>
            <DocsPlayground runtime="jumentix-browser-lab" id="bulk-mutex-dead-letter" />
          </div>
          <DocsPlayground runtime="key-value-storage" id="getting-started" />
          <DocsPlayground runtime="message-mediator" id="getting-started" />
          <DocsPlayground runtime="mutex-service" id="getting-started" />
          <DocsPlayground runtime="sdk-rest-client" id="getting-started" />
          <DocsPlayground runtime="sdk-websocket-client" id="getting-started" />
          <DocsPlayground runtime="cana" id="getting-started" />
          <DocsPlayground runtime="designer-core" id="getting-started" />
        </div>
      </div>
    </Band>
  );
}

function PM2OperationsBand({
  locale,
  alternate = false,
}: {
  locale: CommercialLocale;
  alternate?: boolean;
}) {
  return (
    <Band alternate={alternate}>
      <div className={classes.sectionStack}>
        <SectionHeading
          eyebrow={t(locale, 'PM2 operations', 'Operação com PM2')}
          title={t(locale, 'Bun-built services get supervised runtime profiles', 'Serviços Bun ganham perfis supervisionados')}
          description={t(
            locale,
            'Jumentix uses PM2 where a long-running VM or container needs process supervision: environment-specific profiles, logs, status, metrics, reloads and startup recovery. The ecosystem files keep REST, WebSocket, gRPC and Service Management processes explicit.',
            'O Jumentix usa PM2 quando uma VM ou container precisa de supervisão de processo: perfis por ambiente, logs, status, métricas, reloads e recuperação no startup. Os arquivos ecosystem deixam explícitos os processos REST, WebSocket, gRPC e Service Management.',
          )}
        />
        <MetricStrip metrics={[
          { value: '4', label: t(locale, 'named process families', 'famílias de processo nomeadas') },
          { value: '3', label: t(locale, 'dev/staging/production profiles', 'perfis dev/staging/production') },
          { value: 'bun', label: t(locale, 'PM2 interpreter in ecosystem files', 'interpreter PM2 nos ecosystem files') },
          { value: 'reload', label: t(locale, 'zero-downtime path for compatible services', 'caminho zero-downtime para serviços compatíveis') },
        ]} />
        <div className={classes.twoColumn}>
          <div className={classes.prose}>
            <h2>{t(locale, 'Why PM2 belongs in the Jumentix story', 'Por que PM2 pertence à história do Jumentix')}</h2>
            <p>
              {t(
                locale,
                'PM2 is not the only deployment option, but it is a strong operational bridge for teams that run Node/Bun services on persistent machines. It daemonizes apps, restarts failed processes, exposes logs and metrics, supports cluster mode and preserves process lists across restarts.',
                'PM2 não é a única opção de deploy, mas é uma ponte operacional forte para times que rodam serviços Node/Bun em máquinas persistentes. Ele daemoniza apps, reinicia processos com falha, expõe logs e métricas, suporta cluster mode e preserva a lista de processos após restarts.',
              )}
            </p>
            <ProofList items={[
              t(locale, 'Profiles are environment-specific instead of hidden in ad hoc shell history.', 'Perfis são específicos por ambiente em vez de ficarem escondidos no histórico do shell.'),
              t(locale, 'REST fallback, realtime and gRPC can be started, inspected and restarted independently.', 'Fallback REST, realtime e gRPC podem iniciar, ser inspecionados e reiniciados de forma independente.'),
              t(locale, 'Bun remains the interpreter, so the same runtime choice powers dev scripts and supervised services.', 'Bun permanece como interpreter, então a mesma escolha de runtime move scripts de dev e serviços supervisionados.'),
              t(locale, 'The PM2 model complements Docker, serverless and cloud functions without changing domain code.', 'O modelo PM2 complementa Docker, serverless e cloud functions sem mudar código de domínio.'),
            ]} />
            <div className={classes.sectionActions}>
              <ActionLink href="https://pm2.keymetrics.io/docs/usage/quick-start/" variant="quiet" external>
                PM2 docs
              </ActionLink>
            </div>
          </div>
          <CodeShowcase samples={codeSamples.pm2} title={t(locale, 'PM2 runtime profiles', 'Perfis runtime PM2')} />
        </div>
      </div>
    </Band>
  );
}

function AIReadyBand({
  locale,
  alternate = false,
}: {
  locale: CommercialLocale;
  alternate?: boolean;
}) {
  return (
    <Band alternate={alternate}>
      <div className={classes.sectionStack}>
        <SectionHeading
          eyebrow={t(locale, 'AI-ready platform', 'Plataforma pronta para AI')}
          title={t(locale, 'The UI gives agents architecture with governance attached', 'A UI entrega arquitetura com governança acoplada')}
          description={t(
            locale,
            'Jumentix is prepared for AI because the product does not ask agents to infer architecture from scattered code. The UI captures bounded contexts, entities, interfaces, deployment profiles and requirements; the repository exposes agent-readable docs and executable checks that keep generated work accountable.',
            'O Jumentix é preparado para AI porque o produto não obriga agentes a inferir arquitetura a partir de código espalhado. A UI captura contextos delimitados, entidades, interfaces, perfis de deploy e requisitos; o repositório expõe docs legíveis por agentes e checagens executáveis que tornam trabalho gerado auditável.',
          )}
        />
        <MetricStrip metrics={[
          { value: 'UI', label: t(locale, 'domain model as first-class input', 'modelo de domínio como input de primeira classe') },
          { value: 'llms', label: t(locale, 'agent-readable website context', 'contexto do site legível por agentes') },
          { value: 'reqs', label: t(locale, 'requirements tied to checks', 'requisitos ligados a checks') },
          { value: 'gates', label: t(locale, 'architecture and publish evidence', 'evidência de arquitetura e publish') },
        ]} />
        <AIGovernanceFlow locale={locale} />
        <DetailGrid items={[
          { title: t(locale, 'Low-context instructions', 'Instruções de baixo contexto'), description: t(locale, 'Agents can start from docs index, package pages, route metadata and code snippets instead of guessing which file owns a behavior.', 'Agentes podem partir do índice de docs, páginas de pacote, metadados de rotas e snippets de código em vez de adivinhar qual arquivo possui um comportamento.'), meta: '/llms-full.txt', icon: <IconCode /> },
          { title: t(locale, 'UI as architecture input', 'UI como input de arquitetura'), description: t(locale, 'The Service Management UI turns product concepts into bounded contexts, interfaces and deployment choices that generators and reviewers can inspect.', 'A UI de Service Management transforma conceitos de produto em contextos, interfaces e escolhas de deploy que geradores e revisores conseguem inspecionar.'), meta: 'service-management-ui', icon: <IconDeviceDesktop /> },
          { title: t(locale, 'Governed generation', 'Geração governada'), description: t(locale, 'Generated or agent-authored changes still pass requirements, test maps, route checks, package boundaries and release governance before publication.', 'Mudanças geradas ou escritas por agentes ainda passam por requisitos, test maps, rotas, limites de pacote e governança de release antes de publicar.'), meta: 'requirements:check', icon: <IconShieldCheck /> },
          { title: t(locale, 'Grounded package graph', 'Grafo de pacotes fundamentado'), description: t(locale, 'Reusable packages give AI work stable names for persistence, mediation, clients, Cana, runtime bootstrap and architecture boundaries.', 'Pacotes reutilizáveis dão ao trabalho de AI nomes estáveis para persistência, mediação, clientes, Cana, bootstrap de runtime e limites arquiteturais.'), meta: 'packages/*', icon: <IconPackage /> },
        ]} />
        <div className={classes.twoColumn}>
          <div className={classes.prose}>
            <h2>{t(locale, 'AI work becomes governed delivery', 'Trabalho de AI vira entrega governada')}</h2>
            <p>
              {t(
                locale,
                'The UI gives AI a constrained starting point: the service vocabulary, boundaries, interfaces, runtime profile and quality obligations are explicit before a prompt is written. That turns the agent from a code guesser into a contributor working inside the platform rules.',
                'A UI entrega para a AI um ponto de partida restrito: vocabulário do serviço, limites, interfaces, perfil de runtime e obrigações de qualidade são explícitos antes de qualquer prompt. Isso transforma o agente de um gerador por chute em um contribuidor dentro das regras da plataforma.',
              )}
            </p>
            <ProofList items={[
              t(locale, 'Prompts reference named bounded contexts, entities, requirements and packages instead of broad implementation wishes.', 'Prompts referenciam contextos delimitados, entidades, requisitos e pacotes nomeados em vez de desejos amplos de implementação.'),
              t(locale, 'Generated code has a known landing zone: UI model, contracts, SDKs, use-cases, adapters, tests and docs.', 'Código gerado tem destino conhecido: modelo da UI, contratos, SDKs, casos de uso, adaptadores, testes e docs.'),
              t(locale, 'Reviewers can reject drift with executable checks instead of relying only on manual architecture review.', 'Revisores podem rejeitar drift com checagens executáveis em vez de depender apenas de review arquitetural manual.'),
            ]} />
          </div>
          <CommercialMatrix
            headers={t(locale, ['AI action', 'UI source', 'Governance guardrail', 'Useful output'], ['Ação de AI', 'Fonte da UI', 'Guarda-corpo de governança', 'Saída útil'])}
            rows={[
              { focus: t(locale, 'Design safely', 'Desenhar com segurança'), when: t(locale, 'Bounded context, entities, relationships and requirements.', 'Contexto delimitado, entidades, relacionamentos e requisitos.'), implementation: t(locale, 'Service model validation and requirement registry.', 'Validação do modelo de serviço e registro de requisitos.'), outcome: t(locale, 'A service spec that product, architecture and engineering can review together.', 'Uma spec de serviço que produto, arquitetura e engenharia revisam juntas.') },
              { focus: t(locale, 'Generate safely', 'Gerar com segurança'), when: t(locale, 'Interfaces, events, deployment profile and package choices.', 'Interfaces, eventos, perfil de deploy e escolhas de pacote.'), implementation: t(locale, 'OpenAPI, AsyncAPI, route checks and workspace boundaries.', 'OpenAPI, AsyncAPI, checagens de rota e limites de workspace.'), outcome: t(locale, 'Contracts, SDKs, handlers and examples aligned to the same model.', 'Contratos, SDKs, handlers e exemplos alinhados ao mesmo modelo.') },
              { focus: t(locale, 'Ship with evidence', 'Publicar com evidência'), when: t(locale, 'Quality expectations, release path and docs index.', 'Expectativas de qualidade, caminho de release e índice de docs.'), implementation: t(locale, 'Test map, architecture checks, docs sync and prepublish gates.', 'Test map, checagens de arquitetura, sync de docs e gates prepublish.'), outcome: t(locale, 'A PR reviewers can audit with concrete proof instead of narrative confidence.', 'Uma PR que revisores auditam com prova concreta em vez de confiança narrativa.') },
            ]}
          />
        </div>
        <CodeShowcase samples={codeSamples.ai} title={t(locale, 'AI governance examples', 'Exemplos de governança AI')} />
      </div>
    </Band>
  );
}

function AIGovernanceFlow({ locale }: { locale: CommercialLocale }) {
  const steps = [
    {
      label: t(locale, '1. Model service', '1. Modele o serviço'),
      title: t(locale, 'UI captures the domain', 'A UI captura o domínio'),
      description: t(locale, 'Category, Task, relationships, validations and API surfaces become explicit platform data.', 'Category, Task, relacionamentos, validações e superfícies de API viram dados explícitos da plataforma.'),
      icon: <IconDeviceDesktop />,
    },
    {
      label: t(locale, '2. Ground the agent', '2. Fundamente o agente'),
      title: t(locale, 'Docs and packages name the path', 'Docs e pacotes nomeiam o caminho'),
      description: t(locale, 'The agent reads the docs index, package contracts and UI blueprint before choosing files to change.', 'O agente lê índice de docs, contratos de pacote e blueprint da UI antes de escolher arquivos para alterar.'),
      icon: <IconCode />,
    },
    {
      label: t(locale, '3. Generate inside boundaries', '3. Gere dentro dos limites'),
      title: t(locale, 'Ports and adapters shape the code', 'Ports e adapters moldam o código'),
      description: t(locale, 'Use-cases, controllers, SDK clients, Cana examples and runtime profiles keep their ownership boundaries.', 'Casos de uso, controllers, SDKs, exemplos Cana e perfis de runtime preservam seus limites de ownership.'),
      icon: <IconHierarchy3 />,
    },
    {
      label: t(locale, '4. Verify evidence', '4. Verifique evidências'),
      title: t(locale, 'Governance checks catch drift', 'Checks de governança capturam drift'),
      description: t(locale, 'Requirements, test maps, architecture scripts, route checks and prepublish gates validate the change.', 'Requisitos, test maps, scripts de arquitetura, checagens de rota e gates prepublish validam a mudança.'),
      icon: <IconShieldCheck />,
    },
    {
      label: t(locale, '5. Publish with confidence', '5. Publique com confiança'),
      title: t(locale, 'PR carries proof', 'A PR carrega prova'),
      description: t(locale, 'Reviewers see what changed, why it fits the architecture and which checks prove it is ready.', 'Revisores veem o que mudou, por que cabe na arquitetura e quais checks provam que está pronto.'),
      icon: <IconRocket />,
    },
  ];

  return (
    <div className={classes.aiFlow} aria-label={t(locale, 'UI to governed PR', 'UI até PR governada')}>
      {steps.map((step) => (
        <article className={classes.aiStep} key={step.label}>
          <span className={classes.aiStepIcon} aria-hidden="true">{step.icon}</span>
          <strong>{step.label}</strong>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </article>
      ))}
    </div>
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

type DetailCard = {
  title: string;
  description: string;
  eyebrow?: string;
  meta?: string;
  icon?: ReactNode;
};

function DetailGrid({ items }: { items: DetailCard[] }) {
  return (
    <div className={classes.detailGrid}>
      {items.map((item) => (
        <article className={classes.detailCard} key={`${item.eyebrow ?? 'detail'}-${item.title}`}>
          {item.icon ? <span className={classes.detailIcon} aria-hidden="true">{item.icon}</span> : null}
          {item.eyebrow ? <p className={classes.cardEyebrow}>{item.eyebrow}</p> : null}
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          {item.meta ? <strong>{item.meta}</strong> : null}
        </article>
      ))}
    </div>
  );
}

type CommercialMatrixRow = {
  focus: string;
  when: string;
  implementation: string;
  outcome: string;
};

function CommercialMatrix({
  headers,
  rows,
}: {
  headers: string[];
  rows: CommercialMatrixRow[];
}) {
  return (
    <div className={classes.matrixWrap}>
      <table className={classes.matrix}>
        <thead>
          <tr>
            {headers.map((header) => <th scope="col" key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.focus}>
              <th scope="row">{row.focus}</th>
              <td>{row.when}</td>
              <td>{row.implementation}</td>
              <td>{row.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProofList({ items }: { items: string[] }) {
  return (
    <ul className={classes.proofList}>
      {items.map((item) => <li key={item}><IconShieldCheck size={17} /> {item}</li>)}
    </ul>
  );
}

function MvpLaunchBand({
  locale,
  alternate = false,
}: {
  locale: CommercialLocale;
  alternate?: boolean;
}) {
  return (
    <Band alternate={alternate}>
      <div className={classes.sectionStack}>
        <SectionHeading
          eyebrow={t(locale, 'Zero to first MVP', 'Do zero ao primeiro MVP')}
          title={t(locale, 'Every use case is a launch path, not just an architecture label', 'Todo caso de uso é uma jornada de lançamento, não só um rótulo arquitetural')}
          description={t(
            locale,
            'The use cases now describe the smallest product slice a team can ship first: what to model, which interface to expose, which Jumentix packages to use, what to validate, and what evidence proves the MVP is ready.',
            'Os casos de uso agora descrevem a menor fatia de produto que um time pode publicar primeiro: o que modelar, qual interface expor, quais pacotes Jumentix usar, o que validar e qual evidência prova que o MVP está pronto.',
          )}
        />
        <MetricStrip metrics={[
          { value: '1', label: t(locale, 'bounded context to start', 'contexto delimitado inicial') },
          { value: '1', label: t(locale, 'primary interface for the first user flow', 'interface primária para o primeiro fluxo') },
          { value: '4', label: t(locale, 'MVP gates: model, contract, runtime, evidence', 'gates MVP: modelo, contrato, runtime, evidência') },
          { value: '5', label: t(locale, 'launch paths from the same architecture', 'jornadas de lançamento na mesma arquitetura') },
        ]} />
        <DetailGrid items={[
          { title: t(locale, 'Model one slice', 'Modele uma fatia'), description: t(locale, 'Start with one bounded context, two or three entities, the first command, and the user-visible outcome the MVP must prove.', 'Comece com um contexto delimitado, duas ou três entidades, o primeiro comando e o resultado visível que o MVP precisa provar.'), meta: t(locale, 'Day 0', 'Dia 0'), icon: <IconHierarchy3 /> },
          { title: t(locale, 'Expose one workflow', 'Exponha um fluxo'), description: t(locale, 'Choose REST, realtime, modular SaaS, microservice, or SPA/PWA based on the first interaction the product must make usable.', 'Escolha REST, realtime, SaaS modular, microsserviço ou SPA/PWA conforme a primeira interação que o produto precisa tornar utilizável.'), meta: t(locale, 'First usable path', 'Primeiro caminho usável'), icon: <IconRoute /> },
          { title: t(locale, 'Use replaceable adapters', 'Use adaptadores substituíveis'), description: t(locale, 'Run in-memory or local infrastructure first, then swap database, broker, function, PM2, or cloud adapters without rewriting use-cases.', 'Rode primeiro com infraestrutura in-memory ou local, depois troque banco, broker, function, PM2 ou cloud adapters sem reescrever casos de uso.'), meta: t(locale, 'No lock-in for the MVP', 'MVP sem lock-in'), icon: <IconDatabase /> },
          { title: t(locale, 'Ship with proof', 'Publique com prova'), description: t(locale, 'Treat route checks, docs sync, focused tests, architecture boundaries, and prepublish evidence as part of the MVP definition.', 'Trate checks de rota, sync de docs, testes focados, limites arquiteturais e evidência prepublish como parte da definição do MVP.'), meta: t(locale, 'Ready to demo', 'Pronto para demo'), icon: <IconShieldCheck /> },
        ]} />
        <CommercialMatrix
          headers={t(locale, ['MVP stage', 'Product question', 'Jumentix action', 'Ready evidence'], ['Etapa do MVP', 'Pergunta de produto', 'Ação no Jumentix', 'Evidência de pronto'])}
          rows={[
            { focus: t(locale, 'Frame', 'Enquadrar'), when: t(locale, 'What is the one behavior the first customer must complete?', 'Qual é o comportamento que o primeiro cliente precisa concluir?'), implementation: t(locale, 'Capture the bounded context, entities, command, query and owner in Service Management.', 'Capture contexto delimitado, entidades, comando, query e owner no Service Management.'), outcome: t(locale, 'A reviewable domain slice with acceptance criteria.', 'Uma fatia de domínio revisável com critérios de aceite.') },
            { focus: t(locale, 'Build', 'Construir'), when: t(locale, 'Which interface makes that behavior usable fastest?', 'Qual interface torna esse comportamento utilizável mais rápido?'), implementation: t(locale, 'Generate or compose the chosen contract, controller/use-case path, SDK/client, and in-memory adapter.', 'Gere ou componha o contrato escolhido, caminho controller/use-case, SDK/client e adaptador in-memory.'), outcome: t(locale, 'One complete happy path running locally.', 'Um happy path completo rodando localmente.') },
            { focus: t(locale, 'Prove', 'Provar'), when: t(locale, 'Can the team trust the MVP enough to demo or pilot it?', 'O time pode confiar no MVP para demo ou piloto?'), implementation: t(locale, 'Run focused tests, route checks, docs sync, architecture boundaries, and website/package gates.', 'Rode testes focados, checks de rota, sync de docs, limites arquiteturais e gates de website/pacote.'), outcome: t(locale, 'Evidence that behavior, docs and architecture agree.', 'Evidência de que comportamento, docs e arquitetura concordam.') },
            { focus: t(locale, 'Evolve', 'Evoluir'), when: t(locale, 'What changes after the first user feedback?', 'O que muda após o primeiro feedback de usuário?'), implementation: t(locale, 'Swap adapters, add events, introduce workers, or extract a service while preserving contracts.', 'Troque adaptadores, adicione eventos, introduza workers ou extraia um serviço preservando contratos.'), outcome: t(locale, 'A next increment that does not rewrite the MVP.', 'Um próximo incremento que não reescreve o MVP.') },
          ]}
        />
      </div>
    </Band>
  );
}

function Home({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <section className={classes.hero}>
        <div className={classes.heroMedia} />
        <img
          className={classes.heroMascot}
          src="/brand/jumentix-mascot.png"
          alt={t(locale, 'Jumentix mascot, inspired by the Brazilian jegue', 'Mascote Jumentix, inspirada no jegue brasileiro')}
          width="300"
          height="300"
        />
        <div className={`${classes.container} ${classes.heroContent}`}>
          <StatusBadge tone="success">{t(locale, 'Open-source software factory', 'Fábrica de software open source')}</StatusBadge>
          <h1>Jumentix</h1>
          <p>
            {t(
              locale,
              'The Jumentix mark comes from the Brazilian jegue: steady, practical, resilient. The platform carries enterprise Node.js architecture from the first modular monolith to an unlimited service landscape.',
              'A marca Jumentix vem do jegue brasileiro: firme, prático e resistente. A plataforma carrega a arquitetura Node.js enterprise do primeiro monólito modular a um ecossistema ilimitado de serviços.',
            )}
          </p>
          <p className={classes.heroBrandNote}>
            {t(
              locale,
              'The animal is the promise: less ceremony, more load-bearing software.',
              'O animal é a promessa: menos cerimônia, mais software que aguenta carga.',
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
            <li><IconPackage size={17} /> Bun monorepo</li>
            <li><IconBrandGithub size={17} /> Open source</li>
          </ul>
        </div>
      </section>
      <Band>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Jumentix carries the load', 'Jumentix carrega a carga')}
            title={t(locale, 'A practical mascot for practical architecture', 'Uma mascote prática para uma arquitetura prática')}
            description={t(
              locale,
              'The jegue is part of the product language: dependable movement, strong footing, and no drama when the terrain changes. Jumentix applies that to visual domain design, contract-first runtimes, reusable adapters, developer automation, and deployment governance.',
              'O jegue faz parte da linguagem do produto: avanço confiável, pé firme e pouca cerimônia quando o terreno muda. O Jumentix aplica isso a design visual de domínios, runtimes orientados a contratos, adaptadores reutilizáveis, automação de desenvolvimento e governança de deploy.',
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
      <BunToolingBand locale={locale} />
      <QualityEvidenceBand locale={locale} />
      <AIReadyBand locale={locale} alternate />
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
            { title: t(locale, 'Service Management', 'Gerenciamento de serviços'), description: t(locale, 'Model domains, entities, relationships, interfaces, environments, and deployment profiles before code generation starts.', 'Modele domínios, entidades, relacionamentos, interfaces, ambientes e perfis de deploy antes da geração de código.'), icon: <IconBuildingFactory2 /> },
            { title: t(locale, 'Contract-first runtimes', 'Runtimes orientados a contratos'), description: t(locale, 'OpenAPI 3.1 and AsyncAPI contracts align request validation, handlers, generated clients, docs, and route checks.', 'Contratos OpenAPI 3.1 e AsyncAPI alinham validação de requests, handlers, clientes gerados, docs e checagens de rota.'), icon: <IconRoute /> },
            { title: t(locale, 'Reusable package ecosystem', 'Ecossistema de pacotes reutilizáveis'), description: t(locale, 'SDK clients, persistence contracts, message mediation, runtime bootstrap, Cana, and adapters live as packages that services can share.', 'SDKs, contratos de persistência, mediação de mensagens, bootstrap de runtime, Cana e adaptadores vivem como pacotes compartilháveis entre serviços.'), icon: <IconPackage /> },
            { title: t(locale, 'Portable persistence', 'Persistência portável'), description: t(locale, 'Repository and store ports keep use-cases stable while PostgreSQL, MySQL, MongoDB, DynamoDB, SQLite, Firebase, or in-memory adapters change.', 'Ports de repository e store mantêm casos de uso estáveis enquanto adaptadores PostgreSQL, MySQL, MongoDB, DynamoDB, SQLite, Firebase ou in-memory mudam.'), icon: <IconDatabase /> },
            { title: t(locale, 'Service communication', 'Comunicação entre serviços'), description: t(locale, 'Message Mediator supports request/response and event flows so modules can stay in-process today and move to workers or brokers later.', 'O Message Mediator suporta fluxos request/response e eventos para módulos ficarem em processo hoje e migrarem para workers ou brokers depois.'), icon: <IconMessages /> },
            { title: t(locale, 'Governed delivery', 'Entrega governada'), description: t(locale, 'Branch-aware CI, security scanning, architectural boundary checks, documentation sync, route checks, and evidence files protect every release.', 'CI por branch, scan de segurança, checagens de limites arquiteturais, sincronização de docs, checagens de rotas e evidências protegem cada release.'), icon: <IconShieldCheck /> },
          ]} />
          <MetricStrip metrics={[
            { value: '12', label: t(locale, 'HTTP/function runtime adapters', 'adaptadores HTTP/functions') },
            { value: '12', label: t(locale, 'database adapter targets', 'alvos de banco de dados') },
            { value: '3', label: t(locale, 'contracted API styles', 'estilos de API contratados') },
            { value: '99/90', label: t(locale, 'statement/branch quality standard', 'padrão de statements/branches') },
          ]} />
        </div>
      </Band>
      <BunToolingBand locale={locale} alternate />
      <BrowserInMemoryLabBand locale={locale} />
      <Band alternate>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Product surfaces', 'Superfícies do produto')}
            title={t(locale, 'What Jumentix gives each team', 'O que o Jumentix entrega para cada equipe')}
            description={t(
              locale,
              'The site should not hide behind vague platform language: Jumentix is a connected set of tools, packages, templates, contracts, and release rules.',
              'O site não deve se esconder atrás de linguagem vaga de plataforma: o Jumentix é um conjunto conectado de ferramentas, pacotes, templates, contratos e regras de release.',
            )}
          />
          <DetailGrid items={[
            { eyebrow: t(locale, 'Model', 'Modelo'), title: t(locale, 'Domain Designer', 'Domain Designer'), description: t(locale, 'Design bounded contexts, entities, fields, relationships, validation rules, OpenAPI composition, AsyncAPI exports, and boilerplate bundles from one workspace.', 'Desenhe contextos delimitados, entidades, campos, relacionamentos, regras de validação, composição OpenAPI, exportações AsyncAPI e pacotes boilerplate em um workspace.'), icon: <IconHierarchy3 /> },
            { eyebrow: t(locale, 'Build', 'Construa'), title: t(locale, 'Backend Template', 'Backend Template'), description: t(locale, 'Start from Users, Auth, RBAC, tenancy, controllers, use-cases, ports, adapters, error contracts, and smokeable runtime profiles.', 'Comece com Users, Auth, RBAC, tenancy, controllers, casos de uso, ports, adaptadores, contratos de erro e perfis de runtime testáveis.'), icon: <IconCode /> },
            { eyebrow: t(locale, 'Consume', 'Consuma'), title: t(locale, 'Generated SDKs', 'SDKs gerados'), description: t(locale, 'REST, WebSocket, and gRPC clients read the canonical contracts so frontend and backend teams share one API vocabulary.', 'Clientes REST, WebSocket e gRPC leem os contratos canônicos para frontend e backend compartilharem o mesmo vocabulário de API.'), icon: <IconDeviceDesktop /> },
            { eyebrow: t(locale, 'Operate', 'Opere'), title: t(locale, 'Governance and deploy paths', 'Governança e caminhos de deploy'), description: t(locale, 'Quality gates, dependency policy, service profiles, Docker, PM2, serverless targets, and release evidence make adoption auditable.', 'Gates de qualidade, política de dependências, perfis de serviço, Docker, PM2, alvos serverless e evidências de release tornam a adoção auditável.'), icon: <IconRocket /> },
          ]} />
        </div>
      </Band>
      <QualityEvidenceBand locale={locale} />
      <AIReadyBand locale={locale} alternate />
      <Band>
        <div className={classes.twoColumn}>
          <div className={classes.prose}>
            <h2>{t(locale, 'Compose the runtime instead of marrying it', 'Componha o runtime em vez de ficar preso a ele')}</h2>
            <p>{t(locale, 'Choose the interface and infrastructure that fit each service. Domain and use-case code stay behind stable ports, so a team can test Express locally, deploy a serverless handler later, or move a bounded context into a worker without rewriting business behavior.', 'Escolha a interface e a infraestrutura adequadas a cada serviço. Domínio e casos de uso permanecem atrás de ports estáveis, então a equipe pode testar Express localmente, publicar um handler serverless depois ou mover um contexto delimitado para um worker sem reescrever comportamento de negócio.')}</p>
            <ProofList items={[
              t(locale, 'Environment variables select adapters; use-cases do not import framework types.', 'Variáveis de ambiente selecionam adaptadores; casos de uso não importam tipos de framework.'),
              t(locale, 'The same contracts feed documentation, validation, SDKs, and route governance.', 'Os mesmos contratos alimentam documentação, validação, SDKs e governança de rotas.'),
              t(locale, 'Each package has an owner boundary and a test expectation before release.', 'Cada pacote tem limite de ownership e expectativa de teste antes do release.'),
            ]} />
          </div>
          <CodeShowcase samples={codeSamples.persistence} title={t(locale, 'Portable persistence', 'Persistência portável')} />
        </div>
      </Band>
      <Band alternate>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Operating model', 'Modelo operacional')}
            title={t(locale, 'Who uses what in the platform', 'Quem usa o quê na plataforma')}
            description={t(
              locale,
              'Jumentix is useful only when each role can see its part of the delivery system. This matrix connects the product surface to daily work.',
              'O Jumentix só é útil quando cada papel enxerga sua parte do sistema de entrega. Esta matriz conecta a superfície do produto ao trabalho diário.',
            )}
          />
          <CommercialMatrix
            headers={t(locale, ['Role', 'When they use it', 'Jumentix surface', 'Result'], ['Papel', 'Quando usa', 'Superfície Jumentix', 'Resultado'])}
            rows={[
              { focus: t(locale, 'Product owner', 'Product owner'), when: t(locale, 'A new SaaS capability needs clear scope before implementation.', 'Uma nova capacidade SaaS precisa de escopo claro antes da implementação.'), implementation: t(locale, 'Domain Designer, exported model docs, use-case blueprints.', 'Domain Designer, documentação exportada do modelo, blueprints de casos de uso.'), outcome: t(locale, 'Backlog items map to domain boundaries instead of loose technical tasks.', 'Itens de backlog mapeiam para limites de domínio em vez de tarefas técnicas soltas.') },
              { focus: t(locale, 'Backend engineer', 'Engenharia backend'), when: t(locale, 'A service needs routes, validation, persistence, auth, or realtime behavior.', 'Um serviço precisa de rotas, validação, persistência, auth ou comportamento realtime.'), implementation: t(locale, 'Backend template, ports/adapters, OpenAPI and AsyncAPI contracts.', 'Backend template, ports/adapters, contratos OpenAPI e AsyncAPI.'), outcome: t(locale, 'Feature work stays inside application and domain modules.', 'Trabalho de feature fica dentro dos módulos de aplicação e domínio.') },
              { focus: t(locale, 'Frontend engineer', 'Engenharia frontend'), when: t(locale, 'A SPA/PWA needs typed access to APIs and offline workflows.', 'Uma SPA/PWA precisa de acesso tipado a APIs e fluxos offline.'), implementation: t(locale, 'Generated SDKs, Cana, React/Vue integration packages, IndexedDB-ready examples.', 'SDKs gerados, Cana, pacotes de integração React/Vue, exemplos prontos para IndexedDB.'), outcome: t(locale, 'UI state and server contracts stay synchronized.', 'Estado da UI e contratos do servidor permanecem sincronizados.') },
              { focus: t(locale, 'Platform team', 'Time de plataforma'), when: t(locale, 'Multiple squads need the same standards without copy-paste governance.', 'Várias squads precisam dos mesmos padrões sem governança copiada à mão.'), implementation: t(locale, 'Branch gates, workspace policies, package boundaries, deployment profiles.', 'Gates por branch, políticas de workspace, limites de pacotes, perfis de deploy.'), outcome: t(locale, 'Reusable golden paths with evidence for security and quality reviews.', 'Golden paths reutilizáveis com evidência para revisões de segurança e qualidade.') },
            ]}
          />
        </div>
      </Band>
      <PM2OperationsBand locale={locale} />
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
      <PageHero locale={locale} eyebrow={t(locale, 'Use cases', 'Casos de uso')} title={t(locale, 'Start with the product you need now', 'Comece com o produto de que você precisa agora')} description={t(locale, 'Every blueprint now reads like a zero-to-first-MVP path: choose the first product behavior, model the domain slice, expose one usable interface, prove it, then evolve without rewriting the architecture.', 'Cada blueprint agora funciona como uma jornada do zero ao primeiro MVP: escolha o primeiro comportamento de produto, modele a fatia de domínio, exponha uma interface usável, comprove e evolua sem reescrever a arquitetura.')} />
      <Band>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Blueprint catalog', 'Catálogo de blueprints')}
            title={t(locale, 'Pick the entry point that matches the product risk', 'Escolha o ponto de entrada que combina com o risco do produto')}
            description={t(
              locale,
              'The blueprints are not separate templates. They are different topologies over the same domain, contract, adapter, and governance model.',
              'Os blueprints não são templates separados. Eles são topologias diferentes sobre o mesmo modelo de domínio, contratos, adaptadores e governança.',
            )}
          />
          <UseCaseLinks locale={locale} />
        </div>
      </Band>
      <MvpLaunchBand locale={locale} alternate />
      <Band>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Decision matrix', 'Matriz de decisão')}
            title={t(locale, 'When to choose each Jumentix path', 'Quando escolher cada caminho Jumentix')}
            description={t(
              locale,
              'Start with the smallest topology that proves the product. Jumentix keeps the contracts stable so the architecture can grow without a rewrite.',
              'Comece com a menor topologia que prova o produto. O Jumentix mantém contratos estáveis para a arquitetura crescer sem reescrita.',
            )}
          />
          <CommercialMatrix
            headers={t(locale, ['Path', 'Use it when', 'Implementation shape', 'What to measure'], ['Caminho', 'Use quando', 'Formato de implementação', 'O que medir'])}
            rows={[
              { focus: t(locale, 'REST API', 'API REST'), when: t(locale, 'The product needs predictable CRUD, integrations, admin workflows, or public API documentation.', 'O produto precisa de CRUD previsível, integrações, fluxos administrativos ou documentação pública de API.'), implementation: t(locale, 'OpenAPI 3.1, native HTTP adapter, controller, use-case, repository port, SDK client.', 'OpenAPI 3.1, adaptador HTTP nativo, controller, caso de uso, port de repository, SDK cliente.'), outcome: t(locale, 'Route coverage, validation failures, API latency, SDK adoption.', 'Cobertura de rotas, falhas de validação, latência da API, adoção do SDK.') },
              { focus: t(locale, 'Realtime API', 'API realtime'), when: t(locale, 'Users need live collaboration, progress updates, notifications, streaming command results, or bidirectional control.', 'Usuários precisam de colaboração ao vivo, progresso, notificações, resultados de comando em streaming ou controle bidirecional.'), implementation: t(locale, 'Socket.IO or gRPC process with REST fallback, AsyncAPI contracts, correlated messages, optional Redis Streams.', 'Processo Socket.IO ou gRPC com fallback REST, contratos AsyncAPI, mensagens correlacionadas, Redis Streams opcional.'), outcome: t(locale, 'Delivery acknowledgement, reconnect behavior, fan-out reliability, fallback parity.', 'Acknowledgement de entrega, reconexão, confiabilidade de fan-out, paridade do fallback.') },
              { focus: t(locale, 'Modular SaaS', 'SaaS modular'), when: t(locale, 'You need to ship one product quickly but still protect domain ownership, tenancy, RBAC, and later extraction.', 'Você precisa lançar um produto rápido, preservando domínio, tenancy, RBAC e extração futura.'), implementation: t(locale, 'One deployable, feature modules, shared composition root, tenant-aware policies, contract events.', 'Um deploy, módulos por feature, composition root compartilhada, políticas tenant-aware, eventos contratados.'), outcome: t(locale, 'Release frequency, onboarding time, module coupling, cost per environment.', 'Frequência de release, tempo de onboarding, acoplamento entre módulos, custo por ambiente.') },
              { focus: t(locale, 'Microservices', 'Microsserviços'), when: t(locale, 'Team ownership, scaling profile, data lifecycle, or deployment cadence requires independent services.', 'Ownership de times, perfil de escala, ciclo de vida dos dados ou cadência de deploy exigem serviços independentes.'), implementation: t(locale, 'Independent workers/services, Message Mediator contracts, broker adapters, per-service gates.', 'Workers/serviços independentes, contratos do Message Mediator, adaptadores de broker, gates por serviço.'), outcome: t(locale, 'Service autonomy, broker durability, contract compatibility, incident isolation.', 'Autonomia de serviço, durabilidade do broker, compatibilidade contratual, isolamento de incidentes.') },
              { focus: t(locale, 'SPA/PWA', 'SPA/PWA'), when: t(locale, 'The frontend must work offline, sync later, or share API contracts across React/Vue products.', 'O frontend precisa funcionar offline, sincronizar depois ou compartilhar contratos de API entre produtos React/Vue.'), implementation: t(locale, 'Generated SDKs, Cana local store, React/Vue hooks, IndexedDB-ready state flow.', 'SDKs gerados, store local Cana, hooks React/Vue, fluxo de estado pronto para IndexedDB.'), outcome: t(locale, 'Offline completion rate, sync conflicts, stale reads, UI event latency.', 'Taxa de conclusão offline, conflitos de sync, leituras antigas, latência de eventos da UI.') },
            ]}
          />
        </div>
      </Band>
      <Band alternate>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Shared foundation', 'Fundação compartilhada')}
            title={t(locale, 'Every use case keeps the same engineering rules', 'Todo caso de uso mantém as mesmas regras de engenharia')}
          />
          <DetailGrid items={[
            { title: t(locale, 'Contracts before adapters', 'Contratos antes de adaptadores'), description: t(locale, 'OpenAPI, AsyncAPI, message contracts, and error contracts describe the boundary before framework code handles it.', 'OpenAPI, AsyncAPI, contratos de mensagem e contratos de erro descrevem o limite antes do código de framework tratá-lo.'), icon: <IconRoute /> },
            { title: t(locale, 'Use-cases before infrastructure', 'Casos de uso antes da infraestrutura'), description: t(locale, 'Application services depend on ports. Databases, queues, HTTP servers, and cloud providers plug in at composition time.', 'Serviços de aplicação dependem de ports. Bancos, filas, servidores HTTP e provedores cloud entram no momento de composição.'), icon: <IconHierarchy3 /> },
            { title: t(locale, 'Evidence before release', 'Evidência antes do release'), description: t(locale, 'Tests, route checks, architectural boundary checks, security review, and docs synchronization are part of delivery.', 'Testes, checagens de rota, limites arquiteturais, revisão de segurança e sincronização de docs fazem parte da entrega.'), icon: <IconShieldCheck /> },
          ]} />
        </div>
      </Band>
      <FinalCta locale={locale} />
    </>
  );
}

const useCaseDetails: Record<UseCaseName, {
  en: {
    eyebrow: string;
    title: string;
    description: string;
    outcomes: string[];
    sample: keyof typeof codeSamples;
    mvpIntro: string;
    mvpSteps: Array<{ label: string; title: string; description: string; output: string }>;
    mvpScope: Array<{ title: string; description: string; meta: string }>;
    validationRows: CommercialMatrixRow[];
  };
  pt: {
    eyebrow: string;
    title: string;
    description: string;
    outcomes: string[];
    sample: keyof typeof codeSamples;
    mvpIntro: string;
    mvpSteps: Array<{ label: string; title: string; description: string; output: string }>;
    mvpScope: Array<{ title: string; description: string; meta: string }>;
    validationRows: CommercialMatrixRow[];
  };
}> = {
  'rest-api': {
    en: {
      eyebrow: 'REST API blueprint',
      title: 'Contract-first REST APIs without domain lock-in',
      description: 'Use OpenAPI 3.1 to bind request validation, handlers, controllers, SDK clients, and documentation.',
      outcomes: ['Native adapters for multiple Node.js HTTP runtimes', 'Swagger documentation and static asset serving', 'Two validation layers: interface and domain'],
      sample: 'rest',
      mvpIntro: 'Use this path when the first MVP must expose predictable CRUD or integration behavior that another system, admin screen, or frontend can call immediately.',
      mvpSteps: [
        { label: 'Day 0', title: 'Choose the first resource', description: 'Model one resource such as Task with Category ownership, required fields, validation, and the first create/list operations.', output: 'MVP output: a tiny OpenAPI surface with one command and one query.' },
        { label: 'Day 1', title: 'Wire the controller path', description: 'Connect request validation, controller, use-case, repository port, in-memory adapter, and response contract.', output: 'MVP output: a running REST route with the domain still independent from the HTTP framework.' },
        { label: 'Day 2', title: 'Generate a usable client', description: 'Expose the contract to a frontend or integration client, then call it from a smokeable example.', output: 'MVP output: API docs, SDK behavior, and a repeatable request example.' },
        { label: 'Release', title: 'Prove the route', description: 'Run route resolution, unit tests, docs sync, architecture checks, and website/package gates before the demo.', output: 'MVP output: evidence that the route, docs, validation and use-case agree.' },
      ],
      mvpScope: [
        { title: 'One resource family', description: 'Task and Category are enough to prove CRUD, filtering, validation, and ownership.', meta: 'Domain slice' },
        { title: 'One primary route group', description: 'Create, list, update status, and fetch by id before adding reporting or bulk operations.', meta: 'API slice' },
        { title: 'One adapter profile', description: 'Start with in-memory or local SQL, then swap the repository adapter after feedback.', meta: 'Runtime slice' },
      ],
      validationRows: [
        { focus: 'Contract', when: 'Can another client understand the API without reading source code?', implementation: 'OpenAPI 3.1, route check, schema examples.', outcome: 'Docs and route metadata match the handler.' },
        { focus: 'Behavior', when: 'Does the first workflow enforce validation and domain rules?', implementation: 'Controller/use-case tests and error contract checks.', outcome: 'Invalid input fails before persistence; domain errors stay explicit.' },
        { focus: 'Adoption', when: 'Can a frontend or partner call it today?', implementation: 'Generated REST client and copyable request example.', outcome: 'A first consumer can create and list records.' },
      ],
    },
    pt: {
      eyebrow: 'Blueprint de API REST',
      title: 'APIs REST orientadas a contratos sem aprisionar o domínio',
      description: 'Use OpenAPI 3.1 para conectar validação, handlers, controllers, SDKs e documentação.',
      outcomes: ['Adaptadores nativos para vários runtimes HTTP Node.js', 'Documentação Swagger e arquivos estáticos', 'Duas camadas de validação: interface e domínio'],
      sample: 'rest',
      mvpIntro: 'Use este caminho quando o primeiro MVP precisa expor CRUD previsível ou comportamento de integração que outro sistema, tela admin ou frontend consiga chamar imediatamente.',
      mvpSteps: [
        { label: 'Dia 0', title: 'Escolha o primeiro recurso', description: 'Modele um recurso como Task com Category, campos obrigatórios, validação e as primeiras operações de create/list.', output: 'Saída MVP: uma superfície OpenAPI pequena com um comando e uma query.' },
        { label: 'Dia 1', title: 'Conecte o caminho do controller', description: 'Ligue validação de request, controller, use-case, port de repository, adaptador in-memory e contrato de resposta.', output: 'Saída MVP: uma rota REST rodando com domínio independente do framework HTTP.' },
        { label: 'Dia 2', title: 'Gere um client utilizável', description: 'Exponha o contrato para um frontend ou cliente de integração e chame a rota em um exemplo testável.', output: 'Saída MVP: docs de API, comportamento de SDK e exemplo repetível de request.' },
        { label: 'Release', title: 'Comprove a rota', description: 'Rode resolução de rotas, testes unitários, sync de docs, checks de arquitetura e gates de website/pacote antes da demo.', output: 'Saída MVP: evidência de que rota, docs, validação e use-case concordam.' },
      ],
      mvpScope: [
        { title: 'Uma família de recurso', description: 'Task e Category bastam para provar CRUD, filtro, validação e ownership.', meta: 'Fatia de domínio' },
        { title: 'Um grupo de rotas', description: 'Create, list, update status e fetch by id antes de reporting ou operações bulk.', meta: 'Fatia de API' },
        { title: 'Um perfil de adapter', description: 'Comece com in-memory ou SQL local, depois troque o repository adapter após feedback.', meta: 'Fatia de runtime' },
      ],
      validationRows: [
        { focus: 'Contrato', when: 'Outro client entende a API sem ler o código fonte?', implementation: 'OpenAPI 3.1, check de rota, exemplos de schema.', outcome: 'Docs e metadados de rota batem com o handler.' },
        { focus: 'Comportamento', when: 'O primeiro fluxo aplica validação e regras de domínio?', implementation: 'Testes de controller/use-case e checks de contrato de erro.', outcome: 'Input inválido falha antes da persistência; erros de domínio ficam explícitos.' },
        { focus: 'Adoção', when: 'Um frontend ou parceiro consegue chamar hoje?', implementation: 'Client REST gerado e exemplo copiável de request.', outcome: 'Um primeiro consumidor consegue criar e listar registros.' },
      ],
    },
  },
  'realtime-api': {
    en: {
      eyebrow: 'Realtime blueprint',
      title: 'Bidirectional APIs with a built-in fallback',
      description: 'Run Socket.IO or gRPC as the primary interface while a separate REST process provides fallback and AsyncAPI documentation.',
      outcomes: ['Correlated request/response messages', 'Redis Streams and cluster resilience for Socket.IO', 'AsyncAPI contracts shared with generated clients'],
      sample: 'realtime',
      mvpIntro: 'Use this path when the first MVP must feel live: progress updates, collaboration, notifications, or command results that return through a bidirectional channel.',
      mvpSteps: [
        { label: 'Day 0', title: 'Pick the live moment', description: 'Choose the one event users must see without refreshing, such as task.created or task.statusChanged.', output: 'MVP output: one AsyncAPI channel and one correlated request/response subject.' },
        { label: 'Day 1', title: 'Run the realtime adapter', description: 'Start Socket.IO or gRPC beside the REST fallback and map messages to the same use-case contract.', output: 'MVP output: a live command that returns acknowledgement and payload.' },
        { label: 'Day 2', title: 'Connect a browser client', description: 'Subscribe to the event, render it in the UI, and keep a REST fallback for reconnect or degraded mode.', output: 'MVP output: the user sees a live update and the fallback returns the same business result.' },
        { label: 'Release', title: 'Prove delivery and reconnect', description: 'Validate message correlation, fallback parity, docs, and process supervision before the pilot.', output: 'MVP output: evidence for delivery acknowledgement, reconnect behavior, and fallback parity.' },
      ],
      mvpScope: [
        { title: 'One live event', description: 'Start with one event that visibly changes the UI or confirms a command.', meta: 'Realtime slice' },
        { title: 'One fallback path', description: 'Keep REST available so the first MVP has a supportable recovery path.', meta: 'Reliability slice' },
        { title: 'One process profile', description: 'Run realtime and fallback processes explicitly with local or PM2 profiles.', meta: 'Operations slice' },
      ],
      validationRows: [
        { focus: 'Correlation', when: 'Can the client match every response to its request?', implementation: 'Message id, subject contract, response handler tests.', outcome: 'No anonymous realtime side effects.' },
        { focus: 'Fallback', when: 'Does REST return the same result when realtime is unavailable?', implementation: 'Fallback route and shared use-case contract.', outcome: 'Degraded mode remains usable.' },
        { focus: 'Operations', when: 'Can the process be started, inspected and restarted?', implementation: 'PM2/runtime profile and logs.', outcome: 'The MVP is demoable outside a dev terminal.' },
      ],
    },
    pt: {
      eyebrow: 'Blueprint realtime',
      title: 'APIs bidirecionais com fallback incorporado',
      description: 'Execute Socket.IO ou gRPC como interface principal enquanto um processo REST separado oferece fallback e documentação AsyncAPI.',
      outcomes: ['Mensagens request/response correlacionadas', 'Redis Streams e resiliência em cluster para Socket.IO', 'Contratos AsyncAPI compartilhados com clientes gerados'],
      sample: 'realtime',
      mvpIntro: 'Use este caminho quando o primeiro MVP precisa parecer vivo: progresso, colaboração, notificações ou resultados de comando voltando por canal bidirecional.',
      mvpSteps: [
        { label: 'Dia 0', title: 'Escolha o momento live', description: 'Escolha o único evento que usuários precisam ver sem refresh, como task.created ou task.statusChanged.', output: 'Saída MVP: um canal AsyncAPI e um subject request/response correlacionado.' },
        { label: 'Dia 1', title: 'Rode o adapter realtime', description: 'Inicie Socket.IO ou gRPC ao lado do fallback REST e mapeie mensagens para o mesmo contrato de use-case.', output: 'Saída MVP: um comando live que retorna acknowledgement e payload.' },
        { label: 'Dia 2', title: 'Conecte um client browser', description: 'Assine o evento, renderize na UI e mantenha fallback REST para reconnect ou modo degradado.', output: 'Saída MVP: usuário vê atualização live e fallback retorna o mesmo resultado de negócio.' },
        { label: 'Release', title: 'Comprove entrega e reconnect', description: 'Valide correlação de mensagens, paridade do fallback, docs e supervisão de processo antes do piloto.', output: 'Saída MVP: evidência de acknowledgement, reconnect e paridade do fallback.' },
      ],
      mvpScope: [
        { title: 'Um evento live', description: 'Comece com um evento que muda a UI ou confirma um comando de forma visível.', meta: 'Fatia realtime' },
        { title: 'Um fallback', description: 'Mantenha REST disponível para que o primeiro MVP tenha recuperação suportável.', meta: 'Fatia de confiabilidade' },
        { title: 'Um perfil de processo', description: 'Rode realtime e fallback explicitamente com perfis locais ou PM2.', meta: 'Fatia operacional' },
      ],
      validationRows: [
        { focus: 'Correlação', when: 'O client relaciona toda resposta ao request?', implementation: 'Message id, contrato de subject, testes do response handler.', outcome: 'Sem efeitos realtime anônimos.' },
        { focus: 'Fallback', when: 'REST retorna o mesmo resultado quando realtime cai?', implementation: 'Rota fallback e contrato de use-case compartilhado.', outcome: 'Modo degradado continua usável.' },
        { focus: 'Operação', when: 'O processo pode iniciar, ser inspecionado e reiniciado?', implementation: 'Perfil PM2/runtime e logs.', outcome: 'O MVP é demonstrável fora do terminal de dev.' },
      ],
    },
  },
  'saas-monolith': {
    en: {
      eyebrow: 'Modular SaaS blueprint',
      title: 'Launch one deployable, preserve every domain boundary',
      description: 'Ship faster as a modular monolith with multi-tenancy, RBAC, organizations, users, and event-driven collaboration already modeled.',
      outcomes: ['Lower first-release operating cost', 'Feature-driven modules keep changes local', 'Message contracts support later extraction'],
      sample: 'start',
      mvpIntro: 'Use this path when the first MVP is a complete SaaS slice: sign in, tenant or organization scope, one core workflow, and one deployable.',
      mvpSteps: [
        { label: 'Day 0', title: 'Define the tenant-owned workflow', description: 'Choose the first organization-owned capability, such as categorized tasks, and define who can create, view, and complete it.', output: 'MVP output: one bounded context with tenant and RBAC expectations.' },
        { label: 'Day 1', title: 'Compose one deployable', description: 'Use the backend template, authentication, authorization, controllers, use-cases, repository ports, and local adapter profile.', output: 'MVP output: one application process that demonstrates the full product path.' },
        { label: 'Day 2', title: 'Add the first UI or SDK consumer', description: 'Connect a frontend, admin view, or generated client to the same contracts.', output: 'MVP output: a user can complete the workflow end to end.' },
        { label: 'Release', title: 'Protect the monolith boundaries', description: 'Run workspace boundaries, route/docs checks, tests, and release evidence before shipping to a pilot environment.', output: 'MVP output: one deployable with extraction-ready domain boundaries.' },
      ],
      mvpScope: [
        { title: 'One tenant workflow', description: 'Organization, user, Category and Task prove tenancy plus real feature behavior.', meta: 'Product slice' },
        { title: 'One deployable', description: 'Keep operations simple while preserving feature modules and composition boundaries.', meta: 'Delivery slice' },
        { title: 'One role policy', description: 'Prove superadmin/admin/user behavior before adding a full permission matrix.', meta: 'Security slice' },
      ],
      validationRows: [
        { focus: 'Tenant safety', when: 'Can one organization see another organization data?', implementation: 'Tenant-aware use-case tests and policy checks.', outcome: 'Cross-tenant reads and writes fail.' },
        { focus: 'Module boundary', when: 'Can the first feature change without touching unrelated modules?', implementation: 'Feature folder and workspace boundary checks.', outcome: 'Changes stay local to the bounded context.' },
        { focus: 'Pilot readiness', when: 'Can the whole MVP run as one supervised app?', implementation: 'Dev/staging profile, smoke test, docs and prepublish evidence.', outcome: 'One deployable is ready for first users.' },
      ],
    },
    pt: {
      eyebrow: 'Blueprint SaaS modular',
      title: 'Lance um deploy, preserve cada limite de domínio',
      description: 'Entregue mais rápido como monólito modular com multitenancy, RBAC, organizações, usuários e colaboração orientada a eventos já modelados.',
      outcomes: ['Menor custo operacional na primeira versão', 'Módulos por feature mantêm mudanças locais', 'Contratos de mensagem suportam extração futura'],
      sample: 'start',
      mvpIntro: 'Use este caminho quando o primeiro MVP é uma fatia SaaS completa: login, escopo de tenant ou organização, um fluxo central e um deploy.',
      mvpSteps: [
        { label: 'Dia 0', title: 'Defina o fluxo do tenant', description: 'Escolha a primeira capacidade da organização, como tarefas por categoria, e defina quem cria, vê e conclui.', output: 'Saída MVP: um contexto delimitado com expectativas de tenant e RBAC.' },
        { label: 'Dia 1', title: 'Componha um deploy', description: 'Use backend template, autenticação, autorização, controllers, use-cases, ports de repository e perfil local de adapter.', output: 'Saída MVP: um processo de aplicação demonstrando o caminho completo do produto.' },
        { label: 'Dia 2', title: 'Adicione o primeiro consumidor', description: 'Conecte frontend, visão admin ou client gerado aos mesmos contratos.', output: 'Saída MVP: usuário completa o fluxo de ponta a ponta.' },
        { label: 'Release', title: 'Proteja os limites do monólito', description: 'Rode limites de workspace, checks de rota/docs, testes e evidência de release antes do piloto.', output: 'Saída MVP: um deploy com limites de domínio prontos para extração.' },
      ],
      mvpScope: [
        { title: 'Um fluxo tenant', description: 'Organization, user, Category e Task provam tenancy e comportamento real de feature.', meta: 'Fatia de produto' },
        { title: 'Um deploy', description: 'Mantenha operação simples preservando módulos de feature e limites de composição.', meta: 'Fatia de entrega' },
        { title: 'Uma política de papel', description: 'Prove superadmin/admin/user antes de uma matriz completa de permissões.', meta: 'Fatia de segurança' },
      ],
      validationRows: [
        { focus: 'Segurança tenant', when: 'Uma organização consegue ver dados de outra?', implementation: 'Testes tenant-aware de use-case e checks de policy.', outcome: 'Leituras e escritas cross-tenant falham.' },
        { focus: 'Limite de módulo', when: 'A primeira feature muda sem tocar módulos não relacionados?', implementation: 'Pasta por feature e checks de workspace boundary.', outcome: 'Mudanças ficam locais ao contexto delimitado.' },
        { focus: 'Pronto para piloto', when: 'O MVP inteiro roda como um app supervisionado?', implementation: 'Perfil dev/staging, smoke test, docs e evidência prepublish.', outcome: 'Um deploy está pronto para primeiros usuários.' },
      ],
    },
  },
  'saas-microservices': {
    en: {
      eyebrow: 'Distributed SaaS blueprint',
      title: 'Scale services without rewriting communication',
      description: 'Use independent workers and contract-based mediation so in-process requests can move to RabbitMQ, BullMQ, or another transport.',
      outcomes: ['Independent service ownership', 'Request/response and publish/listen patterns', 'Per-service runtimes, tests, and deployment'],
      sample: 'deploy',
      mvpIntro: 'Use this path when the first MVP already needs independent ownership or a background capability that should not share the main application lifecycle.',
      mvpSteps: [
        { label: 'Day 0', title: 'Extract only one boundary', description: 'Choose one bounded context or worker behavior, such as task notification, category analytics, or async import.', output: 'MVP output: one service boundary with a clear subject and payload contract.' },
        { label: 'Day 1', title: 'Start in process, then broker', description: 'Prove the Message Mediator contract in-memory before introducing RabbitMQ, BullMQ, Redis Streams, or another durable transport.', output: 'MVP output: request/response or publish/listen works without consumer imports.' },
        { label: 'Day 2', title: 'Give the service its own profile', description: 'Run the service with a named PM2, Docker, or worker profile and independent tests.', output: 'MVP output: the service can restart or deploy without rewriting the producer.' },
        { label: 'Release', title: 'Prove compatibility', description: 'Validate contract compatibility, retry/dead-letter behavior where relevant, and per-service evidence.', output: 'MVP output: one independent service with measured blast radius.' },
      ],
      mvpScope: [
        { title: 'One service boundary', description: 'Extract the smallest behavior with a clear owner and message contract.', meta: 'Ownership slice' },
        { title: 'One durable path', description: 'Add broker durability only after the in-memory contract proves the interaction.', meta: 'Messaging slice' },
        { title: 'One independent gate', description: 'Run service-focused tests and deployment checks for the extracted boundary.', meta: 'Governance slice' },
      ],
      validationRows: [
        { focus: 'Compatibility', when: 'Can producer and consumer evolve without importing each other?', implementation: 'Message contract tests and subject/payload examples.', outcome: 'The contract owns compatibility.' },
        { focus: 'Isolation', when: 'Can this service fail without hiding the failure?', implementation: 'Retry, error contract, dead-letter or fallback evidence.', outcome: 'Failure mode is explicit.' },
        { focus: 'Ownership', when: 'Can one team ship the service independently?', implementation: 'Per-service profile, tests and release evidence.', outcome: 'Independent ownership is real, not organizational theater.' },
      ],
    },
    pt: {
      eyebrow: 'Blueprint SaaS distribuído',
      title: 'Escale serviços sem reescrever a comunicação',
      description: 'Use workers independentes e mediação baseada em contratos para mover requests em processo para RabbitMQ, BullMQ ou outro transporte.',
      outcomes: ['Propriedade independente por serviço', 'Padrões request/response e publish/listen', 'Runtime, testes e deploy por serviço'],
      sample: 'deploy',
      mvpIntro: 'Use este caminho quando o primeiro MVP já precisa de ownership independente ou uma capacidade background que não deve compartilhar o ciclo de vida da aplicação principal.',
      mvpSteps: [
        { label: 'Dia 0', title: 'Extraia só um limite', description: 'Escolha um contexto delimitado ou comportamento worker, como notificação de task, analytics de category ou import assíncrono.', output: 'Saída MVP: um limite de serviço com subject e payload claros.' },
        { label: 'Dia 1', title: 'Comece em processo, depois use broker', description: 'Comprove o contrato do Message Mediator in-memory antes de RabbitMQ, BullMQ, Redis Streams ou outro transporte durável.', output: 'Saída MVP: request/response ou publish/listen funciona sem imports de consumidor.' },
        { label: 'Dia 2', title: 'Dê perfil próprio ao serviço', description: 'Rode o serviço com perfil PM2, Docker ou worker nomeado e testes independentes.', output: 'Saída MVP: serviço reinicia ou deploya sem reescrever o produtor.' },
        { label: 'Release', title: 'Comprove compatibilidade', description: 'Valide compatibilidade de contrato, retry/dead-letter quando relevante e evidência por serviço.', output: 'Saída MVP: um serviço independente com blast radius medido.' },
      ],
      mvpScope: [
        { title: 'Um limite de serviço', description: 'Extraia o menor comportamento com owner e contrato de mensagem claros.', meta: 'Fatia de ownership' },
        { title: 'Um caminho durável', description: 'Adicione durabilidade de broker só após o contrato in-memory provar a interação.', meta: 'Fatia de mensageria' },
        { title: 'Um gate independente', description: 'Rode testes e checks de deploy focados no limite extraído.', meta: 'Fatia de governança' },
      ],
      validationRows: [
        { focus: 'Compatibilidade', when: 'Produtor e consumidor evoluem sem importar um ao outro?', implementation: 'Testes de contrato de mensagem e exemplos de subject/payload.', outcome: 'O contrato controla compatibilidade.' },
        { focus: 'Isolamento', when: 'O serviço pode falhar sem esconder a falha?', implementation: 'Retry, contrato de erro, dead-letter ou evidência de fallback.', outcome: 'O modo de falha é explícito.' },
        { focus: 'Ownership', when: 'Um time consegue publicar o serviço sozinho?', implementation: 'Perfil, testes e evidência de release por serviço.', outcome: 'Ownership independente é real, não teatro organizacional.' },
      ],
    },
  },
  'spa-pwa': {
    en: {
      eyebrow: 'Frontend blueprint',
      title: 'Build installable products that keep working offline',
      description: 'Pair generated SDK clients with a SPA or PWA architecture, IndexedDB persistence, and the same contract vocabulary as the backend.',
      outcomes: ['Offline-first data workflows', 'REST, Socket.IO, and gRPC client packages', 'Shared governance across frontend and backend'],
      sample: 'start',
      mvpIntro: 'Use this path when the first MVP must run in the browser, keep local state, and later synchronize with backend contracts.',
      mvpSteps: [
        { label: 'Day 0', title: 'Model local records', description: 'Start with Category and Task tables, one filter, one create action, and one event the UI can listen to.', output: 'MVP output: browser data model with a visible workflow.' },
        { label: 'Day 1', title: 'Run in memory first', description: 'Use Cana, generated SDK contracts, or browser-native in-memory adapters before adding a backend dependency.', output: 'MVP output: the app works entirely in the browser.' },
        { label: 'Day 2', title: 'Connect state management', description: 'Wire React Context, Redux, Vue 3 Pinia, or another store to Cana events and refresh component state.', output: 'MVP output: UI updates when local data changes.' },
        { label: 'Release', title: 'Prove offline behavior', description: 'Validate local persistence, event listeners, sync assumptions, accessibility, route rendering, and copyable examples.', output: 'MVP output: an installable or browser-ready first product demo.' },
      ],
      mvpScope: [
        { title: 'Two local tables', description: 'Category and Task prove relationship, filtering, and event-driven UI updates.', meta: 'Data slice' },
        { title: 'One state library', description: 'Use Context, Redux, or Pinia as the first integration surface.', meta: 'UI slice' },
        { title: 'One sync assumption', description: 'Document whether the MVP is local-only, sync-later, or API-backed.', meta: 'Product slice' },
      ],
      validationRows: [
        { focus: 'Local data', when: 'Can the app create and read records with no server?', implementation: 'Cana/browser in-memory playground and local persistence checks.', outcome: 'The first workflow works offline.' },
        { focus: 'State updates', when: 'Do components refresh from Cana events?', implementation: 'React/Vue state-management examples and event listener assertions.', outcome: 'UI stays consistent with local data.' },
        { focus: 'Future backend', when: 'Can the same vocabulary map to API contracts later?', implementation: 'Generated SDK names and Category/Task contract parity.', outcome: 'The frontend MVP does not invent a separate domain.' },
      ],
    },
    pt: {
      eyebrow: 'Blueprint frontend',
      title: 'Crie produtos instaláveis que continuam funcionando offline',
      description: 'Combine SDKs gerados com arquitetura SPA ou PWA, persistência IndexedDB e o mesmo vocabulário de contratos do backend.',
      outcomes: ['Fluxos de dados offline-first', 'Pacotes cliente REST, Socket.IO e gRPC', 'Governança compartilhada entre frontend e backend'],
      sample: 'start',
      mvpIntro: 'Use este caminho quando o primeiro MVP precisa rodar no browser, manter estado local e depois sincronizar com contratos backend.',
      mvpSteps: [
        { label: 'Dia 0', title: 'Modele registros locais', description: 'Comece com tabelas Category e Task, um filtro, uma ação de create e um evento que a UI consegue ouvir.', output: 'Saída MVP: modelo de dados browser com fluxo visível.' },
        { label: 'Dia 1', title: 'Rode primeiro in-memory', description: 'Use Cana, contratos SDK gerados ou adaptadores in-memory nativos do browser antes de depender de backend.', output: 'Saída MVP: o app funciona 100% no browser.' },
        { label: 'Dia 2', title: 'Conecte state management', description: 'Ligue React Context, Redux, Vue 3 Pinia ou outro store aos eventos do Cana e atualize componentes.', output: 'Saída MVP: UI atualiza quando dados locais mudam.' },
        { label: 'Release', title: 'Comprove comportamento offline', description: 'Valide persistência local, listeners de evento, premissas de sync, acessibilidade, rotas e exemplos copiáveis.', output: 'Saída MVP: primeira demo instalável ou pronta para browser.' },
      ],
      mvpScope: [
        { title: 'Duas tabelas locais', description: 'Category e Task provam relacionamento, filtro e atualização de UI por evento.', meta: 'Fatia de dados' },
        { title: 'Uma biblioteca de estado', description: 'Use Context, Redux ou Pinia como primeira superfície de integração.', meta: 'Fatia de UI' },
        { title: 'Uma premissa de sync', description: 'Documente se o MVP é local-only, sync-later ou apoiado por API.', meta: 'Fatia de produto' },
      ],
      validationRows: [
        { focus: 'Dados locais', when: 'O app cria e lê registros sem servidor?', implementation: 'Playground Cana/browser in-memory e checks de persistência local.', outcome: 'O primeiro fluxo funciona offline.' },
        { focus: 'Atualizações de estado', when: 'Componentes atualizam a partir dos eventos do Cana?', implementation: 'Exemplos React/Vue de state management e assertions de listener.', outcome: 'UI permanece consistente com dados locais.' },
        { focus: 'Backend futuro', when: 'O mesmo vocabulário mapeia para contratos de API depois?', implementation: 'Nomes de SDK gerado e paridade de contrato Category/Task.', outcome: 'O MVP frontend não inventa outro domínio.' },
      ],
    },
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
          <SectionHeading
            eyebrow={t(locale, 'From zero to first MVP', 'Do zero ao primeiro MVP')}
            title={t(locale, 'A practical launch sequence for this blueprint', 'Uma sequência prática de lançamento para este blueprint')}
            description={content.mvpIntro}
          />
          <ol className={classes.timeline}>
            {content.mvpSteps.map((step) => (
              <li key={`${step.label}-${step.title}`}>
                <strong>{step.label}</strong>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <p className={classes.timelineMeta}>{step.output}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Band>
      <Band>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'MVP scope', 'Escopo MVP')}
            title={t(locale, 'Keep the first release small enough to prove', 'Mantenha a primeira versão pequena o bastante para comprovar')}
          />
          <DetailGrid items={content.mvpScope.map((item) => ({ ...item, icon: <IconShieldCheck /> }))} />
          <CommercialMatrix
            headers={t(locale, ['Proof area', 'Question to answer', 'Jumentix mechanism', 'MVP evidence'], ['Área de prova', 'Pergunta a responder', 'Mecanismo Jumentix', 'Evidência MVP'])}
            rows={content.validationRows}
          />
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
  {
    title: 'HTTP runtimes',
    description: 'Express, Fastify, Restify, AWS Lambda, Cloudflare Workers, Vercel Functions, LoopBack, Sails, Feathers, Derby, AdonisJS, and Total.js.',
    ptDescription: 'Express, Fastify, Restify, AWS Lambda, Cloudflare Workers, Vercel Functions, LoopBack, Sails, Feathers, Derby, AdonisJS e Total.js.',
    icon: <IconApi key="http" />,
  },
  {
    title: 'Realtime',
    description: 'Socket.IO, Redis Streams, cluster adapter, gRPC, REST fallback, AsyncAPI documents, and generated realtime clients.',
    ptDescription: 'Socket.IO, Redis Streams, adapter de cluster, gRPC, fallback REST, documentos AsyncAPI e clientes realtime gerados.',
    icon: <IconMessages key="realtime" />,
  },
  {
    title: 'SQL',
    description: 'PostgreSQL, MySQL, SQL Server, Oracle, SQLite, Aurora DSQL, and RDS through shared persistence contracts.',
    ptDescription: 'PostgreSQL, MySQL, SQL Server, Oracle, SQLite, Aurora DSQL e RDS por contratos compartilhados de persistência.',
    icon: <IconDatabase key="sql" />,
  },
  {
    title: 'NoSQL',
    description: 'MongoDB, DynamoDB, Cassandra, Firebase, key-value storage, and in-memory adapters for local tests and prototypes.',
    ptDescription: 'MongoDB, DynamoDB, Cassandra, Firebase, key-value storage e adaptadores in-memory para testes locais e protótipos.',
    icon: <IconDatabase key="nosql" />,
  },
  {
    title: 'Messaging',
    description: 'In-memory Message Mediator for local/browser flows, with RabbitMQ and BullMQ-compatible contracts for durable Node workers.',
    ptDescription: 'Message Mediator in-memory para fluxos locais/browser, com contratos compatíveis com RabbitMQ e BullMQ para workers Node duráveis.',
    icon: <IconTopologyStar3 key="messaging" />,
  },
  {
    title: 'Deployment',
    description: 'PM2, Docker, Serverless, AWS, Azure, Google Cloud, Vercel, Cloudflare, and environment-specific runtime profiles.',
    ptDescription: 'PM2, Docker, Serverless, AWS, Azure, Google Cloud, Vercel, Cloudflare e perfis de runtime por ambiente.',
    icon: <IconCloud key="deployment" />,
  },
] as const;

function Integrations({ locale }: { locale: CommercialLocale }) {
  return (
    <>
      <PageHero locale={locale} eyebrow={t(locale, 'Integrations', 'Integrações')} title={t(locale, 'Choose infrastructure per service, not per platform', 'Escolha a infraestrutura por serviço, não por plataforma')} description={t(locale, 'Jumentix keeps technology decisions at the adapter boundary, where they can be tested and replaced.', 'O Jumentix mantém decisões de tecnologia no limite dos adaptadores, onde podem ser testadas e substituídas.')} />
      <BunToolingBand locale={locale} />
      <BrowserInMemoryLabBand locale={locale} alternate />
      <PM2OperationsBand locale={locale} />
      <Band>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Adapter catalog', 'Catálogo de adaptadores')}
            title={t(locale, 'The practical integration surface', 'A superfície prática de integração')}
            description={t(
              locale,
              'Each adapter sits outside the domain. The application selects ports and contracts; the composition root decides which technology runs in each environment.',
              'Cada adaptador fica fora do domínio. A aplicação seleciona ports e contratos; a raiz de composição decide qual tecnologia roda em cada ambiente.',
            )}
          />
          <div className={classes.integrationGrid}>
            {integrations.map((item) => (
              <article className={classes.integration} key={item.title}>
                {item.icon}
                <h3>{item.title}</h3>
                <p>{t(locale, item.description, item.ptDescription)}</p>
              </article>
            ))}
          </div>
        </div>
      </Band>
      <Band alternate>
        <div className={classes.twoColumn}>
          <div className={classes.prose}>
            <h2>{t(locale, 'Change the driver, preserve the application', 'Troque o driver, preserve a aplicação')}</h2>
            <p>{t(locale, 'Bootstrap adapters read environment configuration, compile the selected database and key-value clients, and inject contracts into the application composition root. That keeps business code independent from Sequelize, Postgres.js, Mongo clients, queues, or HTTP framework request objects.', 'Adaptadores de bootstrap leem a configuração do ambiente, compilam os clientes de banco e chave-valor escolhidos e injetam contratos na raiz de composição. Isso mantém código de negócio independente de Sequelize, Postgres.js, clientes Mongo, filas ou objetos de request de frameworks HTTP.')}</p>
            <ProofList items={[
              t(locale, 'Local test profile can use in-memory adapters without changing use-cases.', 'O perfil de teste local pode usar adaptadores in-memory sem alterar casos de uso.'),
              t(locale, 'Production profile can choose a relational or NoSQL adapter per service.', 'O perfil de produção pode escolher um adaptador relacional ou NoSQL por serviço.'),
              t(locale, 'Realtime, REST, and function deployments reuse the same application contracts.', 'Deploys realtime, REST e functions reutilizam os mesmos contratos de aplicação.'),
            ]} />
          </div>
          <CodeShowcase samples={codeSamples.persistence} title={t(locale, 'Infrastructure adapter selection', 'Seleção de adaptadores de infraestrutura')} />
        </div>
      </Band>
      <Band>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Selection guide', 'Guia de escolha')}
            title={t(locale, 'How to pick the right adapter', 'Como escolher o adaptador certo')}
            description={t(
              locale,
              'The goal is not to support every technology for its own sake. The goal is to let each service choose the smallest reliable infrastructure that fits its data, latency, and operations profile.',
              'O objetivo não é suportar toda tecnologia por vaidade. O objetivo é permitir que cada serviço escolha a menor infraestrutura confiável para seu perfil de dados, latência e operação.',
            )}
          />
          <CommercialMatrix
            headers={t(locale, ['Decision', 'Prefer this when', 'Jumentix mechanism', 'Avoids'], ['Decisão', 'Prefira quando', 'Mecanismo Jumentix', 'Evita'])}
            rows={[
              { focus: t(locale, 'Express/Fastify/Restify', 'Express/Fastify/Restify'), when: t(locale, 'You want a long-running Node service with standard REST semantics and mature middleware.', 'Você quer um serviço Node persistente com semântica REST padrão e middleware maduro.'), implementation: t(locale, 'HTTP adapter maps request/response to controller methods and OpenAPI validation.', 'Adaptador HTTP mapeia request/response para controllers e validação OpenAPI.'), outcome: t(locale, 'Framework-specific request objects leaking into use-cases.', 'Objetos de request do framework vazando para casos de uso.') },
              { focus: t(locale, 'Cloudflare/Vercel/Lambda', 'Cloudflare/Vercel/Lambda'), when: t(locale, 'Traffic is bursty, globally distributed, or owned by platform function routing.', 'O tráfego é irregular, distribuído globalmente ou pertence ao roteamento de functions da plataforma.'), implementation: t(locale, 'Function adapter wraps the same operation contracts used by REST controllers.', 'Adaptador de function encapsula os mesmos contratos de operação usados por controllers REST.'), outcome: t(locale, 'A separate business implementation for serverless.', 'Uma implementação de negócio separada para serverless.') },
              { focus: t(locale, 'PostgreSQL/MySQL/SQL Server', 'PostgreSQL/MySQL/SQL Server'), when: t(locale, 'You need relational constraints, transactions, reporting, or familiar operations.', 'Você precisa de constraints relacionais, transações, reporting ou operação familiar.'), implementation: t(locale, 'Database client factory composes repository adapters behind store contracts.', 'Database client factory compõe adaptadores de repository atrás de contratos de store.'), outcome: t(locale, 'SQL decisions coupled to domain entities.', 'Decisões SQL acopladas a entidades de domínio.') },
              { focus: t(locale, 'MongoDB/DynamoDB/Cassandra', 'MongoDB/DynamoDB/Cassandra'), when: t(locale, 'Data shape, throughput, distribution, or access patterns fit document/key-value/wide-column storage.', 'Formato de dados, throughput, distribuição ou padrões de acesso combinam com document/key-value/wide-column.'), implementation: t(locale, 'External persistence adapters implement the same repository contract expected by use-cases.', 'Adaptadores externos de persistência implementam o mesmo contrato de repository esperado pelos casos de uso.'), outcome: t(locale, 'A NoSQL rewrite of the application layer.', 'Uma reescrita NoSQL da camada de aplicação.') },
              { focus: t(locale, 'RabbitMQ/BullMQ', 'RabbitMQ/BullMQ'), when: t(locale, 'Commands or events must survive process restarts and cross service boundaries.', 'Comandos ou eventos precisam sobreviver a restarts e atravessar limites de serviço.'), implementation: t(locale, 'Message Mediator contracts define subjects, payloads, request/response, and publish/listen behavior.', 'Contratos do Message Mediator definem subjects, payloads, request/response e comportamento publish/listen.'), outcome: t(locale, 'Consumers importing producer implementations.', 'Consumidores importando implementações de produtores.') },
            ]}
          />
        </div>
      </Band>
      <Band alternate>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Package map', 'Mapa de pacotes')}
            title={t(locale, 'Integration code is packaged, not scattered', 'Código de integração é empacotado, não espalhado')}
          />
          <DetailGrid items={[
            { title: '@jumentix/adapter-runtime-bootstrap', description: t(locale, 'Centralizes runtime and infrastructure wiring so services avoid one-off bootstraps.', 'Centraliza wiring de runtime e infraestrutura para serviços evitarem bootstraps únicos.'), meta: t(locale, 'Runtime composition', 'Composição de runtime'), icon: <IconCloud /> },
            { title: '@jumentix/database-client-factory', description: t(locale, 'Compiles the configured database client and keeps selection rules out of business modules.', 'Compila o cliente de banco configurado e mantém regras de seleção fora dos módulos de negócio.'), meta: t(locale, 'Database selection', 'Seleção de banco'), icon: <IconDatabase /> },
            { title: '@jumentix/persistence-contracts', description: t(locale, 'Defines stable store/repository contracts shared by in-memory and external adapters.', 'Define contratos estáveis de store/repository compartilhados por adaptadores in-memory e externos.'), meta: t(locale, 'Ports', 'Ports'), icon: <IconHierarchy3 /> },
            { title: '@jumentix/message-mediator', description: t(locale, 'Coordinates commands, requests, responses, and events across modules or services.', 'Coordena comandos, requests, responses e eventos entre módulos ou serviços.'), meta: t(locale, 'Messaging', 'Mensageria'), icon: <IconMessages /> },
            { title: '@jumentix/sdk-rest-client', description: t(locale, 'Reads canonical OpenAPI contracts and exposes typed REST client behavior.', 'Lê contratos OpenAPI canônicos e expõe comportamento tipado de cliente REST.'), meta: t(locale, 'Client SDK', 'SDK cliente'), icon: <IconDeviceDesktop /> },
            { title: '@jumentix/cana', description: t(locale, 'Provides local relational state, event listening, and browser persistence for frontend examples and future apps.', 'Fornece estado relacional local, escuta de eventos e persistência browser para exemplos frontend e apps futuros.'), meta: t(locale, 'Frontend data', 'Dados frontend'), icon: <IconPackage /> },
          ]} />
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
          <SectionHeading
            eyebrow={t(locale, 'Request path', 'Caminho do request')}
            title={t(locale, 'The same path works for HTTP, realtime, functions, and workers', 'O mesmo caminho funciona para HTTP, realtime, functions e workers')}
            description={t(
              locale,
              'Every interface starts outside the domain and moves inward through contracts. Every infrastructure call moves outward through ports.',
              'Toda interface começa fora do domínio e entra por contratos. Toda chamada de infraestrutura sai por ports.',
            )}
          />
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
      <AIReadyBand locale={locale} alternate />
      <BrowserInMemoryLabBand locale={locale} />
      <Band alternate>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Layer responsibilities', 'Responsabilidades por camada')}
            title={t(locale, 'What is allowed to know what', 'O que pode conhecer o quê')}
            description={t(
              locale,
              'The value of the architecture is the restriction. Jumentix makes the boundaries explicit so scaling the system does not turn every feature into a cross-cutting rewrite.',
              'O valor da arquitetura está na restrição. O Jumentix torna limites explícitos para que escalar o sistema não transforme toda feature em reescrita transversal.',
            )}
          />
          <CommercialMatrix
            headers={t(locale, ['Layer', 'Owns', 'Can depend on', 'Must not contain'], ['Camada', 'É dona de', 'Pode depender de', 'Não deve conter'])}
            rows={[
              { focus: t(locale, 'Interface adapter', 'Adaptador de interface'), when: t(locale, 'HTTP/WebSocket/gRPC/function transport, request parsing, protocol responses.', 'Transporte HTTP/WebSocket/gRPC/function, parsing de request, responses de protocolo.'), implementation: t(locale, 'OpenAPI/AsyncAPI contracts, controller contracts, runtime utilities.', 'Contratos OpenAPI/AsyncAPI, contratos de controller, utilitários de runtime.'), outcome: t(locale, 'Business rules, database queries, tenant policy decisions.', 'Regras de negócio, queries de banco, decisões de política tenant.') },
              { focus: t(locale, 'Controller', 'Controller'), when: t(locale, 'Request-to-use-case mapping, input shape, response shape, error exposure.', 'Mapeamento request-para-caso-de-uso, formato de input, formato de output, exposição de erro.'), implementation: t(locale, 'Application use-cases and validation contracts.', 'Casos de uso de aplicação e contratos de validação.'), outcome: t(locale, 'Framework request objects or concrete repository clients.', 'Objetos request de framework ou clientes concretos de repository.') },
              { focus: t(locale, 'Application use-case', 'Caso de uso de aplicação'), when: t(locale, 'Business workflow, authorization calls, orchestration, transaction boundary decisions.', 'Workflow de negócio, chamadas de autorização, orquestração, decisões de fronteira transacional.'), implementation: t(locale, 'Domain objects, domain services, repository ports, mediator ports.', 'Objetos de domínio, serviços de domínio, ports de repository, ports de mediator.'), outcome: t(locale, 'Express/Fastify/Sequelize/Mongo/BullMQ imports.', 'Imports de Express/Fastify/Sequelize/Mongo/BullMQ.') },
              { focus: t(locale, 'Domain', 'Domínio'), when: t(locale, 'Entities, value objects, invariants, tenant/RBAC policies, domain events.', 'Entidades, value objects, invariantes, políticas tenant/RBAC, eventos de domínio.'), implementation: t(locale, 'Pure types, policies, and business rules inside the bounded context.', 'Tipos puros, políticas e regras de negócio dentro do contexto delimitado.'), outcome: t(locale, 'I/O, environment variables, logging, HTTP status codes.', 'I/O, variáveis de ambiente, logging, status code HTTP.') },
              { focus: t(locale, 'Output adapter', 'Adaptador de saída'), when: t(locale, 'Persistence, queues, external providers, cache, files, email, and broker-specific details.', 'Persistência, filas, provedores externos, cache, arquivos, email e detalhes de broker.'), implementation: t(locale, 'Ports and contracts owned by the application layer.', 'Ports e contratos pertencentes à camada de aplicação.'), outcome: t(locale, 'Domain decisions that belong in use-cases or entities.', 'Decisões de domínio que pertencem a casos de uso ou entidades.') },
            ]}
          />
        </div>
      </Band>
      <Band>
        <div className={classes.twoColumn}>
          <div className={classes.prose}>
            <h2>{t(locale, 'Contracts survive topology changes', 'Contratos sobrevivem a mudanças de topologia')}</h2>
            <p>{t(locale, 'A domain service can consume and produce messages as an independent worker. Move it out of process without making its consumers import the implementation.', 'Um serviço de domínio pode consumir e produzir mensagens como worker independente. Retire-o do processo sem obrigar consumidores a importar a implementação.')}</p>
            <ProofList items={[
              t(locale, 'In-process calls can become brokered messages through the same subject and payload contract.', 'Chamadas em processo podem virar mensagens em broker pelo mesmo subject e payload.'),
              t(locale, 'REST fallback can stay available while realtime or gRPC handles the primary interaction.', 'Fallback REST pode continuar disponível enquanto realtime ou gRPC lida com a interação principal.'),
              t(locale, 'Workers own process lifecycle; contracts own compatibility.', 'Workers controlam o ciclo de vida do processo; contratos controlam compatibilidade.'),
            ]} />
          </div>
          <CodeShowcase samples={codeSamples.start.slice(1, 2)} title="Message Mediator" />
        </div>
      </Band>
      <Band alternate>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Topology evolution', 'Evolução de topologia')}
            title={t(locale, 'Scale by extracting boundaries, not by rewriting features', 'Escale extraindo limites, não reescrevendo features')}
          />
          <DetailGrid items={[
            { eyebrow: t(locale, 'Stage 1', 'Etapa 1'), title: t(locale, 'Modular monolith', 'Monólito modular'), description: t(locale, 'One deployable, multiple bounded contexts, shared composition root, one operational surface for the first release.', 'Um deploy, múltiplos contextos delimitados, composition root compartilhada, uma superfície operacional para o primeiro release.'), meta: t(locale, 'Best for first product proof', 'Melhor para primeira prova de produto'), icon: <IconBuildingFactory2 /> },
            { eyebrow: t(locale, 'Stage 2', 'Etapa 2'), title: t(locale, 'Dedicated runtime process', 'Processo de runtime dedicado'), description: t(locale, 'Move realtime, gRPC, or background behavior into a separate process while REST remains available as fallback.', 'Mova realtime, gRPC ou comportamento background para processo separado enquanto REST permanece como fallback.'), meta: t(locale, 'Best for latency or long-running work', 'Melhor para latência ou trabalho longo'), icon: <IconMessages /> },
            { eyebrow: t(locale, 'Stage 3', 'Etapa 3'), title: t(locale, 'Extracted service', 'Serviço extraído'), description: t(locale, 'Promote a bounded context into its own service with its own database adapter, deployment profile, broker, and CI evidence.', 'Promova um contexto delimitado para seu próprio serviço com adaptador de banco, perfil de deploy, broker e evidência de CI.'), meta: t(locale, 'Best for team ownership', 'Melhor para ownership de time'), icon: <IconTopologyStar3 /> },
          ]} />
        </div>
      </Band>
      <Band>
        <div className={classes.sectionStack}>
          <SectionHeading
            eyebrow={t(locale, 'Architecture governance', 'Governança arquitetural')}
            title={t(locale, 'The repository checks the rules humans forget', 'O repositório checa as regras que humanos esquecem')}
            description={t(
              locale,
              'The architecture page is only meaningful because the repo enforces it. Jumentix ships tests and scripts that fail when boundaries, contracts, coverage, or docs drift.',
              'A página de arquitetura só tem valor porque o repo a aplica. O Jumentix entrega testes e scripts que falham quando limites, contratos, cobertura ou docs saem de sincronia.',
            )}
          />
          <DetailGrid items={[
            { title: t(locale, 'Boundary checks', 'Checagens de limite'), description: t(locale, 'Hexagonal and workspace boundary scripts reject controller-to-infra shortcuts and cross-package imports that break ownership.', 'Scripts de limite hexagonal e workspace rejeitam atalhos controller-para-infra e imports entre pacotes que quebram ownership.'), meta: 'arch:check-*', icon: <IconGitBranch /> },
            { title: t(locale, 'Contract checks', 'Checagens de contrato'), description: t(locale, 'OpenAPI route resolution, AsyncAPI exports, generated docs, and SDK paths keep external interfaces synchronized.', 'Resolução de rotas OpenAPI, exportações AsyncAPI, docs gerados e caminhos de SDK mantêm interfaces externas sincronizadas.'), meta: 'oas:check-routes', icon: <IconRoute /> },
            { title: t(locale, 'Quality evidence', 'Evidência de qualidade'), description: t(locale, 'Branch-aware gates choose focused suites for task branches and full suites for release contexts, preserving speed and discipline.', 'Gates por branch escolhem suítes focadas para branches de tarefa e suítes completas para release, preservando velocidade e disciplina.'), meta: 'ci:gate:branch', icon: <IconShieldCheck /> },
          ]} />
        </div>
      </Band>
      <QualityEvidenceBand locale={locale} alternate />
      <PM2OperationsBand locale={locale} />
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
      <PageHero locale={locale} eyebrow="Roadmap" title={t(locale, 'A public path from platform foundation to software factory', 'Um caminho público da fundação da plataforma à fábrica de software')} description={t(locale, 'The canonical repository remains the source of truth. This view explains the product direction without hiding the implementation backlog.', 'O repositório canônico permanece como fonte da verdade. Esta visão explica a direção do produto sem ocultar o backlog de implementação.')} />
      <Band><ol className={classes.timeline}>{phases.map(([phase, title, description]) => <li key={phase}><strong>{phase}</strong><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol><div className={classes.sectionActions}><ActionLink href={`${repositoryUrl}/milestones`} external>{t(locale, 'Open live roadmap', 'Abra o roadmap ao vivo')}</ActionLink></div></Band>
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
