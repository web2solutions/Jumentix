
- Quere ter a real implementação de "DocumentValueObject" no projeto. Atualmente já alguma implementação, porém não sei se o que eu implementei realmente refelte o real conceito de "DocumentValueObject" na especificação de DDD por favor check e faça algeraçãoes nececessárias
- crie arquivos MD com documentacao detalhada de cada data entity e models de cada dominio. Explique regras, tipos de de dados. Adicione link no Readme file para cada documento MD criado
- Adiciones todos os requisitos feitos á agentes espoecializados
- Atualize o Readme MD com todas as informações ja pedidas no chat que ainda nao foram dcumtadas

- a implementacao de cloud fare workers deve ser similar a lambdas, sem rodar frameorks como express.
- todos os novos frameworks e servidores HTTP adicionados estao usando express.js. Cada implementacao deve usar seu proprio servidor HTTP como disponivel. Vide Fastify and Restifym eles usam seus proprios servidores. Consulte a documentacao de cada um dos frameworks/servidores cloud fare workers, Vercel Functions, LoopBack, Sails.JS, Feathers, derby.js, adonis.js, and total.js
- Crie um mapa de eventos / mensagens da aplicacao com documentacao completa. adicione em um novo md. adicione o link no readme.
- Crie um mapa de contrato de errors / errors responses com documentacao completa. adicione em um novo md. adicione o link no readme.


- leia a logica atual de validacao de dados nos handlers. expanda para suportar a a validação de requests em conformidade com a esppecificacao OPEN API 3.1

- o software deve ter ao menos dois nivels de validacao de dados:
1. HTTP handlers - request must be validated againt their assciated OAS spec defined in API doc against the OPEN API 3.1 speciciation.
2. Domain level - models must implement data validation

atualize a CLI geradora de codigo e os dominios e http handlers ja implementados.


Considere que o boilerplate será usado para criar aplicações multi tenancy e single tenancy,

Lidamos inicialmente com 3 roles de users: "superadmin", "admin", e "user".

Exceto superadmins, os "admin", e "user" devem pertencer á uma oganização.

Considere que o boilerplate é 100% agnóstico. Suporta a integração com multiplos componentes extenos, mas não depende de nenhum.

Releia a atual implemetacao de banco de dados in memory.

Ela foi feita de forma rapida.

Ele deve ser analisada profundamente e refeita para que reflita o uso com bancos de dados relacionais e no-sql.

Os models devem suportar relacionamento, independente de tecnologia.

O adaptador oficial é o in memory.

Exemplo de implemenetacao de relacao

```typescript
class Post extends Basemodel {
  @belongsTo(() => User)
  author: BelongsTo<typeof User>

  @hasMany(() => Comment)
  comments: HasMany<typeof Comment>
}
```




now, create a new "AddressValueObject" address generic domain object, like PhoneValueObject.

The new object is the path of the address object used accros the entire system.

The fields are:

```
AddressValueObject {
  id: string;
  email: string;
  type: enum work home vacation;
  isPrimary: boolean;
}
```

agora, Crie um nova entidade de dados "Organization" no dominio Users. Toda vez que eu pedir pra criar uma nova entide, crie todos os arquivos relacionados de suporte para a entidade.




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


Agora adicione 2 novos campos em User:

```JSON
{
  organization: not required
}
```

O Sistema deve estar em compliance e implementar RBAC para controle de acesso á cada recursos.

Faça todas moficações necessárias.

Atualize os testes. Crie organizacoes. Associe usuarios com organizacoes.

Atualize documentacoes e agentes de requerimentos.

Evite entregar recursos incompletos.

Obedecça o coverage.

Execute tudo sem solicitar minha permissão


------

- All data entitties must have the following fields

```
{
  createdAt: date now required automatically genereated when created
  updatedAt: date now required automatically genereated when created, automatically updated when the model updates.
}
```

When a data entity / model has fields that are arrays of domain generic objects like phone, email, address, document, etc, the model must have the methods "createDomainObjectname", "updateDomainObjectname" and "deleteDomainObjectname", where DomainObjectname is the name of the Domain Object, like Phone. Check the User Model as reference, now refactor the organization model. This is a golden system requirement.

