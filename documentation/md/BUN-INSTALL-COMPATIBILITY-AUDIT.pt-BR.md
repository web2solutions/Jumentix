# Auditoria de compatibilidade de instalação com Bun

Entregável da tarefa do Linear JUM-538, projeto `[Tooling] Replace Internal Node and pnpm Workflows with Bun`.
Evidência coletada em 2026-07-29 contra `web2solutions/Jumentix` `dev` (`6796b06`), Bun `1.3.13`, macOS (APFS),
em uma worktree isolada.

Esta auditoria antecipa três dos riscos registrados no épico para que sejam descobertos aqui e não dentro de
JUM-25/JUM-26: `bun install` alterando a árvore gerenciada (risco nº 1), a falha de link do `uWebSockets.js`
(risco nº 2) e seletores de override aninhados (risco nº 4).

## 1. `bun install` altera o `package.json` enquanto `pnpm-workspace.yaml` existe

Reproduzido, e o dano é maior do que a baseline do JUM-23 registrou. Com os dois arquivos presentes, o
`bun install` trata `pnpm-workspace.yaml` como entrada e o mescla no `package.json`, **sobrescrevendo valores
conflitantes sem nenhum aviso**.

Diff medido de um único `bun install` contra um `package.json` escrito de propósito:

| Campo | Escrito | Depois do `bun install` | Classe de dano |
| --- | --- | --- | --- |
| `workspaces` | `["apps/*","packages/*","tooling/*"]` | `[".","apps/*","packages/*","apps/service-management","tooling/*"]` | Injetou `"."` (a raiz como membro do próprio workspace) e um caminho já coberto por `apps/*` |
| `patchedDependencies` | `{"nextra-theme-docs@4.6.1": "..."}` | adiciona `{"nextra-theme-docs@4.6.1@4.6.1": "..."}` | **Chave corrompida** — a versão é anexada duas vezes, gerando um seletor que nunca casa com um pacote. O patch fica declarado duas vezes, uma delas inerte |
| `overrides.postcss` | `^8.5.23` | `^8.5.18` | **Rebaixamento silencioso de segurança.** Um piso elevado de propósito voltou ao valor do pnpm |
| `overrides` | 16 pins planos | 23 pins | Injetou os 7 seletores aninhados do pnpm (`restify>find-my-way`, `cassandra-driver>adm-zip`, `next>postcss`, `next>sharp`, `concurrently>shell-quote`, `@grpc/proto-loader>protobufjs`, `google-gax>protobufjs`) como chaves de string planas — a forma `EINVALIDTAGNAME` que o npm rejeita |

O caso do `postcss` é o que mais importa. Não é um build quebrado; é um piso de segurança sendo relaxado em
silêncio pelo gerenciador de pacotes, exatamente o modo de falha que o conjunto de overrides existe para evitar.

### Consequência para o plano

**`pnpm-workspace.yaml` precisa ser removido antes do primeiro `bun install`, não depois.** Isso inverte a ordem
implícita na "transição com dois lockfiles" do JUM-25: manter as duas superfícies enquanto se roda o Bun não é
um estado intermediário seguro, é o estado em que a alteração acontece.

Verificado: com `pnpm-workspace.yaml` e `pnpm-lock.yaml` removidos, um `bun install` completo deixa o
`package.json` idêntico byte a byte. Confirmado por diff em instalações repetidas.

### Guarda

`ci-cd/check-dependency-override-integrity.js` congela a baseline de segurança pré-migração (16 pins, 1
resolution, 1 patch) e falha fechado em: pin ausente, faixa alterada, seletor aninhado reintroduzido, arquivo de
patch ausente ou inexistente, ou superfície do pnpm ressuscitada. Caminhos negativos exercitados — exit `1` com
um pin removido, exit `0` quando intacto.

## 2. `uWebSockets.js` não pode ser instalado pelo Bun — bloqueio não resolvido

`hyper-express@6.17.3` depende de `uWebSockets.js` via tarball do GitHub:

```
"uWebSockets.js": "github:uNetworking/uWebSockets.js#v20.51.0"
```

O Bun baixa corretamente — tarball de 46.11 MB, 31 entradas transmitidas, resolvido para o commit
`6609a88ffa9a16ac5158046761356ce03250a0df` — e então falha na etapa de link:

```
ENOENT: No such file or directory: failed to link package:
  uWebSockets.js@github:uNetworking/uWebSockets.js#6609a88... (clonefileat)
Failed to install 1 package
```

