# Integrações canônicas e CI privada gratuita

`XpertMinds/Jumentix` permanece como repositório privado canônico. O Requisito
113 substitui serviços pagos indisponíveis por contratos rastreados e
reproduzíveis. Check obrigatório ausente, ignorado, cancelado, expirado ou com
falha nunca é verde.

## Contrato canônico

| Área | Contrato gratuito obrigatório | Papel |
| --- | --- | --- |
| CI | Workflows GitHub Actions deste repositório | Executor canônico das PRs para `dev`, promoções para `main` e branches protegidas |
| Cobertura | repository-owned coverage, artefatos JSON/LCOV e limites de projeto e patch | Autoridade canônica sem conta ou token externo |
| Qualidade | Gate Bun por branch e build/smoke/prepublish do Storybook | Validação obrigatória de produto e governança |
| SAST/qualidade | SonarQube Cloud | Defesa em profundidade enquanto houver gratuidade para projeto privado |
| Dependências | Scanner próprio via OSV.dev e Dependabot | Vulnerabilidades fail-closed e propostas de atualização |
| Segredos | Scanner OSS fixado executado pelo GitHub Actions | Substituto próprio para checks pagos em PR |
| Achados de PR | Reviewdog recebe scanners OSS fixados | Review third-party inline sem entregar o source a um SaaS hospedado |
| Deploy | Build reproduzível e deploy manual documentado | Fallback gratuito sem Git binding privado da organização |

## Serviços aposentados ou opcionais (2026-08-01)

- **CircleCI retired / aposentado:** o pipeline duplicado e o webhook deixaram
  de ser autoridade. GitHub Actions e os mesmos comandos Bun locais fazem os gates.
- **Codecov retired / aposentado:** checks privados exigem plano pago. O próprio
  repositório calcula e publica cobertura de projeto e patch.
- **GitGuardian aposentado:** checks de PR privada de organização exigem plano
  pago. Um scanner OSS fixado assume o gate.
- Cursor Bugbot é opcional porque a cota pode impedir resultado terminal;
  scanners via Reviewdog fornecem achados determinísticos.
- O Git binding da Vercel é opcional no Hobby. O build continua obrigatório e
  existe fallback manual auditável.
- SonarQube Cloud é defesa em profundidade, não dono único da cobertura ou
  segurança. Mudanças no plano não removem os gates próprios.

## Implementação do review third-party em PR

O check obrigatório `third-party-review` executa Gitleaks `8.30.1`, Semgrep
`1.172.0` e Reviewdog `0.21.0`. Arquivos de release são validados por checksum,
a imagem Semgrep é fixada por digest OCI e a política vive em `.semgrep.yml`.
Reviewdog publica os achados SARIF como reviews no GitHub; os status dos scanners
são aplicados separadamente para que publicar comentário não esconda falha. O
source permanece dentro do runner do GitHub.

## Regras fail-closed

1. Actions usam permissão mínima e SHAs imutáveis.
2. Segredos nunca são impressos, copiados de cofres legados ou commitados.
3. Gates canônicos de branch, cobertura, website, segurança, governança e
   resolução de conversas precisam terminar com sucesso.
4. `--no-verify`, merge admin/forçado, status falso ou relaxamento temporário
   não constituem evidência.
5. A proteção de branch exige somente checks determinísticos dos workflows.

## Validação pertencente ao repositório

```bash
bun run ci:gate:branch
bun run integrations:check
bun run test:coverage
bun run coverage:check
bun run coverage:patch
```

Os mesmos comandos executam localmente e no GitHub Actions. O workflow retém
artefatos de cobertura para auditoria independente do Codecov.

## Rollback e mudanças de provedor

Vínculos podem ser removidos de forma independente. Um substituto só se torna
obrigatório por requisito governado e PR aprovada para `dev`; badges externos
verdes nunca sobrepõem a evidência do repositório.
