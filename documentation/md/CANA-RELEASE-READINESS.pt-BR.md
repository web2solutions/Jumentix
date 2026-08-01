# Cana — Prontidão para Release

Situação do `@jumentix/cana` frente ao release, e o que cada item pendente exige.

Isto não é uma lista de intenções. Cada linha diz o que foi **medido**, e cada
lacuna diz quem pode fechá-la. Um documento de prontidão que reporta planos como
progresso é pior do que nenhum, porque é o artefato a partir do qual a decisão de
release é tomada.

Inglês: [CANA-RELEASE-READINESS.md](./CANA-RELEASE-READINESS.md)

---

## 1. Resumo

**Não está pronto para publicar.** Há uma lacuna bloqueante, e ela não é defeito
de código: não existe evidência entre navegadores. O motor está completo, testado
e empacotado; o que falta é prova de que ele se comporta nos navegadores que
pretende atender.

| Área | Situação |
|---|---|
| Motor (ciclo de vida, CRUD, consultas, transações, eventos, hooks) | Completo, testado |
| Recuperação de falhas (livro de operações) | Completo, testado |
| Worker host e protocolo | Completo, testado sobre porta de mensagem real |
| Política de durabilidade e despejo | Completa, testada contra estados construídos |
| Integração com a factory de clientes Jumentix | Completa, testada |
| Empacotamento (CJS/ESM duplo, tipos, licença) | Completo, testado |
| Documentação (projeto, uso, EN + PT-BR) | Completa |
| Concordância diferencial com o Dexie | Completa, 18/18 concordam |
| **Conformidade entre navegadores** | **Não executada — bloqueante** |
| Desempenho com volume real de dados | Forma de complexidade medida; latência absoluta não |
| Verificação em CI de qualquer item acima | **Nunca executada — cobrança** |

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

## 3. A lacuna bloqueante: conformidade entre navegadores (JUM-417)

Todo teste automatizado roda sobre `fake-indexeddb`. É um shim fiel, e o harness
diferencial mostra que Cana e Dexie concordam nele — mas não é um navegador. Não
tem cota real, nem despejo, nem `navigator.storage`, nem thread separada.

Logo, os seguintes pontos estão **não verificados em navegador algum**:

- reporte de cota real e o limiar `nearQuota`
- despejo de fato, e a lápide sobrevivendo a ele
- o caminho `Unavailable` em navegação privada
- o motor rodando dentro de um `Worker` real
- dados sobrevivendo a um reload de página
- as peculiaridades do IndexedDB do Safari em particular, historicamente as que
  mais divergem

### Como fechá-la

A suíte de conformidade já existe e já está verificada. É uma função simples
sobre um ambiente injetado, `runConformance`, exercitada pela suíte unitária para
não apodrecer — de modo que, ao ser apontada para um navegador, a única variável
nova é o navegador.

```bash
cd packages/cana
bun run build
bunx serve conformance    # ou qualquer servidor estático
```

Abra a página em cada navegador da matriz e clique em **Run conformance**. O
relatório é impresso na página e no console como JSON, para que um driver possa
raspá-lo.

Verificações que um shim não consegue responder reportam `skipped` com motivo,
nunca `passed`, e `describeCoverage()` se recusa a resumir uma execução parcial
como limpa.

### A matriz

| Navegador | Mínimo | Por que está na lista |
|---|---|---|
| Chrome / Edge | 110 | Maior participação; a implementação de referência |
| Firefox | 110 | Implementação independente de IndexedDB |
| Safari (macOS) | 16.4 | Historicamente o mais divergente |
| Safari (iOS) | 16.4 | Política de armazenamento separada e despejo muito mais agressivo |
| Chrome Android | 110 | Comportamento de despejo difere do desktop |

O Safari é o que mais importa: ele não teve `IDBFactory.databases()` por anos —
exatamente o caso para o qual o classificador de despejo foi corrigido neste
épico.

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

**Nenhum job de CI jamais rodou neste trabalho.** Todo push para a PR #15 falhou
no runner em menos de dois segundos:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

Essas marcas vermelhas são **pendentes, não falhas** — nenhum teste executou,
então não são evidência em nenhuma direção. Sob o Requisito 065 não podem ser
descritas como passando, e também não podem ser descartadas como "não
relacionadas".

Desbloquear depende do dono da conta, em **Settings → Billing & plans**.

Separadamente, `agent-registry:check` é a única falha dentro de
`bun run ci:gate`. É pré-existente no `dev` em `077030d` — verificado rodando lá
— e depende do dono do JUM-568 publicar o espelho local para cima e re-fixar o
pin. `bun run agent-registry:sync` **não** deve ser usado: ele escreve o remoto
por cima do local e descartaria a evidência.

---

## 7. Portão de release

A publicação deveria aguardar todos estes itens:

1. **Execução de conformidade entre navegadores**, com o relatório anexado ao
   release. Dono: quem tiver os dispositivos. Este é o item bloqueante.
2. **CI verde**, o que exige antes a resolução da cobrança.
3. **`agent-registry:check`** resolvido pelo seu dono.
4. **Uma linha de base de latência em navegador real.** A forma de complexidade
   está medida; os números absolutos não, e não podem vir de um shim em memória.

Os itens 1 e 4 são os que mudam o que uma aplicação pode honestamente afirmar aos
seus usuários. Os itens 2 e 3 são portões de processo que ainda assim precisam
estar verdes para que um release seja defensável.

### O que é seguro hoje

Usar o Cana **dentro deste monorepo**, no Chrome, com as ressalvas do documento
de projeto compreendidas. Isso é uma afirmação materialmente diferente de
publicá-lo no npm para consumidores arbitrários em navegadores arbitrários, e
essa diferença é o assunto deste documento.

---

## 8. Relacionados

- [CANA-INDEXEDDB-ADAPTER.pt-BR.md](./CANA-INDEXEDDB-ADAPTER.pt-BR.md) —
  fundamentação de projeto e a lista completa do que **não** está comprovado
- [CANA-USAGE-GUIDE.pt-BR.md](./CANA-USAGE-GUIDE.pt-BR.md) — referência de API e guia
- `packages/cana/conformance/index.html` — o executor de conformidade no navegador
- `packages/cana/test/` — as suítes por trás de cada número acima