O linker isolado ainda cria o symlink do consumidor:

```
node_modules/.bun/hyper-express@6.17.3/node_modules/uWebSockets.js
  -> ../../uWebSockets.js@github+uNetworking+uWebSockets.js+6609a88.../node_modules/uWebSockets.js
```

O destino nunca é criado, então é um **symlink pendurado** e a falha aparece em tempo de execução, não na
instalação:

```
$ bun -e "require('hyper-express')"
FAILED: ENOENT reading ".../node_modules/.bun/hyper-express@6.17.3/node_modules/uWebSockets.js"
```

### Mitigações tentadas — todos os quatro backends de instalação falham

| Configuração | Pacotes instalados | uWS resolvido | `require('hyper-express')` |
| --- | --- | --- | --- |
| `--linker=isolated --backend=clonefile` (padrão) | 4071 | não | FAILED |
| `--linker=isolated --backend=copyfile` | 4071 | não | FAILED |
| `--linker=isolated --backend=hardlink` | 4071 | não | FAILED |
| `--linker=isolated --backend=symlink` | 4071 | não | FAILED |
| `--linker=hoisted --backend=clonefile` | **2056** | não | FAILED |

`clonefileat` é uma syscall de copy-on-write do APFS, então o backend padrão era o suspeito óbvio — mas a falha
sobrevive a todos os backends, o que descarta a estratégia de cópia como causa. `trustedDependencies:
["uWebSockets.js"]` está declarado e não muda o resultado; a falha está no link, antes de qualquer script de
ciclo de vida rodar.

O linker hoisted é inadequado por conta própria: instalou **2056 de 4071** pacotes e reportou três falhas em
vez de uma.

### Causa raiz, encontrada depois que a falha de instalação foi corrigida

Vendorizar o pacote (veja `ci-cd/vendor-uwebsockets.js`) e avançar a versão para uWS **v20.69.0**, que traz
um binário `_137` para a ABI do Bun, produziu um módulo instalado e linkado corretamente — e ele ainda não
carrega:

```
TypeError: symbol 'napi_register_module_v1' not found in native module.
  Is this a Node API (napi) module?
```

**O uWebSockets.js é compilado contra a ABI interna crua do V8/Node (`NODE_MODULE_VERSION`), não contra a
N-API.** O Bun implementa apenas N-API. Nenhuma versão, linker, backend de instalação ou estratégia de vendoring
alcança isso: é uma incompatibilidade arquitetural no modelo de distribuição do módulo, anterior a nós.

Estado final verificado na mesma árvore, mesma cópia vendorizada:

| Runtime | ABI | `require('hyper-express')` |
| --- | --- | --- |
| Node 22 | 127 | **OK** |
| Bun 1.3.13 | 137 | FAILED — `napi_register_module_v1` not found |

Os três defeitos da camada de instalação eram reais e foram corrigidos. Eles também mascaravam este, e é por isso
que corrigi-los isoladamente pareceu progresso e não mudou nada.

### Resolução

`hyper-express` é um **alvo declarado de runtime Node** pelo Requisito 096 §4, não um alvo Bun. É uma
impossibilidade técnica documentada com prova de uma linha, não uma concessão de escopo.

A etapa de vendoring continua necessária, e necessária sob o Bun, porque o caminho Node também depende dela: o
instalador do Bun não consegue materializar o tarball do GitHub, então sem `ci-cd/vendor-uwebsockets.js` o
módulo fica ausente para *qualquer* runtime. O script roda como `postinstall`, verifica o tarball fixado por
SHA-256, extrai apenas os binários da plataforma atual, falha fechado se a ABI deste runtime não tiver binário
pré-compilado e repara os symlinks pendurados que o linker isolado deixa em `node_modules/.bun/*/node_modules/`.

### Impacto

Antes dessa resolução, isto era um **bloqueio duro para a troca**, não um aviso cosmético de instalação:

* `hyper-express` é um dos frameworks HTTP suportados declarados (`JUMENTIX_HTTP_FRAMEWORK=hyper-express`).
* Seu alvo de integração tem **21 arquivos de teste**.
* A aceitação do runtime Bun exige que todo gate adequado ao destino passe. Um adapter de framework que não pode
  ser importado não passa, e declarar a matriz verde com esse alvo pulado seria um falso verde pelo Requisito 065.

### Posição de cadeia de suprimentos do artefato vendorizado

