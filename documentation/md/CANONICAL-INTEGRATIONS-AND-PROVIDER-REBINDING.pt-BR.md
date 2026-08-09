# Integrações canônicas e CI privada gratuita

`XpertMinds/Jumentix` permanece como repositório privado canônico. O Requisito
113 substitui serviços pagos indisponíveis por contratos rastreados e
reproduzíveis. Check obrigatório ausente, ignorado, cancelado, expirado ou com
falha nunca é verde.

## Contrato canônico

| Área | Contrato gratuito obrigatório | Papel |
| --- | --- | --- |
| CI | Workflow GitHub Actions canônico deste repositório | Executor canônico das PRs para `dev`, promoções para `main` e branches protegidas; CircleCI desabilitado |
| Cobertura | Job GitHub Actions de cobertura, artefatos JSON/LCOV e limites de projeto e patch | Autoridade canônica; publicação Codecov é visibilidade |
| Publicação Codecov | Upload pelo Codecov CLI no GitHub Actions com `CODECOV_TOKEN` | Espelho de dashboard após os thresholds próprios passarem |
| Qualidade | Gate Bun por branch e build/smoke/prepublish do Storybook | Validação obrigatória de produto e governança |
| SAST/qualidade | SonarQube Cloud | Defesa em profundidade enquanto houver gratuidade para projeto privado |
| Dependências | Scanner próprio via OSV.dev e Dependabot | Vulnerabilidades fail-closed e propostas de atualização |
| Segredos | Scanner OSS fixado executado pelo GitHub Actions | Substituto próprio para checks pagos em PR |
| Achados de PR | Artefatos SARIF de scanners OSS fixados | Evidência de review third-party sem dar autoridade a reviewer hospedado |
| Deploy | Build reproduzível e deploy manual documentado | Fallback gratuito sem Git binding privado da organização |

## Serviços aposentados ou opcionais (2026-08-03)

- **CircleCI desabilitado:** GitHub Actions é o executor hospedado ativo e
  `.circleci/config.yml` não deve voltar sem mudança governada de requisito.
- **Publicação Codecov restaurada:** GitHub Actions envia LCOV pelo Codecov CLI após
  a cobertura própria passar. Codecov não é a autoridade dos thresholds.
- **GitGuardian aposentado:** checks de PR privada de organização exigem plano
  pago. Um scanner OSS fixado assume o gate.
- Cursor Bugbot é opcional porque a cota pode impedir resultado terminal;
  scanners via Reviewdog fornecem achados determinísticos.
- O Git binding da Vercel é opcional no Hobby. O build continua obrigatório e
  existe fallback manual auditável.
- SonarQube Cloud é defesa em profundidade, não dono único da cobertura ou
  segurança. Mudanças no plano não removem os gates próprios.

## Implementação do review third-party em PR

O check obrigatório `third-party-review` executa Gitleaks `8.30.1` e Semgrep
`1.172.0`. Arquivos de release são validados por checksum, o Semgrep é
instalado em um virtualenv local do job com versão fixada e a política vive em `.semgrep.yml`. O GitHub Actions retém
artefatos SARIF; os status dos scanners são aplicados para que publicar
evidência não esconda falha.

## Regras fail-closed

1. Jobs GitHub Actions usam ferramentas fixadas, dependências congeladas e evidência fail-closed.
2. Segredos nunca são impressos, copiados de cofres legados ou commitados.
3. Gates canônicos de branch, cobertura, website, segurança, governança e
   resolução de conversas precisam terminar com sucesso.
4. `--no-verify`, merge admin/forçado, status falso ou relaxamento temporário
   não constituem evidência.
5. A proteção de branch exige somente checks determinísticos dos jobs GitHub Actions.

## Validação pertencente ao repositório

```bash
bun run ci:gate:branch
bun run integrations:check
```

Os mesmos comandos sem cobertura pesada executam localmente e no GitHub Actions. O
produtor de cobertura e o gate de thresholds rodam no job GitHub Actions `coverage`
em promoções de release para `main`, pushes em `main` e execuções completas
agendadas, depois enviam LCOV ao Codecov para visibilidade.

## Rollback e mudanças de provedor

Vínculos podem ser removidos de forma independente. Um substituto só se torna
obrigatório por requisito governado e PR aprovada para `dev`; badges externos
verdes nunca sobrepõem a evidência do repositório.
