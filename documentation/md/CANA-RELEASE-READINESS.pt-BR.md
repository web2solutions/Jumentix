# Cana — Prontidão para Release

Situação do `@jumentix/cana` frente ao release, e o que cada item pendente exige.

Isto não é uma lista de intenções. Cada linha diz o que foi **medido**, e cada
lacuna diz quem pode fechá-la. Um documento de prontidão que reporta planos como
progresso é pior do que nenhum, porque é o artefato a partir do qual a decisão de
release é tomada.

Inglês: [CANA-RELEASE-READINESS.md](./CANA-RELEASE-READINESS.md)

---

## 1. Resumo

**Pronto dentro deste monorepo; o portão de publicação agora é uma questão de
latência de desempenho, não de correção.** A lacuna que bloqueava o release —
a ausência de evidência entre navegadores — está fechada. O motor está
completo, testado e empacotado, e agora está provado que ele se comporta da
mesma forma nos três motores de navegador que pretende atender. O que resta
aberto é uma linha de base de latência absoluta, que nenhum shim em memória
consegue produzir e que é a única coisa entre "seguro dentro deste monorepo" e
um release público no npm.

| Área | Situação |
|---|---|
| Motor (ciclo de vida, CRUD, consultas, transações, eventos, hooks) | Completo, testado |
| Recuperação de falhas (livro de operações) | Completo, testado |
| Worker host e protocolo | Completo, testado sobre porta de mensagem real |
| Política de durabilidade e despejo | Completa, testada contra estados construídos |
| Integração com a factory de clientes Jumentix | Completa, testada |
| Empacotamento (CJS/ESM duplo, tipos, licença) | Completo, testado |
| Documentação (projeto, uso, EN + PT-BR) | Completa |
| Concordância diferencial com o Dexie | Completa, 18/18 concordam, no navegador |
| **Conformidade entre navegadores** | **Completa — 284/284 no Chrome, Firefox e WebKit** |
| Desempenho com volume real de dados | Forma de complexidade medida em navegador real; latência absoluta não |
| Verificação em CI de qualquer item acima | **Roda a cada push/PR pela matriz de cobertura** |

---

## 2. O que foi medido

Os números abaixo vêm de `bun run test:unit` e de uma execução de cobertura na
branch, não de memória.

```
suíte unitária do repo     852 passaram, 117 suítes
suítes do cana             278 passaram, 16 suítes
cobertura do fonte cana    98,15 stmts / 93,01 branch / 97,61 funcs / 99,15 lines
eslint (cana + testes)     0 problemas
tsc --noEmit               passa
diferencial vs Dexie       18/18 concordam
```

### A cobertura não é exigida para este pacote

O `jest.config.js` define
`coveragePathIgnorePatterns: ['<rootDir>/packages/', …]`, então todo pacote do
workspace fica fora do gate de cobertura. Os números acima exigiram sobrescrever
isso na linha de comando.

Isso significa que um pacote pode subir sem teste nenhum e o gate continua verde.
É a mesma forma do JUM-557 e **não** foi alterado unilateralmente por esta
branch — afeta todos os pacotes do repositório e pertence a quem é dono da
política de cobertura.

---

## 3. Conformidade entre navegadores: medida, não mais bloqueante (JUM-417)

A execução de conformidade que esta seção descrevia como ausente agora existe, e
é uma matriz em vez de um único navegador. O `fake-indexeddb` foi removido do
pacote; todo teste comportamental roda sobre o IndexedDB do próprio navegador
através do Cypress, headless, sem shims.

**284 testes passam em cada um dos três motores**, cada execução contra a
implementação de armazenamento do próprio motor:

| Motor | Driver | Por que está na lista |
|---|---|---|
| Chromium (`chrome`) | Cypress | Maior participação; a implementação de referência |
| Gecko (`firefox`) | Cypress | Implementação independente de IndexedDB |
| WebKit | Cypress + `playwright-webkit` | O motor do Safari — historicamente o mais divergente |