O vendoring foi escolhido (2026-07-29) e implementado como **download fixado com verificação de checksum**, em
vez de versionar o artefato no git. O tarball tem 31 MB comprimido e expande para ~127 MB de binários
pré-compilados em 15 combinações de plataforma/ABI, das quais cada máquina precisa de uma.

A propriedade de integridade que importa — receber exatamente os bytes revisados — vem da tag fixada mais o
SHA-256 registrado, não do arquivo estar no histórico do git:

* tag `v20.69.0`, publicada em 2026-07-11
* `sha256 691f1f43cb6c4e30c56d7c11968c275130e57b52ac3327bc457c574dedc613d0`
* licença: Apache-2.0 (levada para a árvore vendorizada)

Um checksum divergente faz a instalação falhar em vez de atualizar a expectativa. Se a tag upstream for movida
algum dia, essa divergência é em si o achado.

Desvio registrado: a decisão tomada dizia "fetch/commit". Versionar foi rejeitado pelo motivo de tamanho acima.
Se o artefato precisar estar na árvore para um build sem rede, isso é uma mudança separada e revisável.

## 3. Seletores de override aninhados — resolvido

Os 7 seletores aninhados do pnpm foram convertidos em pins planos. Isso **não** amplia a exposição: um override
plano vale para todo dependente, o que é estritamente mais forte do que fixar um dependente.

Seis dos sete já tinham um pin plano idêntico em vigor, então o comportamento efetivo não muda:

| Seletor do pnpm | Faixa | Pin plano preexistente |
| --- | --- | --- |
| `restify>find-my-way` | `^9.7.0` | `find-my-way: ^9.7.0` — idêntico |
| `next>postcss` | `^8.5.18` | `postcss` — piso idêntico |
| `next>sharp` | `^0.35.0` | `sharp: ^0.35.0` — idêntico |
| `concurrently>shell-quote` | `^1.9.0` | `shell-quote: ^1.9.0` — idêntico |
| `@grpc/proto-loader>protobufjs` | `^7.6.5` | `protobufjs: ^7.6.5` — idêntico |
| `google-gax>protobufjs` | `^7.6.5` | `protobufjs: ^7.6.5` — idêntico |
| `cassandra-driver>adm-zip` | `^0.6.0` | **nenhum** — virou `adm-zip: ^0.6.0` plano |

`postcss` era o único conflito real entre as três superfícies de declaração: `^8.5.18` em
`pnpm-workspace.yaml` e em `package.json#overrides`, `^8.5.23` em `package.json#pnpm.overrides`. Resolvido para
**`^8.5.23`**, o piso mais alto. As duas faixas admitem 8.5.23, então a única diferença é o mínimo, e ficar com o
valor menor teria relaxado um piso de segurança por acidente de precedência de arquivos.

## 4. Desempenho de instalação

Medido na mesma máquina e árvore, cache quente, linker isolado:

| Operação | Tempo de relógio |
| --- | --- |
| `bun install` (4071 pacotes) | 4.77 s – 11.24 s |
| `bun install --frozen-lockfile` (sem mudanças) | 2.37 s |

O `bun.lock` é gerado no formato de texto versionado com 568 KB. `bun install --frozen-lockfile` termina sem
alterar o lockfile, atendendo ao Requisito 096 §2.

Nenhuma afirmação de desempenho é feita contra a baseline do pnpm aqui: as superfícies do pnpm foram removidas
antes destas medições, então uma comparação na mesma árvore não foi possível. O JUM-38 é dono do orçamento
comparativo.

## 5. Status

| Risco | Status |
| --- | --- |
| nº 1 `bun install` altera a árvore gerenciada | **Resolvido** — causa identificada, ordem corrigida, guarda criada, caminhos negativos testados |
| nº 4 Seletores de override aninhados | **Resolvido** — convertidos em pins planos com justificativa por entrada |
| nº 2 Falha de link do `uWebSockets.js` | **Resolvido por vendoring** — etapa `postinstall` fixada e com checksum; módulo presente e carregável no Node |
| nº 2b uWS não é módulo N-API (encontrado durante o nº 2) | **Fechado como impossível no upstream.** `hyper-express` é alvo declarado de runtime Node pelo Req 096 §4. Não existe caminho Bun em nenhuma versão |

Nenhum gate de qualidade é declarado verde por este documento. Ele registra apenas evidência da camada de instalação.
