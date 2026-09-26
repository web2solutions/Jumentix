<!--
Arquivo gerado automaticamente a partir de: documentation/md/CONTRIBUTING-AND-TOOLING.md
Idioma alvo: Português (Brasil)
-->
# Contribuição e ferramentas

## Contribuindo

1. Crie uma filial.
2. Certifique-se de que exista uma Issue do Linear vinculada ao Project focado no Linear:

```text
https://linear.app/jumentix
```

3. Defina/atualize os campos da Issue e do Project no Linear (`Status`, `Prioridade`, `Tamanho`,
   `Estimativa`, `Data de início`, `Data de término`, milestone e natureza principal).
4. Execute o modo TDD:

```bash
bun run tdd
```

5. Faça suas alterações.
6. Faça o commit usando:

```bash
bun run commit
```

Este comando executa lint/tests e, em seguida, abre o fluxo de confirmação.

Os PRs devem incluir a Issue do Linear, o Project focado, o milestone, o Project Update
obrigatório e as evidências de entrega no GitHub.

Toda thread de revisão deve ser resolvida nativamente no GitHub. Todo comentário
geral da PR precisa de uma resposta visível do autor da PR ou de um mantenedor do
repositório, usando um dos marcadores abaixo. Uma resposta `resolved` deve usar a
URL exata do comentário e um SHA da PR; uma resposta `invalid` deve incluir uma
explicação factual fora do marcador.

```html
<!-- jumentix-pr-feedback: resolved comment=https://github.com/OWNER/REPO/pull/NUMBER#issuecomment-ID commit=PR_COMMIT_SHA -->
<!-- jumentix-pr-feedback: invalid comment=https://github.com/OWNER/REPO/pull/NUMBER#issuecomment-ID -->
```

O gate automatizado ignora somente o aviso estrito de limite de uso do Cursor,
feito pelo login `cursor`. Todo outro feedback, inclusive de SonarCloud e
Codecov, deve ser resolvido ou respondido com esta evidência.

## Escrevendo documentação para o leitor certo

Cada arquivo de documentação serve um único leitor. Nomeie esse leitor antes de escrever e
mantenha cada fato em exatamente uma camada — as demais camadas apontam para ele.

| Camada | Arquivos | Leitor |
| --- | --- | --- |
| Prospect | `README.md` / `README.pt-BR.md` da raiz, páginas comerciais do site | quem está decidindo se experimenta o Jumentix |
| Desenvolvedor | páginas `/docs/**` do site (`apps/jumentix-website/content/**`) | quem integra o Jumentix |
| Contribuidor | `documentation/md/**`, `README.md` de cada componente | quem constrói o Jumentix |
| Agente / interno | `.agents/**` | um agente executando governança |

Páginas de prospect e de desenvolvedor nunca trazem variáveis de controle de CI/gate
(`JUMENTIX_ENABLE_GITHUB_ACTIONS_CI`, `JUMENTIX_QUALITY_GATE_TARGET`, `JUMENTIX_GATE_V2`,
`JUMENTIX_TEST_RUNTIME`), mecânica de fallback de provedor de CI, números de requisito, ids de
issue do Linear nem caminhos `.agents/`. Chaves de runtime como `JUMENTIX_HTTP_FRAMEWORK` são
configuração do produto e continuam permitidas.

```bash
bun run docs:check-audience
```

A verificação falha citando arquivo, linha e regra. Os casos existentes ficam listados com a
issue responsável em `ci-cd/documentation-audience-allowlist.json`; a lista só diminui — uma
entrada para um arquivo já limpo faz a verificação falhar até ser removida.

## Ferramentas

Fiapos:

```bash
bun run lint
```

Lint + correção:

```bash
bun run lint:fix
```

`CHANGELOG.md` é gerado pelo GitHub Actions somente após merges validados para `main`.
Não o atualize em uma branch de tarefa ou PR; `bun run changelog:check` fica disponível
apenas para diagnosticar a geração localmente.

Arquitetura e contratos:

```bash
bun run deps:check-cycles
bun run arch:check-boundaries
bun run arch:check-users-legacy-imports
bun run oas:check-routes
```

Verificação de tempo de execução do nó:

```bash
bun run check-node-version
```

Porta de fumaça e CI:

```bash
bun run ci:smoke
bun run ci:gate
```