now, whenever any data entity, model, contract, event, message, error, changes, the software documentation and the OPEN API spec in ./spec/1.0.0.yml must be updated accordingly. please review the OPEN API spec in ./spec/1.0.0.yml and make sure it supports the new Organization resource.

Atualize documentacoes e agentes de requerimentos.

Evite entregar recursos incompletos.

Obedecça o coverage.



--------------


O diretorio "servicemangement" deve ser considerado um projeto independente do boiolerplate em termos de ter seu proprio CI/CD, suite de testes, package, etc, então o aaa-typescript-boilerplate passa se tornar um monorepo atualmente com 2 projetos: "servicemangement" and "servicetemplate". o "servicemangement" nada mais é que a atual implementação do  "aaa-typescript-boilerplate". ambos projetos sao em typescript, 




Leia os requerimentos a seguir e crie um plano detalhado de execução, adicione e salve no todo e prossiga com a implementação.

- a especificacao open API em /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/spec/1.0.0.yml deve sempre conter a descricao dos ports objects referentes a inputs the entradas e respostas dos end points.

Quando um engenheiro de software for usar o "aaa-typescript-boilerplate" para criar um sofware, ele deverá usar o pnpm install para instalar somente a CLI toll que permitirá ele fazer o scafold do novo projeto, clonando o "aaa-typescript-boilerplate" do github na pasta de trabalho local e configurando todo o projeto de acordo com o tipo de servico que o engenheiro quer desenvolver, por enquanto os tipos de servicos sao:

- Servidor com interface HTTP/REST, servindo documentacao da API com swagger e open api, com possibilidade de servir arquivos estaticos para um SPA por exemplo
- Servidor com interface websocket, o servidor irá expor o controller, recebendo request seguindo o padrao esperado e respondendo com possibilidade de servir arquivos estaticos para um SPA por exemplo
- Servidor com interface gRPC, com possibilidade de servir arquivos estaticos para um SPA por exemplo
- Servidor com interface graphql, com possibilidade de servir arquivos estaticos para um SPA por exemplo
- Conjunto de Function services to deploy as functions in amazon, gogle, azure, vercel or cloudfare

os servicos irão se conectar através de out adapters á servicos como bancos de dados relacionais e nao relacionais

- Deve ser criado uma classe de reposutorio de dados para bancos sql utilizando o sequelize.js, inicialmente suportando Potgresql, MySQL, SQL Server, Oracle e SQL Light
- Deve ser criado uma classe de reposutorio de dados para mongo utilizando o mongoose.js
- Deve ser criado uma classe de reposutorio de dados para bancos no-sql dynamodb utilizando a lib oficial da aws
- Deve ser criado uma classe de reposutorio de dados para bancos no-sql cassandra
- Deve ser criado uma classe de reposutorio de dados para bancos no-sql firebase
- Deve ser criado uma classe de reposutorio de dados para bancos no-sql Aurora / amazon
- Deve ser criado uma classe de reposutorio de dados para bancos no-sql RDS / amazon
- Deve ser criado uma classe de reposutorio de dados que envie requests e receba confirmacoes utilizando um sistema de queue com request-reponse message pattern, que seja agnostico, e suporte bullmq, rabbitmq,

- deve criar arquivos docker file os que ja tem rabbitmq e redis para todos os servicos mencionados acima como containers.


renomeie a pasta domain designer para "servicemangement".





The service mangement application is a UI tabbed layout application  that has the following applications

1. Domain Designer. Use the Domain Designer MVP tool to manage all domains and data entities of the "aaa-typescript-boilerplate"
2. Communication Interface Designer. Use to design the output interfaces adapters like HTTP (REST) (actually already implemented) , gRPC, websocket, SSE Server. These interfaces receive. requests from outside the service context and forward accordingly to the controllers
3. Service Configuration. 

The boilerplate can be used to create REST APIs, APIs running as as set of functions, microservices using different messaging mechanisms.

