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
pnpm run tdd
```

5. Faça suas alterações.
6. Faça o commit usando:

```bash
pnpm run commit
```

Este comando executa lint/tests e, em seguida, abre o fluxo de confirmação.

Os PRs devem incluir a Issue do Linear, o Project focado, o milestone, o Project Update
obrigatório e as evidências de entrega no GitHub.

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
