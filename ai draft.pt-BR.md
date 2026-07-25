<!--
Arquivo gerado automaticamente a partir de: ai draft.md
Idioma alvo: Português (Brasil)
-->
- Quer ter uma implementação real de "DocumentValueObject" no projeto. Atualmente já há alguma implementação, porém não sei se o que eu implementei realmente refleti o conceito real de "DocumentValueObject" na previsão de DDD para favor verificar e fazer as algerações necessárias
- crie arquivos MD com documentação detalhada de cada entidade de dados e modelos de cada domínio. Regras explícitas, tipos de dados. Adicione link no arquivo Leiame para cada documento MD criado
- Adiciona todos os requisitos feitos à agentes especializados
- Atualize o Readme MD com todas as informações ja pedidas no chat que ainda não foram cumtadas

- a implementação de cloud fare workers deve ser semelhante a lambdas, sem rodar frameworks como express.
- todos os novos frameworks e servidores HTTP adicionais estão usando express.js. Cada implementação deve usar seu próprio servidor HTTP como disponível. Vide Fastify e Restifym eles usam seus próprios servidores. Consulte a documentação de cada um dos frameworks/servidores cloud fare workers, Vercel Functions, LoopBack, Sails.JS, Feathers, derby.js, adonis.js e total.js
- Crie um mapa de eventos / mensagens da aplicação com documentação completa. adicione em um novo md. adicione o link no leia-me.
- Crie um mapa de contrato de erros/respostas de erros com documentação completa. adicione em um novo md. adicione o link no leia-me.

- leia a lógica atual de validação de dados nos manipuladores. expanda para suportar a validação de solicitações em conformidade com a especificação OPEN API 3.1

- o software deve ter pelo menos dois níveis de validação de dados:
1. Manipuladores HTTP - a solicitação deve ser validada de acordo com sua especificação OAS associada definida no documento da API em relação à especificação OPEN API 3.1.
2. Nível de domínio – os modelos devem implementar validação de dados

atualize a CLI geradora de código e os domínios e manipuladores http já implementados.

Considere que o padrão será usado para criar aplicações multi tenancy e single tenancy,

Lidamos inicialmente com 3 funções de usuários: "superadmin", "admin" e "user".

Exceto superadmins, os "admin" e "user" pertencem a uma organização.

Considere que o padrão é 100% agnóstico. Suporta integração com múltiplos componentes externos, mas não depende de nenhum.

Releia a atual implementação de banco de dados em memória.

Ela foi feita de forma rápida.

Ele deve ser comprovado profundamente e refeito para que reflita o uso com bancos de dados relacionais e no-sql.

Os modelos devem suportar relacionamento, independente de tecnologia.

O adaptador oficial é o em memória.

Exemplo de implementação de relacionamento

```typescript
class Post extends Basemodel {
  @belongsTo(() => User)
  author: BelongsTo<typeof User>

  @hasMany(() => Comment)
  comments: HasMany<typeof Comment>
}
```

agora, crie um novo objeto de domínio genérico de endereço "AddressValueObject", como PhoneValueObject.

O novo objeto é o caminho do objeto de endereço usado em todo o sistema.

Os campos são:

```
AddressValueObject {
  id: string;
  email: string;
  type: enum work home vacation;
  isPrimary: boolean;
}
```

agora, Crie uma nova entidade de dados "Organização" no domínio Users. Toda vez que eu peço pra criar uma nova entidade, grito todos os arquivos relacionados de suporte para a entidade.

```JSON
Organization {
  _id: inherit default,
  name: string required
  address: [] array of AddressValueObject
  phone: [] array of PhoneValueObject
  email: [] array of EmailValueObject
  
  @hasMany(() => User)
  users: HasMany<typeof User>
}
```

Agora adicione 2 novos campos em Usuário:

```JSON
{
  organization: not required
}
```

O Sistema deve estar em compliance e implementar RBAC para controle de acesso a cada recurso.

Faça todas as modificações possíveis.

Atualizar os testículos. Crie organizações. Associação de usuários com organizações.

Atualizar documentações e agentes de requisitos.

Evite entregar recursos incompletos.

Obedecça a cobertura.

Execute tudo sem solicitar minha permissão

------

- Todas as entidades de dados devem ter os seguintes campos

```
{
  createdAt: date now required automatically genereated when created
  updatedAt: date now required automatically genereated when created, automatically updated when the model updates.
}
```

Quando uma entidade/modelo de dados possui campos que são arrays de objetos genéricos de domínio como telefone, email, endereço, documento, etc, o modelo deve ter os métodos "createDomainObjectname", "updateDomainObjectname" e "deleteDomainObjectname", onde DomainObjectname é o nome do objeto de domínio, como Phone. Verifique o Modelo do Usuário como referência, agora refatore o modelo da organização. Este é um requisito de ouro do sistema.

