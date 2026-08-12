# backend-template (backend de referência)

Reference Node/Bun backend that shows how Jumentix wires REST, realtime, and persistence adapters around domain use-cases.

## O que é

Reference Node/Bun backend that shows how Jumentix wires REST, realtime, and persistence adapters around domain use-cases.

## Por que existe

Juniores precisam de um app concreto para abrir — não só APIs de pacotes.

## Responsabilidade no escopo

- **Responsável por:** a runnable reference service composition (HTTP/realtime adapters + use-cases) juniors can copy patterns from
- **Camada:** application / adapters (server)
- **Usado com:** persistence packages, SDK clients, REST/Realtime guides
- **Não responsável por:** browser offline storage (Cana) or private monorepo tooling pages


## Pré-requisitos

- [Começando](/docs/pt-BR/jumentix/concepts/getting-started)
- Bun 1.3.14+

## Glossário

- **App de referência** — aplicação no monorepo usada como composição de ensino.

## Passos numerados

1. Abra `apps/backend-template` no monorepo.
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

[/docs/jumentix/guides/rest-api](/docs/pt-BR/jumentix/guides/rest-api)
