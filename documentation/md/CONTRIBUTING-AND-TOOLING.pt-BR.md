<!--
Arquivo gerado automaticamente a partir de: documentation/md/CONTRIBUTING-AND-TOOLING.md
Idioma alvo: Português (Brasil)
-->
# Contribuição e ferramentas

## Contribuindo

1. Crie uma filial.
2. Certifique-se de que haja um problema GitHub relacionado e que ele seja adicionado ao Linear Project **Jumentix**:

```text
https://linear.app/jumentix
```

3. Definir/atualizar campos do projeto para o problema (`Status`, `Prioridade`, `Tamanho`, `Estimativa`, `Data de início`, `Data de término`).
2. Execute o modo TDD:

```bash
pnpm run tdd
```

4. Faça suas alterações.
5. Confirme usando:

```bash
pnpm run commit
```

Este comando executa lint/tests e, em seguida, abre o fluxo de confirmação.

Os PRs devem incluir a questão vinculada e o contexto do projeto (item do projeto Jumentix).

## Ferramentas

Fiapos:

```bash
pnpm run lint
```

Lint + correção:

```bash
pnpm run lint:fix
```

Atualize o changelog do histórico do git:

```bash
pnpm run changelog:update
```

Valide que o changelog está sincronizado:

```bash
pnpm run changelog:check
```

Arquitetura e contratos:

```bash
pnpm run deps:check-cycles
pnpm run arch:check-boundaries
pnpm run arch:check-users-legacy-imports
pnpm run oas:check-routes
```

Verificação de tempo de execução do nó:

```bash
pnpm run check-node-version
```

Porta de fumaça e CI:

```bash
pnpm run ci:smoke
pnpm run ci:gate
```