agora, sempre que qualquer entidade de dados, modelo, contrato, evento, mensagem, erro, alteração, a documentação do software e a especificação da API OPEN em ./spec/1.0.0.yml devem ser atualizadas adequadamente. revise a especificação da API OPEN em ./spec/1.0.0.yml e certifique-se de que ela oferece suporte ao novo recurso Organização.

Atualizar documentações e agentes de requisitos.

Evite entregar recursos incompletos.

Obedecça a cobertura.

--------------

O diretório "servicemangement" deve ser considerado um projeto independente do boiolerplate em termos de ter seu próprio CI/CD, suíte de testes, pacote, etc, então o aaa-typescript-boilerplate passa a se tornar um monorepo atualmente com 2 projetos: "servicemangement" e "servicetemplate". o "servicemangement" nada mais é que a atualização atual do "aaa-typescript-boilerplate". ambos os projetos são em datilografado,

Leia os requisitos a seguir e crie um plano detalhado de execução, adicione e salve no todo e prossiga com a implementação.

- a especificação da API aberta em /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/spec/1.0.0.yml deve sempre conter uma descrição dos objetos ports referentes às entradas, entradas e respostas dos pontos finais.

Quando um engenheiro de software para usar o "aaa-typescript-boilerplate" para criar um software, ele deverá usar o pnpm install para instalar somente uma CLI que permitirá que ele faça o scafold do novo projeto, clonando o "aaa-typescript-boilerplate" do github na pasta de trabalho local e configurando todo o projeto de acordo com o tipo de serviço que o engenheiro quer desenvolver, por enquanto os tipos de serviços são:

- Servidor com interface HTTP/REST, opcionalmente documentação da API com swagger e open api, com possibilidade de usar arquivos estatísticos para um SPA por exemplo
- Servidor com interface websocket, o servidor irá exportar o controlador, recebendo solicitação seguindo o padrão esperado e respondendo com possibilidade de servir arquivos estatísticos para um SPA por exemplo
- Servidor com interface gRPC, com possibilidade de usar arquivos estáticos para um SPA por exemplo
- Servidor com interface graphql, com possibilidade de usar arquivos estáticos para um SPA por exemplo
- Serviços de conjunto de funções para implantar como funções em amazon, gogle, azure, vercel ou cloudfare

os serviços irão se conectar através de adaptadores a serviços como bancos de dados relacionados e não relacionais

- Deve ser criada uma classe de repositório de dados para bancos sql utilizando o sequelize.js, suportando inicialmente Potgresql, MySQL, SQL Server, Oracle e SQL Light
- Deve ser criada uma classe de repositório de dados para mongo utilizando o mongoose.js
- Deve ser criada uma classe de repositório de dados para bancos no-sql dynamodb utilizando a lib oficial da aws
- Deve ser criada uma classe de repositório de dados para bancos no-sql cassandra
- Deve ser criada uma classe de repositório de dados para bancos no-sql firebase
- Deve ser criada uma classe de repositório de dados para bancos no-sql Aurora / amazon
- Deve ser criada uma classe de repositório de dados para bancos no-sql RDS / amazon
- Deve ser criada uma classe de repositório de dados que envia solicitações e recebe confirmações utilizando um sistema de fila com padrão de mensagem de solicitação-resposta, que seja agnóstico, e suporte bullmq, RabbitMQ,

- deve criar arquivos docker file os que já têm coelhomq e redis para todos os serviços mencionados acima como containers.

renomeie um designer de domínio de macarrão para "servicemanagement".

O aplicativo de gerenciamento de serviço é um aplicativo de layout com guias de UI que possui os seguintes aplicativos

1. Designer de domínio. Use a ferramenta Domain Designer MVP para gerenciar todos os domínios e entidades de dados do "aaa-typescript-boilerplate"
2. Designer de Interface de Comunicação. Use para projetar os adaptadores de interfaces de saída como HTTP (REST) ​​(na verdade já implementado), gRPC, websocket, SSE Server. Essas interfaces recebem. solicitações de fora do contexto de serviço e encaminhadas de acordo aos controladores
3. Configuração do serviço.

O padrão pode ser usado para criar APIs REST, APIs executadas como um conjunto de funções, microsserviços usando diferentes mecanismos de mensagens.

