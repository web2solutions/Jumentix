<!--
Arquivo gerado automaticamente a partir de: documentation/md/ARCHITECTURE-AND-STRUCTURE.md
Idioma alvo: Português (Brasil)
-->
# Arquitetura e Estrutura

## Estrutura do Projeto (Atual)

```txt
apps/backend-template/src/
  config/
  infra/                           # cross-cutting infrastructure adapters
  interface/                       # HTTP runtime adapters and transport plumbing
  modules/
    Users/
      adapters/                    # canonical adapter namespace (in/out)
        in/http/controllers/
        out/persistence/
      application/                 # application layer + use-case contracts
        use-cases/
      composition/                 # module wiring/composition root
      domain/                      # core entities/models
      events/                      # integration/domain events contracts/listeners
      features/                    # use-case style operations used by services
      infra/                       # legacy compatibility namespace (bridges)
      interface/                   # legacy compatibility namespace (bridges)
  shared/
```

## Direção da arquitetura alvo

A migração para limites hexagonais mais rígidos baseados em recursos está documentada em:

- [Plano de migração baseado em recursos hexagonais](./HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md)

Destaques atuais já implementados:

- Controladores em Usuários chamam casos de uso de aplicativos, não criação direta de infra-estrutura.
- Os eventos de integração de usuários são padronizados e conectados por meio de composição.
- O CI bloqueia violações de limites do controlador e regressões de dependências cíclicas.
- CI bloqueia novas importações herdadas para namespaces de controlador/repositório de usuários.
- A persistência na memória agora usa semântica de armazenamento genérico de estilo relacional (índices exclusivos, índices de relacionamento) para espelhar o comportamento do adaptador SQL/NoSQL.
- O domínio de usuários inclui agregado de locatário (`Organização`) e política de função RBAC (`superadmin`, `admin`, `user`).

## Responsabilidades da Camada

### Fluxo de solicitação

`Handler -> Controlador -> Caso de uso do aplicativo -> Domínio/Políticas -> Porta do repositório -> Adaptador`

### Fluxo de resposta

`Handler <- Controlador <- Caso de uso do aplicativo <- Domínio/Políticas <- Adaptador de repositório`

### Responsabilidades dos componentes

1. Manipuladores de solicitação HTTP:
   ponto de entrada de infraestrutura para tempo de execução HTTP/Lambda.
2. Controladores:
   validar solicitação e delegar para casos de uso de aplicativos.
3. Casos de uso/serviços de aplicativos:
   orquestrar o comportamento do domínio e as portas de saída.
4. Domínio:
   entidades, objetos de valor, invariantes e políticas de negócios.
5. Portas de repositório:
   abstrações para operações de persistência.
6. Adaptadores:
   implementações concretas para tempo de execução, persistência, segurança, mutex, eventos.

## Limites de locação e autorização

- `superadmin` pode operar sem vinculação à organização.
- `admin` e `user` têm escopo de locatário e devem fazer referência à organização.
- A aplicação de RBAC é implementada no fluxo de domínio/serviço/autenticação dos usuários, não no código de colagem do adaptador HTTP.

## Estratégia de adaptador de persistência

- Adaptador oficial: armazenamento na memória.
- Destino do design: comportamento compatível com contrato para adaptadores de persistência relacionais e NoSQL.
- A implementação atual na memória inclui:
  - aplicação de índice exclusivo (diferencia maiúsculas de minúsculas e não diferencia maiúsculas de minúsculas)
  - suporte para pesquisa de relação (`getByRelation`)
  - comportamento previsível de paginação/filtro

## Diagrama de Classes

Diagrama de arquitetura: <a href="https://miro.com/app/board/uXjVNq5nWJY%3D/?share_link_id=603404471489">placa Miro</a>
