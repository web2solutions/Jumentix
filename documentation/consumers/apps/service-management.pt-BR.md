# service-management (SPA Domain Designer)

Service Management app hosting the Domain Designer UI; uses designer-core for model logic and Cana for offline persistence.

## O que é

Service Management app hosting the Domain Designer UI; uses designer-core for model logic and Cana for offline persistence.

## Por que existe

Juniores precisam de um app concreto para abrir — não só APIs de pacotes.

## Responsabilidade no escopo

- **Responsável por:** the Service Management product UI and designer workflows
- **Camada:** application (browser)
- **Usado com:** `@jumentix/designer-core`, `@jumentix/cana`, SPA/PWA guide
- **Não responsável por:** server OpenAPI gateways or Redis KV


## Pré-requisitos

- [Começando](/docs/pt-BR/jumentix/concepts/getting-started)
- Bun 1.3.14+

## Glossário

- **App de referência** — aplicação no monorepo usada como composição de ensino.

## Passos numerados

1. Abra `apps/service-management` no monorepo.
2. Leia o README para scripts locais.
3. Siga o guia ligado para o primeiro sucesso.
4. Vá aos pacotes que sustentam o app.

## Erros comuns

| Sintoma | Causa | Correção |
|---------|-------|----------|
| Procurar docs de pacotes privados no site | Pacotes excluídos | Use só o hub público de pacotes |

## Checklist júnior (“Eu consigo …”)

- [ ] Explico o app em uma frase
- [ ] Sei qual guia abrir em seguida
- [ ] Sei que tooling privado não está neste site

## Próximo passo

[/docs/jumentix/guides/spa-pwa](/docs/pt-BR/jumentix/guides/spa-pwa)