portanto, esta guia deve permitir ao engenheiro configurar exatamente o tipo de software, como ele é executado, qual nuvem, como VM, como função, servidores dedicados, salvar credenciais, todas as informações necessárias para implantação, suporte aws, google, vercel, cloudfare cloud, azure, docker. permitir a integração com os provedores de nuvem permitindo, por exemplo, visualizar os recursos do gateway API. As funções lambdas, azure e google são implantadas com framework serverless, já existe alguma integração serverless no projeto. estendê-lo

- Servidor Dedicado
  através de ssh
- Máquina Virtual
  através de ssh
  EC2?
-API REST
  Servidor Dedicado via ssh
  Instâncias EC2
- APIs de função:
    AWS Lambda / sem servidor
    Funções Vercel
    CloudFare
4. Implantar gerenciamento. A ferramenta de gerenciamento Deploy permite implantar e gerenciar todas as implantações do serviço através de diferentes serviços e arquiteturas.

Se o serviço for um conjunto de funções, ele será implantado como aws, google, azure, funções vercel ou trabalhadores cloudfare. use sem servidor quando for possível.

Se o serviço for um monólito com muitos domínios, ele será implantado em VMs privadas, soluções em nuvem de VMs (aws, google, azure) ou servidores dedicados

Atualizar documentações e agentes de requisitos.

Evite entregar recursos incompletos.

Obedecça a cobertura.

------

Leia o arquivo /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/src/interface/HTTP/RestAPI.ts

Ele é o boostrap usado para criar APIs REST. Ele importa os mais diversos recursos e exporta os recursos internos através de um servidor HTTP. Um dos frameworks suportados é o Express.js

Chorar:

- WebSocketAPI - é uma implementação semelhante ao RestAPI, porém, ao investir em expor os handlers, controladores e casos de uso através de requisições e rotas HTTP, a comunicação será bidirecional via weboscket. estrutura para usar https://github.com/socketio/socket.IO
- gRPCAPI - é uma implementação semelhante ao RestAPI, porém, ao investir em expor os handlers, controladores e casos de uso através de requisições e rotas HTTP, a comunicação será bidirecional via gRPC. Estrutura a ser usada - https://grpc.io/docs/languages/node/

Ambos os servidores acima usam o padrão AsyncAPI, uma evolução da API aberta, que para arquiteturas é orientada por eventos https://www.asyncapi.com/docs.

Crie arquivos versão asyncapi do open api /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/spec/1.0.0.yml

o diretório "src/modules/Users/interface/api" deve ser renomeado para "src/modules/Users/interface/restapi" e 2 novos diretórios devem ser criados "src/modules/Users/interface/websocketapi" e "src/modules/Users/interface/grpcapi"

Dentro deverá haver um framework pasta, e dentro dos handlers que receberão as solicitações dos clientes. Crie arquivos para ambos grpc e websocket, para receber requisição e redirecionar para o controle e método específico.

Crie 3 clientes skd em /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/sdk-clients

1. Cliente REST API, usando busca nativa do navegador
2. Cliente API websocket, usando soquete do navegador io
3. Cliente API gRPC usando https://grpc.io/docs/languages/node/

Os clientes devem contar com ambos os arquivos de definição YML de /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/spec

--------------

Leia os requisitos a seguir e crie um plano detalhado de execução, salve no todo e prossiga com a implementação.

a aplicação Configuração de Serviço.  "/Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/servicemangement" permite ao desenvolvedor selecionar qual tipo de serviço está sendo criado / gerenciado

-RESTAPI

- websocketAPI + RESTAPI

- grpcAPI + RESTAPI

ambos os serviços rodam em porta separada

Todos os serviços criados e que rodarão em Vms, todos os ambientes, seja local (dev), teste (staging) ou produção, rodarão através do pm2 https://pm2.keymetrics.io/.

A ferramenta de desenvolvimento "/Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/servicemangement" será servida via pm2.

Instale o pm2 no projeto.

Crie arquivos de configuração para dev, staging e produção, para iniciar ./src/interface/HTTP/adapters, ./src/interface/gRPC/adapters e ./src/interface/WebSocket/adapters

Modifique o pacote e qualquer chamada existente para arquivos adpters do diretório ./src/interface/HTTP/adapters, ./src/interface/gRPC/adapters e ./src/interface/WebSocket/adapters para serem iniciados via pm2

Em qualquer ambiente VM, websocketAPI, RESTAPI e grpcAPI devem ser iniciados como processos separados via pm2

O ambiente dev deve iniciar o gerenciamento de serviço via pm2 automaticamente

Atualizar documentações e agentes de requisitos.

Evite entregar recursos incompletos.

Obedecça a cobertura.

-------

Leia os requisitos a seguir e crie um plano detalhado de execução, salve no todo e prossiga com a implementação.

