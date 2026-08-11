<!--
Arquivo gerado automaticamente a partir de: documentation/md/guides/CREATING-SAAS-MONOLITH-WITH-JUMENTIX.md
Idioma alvo: Português (Brasil)
-->
# Criando SaaS Monolith com Jumentix

Use esse caminho quando desejar uma entrega rápida com limites modulares fortes e um caminho de migração futuro limpo.

## Estratégia recomendada

1. Comece com contextos limitados no Domain Designer.
2. Mantenha cada domínio isolado através de portas/adaptadores e contratos explícitos.
3. Expor interfaces via REST e, opcionalmente, canais em tempo real.
4. Mantenha a infraestrutura conectável por meio de pacotes de espaço de trabalho (`@jumentix/*`).

## Por que isso funciona

- Primeiro lançamento de produção mais rápido.
- Menor complexidade operacional do que os primeiros microsserviços.
- Limpe o caminho de extração quando a escala ou os limites da equipe exigirem divisão de serviço.

## Plano de entrega

1. Projetar modelo de domínio e contratos (OpenAPI/AsyncAPI).
2. Implementar fluxos de domínio/casos de uso/controlador.
3. Execute em uma unidade de implantação com processos gerenciados por PM2.
4. Adicione controles de observabilidade e conformidade.
5. Valide os portões de qualidade e os limites de cobertura antes de cada push.

## Público-alvo

- Equipes de produto validando novas propostas de SaaS rapidamente.
- Equipes de engenharia que precisam de manutenção sem excesso de arquitetura muito cedo.

## Documentos relacionados

- [Arquitetura e Estrutura](/docs/jumentix/concepts/architecture)
- [Hub de modelo de back-end](/docs/jumentix/guides/rest-api)
- Implantar matriz de destino e empacotamento


## Próximos passos

1. [Começando](/docs/pt-BR/jumentix/concepts/getting-started)
2. [REST](/docs/pt-BR/jumentix/guides/rest-api)

## Checklist júnior (“Eu consigo …”)

- [ ] Explico o objetivo deste guia em uma frase
- [ ] Completei o primeiro sucesso sem adivinhar jargão
- [ ] Sei a próxima página de docs a abrir