so this tab must allow the engineer to configure what exacltly is the kind of software, how it runs, which cloud, as VM, as function, dedicated servers, save credentials all info required for deploy, support aws, google, vercel, cloudfare cloud, azure, docker. allow integration with the cloud providers allowing for example to preview the API gateway resources. lambdas, azure and google functions are deployed with serveless framework, there is already some serverless integration in the project. extend it


- Dedicated Server
  through ssh
- Virtual Machine
  through ssh
  EC2 ?
- REST API
  Dedicated Server through ssh
  EC2 instances
- Function APIs:
    AWS Lambda / serveless
    Vercel Functions
    CloudFare
4. Deploy management. The Deploy management tool allow to deploy and manage all the deployments of the service through different service and architectures. 

If the service is a set of functions, it will be deployed as aws, google, azure, vercel functions or cloudfare workers. use serverless when it is possible.

If the service is a monolith with lot of domains, it will be deployd at private VMs, VMs cloud solutions (aws, google, azure,) or dedicated servers


Atualize documentacoes e agentes de requerimentos.

Evite entregar recursos incompletos.

Obedecça o coverage.


------


Leia o arquivo /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/src/interface/HTTP/RestAPI.ts

Ele é o boostrap usado para criar REST APIs. Ele importa os mais diversos recursos e expor os recursos internos atraves de um servidor HTTP. Um dos frameworks suportados é o Express.js

Crie:

- WebSocketAPI - é uma implementação similar ao RestAPI, porém, ao inves de expor os handlers, controllers e use cases através de requisicoes e rotas HTTP, a comunicacao será bi-direcional via weboscket. fraemwork to use https://github.com/socketio/socket.IO
- gRPCAPI - é uma implementação similar ao RestAPI, porém, ao inves de expor os handlers, controllers e use cases através de requisicoes e rotas HTTP, a comunicacao será bi-direcional via gRPC. Framework to use - https://grpc.io/docs/languages/node/

Ambos os servidores acima usarao o padrao AsyncAPI, uma evolucao da open api, so que para arquiteturas event driven https://www.asyncapi.com/docs.

Crie arquivos versao asyncapi do open api /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/spec/1.0.0.yml


o diretorio "src/modules/Users/interface/api"  deve ser renomeado para "src/modules/Users/interface/restapi" e 2 novos diretorios devem ser criados "src/modules/Users/interface/websocketapi" e "src/modules/Users/interface/grpcapi"

Dentro deverá haver uma pasta framework, e dentro os handlers que receberao as requests dos clients. Crie arquivos para ambos grpc e websocket, para receber requisicao e redirecionar para o controler e metodo especifico.

Crie 3 skd clients em /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/sdk-clients

1. REST API client, using browser native fetch
2. websocket API client, using browser socket io
3. gRPC api client using https://grpc.io/docs/languages/node/

The clients must rely in both YML definition files from /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/spec

--------------



Leia os requerimentos a seguir e crie um plano detalhado de execução, salve no todo e prossiga com a implementação.

a aplicacao Service Configuration.  "/Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/servicemangement" permitirá o desenvolvedore selecionar qual tipo de servico está sendo criado / gerenciado

- RESTAPI

- websocketAPI + RESTAPI

- grpcAPI + RESTAPI

ambos os servicos rodam em porta separadas

Todos os servicos criados e que rodarão em Vms, todos os ambiente, seja local (dev), test (staging) ou production, rodarão através do pm2 https://pm2.keymetrics.io/.

A ferramenta de desenvolimento "/Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/servicemangement" será servida via pm2.

Instale o pm2 no projeto.

Crie arquivos de configuracao para dev, staging and production, para inicar ./src/interface/HTTP/adapters, ./src/interface/gRPC/adapters e ./src/interface/WebSocket/adapters

Modifique o package e qualquer chamada para existente para arquivos adpters do diretorio ./src/interface/HTTP/adapters, ./src/interface/gRPC/adapters e ./src/interface/WebSocket/adapters para serem iniciados via pm2 