adicione novos campos de configuração em todos os arquivos env em /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/src/config:

- AAA_HTTP_FRAMEWORK # default express, ao iniciar o RESTAPI, use este adaptador de framework, os valores podem ser expressos
- AAA_REALTIME_API # padrão não, se sim, inicie a API em tempo real
- AAA_REALTIME_API_PROTOCOL # websocket padrão, pode ser websocket
- AAA_DATABASE_DRIVER # Mongo, PostgreSQL, MySQL, MS SQL, RDS, Aurora, Cassandra

O gerenciamento de serviço deve ser capaz de ler e alterar os valores das variáveis ​​no ambiente atual de desenvolvimento, seja windows mac ou linux.

Então, em todos os ambientes, os serviços serão iniciados, carregando os adaptadores de acordo com as variáveis ​​de ambiente.

faça todas as implementações necessárias

Atualizar documentações e agentes de requisitos.

Evite entregar recursos incompletos.

Obedecça a cobertura.

--------

Verifique a implementação de login, acesso a endpoints, gerenciamento de usuários, controle de acesso.

Veja o que falta para que a aplicação atinja perto de 100% de conformidade com PCI e liste para mim

-------

Leia os requisitos a seguir e crie um plano detalhado de execução, salve no todo e prossiga com a implementação.

consulte a documentação das funções vercel https://vercel.com/docs/functions refatore nosso servidor e manipuladores de acordo

Os tokens JWT devem conter a função do usuário e informações sobre a organização à qual o usuário pertence.

Usuários do tipo "admin" e "user", quando criam registros no banco de dados, devem ter o id da organização que pertence usado no campo "organization" de cada registro criado no banco de dados.

o padrão será usado para construção de aplicações pequenas até ERPs.

Usuários de uma organização, não podem nunca ver dados de outras organizações, dados de domínios e subdomínios CORE são 100% escopados em níveis organizacionais.

Adicione novos campos no usuário e atualize todas as camadas relacionadas

Preferência do usuário {
  _id: herdar o padrão,
  @belongsTo(() => Usuário)
  usuário: pertence a<tipo de usuário>
  idioma: string necessária código ISO, código padrão para inglês
  moeda: string necessária código ISO, código padrão para inglês
  tema: corda,

organização: BelongsTo<typeof Organization>
}

Todo software desenvolvido com DDD tem subdomínios, que são secundários ao foco da empresa, e domínios core, que representam todas as regras de negócio.

O padrão irá contar com alguns subdomínios básicos:

- Domínio de Tarefas.

As tarefas podem ter múltiplos cessionários, ter um relator ou não. Tarefas pertencentes a uma organização.

Comentário da Tarefa {
  _id: herdar o padrão,
  @belongsTo(() => Usuário)
  autor: BelongsTo<typeof User>

organização: BelongsTo<typeof Organization>
}

TaskPool {
  _id: herdar o padrão,
  pergunta: string obrigatória
  @hasMany(() => TaskPoolOption)
  opções: HasMany<typeof TaskPoolOption> // obrigatório
  status: string padrão aberto obrigatório // aberto fechado

organização: BelongsTo<typeof Organization>
}

TaskPoolOption {
  _id: herdar o padrão,
  @belongsTo(() => TaskPool)
  task_pool: BelongsTo<typeof TaskPool>// obrigatório
  resposta: string obrigatória
  votos: número inteiro padrão 0 obrigatório

organização: BelongsTo<typeof Organization>
}

TaskPoolOption não pode receber votos se TaskPool estiver fechado

TaskLabel {
  _id: herdar o padrão,
  nome: string obrigatória
  cor: string obrigatória
}

Tarefa {
  _id: herdar o padrão,
  nome: string obrigatória
  descrição: string obrigatória

@hasMany(() => TaskLabel)
  rótulos: []

@belongsTo(() => Usuário)
  repórter: BelongsTo<typeof User> // não obrigatório
  
  @hasMany(() => Usuário)
  responsável: HasMany<typeof User> 
  
  @hasMany(() => TaskComment)
  comentários: HasMany<typeof TaskComment> 
  
  @hasMany(() => Tarefa)
  subtarefas: HasMany<typeof Task>

status: string obrigatório padrão pendente // pendente, em andamento, em revisão, verificação de qualidade, concluído

isSubTask: booleano padrão falso

organização: BelongsTo<typeof Organization>
}

Crie todas as camadas necessárias para o novo domínio bem como expô-lo, faça entidade de dados ao controlador, crie manipuladores para todos os frameworks HTTP, gRPC e websocket implementados.

