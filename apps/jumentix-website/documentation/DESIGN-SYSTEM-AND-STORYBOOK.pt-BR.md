# Design System e Storybook do site Jumentix

Rastreamento:

- Épico: [#167](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/167)
- Tarefa: [#170](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/170)

## Propósito

O design system do Jumentix oferece às páginas comerciais e à documentação técnica uma linguagem
visual única, acessível e orientada a código. A interface fundamental permanece próxima ao pacote
do site, e cada estado reutilizável pode ser inspecionado antes de chegar a uma página ou deploy.

O design usa geometria compacta, superfícies neutras, azul e verde operacionais e sinais em coral
e amarelo. Produtos de referência informam a densidade e os padrões de navegação, mas o Jumentix
mantém identidade própria.

## Inventário de componentes

| Componente | Responsabilidade |
| --- | --- |
| `BrandMark` | Identidade estável do produto e link inicial |
| `ActionLink` | Ações primárias, secundárias, discretas e externas |
| `StatusBadge` | Estados neutro, sucesso e atenção |
| `SectionHeading` | Contexto, título e narrativa de apoio |
| `FeatureGrid` | Resumos responsivos de capacidades |
| `Callout` | Orientações informativas, de sucesso e de alerta |
| `MetricStrip` | Métricas comparáveis de produto e engenharia |
| `CapabilityTable` | Matriz compacta de implementações |
| `CodeShowcase` | Abas de código acessíveis e ação de cópia |
| `SearchField` | Controle estável de busca na documentação |
| `Pagination` | Navegação anterior, próxima e numerada |
| `LocaleSwitch` | Controle explícito de idioma EN/PT-BR |
| `SiteHeader` | Navegação de produto e ação para o repositório |
| `SiteFooter` | Navegação de produto, aprendizado e comunidade |
| `DocsToolbar` | Busca, edição e idioma na documentação |
| `ArchitectureFlow` | Diagramas responsivos de arquitetura e fluxo |

O ponto de entrada público é `components/design-system/index.tsx`. Os estilos fundamentais estão
divididos entre `tokens.css` e `DesignSystem.module.css`.

## Capacidades do Storybook

O Storybook está configurado para:

- Next.js, React, Mantine e arquivos estáticos locais;
- documentação gerada dos componentes;
- análise de acessibilidade que trata violações como erro;
- inspeção em temas claro e escuro;
- histórias em viewports desktop e mobile;
- builds estáticos determinísticos;
- smoke test do manifesto, exigindo histórias fundamentais e tamanho mínimo do catálogo.

O catálogo gera atualmente 42 entradas indexadas, incluindo estados mobile explícitos para o
cabeçalho, fluxo de arquitetura, página comercial do produto e composições comerciais completas.

Evidências visuais:

- [Catálogo de componentes](./research/storybook-design-system.png)
- [Componentes no tema escuro](./research/storybook-dark-theme.png)
- [Cabeçalho mobile em 320 px](./research/storybook-mobile-header.png)

## Comandos

Na raiz do monorepo:

```bash
pnpm run website:storybook
pnpm run website:storybook:build
pnpm run website:storybook:smoke
```

Em `apps/jumentix-website`:

```bash
pnpm run storybook
pnpm run storybook:build
pnpm run storybook:smoke
```

O comando smoke espera um build atualizado em `storybook-static`. A saída gerada é ignorada pelo
Git.

## Responsabilidade do workflow

O Storybook pertence exclusivamente ao workflow de `apps/jumentix-website`. Seu servidor de
desenvolvimento, build estático, validação smoke, verificações de acessibilidade e testes de
componentes são gates de qualidade do website.

O Storybook não faz parte do workflow principal do monorepo nem de sua matriz global de testes.
Ele não deve bloquear pacotes, aplicações, templates de backend ou serviços não relacionados. Os
comandos raiz `website:storybook*` são atalhos que delegam para este workspace e não transferem a
responsabilidade do workflow para a raiz do monorepo.

O workflow com filtro de caminhos `.github/workflows/website.yml` é o responsável pela CI
hospedada. Ele executa somente quando entradas pertencentes ao website mudam e valida o build
estático do Storybook, o smoke do inventário e a preparação do website para publicação. O
workflow global `.github/workflows/test.yml` nunca executa o Storybook.

## Fluxo de contribuição

1. Adicione ou atualize o componente reutilizável em `components/design-system`.
2. Reutilize tokens existentes antes de criar um novo token semântico.
3. Exporte o componente pelo ponto de entrada do design system.
4. Adicione uma história significativa, incluindo estados interativos, responsivos, vazios ou de
   erro quando aplicável.
5. Verifique foco por teclado, nomes acessíveis, contraste, modo escuro, layout mobile e redução de
   movimento.
6. Execute typecheck, build do Storybook e smoke do Storybook.
7. Reutilize o componente nas páginas de produto ou documentação em vez de duplicar a marcação.

## Restrições de design

- Cards e superfícies emolduradas usam raios de no máximo oito pixels.
- Formas de pílula ficam reservadas a indicadores compactos de estado.
- O tamanho do texto não escala diretamente com a largura da viewport.
- Movimentos respeitam `prefers-reduced-motion`.
- Tabelas e exemplos de código usam rolagem horizontal em vez de quebrar o layout mobile.
- Controles apenas com ícones sempre possuem nomes acessíveis e tooltips quando necessário.
- Widgets de código são preferidos quando uma capacidade é melhor demonstrada com contratos ou
  comandos executáveis.