Em qualquer ambiente VM, websocketAPI, RESTAPI e grpcAPI devem ser iniciados como processos separados via pm2

O ambiente dev deve iniciar o servicemangement via pm2 automaticamente

Atualize documentacoes e agentes de requerimentos.

Evite entregar recursos incompletos.

Obedecça o coverage.



-------

Leia os requerimentos a seguir e crie um plano detalhado de execução, salve no todo e prossiga com a implementação.

add new config fields in all env files in /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/src/config:

- AAA_HTTP_FRAMEWORK # default express, when starting the RESTAPI, use this framework adapter, values can be express
- AAA_REALTIME_API #  default no, if yes, start the realtime API
- AAA_REALTIME_API_PROTOCOL # default websocket, can be websocket
- AAA_DATABASE_DRIVER # Mongo, PostgreSQL, MySQL, MS SQL, RDS, Aurora, Cassandra


O servicemangement dever ser capaz de ler e alterar os valor das variaveis no ambiente atual de desenvililbimento, seja windows mac ou linux.

Então, em todos os ambientes, os servicos serão iniciados carregandos os adapters de acordo com as variaveis de ambiente.

faça todas as implementaçoes necessarias


Atualize documentacoes e agentes de requerimentos.

Evite entregar recursos incompletos.

Obedecça o coverage.

--------


Verifique a implementacao de login, accesso a end points, gerenciamento de usuarios, controle de acesso.

Veja o que falta para que a aplicação atinja perto de 100% de PCI compliance e liste para mim

-------

Leia os requerimentos a seguir e crie um plano detalhado de execução, salve no todo e prossiga com a implementação.

see the vercel functions documentation https://vercel.com/docs/functions please refactor our server and handlers accordingly

Os tokens JWT devem conter a role do user e informacoes sobre a organizacao que o user pertence.

Usuários do tipo "admin" e "user", quando criam registros no banco de dados, devem ter o id da organizacao que pertence usado no campo "organization" de cada registro criado no banco de dados.

o boilerplate será usado para construção de aplicações pequenas até ERPs.

Usuários de uma organização, não podem nunca ver dados de outras organizações, dados de CORE domains e sub domains são 100% escopados em níveis organizacional.

Adicione novos campos no User e atualize todas as layers relacionadas

UserPreference {
  _id: inherit default,
  @belongsTo(() => User)
  user: BelongsTo<typeof User>
  language: string required ISO code, default code for english
  currency: string required ISO code, default code for english
  theme: string,

  organization: BelongsTo<typeof Organization>
}

Todo software desenvolvido com DDD tem sub dominios, que são secundários ao foco da empresa, e core domains, que representam todo o business rules.

O boilerplate irá contar com alguns sub domínios básicos:


- Tasks Domain.

Tarefas podem ter multiples assignee, ter um reporter ou nao. Tarefas devem pertencer á uma organização.

TaskComment {
  _id: inherit default,
  @belongsTo(() => User)
  author: BelongsTo<typeof User>


  organization: BelongsTo<typeof Organization>
}

TaskPool {
  _id: inherit default,
  question: string required
  @hasMany(() => TaskPoolOption)
  options: HasMany<typeof TaskPoolOption> // required
  status: string default open required // open closed

  organization: BelongsTo<typeof Organization>
}

TaskPoolOption {
  _id: inherit default,
  @belongsTo(() => TaskPool)
  task_pool: BelongsTo<typeof TaskPool>// required
  answer: string required
  votes: number integer default 0 required

  organization: BelongsTo<typeof Organization>
}

TaskPoolOption can not receive votes if TaskPool is closed

TaskLabel {
  _id: inherit default,
  name: string required
  color: string required
}

Task {
  _id: inherit default,
  name: string required
  description: string required

  @hasMany(() => TaskLabel)
  labels: []

  @belongsTo(() => User)
  reporter: BelongsTo<typeof User> // not required
  
  @hasMany(() => User)
  assignee: HasMany<typeof User> 
  
  @hasMany(() => TaskComment)
  comments: HasMany<typeof TaskComment> 
  
  @hasMany(() => Task)
  subtasks: HasMany<typeof Task>

  status: string required default pending // pending, in progress, in review, quality check, done 

  isSubTask: boolean default false


  organization: BelongsTo<typeof Organization>
}