Se tiver alguma sugestão de alteração ou expansão na modelagem de dados, me apresente para aprovação.

Atualizar documentações e agentes de requisitos.

Evite entregar recursos incompletos.

Obedecça a cobertura.

------

Workflow de inicialização e integração do serviço com banco de dados.

Os arquivos bootstrap, como adaptador de interface HTTP express.js (/apps/apps/apps/aaa-typescript-boilerplate/src/interface/HTTP/adapters/express/express.ts), fastify.js (src/interface/HTTP/adapters/fastify/fastify.ts) devem importar todos os clientes de banco de dados: in memory, mongoose, sequelize, etc. process.env.AAA_DATABASE_DRIVER e identifica qual driver de banco de dados deve ser injetado dentro da RestAPI, gRPCAPI ou webSocketAPI.

Os clientes DBS expõem uma API no formato IDatabaseClient. onde lojas é um array de objetos no formato IStore, contendo cada tabela/coleção do banco de dados conectado mapeados para IStore. Já dentro do Fluxo, os Data Repositories recebem uma referência do dbClient injetada. tendo acesso direto a dbCLient.stores e podendo chamar métodos como dbCLient.stores.NomeDaCollection.create().

termine a implementação do src/infra/persistence/external/ExternalStoreProxy.ts, mapeie a implementação atual do IStore para usar em todos os DBclients de todos os bancos de dados que não são necessários. As tabelas do aequelize e coleções do mongoose devem ser traduzidas para IStore, assim como nossos adaptadores para cassandra, dynamodb, etc.

esse tipo de implementação evita a dependência de arquivos externos na camada de repositórios de dados, bem como evita a criação de um repositório de dados para cada tipo de banco. deixando assim o gerenciamento da conexão com banco em nível de aplicação / infra

quero teste de fumaça de cada banco de dados

------

Leia os requisitos a seguir e crie um plano detalhado de execução, salve no todo e aguarde por novas ordens.

Quero um plano detalhado para evitar perda de tempo com implementações incertas.

O repositório aaa-typescript-boilerplate precisa ser reorganizado e passar a ser um repositório mono.

O que antes era apenas um template para gerar backend de serviços diferentes, agora passa a ser um monorepo de um produto que funciona como uma fábrica de software gerenciadora de serviços nodejs backend e frontend.

O monorepo passará a ser gerenciado pelo gerenciador pnpm

O nome do produto é JumentiX.

O nome "JumentiX" é uma alusão ao animal famoso no Brasil chamado Jumento, que consome pouco e tem muito poder de carga.

Vídeo do mascote na imagem https://camo.githubusercontent.com/c02ee6896511af4bee5b20800df049a75b2ec01bc59578bf5ac0b2aaa97d64b7/68747470733a2f2 f73332e616d617a6f6e6177732e636f6d2f6372656174696f6e2e686f777273652e636f6d2f3130303033303037372d6e6f726d616c2e706e67

para começar o jumentix, bastará o desenvolvedor rodar `pnpm install jumentix@init -g` no terminal e isso irá baixar e instalar o pacote o CLI que será usado para download e instalação de componentes e bootstrap de código

O Jumentix permite criar desde monolitos modulares prontos para serem desacoplados em micro serviços, até um grupo ilimitado de múltiplos serviços.

O Jumentix permite gerenciar desde o simples monolito criado até um grupo de serviços ilimitados criados com o Jumentix.

O Jumentix permite criar um grupo híbrido de serviços backend e frontend, bem como um simples serviço backend ou um serviço fronten SPA, PWA que funciona 100% offline (usando indexedDB como banco)

O Jumentix suporta o desenvolvimento de cada serviço até o deploy deles para plataformas diferentes, como VMs, instâncias Ec2, APIs de serviços lambdas (ou vercel ou cloudfare).

Todos os serviços, sejam backend ou frontend Seguem 100% os princípios de Event Driven Design, DDD, Hexagonal Archicture, CLean Code.

O monorepo usa typescript como já faz atualmente, deve manter o máximo de retrocompatibilidade e suportar o desenvolvimento de projetos node typescript de natureza diferente.

O mono repo tem configurações genéricas de bundler e configurações expandidas para cada tipo de serviço: backend, frontend SPA, frontend com SSR, livarias npm para backend, livarias npm para frontend

Atualmente os serviços de domínio de backend se comunicam entre si através de uma implementação do Message Mediator. Essa classe deverá ser distribuída como um pacote npm e importada nos serviços backend.

Cada projeto terá seu próprio conjunto de testes e suítes organizados dentro de seus projetos.

O Jumentix continuará usando o pm2 para gerenciamento de ambientes como o aaa-typescript-boilerplate já faz atualmente, a diferença é que ele irá rodar mais serviços backend e agora também frontend.

