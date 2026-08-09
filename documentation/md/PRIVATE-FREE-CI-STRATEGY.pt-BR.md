# Estratégia gratuita de CI para repositório privado

## Decisão

O Jumentix permanece privado sob `XpertMinds`. GitHub Actions voltou a ser o
orquestrador canônico, e CircleCI está desabilitado. Quando um serviço cobra pela
validação de repositório privado, a evidência é gerada e retida pelo próprio
repositório. Checks obrigatórios falham fechado: resultado pulado, neutro,
ausente, expirado ou pendente nunca é verde.

## Mapa de substituição gratuita

| Serviço aposentado ou instável | Substituição do repositório | Evidência obrigatória |
| --- | --- | --- |
| Drift de CI hospedada | workflow GitHub Actions por branch | `branch-gate` e artefato JSON |
| Checks privados Codecov | LCOV Jest/Bun, threshold do projeto e linhas alteradas, depois upload Codecov CLI no GitHub Actions | `coverage`, JSON, LCOV, patch e upload `codecov` |
| GitGuardian | Gitleaks CLI fixado no GitHub Actions | artefatos SARIF e `third-party-review` terminal |
| Snyk privado | `bun audit`, integridade de overrides e Semgrep fixado | células de dependência/segurança e artefatos SARIF |
| Revisor hospedado de PR | scanners Semgrep e Gitleaks controlados pelo repositório | check obrigatório `third-party-review` |

SonarQube Cloud continua como defesa em profundidade enquanto houver cota para o
projeto privado. Ele não é o único proprietário da cobertura ou segurança. Se a
cota desaparecer, os gates do repositório continuam bloqueantes; a proteção só
muda na PR governada que registra a aposentadoria do provedor.

## Plano de gates de pull request

PRs de tarefa miram `dev`; somente promoção de release de `dev` mira `main`.

| Gate | PR de tarefa para `dev` | push em `dev` | promoção `dev -> main` |
| --- | --- | --- | --- |
| Build/teste por branch | obrigatório, testes afetados por camada | unitário health | matriz estrita completa |
| Cobertura do repositório | adiada para promoção | adiada para promoção | obrigatória |
| Revisão third-party | obrigatória | não obrigatória | obrigatória |
| Quality gate Sonar | adiado para promoção | adiado para promoção | obrigatório enquanto disponível |
| Qualidade Storybook/site | somente quando selecionada pelo mapa | adiada para promoção | obrigatória |
| Governança/rastreabilidade | obrigatória no gate barato | obrigatória | obrigatória |

PRs de tarefa para `dev` têm alvo operacional de dez minutos ou menos. O
`branch-gate` classifica o contexto, lê `test-map.json` e executa apenas suites
afetadas/relacionadas, mais checks leves de governança e segurança. A matriz
estrita cobre toolchain, auditoria de dependências, smoke de segredos/segurança,
arquitetura, workspaces, requisitos/NFR, registry, testes unitários/integração/e2e,
cobertura, OpenAPI/serverless, build e smoke. Toda célula produz evidência
terminal; falhas são corrigidas, nunca contornadas.

## Contrato de cobertura

- Statements, linhas e funções: 99%.
- Branches: 90%.
- Linhas alteradas: 99%.
- GitHub Actions retém JSON e LCOV para auditoria independente e envia LCOV ao Codecov para visibilidade.
- Gates locais e PRs até `dev` ficam rápidos: cobertura completa e patch coverage são obrigatórios no GitHub Actions para promoções `dev -> main`, pushes em `main` e execuções completas agendadas.
- Badges e mapa de cobertura apontam apenas para workflows canônicos.

## Contrato de revisão third-party

O job GitHub Actions `third-party-review` executa Gitleaks e Semgrep fixados.
Downloads têm checksum, SARIF é retido e erro ou finding retorna saída terminal
diferente de zero. Tags mutáveis e `continue-on-error` silencioso são recusados
por `ci:check-third-party-review`.

A revisão automática complementa a matriz; não substitui testes, cobertura,
responsabilidade humana ou resolução de comentários válidos.

## Operação e recuperação

1. Manter os checks exatos em `dev` e `main`; aprovação pode ser opcional, mas
   evidência de qualidade e segurança continua obrigatória.
2. Fixar versões e checksums. Revisar releases mensalmente e atualizar por PR
   governada com checksum e testes de contrato.
3. Reter gate, cobertura, SARIF e scanners pelo prazo do workflow; nunca incluir
   segredos em logs ou artefatos.
4. Se a capacidade hospedada falhar, usar runner GitHub Actions efêmero da
   XpertMinds com os mesmos comandos Bun e sem credenciais persistentes. Execução local é só
   diagnóstico; checks remotos protegidos ainda precisam terminar.
5. Se um provedor parar, falhar fechado, registrar no Project Update do Linear,
   substituí-lo por ferramenta fixada e só alterar proteção após ficar verde.
6. Semanalmente: conferir checks/agendamentos. Mensalmente: tokens, pins e
   retenção. Trimestralmente: testar perda de provedor e recuperação de runner.

## Nomes dos checks obrigatórios

- `branch-gate`
- `coverage`
- `third-party-review`
- `website`
- `workspace-builds`
- `workspace-tests`
- `integration`
- `database-matrix`

Cursor Bugbot é neutro/pulado e não é evidência. Outro revisor hospedado só pode
ser defesa adicional; não substitui o workflow fixado e fail-closed.

## Definição de verde

Uma PR só está verde quando todos os checks obrigatórios terminam com sucesso,
achados válidos são resolvidos, rastreabilidade PR/Linear está completa e o merge
protegido ocorre sem `--no-verify`, admin, force ou bypass equivalente.
