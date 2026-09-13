# Migração dos repositórios canônicos

## Repositórios ativos

O desenvolvimento e a coordenação do Jumentix usam estes repositórios canônicos:

| Responsabilidade | Repositório canônico |
| --- | --- |
| Produto, código, requisitos, especificações, documentação, CI e releases | `web2solutions/Jumentix` |
| Registro de agentes, atribuições e checagens de branches | `XpertMinds/jumentix-agent-registry` |

Novos trabalhos devem ser criados somente nesses repositórios. O acesso exige
uma identidade autorizada pelo proprietário do projeto e registrada no Linear.

## Repositórios obsoletos

Os repositórios abaixo são históricos, somente leitura e não aceitam novas
modificações:

- `web2solutions/aaa-typescript-boilerplate`
- `web2solutions/jumentix-agent-registry`

Eles permanecem arquivados após a PR final de migração para `dev`. Links
existentes podem ser mantidos somente quando estiverem claramente identificados
como evidência histórica de entrega.

## Clone e configuração do registry

```bash
git clone git@github.com:web2solutions/Jumentix.git
cd Jumentix
git switch dev
bun install --frozen-lockfile
```

Consumidores do Agent Registry configuram `GITHUB_TOKEN` ou `GH_TOKEN` com
acesso privado de leitura. O token nunca deve ser registrado em logs, commitado,
incluído em URLs ou copiado para a documentação. Os mirrors fixam o commit
imutável completo do registry.

## Política de entrega

- Branches de tarefa partem de `dev` e têm `dev` como destino.
- Títulos de PR começam com o ID correspondente do Linear:
  `[JUM-XXXX][Nature]`.
- A contagem de aprovações de revisão é opcional.
- CI, qualidade, cobertura, segurança, governança, rastreabilidade e resolução
  de comentários válidos permanecem obrigatórios.
- Checks ausentes, com falha, ignorados, cancelados, expirados ou incompletos não
  são evidência de aprovação e não podem receber bypass.

## Rastreabilidade

- Requisito: `103`, `104`
- Epic do Linear: `JUM-562`
- Tarefa de documentação: `JUM-563`
- Tarefa de integrações da aplicação: `JUM-568`
- Contrato de integração: `INTEGRATION-MIGRATION-REQUIREMENT.pt-BR.md`