Projetos/componentes:

- CI, a ferramenta CLI atual - será distribuída como pacote NPM e será usada para criar uma nova estrutura Jumentix.
- backend boilerplate - atual aaa-typescript-boilerplate, projeto usado para criar diferentes serviços como já faz, todos os arquivos relacionados ao atual aaa-typescript-boilerplate, como src, documentação, node_modules, OASDoc, seed, test, AsynAPIDOC, serverless, etc., docker, cobertura
- sdk-clients - bibliotecas independentes npm que serão importadas em aplicações front-end para consumir as APIs back-end
- gerenciamento de serviços - uma ferramenta WEB 
- Message Mediator - a implementação atual do Message Mediatior deve ser dissociada e servida como uma biblioteca independente npm que será importada em aplicativos de back-end, em vez de exigir múltiplas distribuições da classe, incluindo os vários aplicativos de back-end criados usando o padrão de back-end

leia o arquivo ele representa a implementação de um banco de dados, nesse caso, em memória. nos passos anteriores, criamos suporte para sequelize, mongoose e diversos frameworks e soluções para acesso ao banco de dados. é necessário criar DbClients para cada uma das implementações que fizemos. também é preciso alterar os adaptadores de interfaces HTTP de cada framework na pasta src/interface/HTTP/adapters/, um exemplo é o /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/src/interface/HTTP/adapters/express/express.ts. o adaptador deve ler a variável de ambiente process.env.AAA_DATABASE_DRIVER e identificar qual driver de banco de dados deve ser utilizado e importado

--------

Leia os requisitos a seguir e crie um plano detalhado de execução, salve no todo e aguarde por novas ordens.

Quero um plano detalhado para evitar perda de tempo com implementações incertas.

- Rodada de documentação.

Crie um arquivo leia-me para o Jumentix explicando o que o JUmentix faz, alvo público, razões para usar o Jumentix, Vantagens do Jumentix comparando com outras soluções.

Organize as documentações de projetos/componentes Jumentix já existentes dentro da pasta de cada projeto.

O Leiame principal deve conter um índice. Esse é um padrão do projeto. Nenhum índice deve ter acesso à documentação de todos os componentes Jumentix.

O Leiame do Mono repo deve focar na venda do Jumentix como uma ferramenta que funciona como fábrica de software, para momentos de desenvolvimento e donos de produtos que desejam lançar SaaS monolitos ou baseados em micro serviços, do 0 à produção em poucos dias, com arquitetura agnóstica e 100% escalavel.

O leia-me principal passa a ser responsável pela visão mercantil do Jumentix quando a documentação de cada projeto será técnica, rica em detalhes, explicando integrações, vantagens, possibilidades de desenvolvimento, exemplos de código, explicação específica de arquitetura. A navegação entre toda a documentação deve ser possível através da documentação do monorepo.

As sessões que a documentação deve ter:

- Criando SPA PWA com o Jumentix.
- Criando uma API REST com o Jumentix.
- Criando uma API Realtime com o Jumentix.
- Criando um SaaS monolito, backend e frontend com o Jumentix.
- Criando um SaaS com arquitetura em microserviços ou Jumentix.

Crie um épico só para documentação. Após o planejamento detalhado em tarefas, execute o plano.

Use sempre o github como gerenciador de projetos e tarefas. Isso é padrão do projeto.

--------

 

- o diretório "backend-template" não é um aplicativo, mas sim um pacote que será utilizado para gerar aplicativos do tipo backend. O jumentix gera backend e front end de aplicativos.

----

https://vercel.com/templates/next.js/mantine-ui-nextra

Leia os requisitos a seguir e crie um plano detalhado de execução, salve no todo e aguarde por novas ordens.

Quero um plano detalhado para evitar perda de tempo com implementações incertas.

Além de engenheiro de software, Agora você é especialista em marketing digital e em conversão de leads.

O Jumentix precisa de um site comercial para vendê-lo como produto.

Crie um site com conteúdo específico, utilizando os arquivos MD de toda documentação do Jumentix como base de dados.

O site será criado no diretório apps/jumentix-website.

O site será publicado em vercel.

Leia e utilize o template: https://vercel.com/templates/next.js/mantine-ui-nextra

Preciso fazer deploy para vercel rodando um pacote do package.json.

Faça toda a integração necessária

Crie um épico só para o site. Após o planejamento detalhado em tarefas, execute o plano.

Use sempre o github como gerenciador de projetos e tarefas. Isso é padrão do projeto.

----

No ERP,

Em Produtos CRUD:

