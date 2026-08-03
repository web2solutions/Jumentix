# Guia de Engenharia Bun

Referência canônica para os fluxos internos de engenharia sobre Bun. Entregável da task JUM-39 no Linear,
projeto `[Tooling] Replace Internal Node and pnpm Workflows with Bun`, sob o Requisito `096`.

Esta é a Issue de documentação dedicada do épico sob o Requisito `094`: o Projeto não pode ser concluído
antes que ela esteja Done.

## 1. Toolchain

O Bun é pinado exatamente. Uma versão, idêntica localmente e no CI — uma faixa de versões é como
"funciona na minha máquina" acaba commitado.

| Fonte de verdade | Valor |
| --- | --- |
| `.bun-version` | `1.3.14` |
| `package.json#packageManager` | `bun@1.3.14` |
| `package.json#engines.bun` | `>=1.3.14` |

O `ci-cd/check-bun-version.js` valida as três e falha fechado. Ele roda como `preinstall`, então é
propositalmente livre de dependências: num clone frio o `node_modules` ainda não existe, e exigir `semver`
ali faria o guard falhar por um motivo alheio ao toolchain.

```bash
bun run check-bun-version
```

## 2. Instalação

```bash
bun install                    # local, pode atualizar o bun.lock
bun install --frozen-lockfile  # CI, recusa alterar o lockfile
```

O `bun.lock` é commitado em formato texto. O CI sempre instala congelado. Os passos pnpm anteriores usavam
`--no-frozen-lockfile`, o que permitia ao CI resolver versões que o lockfile nunca registrou; esse buraco
está fechado.

Se o `--frozen-lockfile` falhar, o manifesto e o lockfile realmente divergem. Rode um `bun install` comum
deliberadamente, revise o diff do lockfile e commite — não recorra a uma flag que esconde a divergência.

### Pins de dependência são controles de segurança

Cada entrada em `package.json#overrides` existe porque um CVE ou uma incompatibilidade exigiu. Perder uma é
uma **regressão silenciosa de segurança**: nada quebra, a versão transitiva vulnerável simplesmente volta a
resolver.

O `ci-cd/check-dependency-override-integrity.js` congela a baseline — 16 pins, 1 resolution, 1 patch — e
falha fechado diante de um pin removido, uma faixa alterada, um seletor aninhado pnpm reintroduzido, um
arquivo de patch ausente, ou uma superfície pnpm ressuscitada.

```bash
bun run deps:check-overrides
```

**Seletores aninhados não existem no Bun.** A forma `"restify>find-my-way"` do pnpm é um nome de pacote
inválido tanto para o npm quanto para o Bun, então o pin fica silenciosamente inerte. Os sete seletores
aninhados foram convertidos em pins flat, o que é estritamente mais forte: um override flat se aplica a
todos os dependentes, não a um.

> **Não rode `bun install` com o `pnpm-workspace.yaml` presente.** O Bun o trata como entrada e sobrescreve
> valores conflitantes do `package.json` — medido: injetou `.` em `workspaces`, produziu a chave de patch
> corrompida `nextra-theme-docs@4.6.1@4.6.1`, injetou os sete seletores aninhados, e **rebaixou
> silenciosamente `overrides.postcss` de um deliberado `^8.5.23` de volta para `^8.5.18`**. As superfícies
> pnpm foram removidas; se alguma reaparecer, o guard de overrides falha.

## 3. Executando comandos

| Objetivo | Comando |
| --- | --- |
| Script do repositório | `bun run <script>` |
| Binário de pacote | `bun x <binário>` |
| Todos os workspaces | `bun run --filter '*' <script>` |
| Um workspace | `bun run --filter @jumentix/website <script>` |

O `bun run --filter` substitui o `pnpm -r --if-present`. Note que a ordem dos argumentos difere do pnpm, e o
comportamento é **melhor**: ele sai com 1 quando nenhum pacote casa com o filtro, onde o `--if-present` saía
com 0. Aquele silêncio era um falso verde.

## 4. `[run] bun = false` — leia antes de mudar

O `bunfig.toml` define `[run] bun = false`, deliberadamente. Colocar `true` redireciona *todo* binário com
shebang Node dentro do `node_modules` para o Bun, incluindo os de terceiros. O Jest não é compatível com
Bun: o `jest-runtime` atribui a uma propriedade que o Bun trata como readonly.

Medido nesta árvore:

| `[run] bun` | Resultado |
| --- | --- |
| `true` | 97 suítes falharam, **0 testes rodaram** |
| `false` | 97 suítes passaram, **547 testes passaram** |

