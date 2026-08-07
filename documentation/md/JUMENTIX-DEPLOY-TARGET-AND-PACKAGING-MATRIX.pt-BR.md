<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX.md
Idioma alvo: Português (Brasil)
-->
# Jumentix Deploy Target e Matriz de Embalagem

## Objetivo

Defina alvos de implantação e contratos de empacotamento de artefatos para serviços de back-end e front-end gerenciados pelo Jumentix.

## Implantar matriz de destino

| Implantar destino | Tipos de serviço | Gerenciador de tempo de execução | Contrato de Embalagem | Caminho de entrega |
|---|---|---|---|---|
| Servidor Dedicado (SSH) | REST, WebSocket+REST, gRPC+REST, front-end | PM2 | Resultado da construção + perfil do ecossistema PM2 | Implantação SSH + recarga PM2 |
| Instância de nuvem VM (VM EC2/GCE/Azure) | REST, WebSocket+REST, gRPC+REST, front-end | PM2 | Resultado da construção + perfil do ecossistema PM2 + contrato ambiental | Implantação IaC/SSH + orquestração PM2 |
| AWS Lambda | APIs de funções | Estrutura sem servidor | Pacote de funções + configuração sem servidor + contrato env | `implantação sem servidor` |
| Funções Vercel | APIs de funções | Tempo de execução do Vercel | Pontos de entrada da função Vercel + configuração | Fluxo de trabalho de implantação do Vercel |
| Trabalhadores da Cloudflare | APIs de função/evento | Tempo de execução do trabalhador | Pacote de módulo de trabalho + configuração de trabalhador | Implantação do Wrangler/Worker |

## Leitor legível por máquina

O suporte modo de execução × provedor de nuvem derivado desta matriz é mantido
como dados em `apps/service-management/src/model/deployCapabilityMatrix.js`
(extraído pelo JUM-544 para que a guia Configuração do Serviço e os alvos de
implantação do JUM-481 validem contra uma única fonte compartilhada em vez de
duas transcrições). A guia Configuração do Serviço do designer a aplica no
momento da gravação (JUM-544): combinações sem alvo de implantação nesta
matriz são rejeitadas. Qualquer alteração nesta matriz deve atualizar esse
módulo — e vice-versa — no mesmo PR.

## Contratos de embalagem

| Tipo de artefato | Arquivos obrigatórios | Portão de validação |
|---|---|---|
| Serviço VM de back-end | `package.json`, saída de compilação, ecossistema PM2, modelo de ambiente | `ci:gate`, construção, testes de fumaça |
| Serviço em tempo real | Contrato AsyncAPI, ponto de entrada do adaptador de tempo de execução, fiação de fallback REST | testes unitários + integração em tempo real |
| Pacote de funções | manipuladores de função, manifesto de implantação (`serverless` ou configuração de plataforma), modelo de env | função fumaça + verificações de contrato |
| Front-end SPA/PWA | saída de compilação de aplicativo, mapeamento de ambiente de tempo de execução, configuração de armazenamento offline | construção/teste/portões de lint de frontend |
| Pacote Compartilhado (npm) | `package.json` semver, lista de permissões de `files`, saídas de tipo/construção | governança de lançamento + publicação de teste |

## Contrato de metadados de gerenciamento de serviços

O Gerenciamento de Serviços deve rastrear, por serviço:

- `serviceType`: `restapi`, `websocket+restapi`, `grpc+restapi`, `funções`
- `deployTarget`: `servidor dedicado`, `vm`, `ec2`, `lambda`, `vercel-functions`, `cloudflare-workers`
- `runtimeProtocol`: `http`, `websocket`, `grpc`
- `databaseDriver`: selecionado `JUMENTIX_DATABASE_DRIVER`
- `keyValueDriver`: selecionado `JUMENTIX_KEYVALUESTORAGE_DRIVER`
- `pm2Profile`: `dev`, `staging`, `production` (para implantações baseadas em VM)

## Critérios de aceitação

- Cada tipo de serviço tem pelo menos um destino de implantação e um contrato de pacote válidos.
- As implantações baseadas em VM priorizam o PM2 e mantêm os processos separados por interface.
- As metas de função mantêm contratos de embalagem nativos do fornecedor.
- A governança de lançamento bloqueia a publicação de artefatos com metadados inválidos.