- Campo Item do Catálogo Aduaneiro nos formulários: ordena os itens, coloca no topo os itens que não possuem produto associado. Cada lista suspensa de valores "Nome do item do catálogo", CAS, HS e NCM. Exibir adicionalmente o código dos produtos da tabela Produtos associados a esse item do Catálogo
- Colocar botão ao lado de "Item de Catálogo Aduaneiro" para criar um novo "Item de Catálogo Aduaneiro" a partir dos formulários de Produto e permitir associar o novo "Item de Catálogo Aduaneiro"
- Adicionar nova “Data de Fabricação” na área “Informação Científica”.
- Exibir todos os novos campos no Produto "CARD" nas linhas da grade

---[-]

- NN328928765BR não tem eventos e deveria ter.
- vários números de rastreamento inteiros em todos os cronogramas de todos os CRUDS do gerenciamento logístico não estão mostrando os eventos associados de 17 faixas na interface do usuário.
- NN328928765BR deverá estar em Dest. Alfândega
- 382386563776, NN285538765BR, NN328928765BR, ND720492541BR informações de eventos incompletas. revisar todas as áreas de registro de remessa em todos os cronogramas

- na gestão logística -> Gestão de Remessa, linhas GRID CARTÕES mostram detalhes do pedido - produtos, alfândega
- o botão "Redefinir dados de rastreamento" deve cancelar o registro de todos os números de rastreamento da 17track api
- nas configurações do App, configurações de envio, após o campo "Taxa de Frete Agente Brasil → Cliente (USD)", adicione um novo campo "Imposto sobre serviços postais".  o valor padrão é 18,10. Este novo campo agora faz parte da lógica onde fazemos cálculos alfandegários de pacotes enviados para o Brasil, incluindo impostos federais e ICMS, explicitamos soma e exibimos o novo "Imposto sobre Serviços Postais". Este campo é um campo de moeda em BRL. E está incluso apenas nas fórmulas que calculam os impostos aduaneiros em reais em PEDIDOS CRUD e faturas
- os números de rastreamento entregues não possuem dados armazenados. Os números de rastreamento entregues devem sempre armazenar todos os eventos definidos no 17track. Downalod e styore. Os botões Uupdate devem baixar todos os registros de eventos de todos, incluindo pacotes entregues
- O histórico de remessas em todas as linhas do tempo mostra apenas os primeiros eventos e deve mostrar tudo em ordem.
- ao editar o número de rastreamento, o campo de memorando não está sendo salvo.
- Os eventos diários de envio são mostrados e desaparecem repentinamente no Rastreamento Unificado.
- fechar todos os cronogramas no Rastreamento Unificado. O usuário clicará para abrir o que deseja ver, adicionará adicionalmente o texto informativo do memorando aos itens recolhidos, para que o usuário possa identificar o que é cada remessa e decidir qual abrir.
- O Rastreamento Unificado permite ao usuário selecionar quantos itens exibir na tela. Padrão 100, classificado por progresso, entregue na parte inferior e preparação na parte superior. permitir filtragem e classificação na tela.
- O Rastreamento Unificado não é atualizado automaticamente quando há alterações em segundo plano.

- Pedidos -> Pedidos TAB CRUD GRID ROW CARD, adicione guias de pagamento e liste as informações associadas de OrderPayments
- Pedidos -> Guia OrderPayments GRID - agrupa as transações de pagamento por pedido.
- Pedidos -> Criar e Editar formulários: Ao atualizar o campo de organização de um Pedido, alterando a propriedade do pedido, faça uma atualização em cascata com todos os objetos vinculados, alterando também sua organização.

na organização CRUD: 
- um ícone de ajuda com a explicação de cada botão na barra de ferramentas
- permite criar um novo usuário ERP no formato "Nova Organização", permitindo definir um novo usuário como proprietário da organização, esse usuário é sempre admin

Revise todos os CRUDS que possuem campo memo:
- campos de memorando: aparecem em cartões em todos os GRIDS de todos os CRUDs que possuem campos de memorando

Crie a entidade de dados da variante do Catálogo de Produtos com base na entidade de dados do Produto atual, clone-a, remova os campos "estoque" e "estoque br" dela, uma vez que é apenas uma representação virtual da variante do catálogo de produtos

no catálogo de produtos -> Listagem do catálogo -> exibir dados de variantes associadas em cada linha da grade CARD

Crie uma nova entidade de dados "SoldProduct". Clone do produto.

Agora, a entidade Dados do produto representa oficialmente um inventário físico de uma organização.

portanto, não possui mais as colunas “estoque” e “estoque br”.