O que torna isso perigoso, e não apenas errado, é o *modo* de falha: toda suíte morre no carregamento com
`TypeError: Attempted to assign to readonly property`, o que se parece com um bug do repositório e não com
uma configuração de runtime.

A flag pode ser invertida quando as suítes unitárias migrarem do Jest para o `bun:test` — entregue pelo
projeto Hexagonal Test Pyramid (JUM-434–436), não por este épico.

## 5. Testes

```bash
bun run test:unit          # gate unitário canônico — Jest sobre Node, 547 testes
bun run test:integration   # alvos de integração
bun run ci:gate            # o gate completo de branch
```

### Fronteiras de runtime declaradas (Requisito 096 §4)

O Node sobrevive apenas como alvo **explícito e declarado**. Existem exatamente duas:

1. O **Jest** roda sobre Node até a migração para `bun:test` aterrissar (ver §4).
2. O **`compat:check-node-version`** valida o contrato de Node voltado ao consumidor e precisa rodar sobre
   Node real.

Qualquer outra invocação de Node dentro do tooling interno é um defeito.

### Onde o `bun test` está hoje

O `bun test` ainda não é o runner do gate, mas é medido, porque a diferença é o trabalho restante da
migração:

| | Baseline | Após o codemod `import type` |
| --- | --- | --- |
| pass | 344 | **471** |
| erros de carregamento | 30 | **3** |
| testes descobertos | 399 | **531** |
| tempo | 0,79 s | 1,72 s |

O Jest leva cerca de 28 s para as mesmas suítes.

As falhas restantes são lacunas de API do `bun:test` — `jest.resetModules` (13), `jest.doMock` (2),
`jest.requireActual` (2), além de diferenças de ordem de mock. Pertencem à JUM-434–436.

### Imports de tipo são uma questão de runtime no Bun

O runtime ESM do Bun resolve bindings nomeados em tempo de execução, então um tipo TypeScript importado *ou
re-exportado* como valor não tem export em runtime e o Bun rejeita o módulo inteiro:

```
SyntaxError: export 'IMessageResponse' not found in './contracts'
```

Use `import type` e `export type`. Os dois lados importam: o `import type` de um consumidor não resolve nada
se o barrel que ele lê usa um `export {}` de valor.

Classifique pela **declaração**, não pelo prefixo do nome. O repositório tem contraexemplos nas duas
direções: `MessageHandler` é um `type` sem prefixo `I`, e `ESqlDialect` é um `type` apesar do prefixo `E`.

## 6. Verificação fail-closed

```bash
bun run ci:fail-closed
```

Um gate que nunca foi observado falhando não é um gate. O `ci-cd/check-fail-closed.js` injeta uma falha
deliberada por classe de gate, exige saída não-zero e restaura a árvore. Cobre oito classes: divergência do
pin de toolchain, pin de segurança removido, seletor aninhado reintroduzido, divergência manifesto/lockfile,
erro de tipo, violação de lint, teste unitário falhando, e execução filtrada de workspace sem script
correspondente.

O harness é ele mesmo fail-closed: se um fixture não puder ser restaurado, ele sai com `2` em vez de deixar
a árvore corrompida.

## 7. Patches

```bash
bun patch <pkg>@<versão>           # prepara uma cópia gravável
# edite node_modules/<pkg>
bun patch --commit node_modules/<pkg>
```

Patches são registrados em `package.json#patchedDependencies` e o guard verifica se o arquivo existe em
disco.

**Patches são de conteúdo, não de grafo.** Eles não podem remover uma dependência: o Bun resolve o grafo a
partir do lockfile, que lê o manifesto original. Tentar remover uma dependência transitiva patcheando o
`package.json` do pai não tem efeito algum na resolução — verificado.

## 8. CI

| Sistema | Setup |
| --- | --- |
| GitHub Actions | `oven-sh/setup-bun` pinado por SHA de commit; eixo de matriz `bun-version`; caches chaveados em `bun.lock` |

O workflow instala com `--frozen-lockfile` e valida o guard de toolchain antes de qualquer outra coisa.

O registry de agentes roda no Firestore. GitHub Actions injeta `FIREBASE_SERVICE_ACCOUNT_KEY`
com o JSON da conta de serviço. Localmente, exporte `FIREBASE_SERVICE_ACCOUNT_KEY` com o mesmo
JSON antes de rodar comandos do registry.

## 9. Runtime de desenvolvimento (PM2)