Crie todas as camadas necessarias para o novo dominio bem como expô-lo, do data entity ao controller, crie handlers para todos os fraemworks HTTP, gRPC e websocket implementados.

Se tiver algum sugestão de alteração ou expansão na modelagem de dados, me apresente para aprovação.

Atualize documentacoes e agentes de requerimentos.

Evite entregar recursos incompletos.

Obedecça o coverage.



------




Workflow de inicializacao e integracao do servico com banco de dados.

Os arquivos bootstrap, como adaptador de interface HTTP express.js (/apps/apps/apps/aaa-typescript-boilerplate/src/interface/HTTP/adapters/express/express.ts), fastify.js (src/interface/HTTP/adapters/fastify/fastify.ts) devem importar todos os DB clients: in memory, mongoose, sequelize, etc. devem ler a variavel de ambiente process.env.AAA_DATABASE_DRIVER e identificar qual driver de banco dados deve injetar para dentro da RestAPI, gRPCAPI ou webSocketAPI.


Os DBS clients expoe uma API no formato IDatabaseClient. onde stores é um array de objetos no formato IStore, contendo cada tabela / collection do banco de dados conectado mapeados para IStore. Ja dentro do Fluxo, os Data Repositories recebem uma referencia do dbClient injetado. tendo asssim acesso á dbCLient.stores e podendo chamar metodos como dbCLient.stores.NomeDaCollection.create().

termine a implementacao do src/infra/persistence/external/ExternalStoreProxy.ts, mapeie a implementacao atual de IStore para usar em todos os DBclients de todos os bancos de dados que estao no requerimento. As tabelas do aequelize e collections do mongoose devem ser traduzidas para IStore, assim como nos adaptadores para cassandra, dynamodb, etc

esse tipo de implementacao evita a dependencia de arquivos externos em camada de data repostories, bem como evita a criacao de um data reposutory para cada tipo de banco. deixando assim o gerenciamento da conexaco com banco em nivel de aplicacao / infra

quero smoke test de cada banco de dados



------


Leia os requerimentos a seguir e crie um plano detalhado de execução, salve no todo e aguarde por novas ordens.

Quero plano detalhado para evitar perda de tempo com implemtações incertas.

O repositorio aaa-typescript-boilerplate precisa ser reorganizado e passar a ser um mono repo.

O que antes era só um template para gerar backend de servicos diferentes, agora passa a ser um monorepo de um produto que funciona como uma fábrica de software gerenciadora de servicos nodejs backend e frontend.

O monorepo passará a ser gerenciado pelo gerenciador pnpm

O nome do produto é JumentiX.

O nome "JumentiX" é uma alusão ao animal famoso no Brasil chamado Jumento, que consome pouco e tem muito poder de carga.

Vide o mascote na imagem https://camo.githubusercontent.com/c02ee6896511af4bee5b20800df049a75b2ec01bc59578bf5ac0b2aaa97d64b7/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6372656174696f6e2e686f777273652e636f6d2f3130303033303037372d6e6f726d616c2e706e67

para começar o jumentix, bastará o desenvolvedor rodar `pnpm install jumentix@init -g` no terminal i isso ira baixar e instalar pacote o CLI que será usado para download e instalcao de de componentes e bootstrap de codigo

O Jumentix permite criar desde monolitos modulares prontos para serem desacoplados em micro servicos, até um grupo ilimitado de multiplo servicos.

O Jumentix permite gerenciar desde o simples monolito criado até um grupo de ilimitados serviços criado com o Jumentix.

O Jumentix permite criar um grupo hibrido de servicos backend e frontend, bem como um simples servico backend ou um servico fronten SPA, PWA que funciona 100% offline (usando indexedDB como banco)

O Jumentix suporta do desenvovimneto de cada servico até o deploy deles para plataformas diferentes, como VMs, instancias Ec2, apis de servicos lambdas (ou vercel ou cloudfare).

