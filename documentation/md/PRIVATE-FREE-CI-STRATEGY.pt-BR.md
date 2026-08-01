# Estratégia gratuita de CI para repositório privado

## Decisão

O Jumentix permanece privado sob `XpertMinds`. GitHub Actions é o orquestrador
canônico; quando um serviço cobra pela validação de repositório privado, a
evidência é gerada e retida pelo próprio repositório. Checks obrigatórios falham
fechado: resultado pulado, neutro, ausente, expirado ou pendente nunca é verde.

## Mapa de substituição gratuita

| Serviço aposentado ou instável | Substituição do repositório | Evidência obrigatória |
| --- | --- | --- |
| CircleCI | testes por branch no GitHub Actions | `build (1.3.14, 7.2)` e artefato JSON |
| Codecov | LCOV Jest/Bun, threshold do projeto e linhas alteradas | `coverage`, JSON, LCOV e patch |
| GitGuardian | Gitleaks CLI fixado no GitHub Actions | anotações Reviewdog e `third-party-review` terminal |
| Snyk privado | `bun audit`, integridade de overrides e Semgrep fixado | células de dependência/segurança |
| Revisor hospedado de PR | Semgrep e Gitleaks fixados via Reviewdog | check obrigatório `third-party-review` |

SonarQube Cloud continua como defesa em profundidade enquanto houver cota para o
projeto privado. Ele não é o único proprietário da cobertura ou segurança. Se a
cota desaparecer, os gates do repositório continuam bloqueantes; a proteção só
muda na PR governada que registra a aposentadoria do provedor.

## Plano de gates de pull request

PRs de tarefa miram `dev`; somente promoção de release de `dev` mira `main`.

| Gate | PR de tarefa para `dev` | push em `dev` | promoção `dev -> main` |
| --- | --- | --- | --- |
| Build/teste por branch | obrigatório, testes afetados | unitário canônico | matriz estrita completa |
| Cobertura do repositório | obrigatório | obrigatório | obrigatório |
| Revisão third-party | obrigatório | obrigatório | obrigatório |
| Quality gate Sonar | obrigatório | obrigatório | obrigatório enquanto disponível |
| Qualidade Storybook/site | obrigatório quando disparado | obrigatório | obrigatório |
| Governança/rastreabilidade | obrigatória na matriz | obrigatória | obrigatória |

A matriz estrita cobre toolchain, auditoria de dependências, smoke de
segredos/segurança, arquitetura, workspaces, requisitos/NFR, registry, testes
unitários/integração/e2e, cobertura, OpenAPI/serverless, build e smoke. Toda
célula produz evidência terminal; falhas são corrigidas, nunca contornadas.

## Contrato de cobertura

- Statements, linhas e funções: 99%.
- Branches: 90%.
- Linhas alteradas: 99%.
- GitHub Actions retém JSON e LCOV para auditoria independente do Codecov.
- Badges e mapa de cobertura apontam apenas para workflows canônicos.

## Contrato de revisão third-party

`third-party-review.yml` executa Gitleaks e Semgrep fixados e publica achados com
Reviewdog fixado. Downloads têm checksum, permissões são mínimas, achados anotam
a PR e erro ou finding retorna saída terminal diferente de zero. Tags mutáveis e
`continue-on-error` silencioso são recusados por `ci:check-third-party-review`.

A revisão automática complementa a matriz; não substitui testes, cobertura,
responsabilidade humana ou resolução de comentários válidos.

## Operação e recuperação

1. Manter os checks exatos em `dev` e `main`; aprovação pode ser opcional, mas
   evidência de qualidade e segurança continua obrigatória.
2. Fixar versões e digests. Revisar releases mensalmente e atualizar por PR
   governada com checksum e testes de contrato.
3. Reter gate, cobertura, SARIF e scanners pelo prazo do workflow; nunca incluir
   segredos em logs ou artefatos.
4. Se runners hospedados falharem, usar runner efêmero da XpertMinds com o mesmo
   workflow e sem credenciais persistentes. Execução local é só diagnóstico;
   checks protegidos do GitHub ainda precisam terminar.
5. Se um provedor parar, falhar fechado, registrar no Project Update do Linear,
   substituí-lo por ferramenta fixada e só alterar proteção após ficar verde.
6. Semanalmente: conferir checks/agendamentos. Mensalmente: tokens, pins e
   retenção. Trimestralmente: testar perda de provedor e recuperação de runner.

## Nomes dos checks obrigatórios

- `build (1.3.14, 7.2)`
- `coverage`
- `third-party-review`
- `SonarQube Cloud Scan`
- `storybook`

Cursor Bugbot é neutro/pulado e não é evidência. Outro revisor hospedado só pode
ser defesa adicional; não substitui o workflow fixado e fail-closed.

## Definição de verde

Uma PR só está verde quando todos os checks obrigatórios terminam com sucesso,
achados válidos são resolvidos, rastreabilidade PR/Linear está completa e o merge
protegido ocorre sem `--no-verify`, admin, force ou bypass equivalente.