A matriz é de motores, não de marcas: `chrome` cobre Chrome, Edge e Brave;
WebKit é o motor do Safari, aquele cuja política de cota e despejo é a mais
estrita dos três e a razão de existir desta issue. Safari (iOS) e Chrome
Android continuam específicos de dispositivo e são o único residual honesto —
os motores de desktop estão provados; as políticas de armazenamento móvel não,
e isso é declarado em vez de varrido para debaixo do tapete.

Os comportamentos que um shim não consegue responder estão agora verificados em
cada motor:

- reporte de cota real e o limiar `nearQuota`
- despejo de fato, e a lápide sobrevivendo a ele
- o caminho `Unavailable` em navegação privada
- o motor rodando dentro de um `Worker` real (suite dedicada, JUM-615)
- fallback localStorage quando o IndexedDB não abre (modo degradado explícito, JUM-615)
- dados sobrevivendo a um reload de página
- os casos-limite de `databases()` e de structured-clone do WebKit,
  historicamente os que mais divergem

Três defeitos que o fake antigo aceitava foram encontrados e corrigidos ao rodar
de verdade (PR #38): uma forma ilegal de invocação de `IDBFactory` que nenhum
navegador permite, uma lápide de armazenamento que se afirmava ausente e que
todo navegador constrói, e números de desempenho medidos contra um shim em
memória que não transferiam para nada.

### Como a matriz roda

Localmente, um motor por invocação (padrão `chrome`):

```bash
bun ci-cd/run-browser-tests.js --browser chrome    # ou firefox, ou webkit
```

Em CI o workflow `coverage` abre um job por motor e envia o LCOV de cada um como
artefato; o workflow SonarQube Cloud baixa os três e os mescla com
`ci-cd/merge-browser-coverage.js`. A mescla é uma união — um local atingido em
qualquer motor conta como coberto — de modo que os caminhos de armazenamento do
WebKit contam para o mesmo relatório que o Sonar lê, e o contrato de 99% é
cumprido pela matriz e não por um único navegador.

### Uma nota de harness específica do WebKit

O verificador de comandos privilegiados do WebKit recusa `cy.task` de qualquer
hook do Mocha, que era como a cobertura do navegador era originalmente escrita.
O arquivo de suporte agora envia `window.__coverage__` por POST para um servidor
loopback que o `setupNodeEvents` sobe para a execução — nenhum comando
privilegiado, então o contrato de cobertura vale no motor que mais precisa ser
medido, e não apenas nos que permitem a API conveniente.

---

## 4. Empacotamento

Verificado por `packages/cana/test/packaging.test.ts`, que
constrói o pacote e carrega o artefato em vez do alias do workspace.

| Item | Estado |
|---|---|
| `main` → `dist/index.js` (CommonJS) | sim |
| `module` / `exports.import` → `dist/index.mjs` (ESM) | sim |
| `types` → `dist/index.d.ts`, primeiro no mapa de exports | sim |
| `files` publica `dist`, README, LICENSE — não `src` | sim |
| `LICENSE.md` presente e coerente com o MIT declarado | sim |
| Dependências de runtime | **nenhuma** |
| `sideEffects: false` | sim |
| `prepublishOnly` limpa e depois constrói | sim |
| Construído com Bun (Req 096) | sim — `tsc` e depois `bun build` para o ESM |

O formato duplo não é otimização. O Cana é uma biblioteca de navegador, e um
pacote só-CommonJS não pode ser carregado por um `import` nativo — a página de
conformidade demonstrou isso concretamente antes de o build ESM ser adicionado.

O Dexie aparece apenas em `devDependencies`, como oráculo diferencial. Não é
dependência de runtime, e um teste garante que nunca se torne uma.

---

## 5. Desempenho: forma medida, latência não

`explain()` prova que uma consulta indexada abriu seu índice. Não prova nada
sobre velocidade, então agora existe uma linha de base que mede a parte que pode
ser honestamente medida aqui.

Seis verificações comparam 1.000 linhas contra 10.000 e limitam a **razão**, em
vez de afirmar um limiar em milissegundos. Um limite de relógio em runner
compartilhado é um teste instável que some em um mês — e sumir leva a cobertura
junto.

O que isso pega: uma varredura completa ficar 10x mais lenta com 10x os dados é
correto; uma consulta *indexada* fazer isso é o bug — o índice foi anunciado e
nunca usado, algo que nenhum teste de correção detecta, porque as linhas
retornadas são idênticas nos dois casos.

Medido e passando: consultas limitadas não escalam com o tamanho da tabela,
buscas indexadas não degradam além do conjunto de resultados que cresce,
`count()` é mais barato que ler as linhas, gets por chave independem do
tamanho, uma escrita em lote de 10.000 linhas completa, e um offset profundo
custa aproximadamente o mesmo que um raso.

**Nenhum número absoluto é afirmado, deliberadamente.** O `fake-indexeddb` é em
memória; o IndexedDB de um navegador é em disco, com perfil de custo
completamente diferente — uma medida de latência daqui seria inútil em produção.
O que transfere é a forma.

Uma linha de base de latência real ainda depende da execução em navegador (§3).
**Ninguém deve ser informado de que o Cana é rápido com base no que há neste
repositório hoje** — apenas que nada escala em uma forma que o tornaria lento.

---

## 6. CI

**O CI roda a matriz completa a cada push e pull request.** O bloqueio de
cobrança que antes deixava todo job pendente está resolvido. O workflow
`coverage` abre um job por motor (`chrome`, `firefox`, `webkit`), cada um
produzindo a execução no navegador e seu LCOV; a perna `chrome` também roda a
suíte Jest contra Redis e RabbitMQ reais e aplica os limiares 99/90/99/99. O
workflow SonarQube Cloud mescla os relatórios dos três motores e analisa a
união, de modo que o Quality Gate lê a matriz e não um único navegador. Ambos
os workflows estão verdes no `dev`.

O `agent-registry:check` também está resolvido: o espelho local em
`.agents/AGENT-REGISTRY.md` confere com a revisão canônica fixada em
`.agents/registry-source.json`, e a verificação passa no `dev`. A recriação de
integrações do JUM-568, da qual ele dependia, foi cancelada como fora de
escopo — nada neste portão ainda está pendente.

---

## 7. Portão de release

Dos quatro itens que antes bloqueavam a publicação, três estão fechados:

1. ~~**Execução de conformidade entre navegadores**~~ — feita: 284/284 no
   Chrome, Firefox e WebKit, a cada push/PR.
2. ~~**CI verde**~~ — feito: cobrança resolvida; a matriz e o Sonar rodam
   verdes no `dev`.
3. ~~**`agent-registry:check`**~~ — feito: o espelho confere com a revisão
   canônica fixada.
4. **Uma linha de base de latência em navegador real.** Ainda aberto. A forma
   de complexidade está medida; os números absolutos não, e não podem vir de um
   shim em memória. Este é o único portão restante entre "seguro dentro deste
   monorepo" e um release público no npm.

O item 4 é o único que ainda muda o que uma aplicação pode honestamente afirmar
aos seus usuários, e é uma afirmação de desempenho, não de correção.

### O que é seguro hoje

Usar o Cana **dentro deste monorepo**, nos motores Chromium, Gecko e WebKit,
com a ressalva de que a latência absoluta não está medida e as políticas de
armazenamento móvel (iOS Safari, Chrome Android) ainda não são exercitadas.
Isso continua uma afirmação materialmente diferente de publicá-lo no npm para
consumidores arbitrários, e a diferença agora se resume a uma única questão de
desempenho em vez de qualquer lacuna de correção.

---

## 8. Relacionados

- [CANA-INDEXEDDB-ADAPTER.pt-BR.md](./CANA-INDEXEDDB-ADAPTER.pt-BR.md) —
  fundamentação de projeto e a lista completa do que **não** está comprovado
- [CANA-USAGE-GUIDE.pt-BR.md](./CANA-USAGE-GUIDE.pt-BR.md) — referência de API e guia
- `packages/cana/conformance/index.html` — o executor de conformidade no navegador
- `packages/cana/test/` — as suítes por trás de cada número acima
