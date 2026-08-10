# Guia do Agente — `rtk` e Caveman

Guia operacional do Requisito `127`. O requisito define a obrigação; este ficheiro mostra como
cumpri-la.

Duas poupanças distintas, uma regra cada:

- **`rtk`** comprime o que as *ferramentas* te devolvem.
- **Caveman** comprime o que *tu* devolves a quem lê.

Nenhum dos dois pode comprimir evidência. É essa exclusão que torna o resto seguro.

## 1. Mapa de comandos

Substitui a coluna da esquerda pela da direita. É esta a mudança do dia a dia.

| Em vez de | Usa |
| --- | --- |
| `bun run <script>` | `rtk proxy bun run <script>` |
| `git <cmd>` | `rtk git <cmd>` |
| `gh <cmd>` | `rtk gh <cmd>` |
| `bunx jest <caminhos>` | `rtk jest <caminhos>` |
| `eslint` / script de lint | `rtk lint` |
| `tsc` | `rtk tsc` |
| `docker <cmd>` | `rtk docker <cmd>` |
| `grep` / `rg` | `rtk grep` / `rtk rg` |
| `find` | `rtk find` |
| `cat` / ler ficheiro para contexto | `rtk read` |
| `curl` | `rtk curl` |

Corre `rtk --help` para a lista completa; cobre pytest, cargo, go, mvn, kubectl e cerca de outros
quarenta.

### Porquê `proxy` para o Bun, e não `rtk npm`

O `rtk` não tem subcomando `bun`. O `rtk npm run <script>` funcionaria — e correria o script sob
**npm**, não sob Bun. Este repositório fixa o Bun pelos Requisitos `106` e `110`, e as regras de
runner dependem de esse pino se manter.

O `rtk proxy` executa o comando sem o alterar e continua a registar uso:

```
rtk proxy bun run requirements:check
```

Usa um subcomando nativo do `rtk` sempre que exista para a ferramenta; usa `proxy` só quando não
exista.

## 2. Ler a saída do `rtk`

A saída do `rtk` é mais seca do que a da ferramenta original. Dois exemplos deste repositório:

```
rtk jest apps/backend-template/test/unit/ci-cd/check-pr-governance.test.ts
PASS (30) FAIL (0)
```

```
rtk git push -u origin claude/governance/JUM-630-mandatory-rtk-and-caveman
ok claude/governance/JUM-630-mandatory-rtk-and-caveman
```

Quando uma corrida falha, para de comprimir e vai buscar a saída real. O `rtk` serve para as noventa
e nove leituras que não dizem nada; a que diz alguma coisa merece o texto completo. O `rtk err` e o
`rtk test` filtram só para falhas, que costuma ser o que queres nesse momento.

## 3. Caveman: comprimir a tua própria prosa

Corta o que não transporta informação: hesitação decorativa, repetição da pergunta, narração do que
vais fazer a seguir, e adjetivos que não mudam decisão nenhuma.

**Antes**

> Fui dar uma olhada ao teste de integração que estava a falhar, e parece que poderá eventualmente
> estar relacionado com a alteração que entrou recentemente, embora quisesse confirmar isso antes de
> dizer algo definitivo.

**Depois**

> Vi o teste de integração que falha. Suspeito da alteração recente. Não confirmado.

Mesmo conteúdo, mesma incerteza preservada. A ressalva sobreviveu porque a ressalva era informação.

## 4. O que nunca se comprime

Reproduz exatamente como foi produzido — texto integral, redação original, sem arredondar, sem
parafrasear:

- saída de asserções falhadas e mensagens de erro;
- contagens de testes e totais de passa/falha;
- tempos e durações medidas;
- SHAs de commit, nomes de branch, identificadores de issue, caminhos de ficheiro;
- estados de jobs, células e checks de CI.

**Errado**

> A suite passou quase toda e o teste de browser falhou depressa.

**Certo**

> `Tests: 1 failed, 52 passed, 53 total`. Falha em
> `pwaShell.browser.integration.test.ts:184`, em 2,65ms.

A segunda é mais longa e é a única que vale a pena escrever. Um relatório que perde o número não foi
comprimido; foi degradado. Se comprimir uma frase custar um facto, fica com a frase.

## 5. Se o teu agente não tiver nenhuma das duas

Requisito `127`, regra 6: indisponibilidade não é dispensa. Usa um padrão de substituição que atinja
o mesmo resultado e regista-o na tua entrada em `.agents/AGENT-REGISTRY.md`.

Substituições aceitáveis:

- **Para o `rtk`** — passa comandos verbosos por um filtro teu: `2>&1 | tail -n 20`,
  `grep -E "error|fail"`, flags `--quiet` / `--reporter=dot`, ou um script wrapper commitado no
  repositório. O objetivo é que a saída de rotina deixe de chegar inteira.
- **Para o Caveman** — aplica a secção 3 à mão. É disciplina de escrita, não um binário.

O que não é aceitável é saltar a obrigação por faltar uma ferramenta específica.

## 6. Verificar-te a ti próprio

```
rtk gain
```

Mostra poupança de tokens e histórico. Se não reportar nada depois de uma sessão de trabalho, não
estavas a encaminhar comandos pelo `rtk`.

O `rtk` avisa também `No hook installed — run 'rtk init -g' for automatic token savings`. Esse
comando altera configuração global fora deste repositório; é decisão do operador, não do agente.

## 7. Bus de progresso de agentes (Requisito `129`)

Sync peer usa Firebase RTDB. Prefira `rtk proxy` nos scripts do bus:

```
rtk proxy bun run agent-bus:status -- --epic "<epic-url-or-id>"
rtk proxy bun run agent-bus:publish -- --agent-id "<id>" --epic "<epic>" --task "<task>" --kind progress --summary "<curto>"
rtk proxy bun run agent-bus:watch -- --epic "<epic-url-or-id>"
```

Exige `FIREBASE_SERVICE_ACCOUNT_KEY` e `FIREBASE_DATABASE_URL`. Firestore continua SSOT de ownership
(`089`). Project Updates continuam o broadcast humano (`102` / `121`).

## Relacionados

- Requisito `127` — a obrigação.
- Requisito `129` — bus obrigatório de progresso de agentes no Firebase RTDB.
- Requisitos `106`, `110` — o pino do Bun que torna o `rtk proxy` necessário.
- Requisito `099` — ler o registo de requisitos antes de executar.
- [Versão em inglês](AGENT-RTK-AND-CAVEMAN-GUIDE.md)
