<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/documentation/WEBSITE-IA-AND-CONVERSION-PLAN.md
Idioma alvo: Português (Brasil)
-->
# IA do site Jumentix e plano de conversão

Rastreamento de problemas:

- Épico: [#124](https://github.com/XpertMinds/Jumentix/issues/124)
- Tarefa: [#125](https://github.com/XpertMinds/Jumentix/issues/125)

## 1. Objetivo

Defina a arquitetura de informações do site comercial e a jornada de conversão antes da implementação para reduzir incertezas e retrabalho.

## 2. Metas de conversão primárias

1. Gere leads empresariais qualificados (demonstração/contato).
2. Mover os avaliadores técnicos para documentação e guias de implementação.
3. Converta o interesse em adoção piloto (comece com um primeiro serviço/aplicativo).

## 3. Modelo de CTA

CTA principal:

- `Reserve uma demonstração empresarial`

CTAs secundários:

- `Iniciar um piloto com Jumentix`
- `Explorar documentação técnica`
- `Fale com a equipe de arquitetura`

Zonas de CTA persistentes:

- Botão CTA de navegação no cabeçalho
- Grupo Hero CTA
- Tiras CTA de final de seção
- Bloco de conversão de rodapé

## 4. Mapa do site (site estático)

1. `/` Home (narrativa comercial, confiança, posicionamento, CTA)
2. Visão geral do produto `/produto` (capacidades e resultados)
3. `/use-cases` Índice de casos de uso
4. `/use-cases/rest-api`
5. `/use-cases/realtime-api`
6. `/use-cases/saas-monolith`
7. `/use-cases/saas-microservices`
8. `/use-cases/spa-pwa`
9. `/architecture` Narrativa da arquitetura corporativa
10. Adaptadores `/integrations`, bancos de dados, opções de tempo de execução
11. `/security-compliance` Postura de segurança e governança
12. `/docs` Gateway de documentos técnicos (links para o índice de documentos)
13. `/pricing-or-engagement` Modelo de engajamento comercial (conteúdo estático inicial)
14. `/contact` Captura de leads e contato empresarial

## 5. Fluxo da jornada do comprador

1. Conscientização:
   - Home -> Proposta de valor do produto -> sinais de credibilidade/confiança.
2. Consideração:
   - Produto -> Casos de uso -> Arquitetura/Integrações.
3. Validação técnica:
   - Gateway de documentos -> hubs de componentes -> guias de implementação.
4. Decisão:
   - CTA de contato/demonstração com proposta piloto explícita.

## 6. Blocos de conteúdo de página estática necessários

Lar:

- Narrativa do problema
- Diferenciação Jumentix
- Métricas de resultados/ROI
- Bloco de CTA

Produto:

- Pilares de capacidade (arquitetura, adaptadores, governança, implantação)
- Valor por persona (CTO, Product Owner, Gerente de Engenharia, Equipe de Plataforma)

Páginas de casos de uso:

- Contexto empresarial
- Por que Jumentix se encaixa
- Padrão de entrega esperado
- CTA para piloto/demonstração

Arquitetura/Integrações:

- DDD/EDA/narrativa hexagonal
- Matriz de estrutura e opções de banco de dados
- Flexibilidade de tempo de execução/implantação

Segurança/conformidade:

- Resumo da postura de endurecimento PCI
- Portões de qualidade CI e padrões de rastreabilidade

Contato:

- Espaço reservado para formulário de solicitação empresarial
- Opções de engajamento e SLAs de resposta esperados

## 7. Mapeamento da fonte para o site do Markdown

| Seção do site | Remarcação de origem |
| --- | --- |
| Posicionamento do produto | `/README.md` |
| Narrativa de arquitetura | `/documentação/md/ARQUITETURA-E-ESTRUTURA.md` |
| Visão/governança do projeto | `/documentation/md/PROJECT-OVERVIEW.md`, `/documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md` |
| Caso de uso REST | `/apps/backend-template/documentation/guides/CREATING-REST-API-WITH-JUMENTIX.md` |
| Caso de uso em tempo real | `/apps/backend-template/documentation/guides/CREATING-REALTIME-API-WITH-JUMENTIX.md` |
| Caso de uso SPA/PWA | `/apps/service-management/documentation/guides/CREATING-SPA-PWA-WITH-JUMENTIX.md` |
| Caso de uso monolítico SaaS | `/documentation/md/guides/CREATING-SAAS-MONOLITH-WITH-JUMENTIX.md` |
| Caso de uso de microsserviços SaaS | `/documentation/md/guides/CREATING-SAAS-MICROSERVICES-WITH-JUMENTIX.md` |
| Matriz de integrações | `/documentação/md/adapters/http/README.md`, `/documentação/md/adapters/databases/README.md` |
| Segurança/conformidade | `/documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`, `/documentation/md/SECURITY-RUNBOOK-PCI.md` |
| Portal de documentos técnicos | `/documentação/README.md` |

## 8. Notas de Governança e Execução

- Todas as páginas são estáticas e versionadas com código do repositório.
- O modelo de conteúdo deve preservar a rastreabilidade até os arquivos de markdown de origem.
- Os PRs que implementam este plano devem mapear os resultados da página para as questões `#125` e `#124`.