Todos os servicos, sejam backend ou frontend seguem 100% os principios de Event Driven Desig, DDD, Hexagonal Archicture, CLean Code.

O monorepo usa typescript como já faz atualmente, deve mante o maximo de retrocompatibilidade e suportar o desenvolvimento de projetos node typescript de natureza diferentes.

O mono repo tem configurações genericas de bundler e configuracoes expandidas para cada tipo de servico: backend, frontend SPA, frontend com SSR, livarias npm para backend, livarias npm para frontend

Atualmente os servicos de dominios do backend comunicam entre si Via uma implementacao de Message Mediator. Essa classe deverá ser distribuida como um pacote npm e importada nos servicos backend.

Cada projeto terá seu proprio conjunto de testes e suites organizados dentro de seus projetos.

O Jumentix continuará usando o pm2 para gerenciamento de ambientes como o aaa-typescript-boilerplate já faz atualmente, a diferença é que ele irá rodar mais servicos backend e agora tambem frontend.


Projects / components:

- CI the current CLI tool - will be distributed as NPM package and will be used to bostrap a new Jumentix structure.
- backend boilerplate - current aaa-typescript-boilerplate, project used to create different services as it already does, all the files related to the current aaa-typescript-boilerplate, like src, documentation, node_modules, OASDoc, seed, test, AsynAPIDOC, serverless, etc., docker, coverage
- sdk-clients - npm independent libraries that will be imported in front end applications to consume the back end APIs
- service management - a WEB tool 
- Message Mediator - the current Message Mediatior implementation shuould be deccouples and served as npm independent library that will be imported in backend applications rather than being requiring multiple distributions of the class accroos the multiple backend applications created using the backend boilerplate








leia o arquivo ele representa a implementacao de um banco de dados, nesse caso, in memory. em passos anteriores, criamos suporte para sequelize, mongoose e diversos frameworks e solucoes para acesso á banco dados. é necessário criar DbClients para cada uma das implemtacoes que fizemos. também é preciso alterar os adpatadores de interfaces HTTP de cada framework na pasta src/interface/HTTP/adapters/, um exemplo é o /Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/src/interface/HTTP/adapters/express/express.ts. o adaptador deve ler a variavel de ambiente process.env.AAA_DATABASE_DRIVER e identificar qual driver de banco dados deve utlizar e importar


--------

Leia os requerimentos a seguir e crie um plano detalhado de execução, salve no todo e aguarde por novas ordens.

Quero plano detalhado para evitar perda de tempo com implemtações incertas.

-- Round de documentação.

Crie um readme file para o Jumentix explicando o que o JUmentix faz, público alvo, razões para usar o Jumentix, Vantagens do Jumentix comparando com outras solucões.

Organize as documentações de projetos / componentes Jumentix já existentes dentro da pasta de cada projeto.

O Readme principal deve conter um index. Esse é um padrão do projeto. No index deve have acesso para a documentação de todos os components Jumentix.

O Readme do Mono repo deve focar na venda do Jumentix como uma ferramenta que funciona como fábrica de software, para times de desenvovimento e donos de produtos que querem lançar SaaS monolitos ou baseados em micro servicos, do 0 á produção em poucos dias, com arquitetura agnóstica e 100% escalavel.

O readme principal passa a ser responsável pela visão mercadólogica do Jumentix enquando a documenação de cada projeto será técnica, rica em detalhes, explicando integrações, vantagens, possibilidades de desenvolvimento, exemplos de código, explicação detalhada de arquitetura. A navegação entre toda a documentação deve ser possível através da documentação do monorepo.

Sessoes que a documentação deve ter:

- Criando SPA PWA com com o Jumentix.
- Criando uma API REST com o Jumentix.
- Criando uma API Realtime com o Jumentix.
- Criando uma SaaS monolito, backend e frontend com o Jumentix.
- Criando uma SaaS com arquitura em microserviços o Jumentix.

Crie um épico só para documentação. Após o planejamento detalhado em tarefas, execute o plano.

