# Integrações canônicas e rebinding de provedores

`web2solutions/Jumentix` é o repositório público canônico. O Requisito 113
mantém CI e evidência de qualidade em modo fail-closed usando planos gratuitos
para open source.

## Contrato canônico

| Área | Contrato obrigatório | Papel |
| --- | --- | --- |
| CI | Workflow GitHub Actions canônico deste repositório | Orquestrador canônico das PRs para `dev`, promoções para `main` e branches protegidas; runner GitHub-hosted `ubuntu-latest` |
| CI secundário | CircleCI habilitado para o repositório público | Espelho independente do mesmo classificador de contexto e nomes de jobs |
| Cobertura | Job de cobertura do repositório, artefatos JSON/LCOV e thresholds de projeto e patch | Autoridade canônica; Codecov é o dashboard público |
| Publicação Codecov | Upload pelo Codecov CLI com `CODECOV_TOKEN` | Mapa de cobertura arquivo a arquivo após os thresholds próprios passarem |
| Qualidade | Gate Bun por branch e build/smoke/prepublish do Storybook | Validação obrigatória de produto e governança |
| SAST/qualidade | Projeto SonarQube Cloud `web2solutions_Jumentix` | Dashboard público de qualidade, confiabilidade, segurança e cobertura |
| Dependências | Scanner próprio via OSV.dev e Dependabot | Detecção fail-closed de vulnerabilidades e propostas de atualização |
| Segredos | Scanner OSS fixado executado no CI | Review de segredos controlado pelo repositório sem checks privados pagos |
| Achados de PR | Artefatos SARIF de scanners OSS fixados | Evidência de review third-party sem dar autoridade única a reviewer hospedado |
| Deploy | Build reproduzível e deploy documentado | Validação de build continua obrigatória antes de release |

## Serviços ativos

- **GitHub Actions canônico:** `.github/workflows/ci.yml` roda em
  `ubuntu-latest`, executa gates baratos até `dev` e reserva a matriz completa
  para `dev -> main`, `main` e execuções completas agendadas/manuais.
- **CircleCI habilitado:** `.circleci/config.yml` espelha o mesmo classificador
  de contexto. Jobs não exigidos pelo destino atual encerram com sucesso antes
  de iniciar trabalho pesado.
- **Publicação Codecov:** o job completo de cobertura envia LCOV depois que os
  thresholds locais de projeto e patch passam. Codecov é dashboard, não
  autoridade de threshold.
- **SonarQube Cloud:** o scanner roda depois da cobertura completa nos contextos
  de release/main e lê os mesmos caminhos LCOV declarados em
  `sonar-project.properties`.
- **GitGuardian/Cursor Bugbot/Vercel:** continuam como visibilidade externa ou
  superfícies de deploy opcionais. A evidência obrigatória permanece nos
  workflows do repositório.

## Regras fail-closed

1. Jobs de CI usam ferramentas fixadas, dependências congeladas e evidência auditável.
2. Segredos nunca são impressos, copiados de cofres legados ou commitados.
3. Gates de branch, cobertura, website, segurança, governança e resolução de
   conversas precisam terminar com sucesso quando selecionados.
4. `--no-verify`, merge admin/forçado, status falso ou relaxamento temporário
   não constituem evidência.
5. A proteção de branch exige somente checks determinísticos emitidos por
   workflows rastreados. Provedores opcionais nunca bloqueiam uma PR por ausência.

## Validação pertencente ao repositório

```bash
bun run ci:gate:branch
bun run integrations:check
```

Os mesmos comandos sem cobertura pesada executam localmente e no CI. O produtor
de cobertura pesada e o gate de thresholds rodam em promoções para `main`,
pushes em `main` e execuções completas agendadas, depois enviam LCOV ao Codecov
e SonarQube Cloud para visibilidade.

## Rollback e mudanças de provedor

Vínculos podem ser removidos de forma independente. Um substituto só se torna
obrigatório por requisito governado e PR aprovada para `dev`; badges externos
verdes nunca sobrepõem a evidência do repositório.
