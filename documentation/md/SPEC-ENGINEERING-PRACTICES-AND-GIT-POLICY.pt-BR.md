<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-ENGINEERING-PRACTICES-AND-GIT-POLICY.md
Idioma alvo: Português (Brasil)
-->
# Práticas de engenharia de especificações e política Git

Esta especificação define regras obrigatórias de execução de engenharia para entrega Jumentix.

Essas regras fazem parte da governança orientada para o desenvolvimento de especificações e se aplicam a todos os componentes do monorepo.

## 1) Política de uso do Git

1. Todo o trabalho deve ser rastreável ao item GitHub Issue + GitHub Project antes da implementação.
2. O desenvolvimento deve acontecer em filiais rastreadas e produzir commits auditáveis.
3. `--no-verify` é proibido para fluxo de entrega normal.
4. O push é bloqueado quando os portões de qualidade locais falham.
5. A rastreabilidade da tarefa/PR deve ser bidirecional:
   - emitir referências PR(s)/commit(s)
   - Questões de referências de relações públicas, contexto do item do projeto e evidências

## 2) Política de mensagens de compromisso

1. O formato de commit convencional é obrigatório.
2. Os escopos de commit devem refletir a natureza da mudança (por exemplo: `feat(domain)`, `fix(runtime)`, `docs(spec)`, `chore(ci)`).
3. As alterações de escopo misto devem ser divididas por natureza, sempre que possível.
4. O histórico de commits deve permanecer significativo para o changelog e para a automação da governança de lançamentos.

## 3) Política de qualidade estática e de fiapos

1. O Lint deve passar pela preparação para mesclagem.
2. As verificações de arquitetura (limites, ciclos, restrições do espaço de trabalho) devem ser aprovadas.
3. As verificações de resolução de rota OpenAPI devem passar quando os contratos de API estão no escopo.
4. Os limites de cobertura são obrigatórios e aplicam a política de fusão/envio.
5. Os limites de commit, push e pull request devem executar a mesma matriz completa canônica; resultados somente de smoke, somente de documentação, ausentes, vazios, ignorados ou não reportados não são evidência de entrega.

## 4) Política de práticas recomendadas de codificação

1. Siga as restrições de arquitetura DDD + Orientada a Eventos + Hexagonal.
2. Mantenha os limites da camada rígidos (`Handler -> Controller -> Use Case -> Domain -> Repository Port -> Adapter`).
3. Prefira padrões de projetos existentes e abstrações de pacotes compartilhados em vez de divergências ad hoc.
4. Mantenha as alterações limitadas ao comportamento solicitado e aos limites relacionados.
5. Use o design do contrato primeiro para comportamento de API/tempo real/evento/erro.
6. Qualquer alteração de modelo/entidade/objeto de valor deve sincronizar OpenAPI/AsyncAPI/docs.

## 5) Política de Pacotes e Ferramentas

1. `pnpm` é o padrão do gerenciador de pacotes para o monorepo.
2. Novas dependências devem respeitar os limites do espaço de trabalho e a propriedade do pacote.
3. Os adaptadores genéricos compartilhados devem ser entregues como pacotes reutilizáveis.

## 6) Política de preparação para relações públicas

Um PR está pronto para mesclagem somente quando todos são verdadeiros:

1. Existe uma questão vinculada + contexto do projeto.
2. Atualizações de especificações estão incluídas para políticas/comportamento alterados.
3. Lint/testes/cobertura/portões de segurança são verdes.
4. As mensagens de confirmação e o agrupamento de alterações seguem as regras de governança.
5. Os registros de documentos e `.agents` são sincronizados quando necessário.
6. Um administrador do repositório pode contornar apenas a quantidade obrigatória de reviews
   quando houver aprovação explícita do responsável pelo projeto registrada. A topologia de
   entrega exigida e todos os gates selecionados de qualidade, cobertura e segurança continuam
   sendo bloqueadores que exigem resultado terminalmente verde.

## 7) Âncoras de Fiscalização

Fontes primárias de aplicação:

1. `.husky/*`
2. Scripts de qualidade e governança `ci-cd/*`
3. `documentação/md/TESTING-CI-AND-QUALITY.md`
4. `documentação/md/JUMENTIX-PROJECT-GOVERNANCE.md`
5. `.agents/requirements/065-commit-push-integrity-and-real-ci-enforcement.md`
6. `.agents/requirements/067-bidirecional-task-pr-traceability-governance.md`