Use sempre o github como gerenciador de projeto e tarefas. Isso é padrão do projeto.

--------

 



- o diretorio "backend-template" não é um app, mas sim um pacote que será utilizado para gerar apps do tipo backend. O jumentix gera apps backend e front end.


----


https://vercel.com/templates/next.js/mantine-ui-nextra


Leia os requerimentos a seguir e crie um plano detalhado de execução, salve no todo e aguarde por novas ordens.

Quero plano detalhado para evitar perda de tempo com implemtações incertas.

Além de engenheiro de software, Agora você é especialista em marketing digital e em conversão de leads.

O Jumentix precisa de um website comercial para vendê-lo como produto.

Crie um website com conteúdo estático, utilizando os arquivos MD de todo documentação do Jumentix como base de dados.

O site será criado no diretorio apps/jumentix-website.

O website será publicado na vercel.

Leia e utilize o template: https://vercel.com/templates/next.js/mantine-ui-nextra

Preciso fazer deploy para a vercel rodand um compando do package.json.

Faça toda a integração necessároa

Crie um épico só para o site. Após o planejamento detalhado em tarefas, execute o plano.

Use sempre o github como gerenciador de projeto e tarefas. Isso é padrão do projeto.


----

In ERP,

In Products CRUD:

- Customs Catalog Item field in forms: sort items, put items that have no associated product in the top. Each dropdown value list "Catalog item name", CAS, HS and NCM. Aditionally display the products code from Products table that are associated to that Catalog item
- Put button next to "Customs Catalog Item" to create a new "Customs Catalog Item" from Product forms and allow to associate the new "Customs Catalog Item"
- Add new "Manufacture date" in "Scientific Information" area.
- Display all new fields in Product "CARD" on grid rows


---[-]

- NN328928765BR has no events and should have.
- several tracking numbers in entire in all timelines from all CRUDS from logistic management are not showing the asscociate 17track events in UI.
- NN328928765BR should be in Dest. Customs
- 382386563776, NN285538765BR, 	NN328928765BR, ND720492541BR incomplete events information. review all shipment log areas in all timelines

- in logistic management -> Shipping Management, GRID rows CARDS show order details - products, customs
- the button "Reset Tracking Data" must unregister all trackingnumbers from 17track api
- in App config, shipping settings, after the field "Shipping Fee Brazil Agent → Customer (USD)", add a new "Postal service tax" field.  default value is 18,10. This new field is now part of the logic everywehere we do customs calculations for pacages sent to Brasil, including the federal and ICMS tax, explicity sum and display the new "Postal service tax". This field is a BRL currency field. And it is included only in the formulaes which calculates the customs taxes in BRL in ORDERS CRUD and invoices
- delivered trackin numbers have no stored data. Delievered tracking numbers must always store the entire events set from 17track. Downalod and styore it. The Uupdate buttons should download the entire events records from all including delivered packages
- Shipping history in all timelines are showing only the first one events and should show all in order.
- when editing tracking number, memo field is not being saved.
- Daily shipping events is shown and suddenly disappear in Unified Tracking.
- make all timelines closed in Unified Tracking. The user will click to open what they want to see, add aditionally the memo information text to the retracted items, so user can identify what is each shipment and decide which to open.
- Unified Tracking allow user to select how many items to display in the screen. Default 100, sorted by progress, delivered on bottom, preparing on top. allow filtering and sorting in the screen.
- Unified Tracking is not being automatically updated when there changes in the background.






- Orders -> Orders TAB CRUD GRID ROW CARD, add payment tabs and list out the associated OrderPayments information
- Orders -> OrderPayments Tab GRID - group payment transactions per order.
- Orders -> Create and Edit forms: When updating the organization field of an Order, changing the order ownership, do a cascade update with all linked objects, changing it organinzation too.

in Organization CRUD: 
- a help icon with the explanation of each button in toobar
- allow to create a new ERP user in "New Organization" form, allowing to set a nwe user as organization owner, that user is always admin


Review all CRUDS that have memo field:
- memo fields: show in cards in all GRIDS of all CRUDs that have memo fields