O PM2 roda as aplicações sob o interpretador Bun:

```
pm2 start <entry> --interpreter bun --interpreter-args='--env-file=...'
```

`-r` é um alias documentado de `--preload` no Bun, e `--env-file` é suportado, então os argumentos do
interpretador Node anteriores seguem válidos. A cadeia de preload do `ts-node` foi removida — o Bun executa
TypeScript diretamente.

Ciclo de vida verificado: `exec_interpreter bun`, `online`, 0 restarts após 66 s, HTTP 200.

O `-r tsconfig-paths/register` ficou redundante, porque o Bun resolve `paths` do tsconfig nativamente. É
inofensivo e foi mantido.

## 10. Rollback

A migração é reversível no nível de commit; não há migração de dados nem artefato publicado envolvido. Para
reverter, desfaça os commits do épico e restaure `pnpm-lock.yaml` e `pnpm-workspace.yaml` do histórico.

Duas coisas precisam ser restauradas juntas ou nenhuma: o lockfile **e** a superfície de overrides. Reverter
uma sem a outra reintroduz exatamente a divergência tripla (`postcss` em `^8.5.18` em dois lugares e
`^8.5.23` num terceiro) que esta migração colapsou numa única fonte de verdade.

## 11. Lacunas conhecidas

| Lacuna | Responsável |
| --- | --- |
| Suítes unitárias ainda no Jest; `[run] bun` não pode ser `true` ainda | Test Pyramid JUM-434–436 |
| 60 falhas de `bun test` por lacunas de API do `bun:test` | Test Pyramid JUM-434–436 |
| Cobertura de branch não é aplicada pelo `bun test` (ele não tem essa métrica) | JUM-437 / §5 deste guia |
| 4 scripts `test` de workspace são placeholders `echo`; outros 15 apenas chamam `typecheck` | Test Pyramid JUM-557 |
| O artefato buildado do backend não carrega sob Node (abaixo) | JUM-37, em aberto |

A quarta linha é um falso verde ativo: o `mono:test` reporta sucesso enquanto quase nenhum workspace roda
teste.

### O artefato buildado não carrega sob Node — e nunca carregou

O Requisito 096 §4 mantém o Node como alvo voltado ao consumidor *validado independentemente*. Medido, essa
validação não se sustenta hoje, e a causa é anterior a esta migração:

```
$ node -e "require('./.build/.../start-rest-api.js')"
Cannot find module '@src/interface/runtime/RuntimeEnvironment'

$ bun -e "require('./.build/.../start-rest-api.js')"
OK
```

O `tsc` não reescreve aliases de path, então a saída compilada mantém `require("@src/...")`. Os scripts PM2
`prod:*` anteriores à migração rodavam essa saída com `--interpreter node` e **sem** preload de
`tsconfig-paths`, então também não conseguiriam resolver. O Bun carrega porque resolve `paths` do tsconfig
nativamente.

Portanto a migração acaba mascarando um defeito latente de produção, em vez de causar um. Fechar isso
corretamente exige uma decisão, não um patch: emitir caminhos relativos reais (um bundler ou `tsc-alias`), ou
declarar que a compatibilidade Node vale só para os pacotes publicados e não para a entrada buildada do
backend. Essa decisão pertence à JUM-37 e **não** é tomada aqui.

### O scan de dependências cobre a árvore Bun instalada

`bun run deps:audit` resolve os pacotes instalados a partir de `bun.lock`,
envia-os para a API em lote do OSV.dev, recupera os detalhes dos avisos e falha
de forma fechada quando o serviço está indisponível ou retorna uma resposta
inválida. Riscos aceitos são identificados explicitamente com datas de expiração
no código-fonte do scanner.

O scanner pertence ao repositório e roda diretamente em `ci:gate`; ele não exige
token de provedor, lockfile de compatibilidade gerado, webhook ou GitHub App.
`packages/security-scanner/src/index.js` contém a consulta e a política de risco,
enquanto `packages/security-scanner/audit.js` é o ponto de entrada do gate.

Os checks de cobertura pertencentes ao repositório e o Sonar consomem as evidências LCOV/JSON geradas e
não são afetados pela troca de lockfile.

## Referências

- Requisito `096` — Bun como runtime e gerenciador de pacotes interno de engenharia
- `documentation/md/BUN-MIGRATION-BASELINE.md` — evidência da baseline JUM-23
- `documentation/md/BUN-INSTALL-COMPATIBILITY-AUDIT.md` — auditoria da camada de install (JUM-538)
