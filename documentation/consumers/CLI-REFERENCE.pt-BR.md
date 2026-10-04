# Referência do CLI Jumentix

O CLI Jumentix (`@jumentix/cli-init`) cria um projeto novo a partir do seu
modelo de domínio ou de um contrato OpenAPI, amplia o projeto conforme o
produto cresce e o mantém em dia com templates mais novos. Esta página lista
todos os comandos e opções.

## Como executar

Você precisa do [Bun](https://bun.sh) 1.3.13 ou mais novo. O Docker é
opcional e só é usado quando o projeto roda um servidor de banco de dados ou
Redis.

```bash
npx @jumentix/cli-init init my-product
```

`bunx @jumentix/cli-init init my-product` funciona da mesma forma. O comando
do pacote é `jumentix`; instale uma vez para chamá-lo direto, que é como os
exemplos abaixo estão escritos:

```bash
bun add -g @jumentix/cli-init
jumentix --help
jumentix <command> --help
```

Sem instalação global, troque `jumentix` por `npx @jumentix/cli-init`.

Códigos de saída: `0` sucesso, `1` problema na entrada ou no projeto, `2`
problema no ambiente (por exemplo, Bun ausente).

## `init` — criar um projeto

```bash
jumentix init [dir] [options]
```

| Opção               | Valores                                                                                                           | Padrão                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `--mode`            | `monolith`, `services`, `hybrid`, `frontend`                                                                      | inferido: um serviço vira `monolith`   |
| `--from`            | um export do Domain Designer (`.json`), um arquivo OpenAPI 3.x (`.yml`/`.json`) ou uma URL `https://` de catálogo | o preset Users                         |
| `--preset`          | `users`                                                                                                           | `users` quando `--from` é omitido      |
| `--http`            | `express`, `fastify`, `restify`                                                                                   | `express`                              |
| `--realtime`        | `none`, `websocket`, `grpc`                                                                                       | `none`                                 |
| `--db`              | `sqlite`, `postgres`, `mysql`, `mongo`, `inmemory`                                                                | `sqlite`                               |
| `--frontend`        | inclui `apps/frontend`                                                                                            | ligado nos modos `hybrid` e `frontend` |
| `--offline`         | mantém a camada de dados offline-first no frontend                                                                | desligado                              |
| `--git`             | executa `git init` e faz o primeiro commit                                                                        | desligado                              |
| `--install`         | executa `bun install` depois da geração                                                                           | desligado                              |
| `--config`          | lê as respostas de um arquivo `jumentix.init.json`                                                                | —                                      |
| `--non-interactive` | nunca pergunta; usa flags e padrões                                                                               | desligado                              |

Modos:

| Modo       | O que você recebe                                          |
| ---------- | ---------------------------------------------------------- |
| `monolith` | Um serviço backend com todos os domínios no mesmo processo |
| `services` | Um serviço backend para cada serviço do seu modelo         |
| `hybrid`   | Serviços backend mais `apps/frontend`                      |
| `frontend` | Só `apps/frontend`, apontado para uma API existente        |

Exemplos:

```bash
# Preset Users, um serviço, Express e SQLite, sem perguntas
npx @jumentix/cli-init init my-product \
  --mode=monolith --preset=users --http=express --realtime=none --db=sqlite \
  --non-interactive

# Seu próprio contrato OpenAPI, backend mais frontend com suporte offline
npx @jumentix/cli-init init my-product \
  --from=./openapi.yml --mode=hybrid --offline --db=postgres --install --git
```

O modelo é validado antes de qualquer arquivo ser escrito. A geração para com
um erro nomeado quando o modelo não tem serviço core, uma entidade não tem
chave primária, uma relação cruza a fronteira de um serviço no modo
`monolith`, uma interface não é suportada ou dois domínios declaram o mesmo
nome de entidade.

### O que é gerado

```text
my-product/
├── apps/
│   ├── <service>/            # um backend por serviço (API REST, spec OpenAPI, testes)
│   └── frontend/             # modos hybrid e frontend
├── docker-compose.yml        # o banco escolhido, mais Redis quando há realtime
├── package.json              # workspace Bun com dev / test / lint / build
├── README.md                 # como rodar, portas, contas de exemplo
├── jumentix.init.json        # suas respostas, reutilizáveis com --config
└── .jumentix/                # metadados usados por add, upgrade e doctor
```

Rode o projeto:

```bash
cd my-product
bun install
bun run dev
```

`bun run test`, `bun run lint` e `bun run build` executam o mesmo script em
todos os apps. A API escuta em `http://localhost:3000` e o frontend em
`http://localhost:5173`; o README gerado lista a porta do banco e as contas de
acesso de exemplo.

## `add` — ampliar um projeto

Execute dentro de um projeto criado por `init`.

| Comando                                                         | Efeito                                                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `jumentix add domain <name> [--from <source>] [--service <id>]` | Adiciona um domínio ao serviço core (ou ao `--service`) e atualiza os módulos do frontend quando existe frontend |
| `jumentix add service <name> --domains a,b`                     | Cria `apps/<name>` e move para ele os domínios listados (modos `services` e `hybrid`)                            |
| `jumentix add frontend [--offline]`                             | Adiciona `apps/frontend` a um projeto só com backend; o modo passa a `hybrid`                                    |

`add` se recusa a sobrescrever arquivos gerados que você editou. Passe
`--force` para seguir mesmo assim.

## `upgrade` — receber templates mais novos

```bash
jumentix upgrade --dry-run
jumentix upgrade
```

`upgrade` mescla no seu projeto os templates da versão instalada do CLI,
arquivo por arquivo, sem descartar suas edições:

| Status          | Significado                                                                                |
| --------------- | ------------------------------------------------------------------------------------------ |
| updated         | Você não tinha alterado o arquivo, ou as duas mudanças mesclaram sem conflito              |
| conflicted      | Você e o template mudaram as mesmas linhas; marcadores de conflito ficam no arquivo        |
| skipped         | O template não mudou, ou só você mudou o arquivo                                           |
| added / removed | Arquivos novos do template são adicionados; arquivos aposentados são reportados e mantidos |

`--dry-run` imprime o relatório sem escrever. O upgrade se recusa a rodar com
alterações não commitadas no git, a menos que você passe `--force`. Upgrades
aplicados escrevem um relatório em `.jumentix/upgrade-<version>.md`.

## `doctor` — verificar o ambiente e o projeto

```bash
jumentix doctor
```

| Área     | Verificações                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| ambiente | versão do Bun (obrigatório), Node.js 20 ou mais novo quando instalado, disponibilidade do Docker                                   |
| projeto  | metadados e modo do projeto, versão dos templates contra o CLI instalado, diretórios `apps/*` esperados, arquivos gerados editados |

`doctor` sai com `0` quando está tudo certo, `1` quando o projeto precisa de
atenção e `2` quando o ambiente precisa.

## Relacionados

- [Primeiros passos](./GETTING-STARTED.pt-BR.md)
- [Arquitetura](./ARCHITECTURE.pt-BR.md)
- [Contratos do ambiente de runtime](./RUNTIME-CAPABILITIES.pt-BR.md)
