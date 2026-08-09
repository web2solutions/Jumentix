<!--
Arquivo gerado automaticamente a partir de: documentation/md/SERVICE-MANAGEMENT-DESIGN-SYSTEM-PWA.md
Idioma alvo: Português (Brasil)
-->
# Design system e shell PWA do Service Management

Este é o documento E7 da cadeia de documentação E1–E8 do Service Management
([JUM-490](https://linear.app/jumentix/issue/JUM-490/docs-e7-documentation-design-system-and-pwa-shell)).
Ele documenta as duas superfícies que definem a *aparência* do designer e
*como ele chega à máquina do usuário*: a **adoção do design system**
([JUM-488](https://linear.app/jumentix/issue/JUM-488/feature-adopt-jumentix-design-system-and-storybook-coverage))
e o **shell PWA instalável**
([JUM-489](https://linear.app/jumentix/issue/JUM-489/feature-installable-pwa-shell-service-worker-manifest))
— exatamente como o código se comporta hoje, já com o fechamento da lacuna de
sincronização multi-abas
([JUM-485](https://linear.app/jumentix/issue/JUM-485/feature-write-event-integration-multi-tab-sync-via-cana-message))
entregue dentro do shell.

Parte deste documento é voltada a contribuidores (como a camada de tokens se
mantém sincronizada, como adicionar um componente sem reintroduzir estilos ad
hoc) e parte é deliberadamente **voltada ao usuário**: o modelo de teclado e
leitor de tela, como instalar o designer como aplicativo, o que significa o
aviso de atualização e como se recuperar de um cache travado sem saber o que é
um service worker. Um caminho de teclado que existe mas não é documentado é um
caminho que ninguém encontra.

Dois limites deliberados:

- **A história dos dados é referenciada, não duplicada.** Onde o trabalho do
  designer vive (Cana), como a migração do localStorage se comportou e o que
  offline significa para os *dados* pertencem ao documento E6
  ([JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior)),
  com o contrato da porta de armazenamento no documento E3,
  [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md).
  Este documento estabelece a fronteira shell↔dados uma única vez — porque a
  história de atualização e recuperação é incompreensível sem ela — e não
  repete a história da persistência.
- **A fonte visual da verdade vive no website.** O inventário de componentes,
  as restrições de design e o fluxo de trabalho do Storybook pertencem ao
  documento
  [Design System e Storybook](../../apps/jumentix-website/documentation/DESIGN-SYSTEM-AND-STORYBOOK.pt-BR.md)
  do website. Este documento cobre a *adoção* desse sistema pelo designer;
  ele não o redefine.

## Adoção do design system na camada de tokens (JUM-488)

O designer é uma SPA vanilla sem build, servida a partir de sua própria raiz
estática. Ele não pode importar os componentes React do website, portanto a
adoção acontece na **camada de tokens**: propriedades customizadas e idiomas
compartilhados, não componentes compartilhados.

### Quais tokens o designer usa

[`apps/service-management/tokens.css`](../../apps/service-management/tokens.css)
é uma cópia vendorizada do
[`components/design-system/tokens.css`](../../apps/jumentix-website/components/design-system/tokens.css)
do website: as rampas de cor (`--jtx-blue-*`, `--jtx-green-*`,
`--jtx-coral-*`, `--jtx-yellow-*`), tinta e texto esmaecido, superfícies e
linhas, fundo de superfície de código, raios, sombras, a escala de espaçamento
de 4–48 px, `--jtx-motion-fast`, `--jtx-content-width`, as sobrescritas de
tema escuro sob `:root.dark`, a proteção de `prefers-reduced-motion` e as
pilhas tipográficas `--jtx-font-sans` / `--jtx-font-mono` (Inter e IBM Plex
Mono — a mesma voz tipográfica do tema Mantine do website).

[`styles.css`](../../apps/service-management/styles.css) resolve **todo valor
cosmético** — cor, tipografia, raio, sombra, espaçamento, movimento — para
esses tokens, carrega depois de `tokens.css` no
[`index.html`](../../apps/service-management/index.html) e escopa suas regras
em nível de elemento sob `.service-management-shell` (com `:where()`) para que
a cascata exata do app se aplique quando o Storybook do website embute a folha
de estilo. O que deliberadamente permanece literal:

- **A geometria estrutural da qual a matemática do canvas depende** — o canvas
  de 3200×2200, a grade de 24 px, domínios de 520 px, entidades de 190 px —
  fixada por
  [`src/model/modelQueries.js`](../../packages/designer-core/src/model/modelQueries.js)
  e sua suíte de unidade. Esses números são comportamento, não cosmética.
- **A densidade compacta dos inspetores** (espaços de 5–7 px nos painéis
  densos), que não tem equivalente em token.
- **Os literais do tom de atenção** — o estilo de erro segue o idioma de
  "atenção" do design system: superfície `--jtx-coral-50` com texto `#a32e1a`
  e borda `#ffc0ad` da rampa coral, os mesmos literais que o componente
  `StatusBadge` do website usa (não existe token de texto da rampa coral a
  referenciar).

Além das cores, o designer segue os idiomas de interação do sistema: o anel de
foco é o anel `:focus-visible` do design system (3 px `--jtx-blue-200`, offset
de 2 px) em todo input, select e botão; o hover segue o idioma de ação
secundária (superfície blue-50, borda blue-200); o movimento respeita
`prefers-reduced-motion` por meio da proteção vendorizada.

### Como os tokens se mantêm sincronizados — a regra da cópia vendorizada

`apps/service-management/tokens.css` é uma **cópia**, e cópias divergem a
menos que uma regra o proíba. A regra está escrita no próprio cabeçalho do
arquivo:

> FONTE DA VERDADE: `apps/jumentix-website/components/design-system/tokens.css`.
> Mantenha os valores dos tokens byte a byte idênticos ao arquivo do website;
> mudanças de token chegam primeiro no arquivo do website e são espelhadas aqui.

Dois corolários que um contribuidor precisa conhecer:

- **O arquivo do website é estendido de forma aditiva, nunca a partir do
  designer.** Quando o designer precisou das pilhas tipográficas como tokens
  (JUM-488), elas foram adicionadas ao arquivo do *website* — porque a cópia
  vendorizada existe, consumidores não-Mantine herdam a mesma voz tipográfica
  — e depois espelhadas para baixo. Um token adicionado apenas à cópia do
  designer seria invisível para o website e silenciosamente apagado no próximo
  espelhamento.
- **O wrapper `.jtx-story-canvas` do Storybook é exclusivo do website** e é
  intencionalmente omitido da cópia vendorizada — é a única diferença
  sancionada entre os dois arquivos.

### Como adicionar um componente sem reintroduzir estilos ad hoc

1. **Reutilize os tokens existentes antes de introduzir um novo valor.** Um
   literal cosmético em `styles.css` é uma regressão ao estado anterior ao
   JUM-488; se nenhum token servir, adicione um token *semântico* primeiro ao
   `tokens.css` do website e espelhe-o na cópia vendorizada na mesma mudança.
2. **Mantenha a geometria estrutural literal apenas quando a matemática do
   canvas for dona dela** — e quando for, o número pertence ao conjunto fixado
   de `modelQueries.js`, não inventado por componente.
3. **Escope regras em nível de elemento sob `.service-management-shell`.** Uma
   regra sem escopo vaza para o chrome do Storybook no momento em que a story
   a monta.
4. **Adicione ou estenda uma story** na cobertura Storybook do designer
   (abaixo) para que a nova superfície seja exercitada pelos mesmos gates de
   build estático, smoke e acessibilidade do restante.

### Onde o inventário do Storybook vive

O designer não tem Storybook próprio; sua cobertura vive no workspace do
website como
[`components/service-management-designer/ServiceManagementDesigner.stories.tsx`](../../apps/jumentix-website/components/service-management-designer/ServiceManagementDesigner.stories.tsx),
que importa os verdadeiros `tokens.css` e `styles.css` do designer e monta sua
marcação real. Oito stories cobrem os estados-chave da UI: `TabShell`,
`WorkspaceControls`, `DomainCanvas` (entidades, arestas, mini-mapa),
`StatusSurfaces` (as superfícies não bloqueantes do JUM-543),
`EntityInspector`, `PanelsAndLists`, `CodePreviews` e `PwaUpdateBanner` (o
aviso de atualização do JUM-489). Como as folhas de estilo são dirigidas por
tokens, a alternância claro/escuro do addon-themes se aplica ao designer
exatamente como se aplica aos componentes do website.

O inventário é enforced, não aspiracional:
[`scripts/storybook-smoke.mjs`](../../apps/jumentix-website/scripts/storybook-smoke.mjs)
exige os oito IDs de story do designer e um catálogo mínimo de 54 entradas, e
o addon de acessibilidade do Storybook está configurado para reportar violações
como erros (`a11y: { test: 'error' }` em
[`.storybook/preview.tsx`](../../apps/jumentix-website/.storybook/preview.tsx)).
O Storybook é exclusivamente um gate do workflow do website — executado pelo
`.github/workflows/website.yml` com escopo de caminho, nunca pela matriz de
testes do monorepo — com os comandos `bun run website:storybook`,
`website:storybook:build` e `website:storybook:smoke` a partir da raiz. O fluxo
de trabalho completo, a propriedade e as restrições de design estão
documentados em
[Design System e Storybook](../../apps/jumentix-website/documentation/DESIGN-SYSTEM-AND-STORYBOOK.pt-BR.md).

## Acessibilidade: o modelo de teclado e leitor de tela

Esta seção é voltada ao usuário. Tudo nela é operável hoje e corresponde ao
comportamento que o JUM-488 entregou; a camada semântica é exercitada pelo
gate de acessibilidade do Storybook (violações falham como erros), e a própria
alternância de abas é exercitada de ponta a ponta pelas suítes de navegador
abaixo.

### A barra de abas é uma tablist de verdade

As quatro abas formam uma tablist WAI-ARIA (`role="tablist"`, `role="tab"`,
`aria-selected`, `aria-controls` no
[`index.html`](../../apps/service-management/index.html); comportamento em
[`src/ui/tabs.js`](../../apps/service-management/src/ui/tabs.js)):

- **Um único ponto de tabulação para toda a barra.** O `tabindex` móvel coloca
  apenas a aba ativa na ordem de tabulação; as demais são alcançáveis pelas
  setas, não por pressionamentos repetidos de Tab.
- **As setas movem e ativam.** `ArrowLeft`/`ArrowRight` percorrem as abas (com
  wrap nas extremidades), `Home`/`End` saltam para a primeira/última aba, e a
  aba focada ativa automaticamente — não há etapa separada de "confirmar".
- **Espaço e Enter mantêm seu comportamento nativo** em todo botão, incluindo
  as abas.

### Alcançando o canvas: o skip link

O primeiro ponto de tabulação da página é o **skip link** ("Skip to canvas
workspace"), que salta o cabeçalho e a barra de abas direto para o workspace
(`#workspace-main`). Ele é invisível até receber foco; o anel de foco do
design system funciona também como sua affordance de revelação.

### O equivalente não visual do canvas

O canvas de domínios é uma superfície visual, mas toda operação estrutural tem
um caminho de teclado — a seleção nunca é exclusiva do ponteiro:

- **Selecione sem o ponteiro.** Cada entrada das listas da barra lateral
  (domínios, relacionamentos) é um `<button>` de verdade, renderizado por
  [`src/ui/inspectors.js`](../../apps/service-management/src/ui/inspectors.js),
  e o campo "Search entity" com seu botão **Find** seleciona uma entidade e
  rola o canvas até ela — de modo que Tab + Enter seleciona uma entidade sem
  tocar no canvas.
- **Mova a seleção com as setas.** Com uma entidade selecionada e nenhum input
  focado, as setas a deslocam 8 px (alinhado ao snap), `Shift`+seta 16 px — a
  mesma matemática de snap do arrasto por ponteiro (o mapa global de teclado
  do `script.js`).
- **Crie relacionamentos sem o arrasto.** `Alt+R` inicia o modo de escolha de
  relacionamento a partir da entidade selecionada (o equivalente em teclado do
  arrasto de âncora); `Escape` cancela o modo de escolha de relacionamento ou
  um arrasto de âncora em andamento, e limpa o relacionamento selecionado.
- **Organize e inspecione.** `Alt+L` aplica o auto-layout, `Alt+V` alterna a
  visão compacta, `Ctrl`/`Cmd`+roda do mouse aplica zoom, e a barra de
  ferramentas do workspace (zoom, fit, reset, snap, compacto, canvas grande) é
  feita de botões comuns. Os três interruptores de visão (visão compacta,
  snap, canvas grande) são toggles `aria-pressed` —
  [`src/ui/canvas.js`](../../apps/service-management/src/ui/canvas.js) mantém o
  estado pressionado em sincronia com as flags de visão que eles alternam.
- **Histórico de edição e exclusão.** `Ctrl`/`Cmd+Z` desfaz, `Ctrl`/`Cmd+Y`
  (ou `Ctrl`/`Cmd+Shift+Z`) refaz; `Delete`/`Backspace` remove o
  relacionamento selecionado e, após um gate de confirmação, a entidade
  selecionada.
- **Espaço ainda ativa botões.** O modificador de panorâmica com Espaço
  pressionado só engata a partir de alvos não interativos, de modo que um
  usuário de teclado operando um botão focado com Espaço aciona o botão, nunca
  a panorâmica.

### O que um leitor de tela anuncia

- **Uma única live region polida** (`#status-region`, `role="status"`,
  `aria-live="polite"`) anuncia mensagens de validação e resultados de API — o
  contrato de superfície de status do JUM-543 que o documento E5 descreve;
  avisos de informação se ocultam sozinhos, erros persistem.
- **Uma linha de status de seleção** (`#selection-status`, também
  `role="status"`) anuncia qual domínio está selecionado a cada mudança de
  seleção.
- **Linhas de status por painel** (prévia do PM2, configuração do serviço,
  ambiente de runtime) também são live regions, de modo que falhas são
  anunciadas onde o usuário está olhando.
- **Todo controle tem um nome acessível** — rótulo visível ou `aria-label` —
  e o banner de atualização do PWA é `role="alert"`, de modo que o aviso de
  atualização é anunciado, não apenas exibido.

## Instalando o designer como aplicativo (JUM-489)

O designer é um PWA instalável. As peças de instalabilidade são
[`manifest.webmanifest`](../../apps/service-management/manifest.webmanifest)
(nome "Jumentix Service Management", nome curto "Service Mgmt", display
`standalone`, start URL e escopo `./`, tema/fundo `#0f172a` e ícones SVG + PNG
incluindo uma variante maskable de 512 px e o ícone de toque da Apple, todos
sob [`icons/`](../../apps/service-management/icons)) e o service worker
([`sw.js`](../../apps/service-management/sw.js), um script clássico servido da
raiz do app para que seu escopo seja o app inteiro), registrado pelo módulo do
lado da página
[`src/pwa/pwaShell.js`](../../apps/service-management/src/pwa/pwaShell.js)
por meio de um pequeno módulo inline ao final do `index.html`.

**Como instalar** — o designer é servido pelo
[`server.js`](../../apps/service-management/server.js), por padrão em
`http://127.0.0.1:3200`:

- **Navegadores Chromium (Chrome, Edge):** a affordance de instalação na barra
  de endereço, ou a entrada "Instalar" / "Salvar e compartilhar" do menu do
  navegador.
- **Safari no macOS:** Arquivo → "Adicionar ao Dock". **Safari no iOS:**
  Compartilhar → "Adicionar à Tela de Início".
- **Qualquer outro navegador moderno:** o designer funciona identicamente em
  uma aba comum; a instalação é um aprimoramento, nunca um requisito.

Deliberadamente **não há botão de instalação customizado** no app — a
instalação é a UI nativa do navegador, e o app nunca a intercepta.

**O que a instalação muda:** o designer abre em janela própria (display
standalone) com ícone próprio, e o shell é pré-cacheado para carregar offline
(próxima seção). **O que a instalação não muda:** os recursos, os dados ou a
cadência de atualização — o app instalado é o mesmo app, servido e atualizado
pelos mesmos mecanismos da aba.

## Atualizações e recuperação — escrito para o usuário

Um shell cache-first é um cache sem expiração que o usuário não consegue ver,
portanto o caminho de atualização é a substância do trabalho de PWA, não uma
consideração tardia.

**Como o designer se atualiza.** O shell é pré-cacheado sob um **nome de cache
versionado** (`service-management-shell@<versão>`; `SHELL_VERSION` no `sw.js`,
incrementado a cada mudança do shell), e o worker nunca ativa uma nova versão
por conta própria — uma troca silenciosa no meio da edição substituiria código
sob estado de edição não salvo. Quando uma atualização publicada chega:

1. A nova versão instala e **aguarda**; a versão que você está executando
   continua servindo. Nada muda no meio da sessão.
2. Um banner aparece: **"A new version of Service Management is available."**
   com três ações — **Reload to update**, **Later**, **Reset app shell**. O
   banner é `role="alert"`, portanto é anunciado a leitores de tela.
3. **Reload to update** troca para a nova versão e recarrega a página — este é
   o único caminho que ativa uma atualização. **Later** descarta o banner sem
   atualizar; o aviso retorna na próxima carga, de modo que descartar nunca o
   prende a uma versão obsoleta.

**Recuperando-se de um cache travado.** Se o shell um dia se comportar mal —
uma instalação do shell offline que falhe exibe um banner próprio ("The
offline shell failed to install … The designer still works online.") — a ação
**Reset app shell** é o caminho de recuperação, e não exige saber o que é um
service worker: ela desregistra o worker, apaga **apenas** os caches
`service-management-shell@*` e recarrega. A próxima carga busca um shell novo
no servidor. O reset nunca toca nos dados do designer, que vivem em um
armazenamento diferente (a fronteira abaixo).

**Comprovado por:**
[`pwaShell.test.ts`](../../apps/backend-template/test/unit/service-management/pwaShell.test.ts)
(handlers do worker, fluxo de atualização, recuperação — com fakes injetados,
incluindo a verificação em disco de que cada entrada de pré-cache commitada
existe) e
[`pwaShell.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/pwaShell.browser.integration.test.ts),
que roda contra o servidor real em um navegador WebKit real: content types do
manifest e do worker, concordância pré-cache↔manifest estático (o alinhamento
do JUM-463 — a lista de pré-cache, incluindo a entrada `designerSync.js` do
JUM-485 e o bundle Cana gerado, deve ser exatamente o que o servidor serve),
registro sob o nome de cache versionado, **o shell carregando e permanecendo
interativo com o servidor efetivamente morto** (um servidor realmente parado,
não um modo offline emulado) e o fluxo de atualização completo — aviso
exibido, nenhuma troca silenciosa, caches obsoletos limpos na ativação.

**Escopo offline.** Com a rede desabilitada o **shell** carrega e permanece
interativo — esse é todo o contrato offline do trabalho de PWA. O worker serve
o shell pré-cacheado em cache-first e nada mais: respostas de `/api/`,
requisições não-GET e requisições cross-origin passam direto para a rede (e
falham naturalmente offline), e **zero dado de aplicação é cacheado** — uma
cópia de conveniência na Cache API seria um fallback pela porta dos fundos,
com garantias mais fracas que o store que ela sombreia. O que offline
significa para os seus *dados* é a história do Cana, contada pelo documento
E6.

## A fronteira de armazenamento: o que instalar não faz

**Instalar o designer não faz backup do seu trabalho.** O shell e os dados são
armazenamentos separados com ciclos de vida separados:

- O **shell** (HTML, CSS, JS, manifest, ícones) vive na Cache API sob
  `service-management-shell@*` — descartável, regenerável a partir do servidor
  a qualquer momento, e exatamente o que "Reset app shell" apaga.
- Os **dados** (seus designs) vivem no banco de dados Cana — nunca cacheados
  pelo service worker, nunca tocados por "Reset app shell".

Uma assimetria que todo usuário deve conhecer: a opção do próprio navegador
**"limpar dados do site"** (ou limpar dados de navegação desta origem) remove
**ambos** — os caches do shell *e* o banco de dados Cana. A presença do shell
nunca implica que seus designs estejam seguros; não há cópia do seu trabalho
no shell para servir de fallback. Exporte seus designs pelos exportadores do
designer quando quiser uma cópia durável.

A história completa dos dados — a adoção do Cana, a migração unidirecional do
localStorage e seu download de backup, a sincronização multi-abas e o
comportamento offline dos dados — pertence ao documento E6
([JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior));
o contrato da porta de armazenamento está em
[Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md)
(E3) e as regras de uso do Cana no
[Guia de uso do Cana](./CANA-USAGE-GUIDE.pt-BR.md). Este documento estabelece
a fronteira uma única vez e defere a eles em vez de manter uma segunda
explicação, que divergiria.

## O que este documento deliberadamente não cobre

- **A história completa dos dados** — o E6
  ([JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior))
  e o documento E3 são seus donos; apenas a fronteira shell↔dados é
  estabelecida aqui.
- **O inventário de componentes e as restrições de design do website** —
  pertencem a
  [Design System e Storybook](../../apps/jumentix-website/documentation/DESIGN-SYSTEM-AND-STORYBOOK.pt-BR.md);
  este documento cobre a adoção, na camada de tokens, desse sistema pelo
  designer.
- **O console de operações e seu contrato de superfície de status** — o
  documento E5,
  [Console de operações do Service Management](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md);
  o modelo de live regions é resumido aqui apenas até onde a história do
  leitor de tela exige.
- **As regras do manifest de servir estático** (boot-only vs on-miss) —
  documentadas no [README do aplicativo](../../apps/service-management/README.pt-BR.md);
  a concordância pré-cache↔manifest estático é mencionada aqui apenas porque
  os testes de PWA a fixam.

## Referências

- Camada de tokens: [`apps/service-management/tokens.css`](../../apps/service-management/tokens.css) (vendorizada; fonte da verdade [`components/design-system/tokens.css`](../../apps/jumentix-website/components/design-system/tokens.css)), [`styles.css`](../../apps/service-management/styles.css), [`index.html`](../../apps/service-management/index.html)
- Comportamento de acessibilidade: [`src/ui/tabs.js`](../../apps/service-management/src/ui/tabs.js), [`src/ui/canvas.js`](../../apps/service-management/src/ui/canvas.js), [`src/ui/inspectors.js`](../../apps/service-management/src/ui/inspectors.js), o mapa global de teclado em [`script.js`](../../apps/service-management/script.js); geometria estrutural fixada por [`src/model/modelQueries.js`](../../packages/designer-core/src/model/modelQueries.js)
- Cobertura Storybook: [`ServiceManagementDesigner.stories.tsx`](../../apps/jumentix-website/components/service-management-designer/ServiceManagementDesigner.stories.tsx), [`storybook-smoke.mjs`](../../apps/jumentix-website/scripts/storybook-smoke.mjs), [`.storybook/preview.tsx`](../../apps/jumentix-website/.storybook/preview.tsx)
- Shell PWA: [`manifest.webmanifest`](../../apps/service-management/manifest.webmanifest), [`sw.js`](../../apps/service-management/sw.js), [`src/pwa/pwaShell.js`](../../apps/service-management/src/pwa/pwaShell.js), [`icons/`](../../apps/service-management/icons), [`server.js`](../../apps/service-management/server.js)
- Suítes: [`pwaShell.test.ts`](../../apps/backend-template/test/unit/service-management/pwaShell.test.ts), [`pwaShell.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/pwaShell.browser.integration.test.ts), [`spaBoot.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/spaBoot.browser.integration.test.ts), [`modelQueries.test.ts`](../../apps/backend-template/test/unit/service-management/modelQueries.test.ts)
- Requisitos: [076](../../.agents/requirements/project/076-task-documentation-and-bilingual-governance.md) (paridade EN/PT)
- Documentos irmãos da cadeia E: [Contratos de ambiente de runtime](./RUNTIME-ENVIRONMENT-CONTRACTS.pt-BR.md) (E1), [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md) (E3), [Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md) (E4), [Console de operações do Service Management](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md) (E5), [Guia de uso do Cana](./CANA-USAGE-GUIDE.pt-BR.md), [Design System e Storybook](../../apps/jumentix-website/documentation/DESIGN-SYSTEM-AND-STORYBOOK.pt-BR.md) (website), [Aplicativo Service Management](./SERVICE-MANAGEMENT-APPLICATION.pt-BR.md)
- Linear: [JUM-488](https://linear.app/jumentix/issue/JUM-488/feature-adopt-jumentix-design-system-and-storybook-coverage), [JUM-489](https://linear.app/jumentix/issue/JUM-489/feature-installable-pwa-shell-service-worker-manifest), [JUM-485](https://linear.app/jumentix/issue/JUM-485/feature-write-event-integration-multi-tab-sync-via-cana-message), [JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior), [JUM-490](https://linear.app/jumentix/issue/JUM-490/docs-e7-documentation-design-system-and-pwa-shell)