adicione os campos: "lote", "número de série" à entidade Dados de produtos. 
remova os campos "stock" e br stock

Todos os itens atuais no inventário pertencem à organização "KetchP"

o estoque BR, logicamente, agora é o Inventário de peptídeos X-Synth no endereço X-synth, adicione novos itens no inventário para X-synth clonando os itens do "KetchP" que possui itens no "estoque br" atual.

Os itens atuais do inventário "KetchP" são todos do "tipo de unidade" "conjunto".
Os itens atuais do inventário "X-synth" são todos do "tipo de unidade" "un".

Portanto, se o estoque possui 100 unidades de um item para vender, ele deverá possuir 100 registros correlacionados na entidade Dados do produto.

Cada produto possui um número de série exclusivo e pertence a um número de lote.

Sempre que um item é vendido, ele é movido para a entidade de dados “ProdutoVendido” e não fica mais disponível no estoque.

Sempre que um pedido for feito, ao selecionar um novo item de linha de produto, associe-o a um item de estoque. Assim, quando o pedido for pago e enviado, ele será movido para “Produto Vendido” e não poderá mais ser revertido. 
Portanto, agora os pedidos podem rastrear o número de série e o lote dos itens vendidos.

A encomenda paga deve referenciar os artigos vendidos em "SoldProduct".

Para adicionar itens no estoque (produtos) agora é necessário número de série, lote, data de fabricação

Permitir que o superadministrador "copie" itens de inventário entre organizações solicitando o novo número de série, lote e data de fabricação adequados

Atualize CRUDS, FORMS, GRIDS de todas as entidades de dados correlacionadas.

Na vitrine, agora os itens de entrega rápida são apenas itens do inventário X-Synth. Liste os produtos de ambos os estoques na vitrine, mas com clara separação de interesses,

Na vitrine, clientes cadastrados no Brasil só veem itens da X-synth.

Produtos -> Lista de Produtos:
- faça do País de Origem um campo suspenso
- exibir fotos em uma janela pop-up na mesma tela

----

adicione uma nova entidade de dados de categoria de catálogo alfandegário. Existem 2 categorias: Cosméticos com o número HS 3304.99 e "Pó de Mica Natural para Artes e Ofícios" com o HS 2525.20.

Todos os itens atuais no catálogo da Alfândega são da categoria do catálogo da Alfândega de Cosméticos.

----

- A nova entidade de dados da Categoria do Catálogo Aduaneiro e CRUD COMPLETO completo com FORMULÁRIOS, GRADES, CARTÕES DE linhas DE GRADE, janela pop-up para edição de registros. Adicione as categorias: - "Cuidados com a pele e cosméticos", - "Artes, pintura e artesanato". Todos os itens atuais do Catálogo Aduaneiro são de "Cuidados com a Pele e Cosméticos", link. atualizar CRUDs do Catálogo Aduaneiro para suportar o novo campo de categoria, FORMs, GRID e cartão de linha de grade. 
- As Variantes do Catálogo de Produtos devem estar vinculadas aos itens do Catálogo Aduaneiro da mesma forma que os Produtos. Assim, ao adicionar um novo "Produto" ao inventário, você o herdará da "Variante do Catálogo de Produtos" associada, na Listagem de Variantes Variante do Catálogo de Produtos CRUD, mostrará o item do catálogo Aduaneiro associado para cada item. Atualizar o FORM, GRID e GRID row CARD

artes, pintura e artesanato

----

- Listagem de inventário aninha item por nome -> código, portanto a grade não deve listar várias entradas com o mesmo nome de produto
- Os lotes de produtos CRUD devem mostrar o progresso, atualizar automaticamente após a migração e alterar os registros, usar os mesmos padrões dos crUDS anteriores

O campo de fotos do produto agora é gerenciado no nível do lote de produtos. Atualizar os dados e UI CRUDS, formulários, grades, detalhes do CARDS

------------
- LLC
- Identificação Fiscal
- Listra ou ebanx.

2H24 -> 240
2 TR60 -> 320
2RT60 -> 512
12S10 -> 84
1 G5K -> 80
1 KP10 -> 64
1 PIN5 -> 48
1FN1 -> 240
1 PV5 -> 96
1ML10 -> 56
15AD -> 88
1 MA10 -> 48
1NP810 -> 40
1NET5 -> 64
1XT100 -> 160
1TSM5 -> 104
1 MS20 -> 104
1 CP10 -> 104
1 CP20 -> 200
15AD -> 88
1 DS10 -> 72
1 AC10 -> 56
1IG1 -> 200
1CND10 -> 140
1ET10 -> 36
1 PIN5 -> 48
1KS10 -> 72