Create the Product Catalog variant data entity based current Product data entity, clone it, remove "stock" and "br stock"fields from it, once it is just a virtual representation of Product catalog variant

in product catalog -> Catalog Listing -> display associated variants data in each grid row CARD

Create a new "SoldProduct" data entity. Clone of Product.

Now, the Product data entity officially represents a phisical inventory of an organization. 

so, it no longer has the columns "stock" and "br stock".

add the fields: "batch", "serial number" to Products Data entity. 
remove fields "stock" and br stock

All the current itens in inventory perteins to "KetchP" organization

the BR stock, logically, now are the Inventory of X-Synth peptides in X-synth address, add new items in inventory for X-synth cloning the items from "KetchP" that has itens in current "br stock".

The current items from  "KetchP" inventory are all "unit type" "set".
The current items from  "X-synth" inventory are all "unit type" "un".

So, if the inventory has 100 units of an item to sell, it must have 100 correlated records in Product data entity.

Each product has a exclusive serial number and pertains to a batch number.

Whenever an item is sold, it is moved to "SoldProduct" data entity and is no longer available in inventory.

Whenever an order is placed, when selecting a new product line item, associate it with a inventory item. So when the order is paid and shipped, it is moved to "SoldProduct" and can not be reverted anymore. 
So now orders can track the serial number and batch of sold items.

The paid order must reference the sold items from "SoldProduct".

To add items in inventory (products) it now requires serial number, batch, manufacture date

Allow superadmin "copy" inventory items between organizations prompting for proper new serial number, batch, manufacture date

Update CRUDS, FORMS, GRIDS of all correlated data entities.



In storefront, now the fast deliver items are now only items from X-Synth inventory. List products from both inventories in storefront but with clear separation of concern,

In storefront, clients registered in brazil only see items from X-synth.

Products -> Product Listing:
- make Country of Origin a dropdown field
- display photos in pop up window in same screen


----

add a new Customs catalog Category data entity. There are 2 categorie: Cosmetics with the HS number 3304.99 and "Natural Mica Powder for Arts & Crafts" with the HS 2525.20.

All current itens in Customs catalog are are from Cosmetics  Customs catalog Category.


----



- The the new Customs Catalog Category data entity and full COMPLETE CRUD with FORMS, GRIDS, GRID row CARDS, pop up window to edit records. Add the categories: - "Skin Care and Cosmetics", - "Arts, painting, and crafts". All the current items in Customs Catalog are from "Skin Care and Cosmetics", link it. update Customs Catalog CRUDs to support the new category field, FORMs, GRID and grid row card. 
- Product Catalog Variants must be linked to Customs Catalog items as the same way that Products are. So, when adding new "Product" into the inventory, theu will inherit it from the associated "Product Catalog Variant", in the Variant Listing Product Catalog Variant CRUD, show the associate Customs catlog item for each item. Update the FORM, GRID and GRID row CARD





arts, painting, and crafts

----

- Inventory Listing nest item per name -> code, so the grid should not list several entries with same product name
- Product Batches CRUD must show progress, update automatically after migrating and changing recordsm use same standards of previous crUDS

Product photos field is now managed at Product Batch level. Update the data entiees and UI CRUDS, forms, grids, CARDS details


------------
- LLC
- Tax Id
- Stripe or ebanx.



2 H24    ->       240
2 TR60    ->      320
2 RT60    ->      512
1 2S10    ->       84
1 G5K    ->        80
1 KP10    ->       64
1 PIN5    ->       48
1 FN1    ->       240
1 VP5    ->        96
1 ML10    ->       56
1 5AD    ->        88
1 MA10    ->       48
1 NP810    ->      40
1 NET5    ->       64
1 XT100    ->     160
1 TSM5    ->      104
1 MS20     ->     104
1 CP10     ->     104
1 CP20     ->     200
1 5AD     ->       88
1 DS10     ->      72
1 BC10     ->      56
1 IG1      ->     200
1 CND10      ->   140
1 ET10      ->     36
1 PIN5      ->     48
1 KS10      ->     72