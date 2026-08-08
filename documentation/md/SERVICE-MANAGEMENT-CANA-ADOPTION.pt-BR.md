<!--
Arquivo gerado automaticamente a partir de: documentation/md/SERVICE-MANAGEMENT-CANA-ADOPTION.md
Idioma alvo: Português (Brasil)
-->
# Adoção do Cana no Service Management, migração e comportamento offline

Este é o documento E6 da cadeia de documentação E1–E8 do Service Management
([JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior)).
Ele documenta a adoção do Cana pelo lado do **consumidor** — o que o designer
promete aos seus usuários sobre os dados deles — exatamente como o código se
comporta hoje, após a entrega da frente de adoção do Cana
([JUM-483](https://linear.app/jumentix/issue/JUM-483/feature-canadesignerstore-idesignerstore-adapter-over-the-cana-client),
[JUM-484](https://linear.app/jumentix/issue/JUM-484/feature-one-way-migration-of-service-managementv1-from-localstorage-to),
[JUM-485](https://linear.app/jumentix/issue/JUM-485/feature-write-event-integration-multi-tab-sync-via-cana-message),
[JUM-486](https://linear.app/jumentix/issue/JUM-486/test-offlineonline-matrix-for-designer-persistence-on-cana)).

A documentação do próprio Cana
([CANA-INDEXEDDB-ADAPTER](./CANA-INDEXEDDB-ADAPTER.pt-BR.md) e
[CANA-USAGE-GUIDE](./CANA-USAGE-GUIDE.pt-BR.md), Cana
[JUM-418](https://linear.app/jumentix/issue/JUM-418/docs-document-cana-architecture-api-migration-and-offline-examples))
documenta o que o banco de dados faz. Este documento registra no que um usuário
do designer pode confiar, o que pode destruir seu trabalho e o que fazer a
respeito — com cada estado nomeando tanto o que é exibido quanto o que o
usuário pode fazer.

Dois limites deliberados:

- **O esquema de armazenamento é referenciado, não duplicado.** As chaves e o
  formato do payload estão fixados no
  [Requisito 126, Contrato 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md);
  este documento referencia esse contrato e não o repete.
- **Os detalhes internos vivem nos documentos irmãos.** O contrato da porta e a
  arquitetura de módulos pertencem ao documento E3,
  [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md);
  as garantias de paridade (incluindo o limite do escopo de exportação) ao
  documento E4,
  [Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md);
  o contrato das superfícies de status, por meio do qual todas as mensagens
  abaixo são renderizadas, ao documento E5,
  [Console de operações do Service Management](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md).

## O único fato do qual todo o resto decorre: sem fallback

**O Cana não tem fallback para localStorage. Nenhum fallback** (decisão de
29/07/2026). Desde a migração unidirecional do
[JUM-484](https://linear.app/jumentix/issue/JUM-484/feature-one-way-migration-of-service-managementv1-from-localstorage-to),
os dados do designer vivem no Cana e em nenhum outro lugar: o
`LocalStorageDesignerStore` transicional foi aposentado e excluído, e nenhum
argumento de driver, global de ambiente ou parâmetro de URL pode desviar o
designer do Cana
([`designerStoreFactory.js`](../../apps/service-management/src/store/designerStoreFactory.js)).
Cada estado de falha abaixo é, portanto, genuíno — não há nada atrás do store
para segurar o designer.

Três coisas decorrem disso que um usuário deve saber sem precisar inferir:

1. **Onde seu trabalho vive.** Neste navegador, nesta máquina, neste perfil de
   navegador — um banco IndexedDB chamado `service-management`, um único object
   store (`designerDocuments`), dois documentos sob as chaves fixadas
   `service-management.v1` e `service-management.schema-baseline.v1`. Ele
   **não é sincronizado** com nenhum servidor (o servidor da aplicação serve o
   shell; ele nunca vê os dados do seu design), **não tem backup feito por
   nós** e **não é recuperável pelo suporte**. Outro navegador, outro perfil,
   outra máquina é outro designer — vazio.
2. **Como ele pode ser perdido.** Evicção de armazenamento pelo navegador (o
   navegador reivindicando o armazenamento da origem sob pressão de disco),
   limpeza de dados do site, uma sessão privada/anônima ou armazenamento
   bloqueado, um navegador sem IndexedDB utilizável, esgotamento de quota e
   corrupção. Cada um é nomeado claramente na matriz abaixo — nenhum deles é
   um "modo degradado", porque não existe modo degradado: um store que não
   consegue guardar seus dados é um store que os perdeu.
3. **O que fazer a respeito.** **Exportar.** Sob o requisito de ausência de
   fallback, a exportação do designer (e o único backup automático que a
   migração produz) é o único mecanismo de recuperação que existe — veja
   [Exportação e backup](#exportação-e-backup).

Uma documentação que descrevesse a adoção do Cana como uma melhoria sem
declarar esses modos de perda seria precisa sobre a tecnologia e enganosa
sobre o produto. A matriz abaixo é a verdade do produto, e é a mesma matriz
que a suíte de navegador do
[JUM-486](https://linear.app/jumentix/issue/JUM-486/test-offlineonline-matrix-for-designer-persistence-on-cana)
testa; as duas não podem divergir.

## Migração: unidirecional, verificada, terminal (JUM-484)

A migração do `service-management.v1` do localStorage para o Cana roda no
boot, antes de qualquer carregamento de estado, no primeiro lançamento após a
atualização — e exatamente uma vez
([`canaMigration.js`](../../apps/service-management/src/store/canaMigration.js)).
Como a segurança não pode vir da retirada, ela vem da construção:

- **Backup antes da primeira escrita.** Antes que qualquer coisa seja escrita
  no Cana, o payload verbatim do localStorage é baixado como
  `service-management-v1-backup-<timestamp>.json`. Este arquivo é o recurso
  que substitui o fallback aposentado — guarde-o.
- **Verificação antes da transição.** O payload de estado (e o baseline de
  diff de schema, quando existe) é escrito através da porta de armazenamento,
  lido de volta e comparado em conteúdo com a fonte. Somente uma migração
  verificada registra seu marcador (`service-management.v1.cana-migration`,
  status `verified`) e um registro de proveniência no Cana
  (`service-management.migration.v1`, versão de schema 1).
- **Falha é declarada, nunca silenciosa e nunca destrutiva.** Qualquer falha —
  um store que não aceita escrita, uma divergência na leitura de volta — deixa
  a fonte no localStorage intacta e a migração reexecutável no próximo
  lançamento. Um payload de origem que não é JSON legível não pode ser migrado
  e nunca é excluído: ele permanece no lugar para recuperação manual, e o boot
  diz isso.
- **Idempotente.** As escritas são `put`s do mesmo payload sob as mesmas
  chaves fixadas; uma migração interrompida reexecuta para o resultado
  idêntico, e um marcador verificado curto-circuita a reentrada — inclusive
  através de um período offline (comprovado pela matriz do JUM-486).
- **Retenção atrasada da fonte por 30 dias.** Após uma migração verificada, a
  fonte no localStorage permanece no lugar, SEM USO, por 30 dias — apenas um
  caminho de recuperação manual, nunca um fallback: nenhum caminho de código a
  lê como store. Após o período de retenção, o boot a remove. A migração é
  terminal.
- **Unidirecional significa unidirecional.** Não há rollback. Uma vez
  verificada a migração, o designer lê e escreve exclusivamente no Cana, e
  nenhuma configuração pode revertê-lo.

O que o usuário vê:

- Em caso de sucesso, a região de status anuncia: *"Your saved design was
  moved to the new persistent store and verified. A backup was downloaded as
  `service-management-v1-backup-<timestamp>.json`; the previous copy stays,
  unused, for 30 days as a manual recovery path."*
- Em caso de falha, um erro nomeia a razão
  (*"Your previously saved design could not be migrated: …"*) e a migração
  tenta novamente no próximo lançamento — a fonte ainda está lá.
- O formato de transmissão não mudou (Requisito 126, Contrato 2): mesmas
  chaves, mesmos documentos JSON — apenas onde vivem. Um baseline existente
  atravessa junto com o estado; um baseline ausente permanece ausente, nunca
  fabricado.

**Comprovado por:**
[`canaMigration.test.ts`](../../apps/backend-template/test/unit/service-management/canaMigration.test.ts)
(unitário) e
[`canaMigration.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/canaMigration.browser.integration.test.ts)
(navegador real, IndexedDB real), mais a célula de idempotência da migração
offline da matriz do JUM-486.

## Comportamento offline: tudo funciona, e "offline" não é "seguro"

**Tudo funciona sem rede — o designer sempre foi local.** O modelo, as abas do
console, desfazer/refazer, importação/exportação e cada gravação rodam contra o
Cana no navegador; o servidor apenas serve o shell da aplicação e as APIs de
ambiente de runtime/PM2. Com o shell PWA instalável
([JUM-489](https://linear.app/jumentix/issue/JUM-489)) o aplicativo carrega
mesmo sem rede alguma: o shell vem do cache do service worker, os dados do
Cana — dois armazenamentos diferentes que nunca se personificam (o shell nunca
mascara um banco evictado como primeira execução, e nunca apresenta dados
próprios em cache; veja o
[README do componente](../../apps/service-management/README.pt-BR.md)).

O que "offline-first" **não** garante:

- **Sem sincronização.** Offline significa *nenhum servidor é necessário*, não
  *seus dados existem em algum outro lugar*. Não há conta, não há cópia na
  nuvem, não há replicação entre dispositivos ou navegadores.
- **Sem backup.** A durabilidade é a política de armazenamento do navegador,
  não nossa. "Limpar dados do site" remove TANTO o cache do shell QUANTO o
  banco Cana — a presença do shell nunca implica que os dados do designer
  estejam seguros.
- **Sem imunidade.** Evicção, esgotamento de quota e corrupção acontecem
  offline também. O trabalho offline está exatamente tão exposto quanto o
  online, e a resposta é a mesma: exporte.

**Comprovado por:** as células offline do JUM-486 — o servidor é
genuinamente morto (nunca uma flag de offline emulada), as edições continuam
contra o IndexedDB real, um reload retorna do cache do shell com as edições
online e offline intactas, e voltar a ficar online não perde nada e não
duplica nada.

## A matriz de estados: o que você vê, o que você pode fazer

Uma matriz, três colunas: a condição de armazenamento (das políticas de quota,
persistência, evicção e recuperação de falhas do Cana — Cana
[JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy)
e
[JUM-411](https://linear.app/jumentix/issue/JUM-411/fix-implement-worker-crash-recovery-and-state-resynchronization)),
o que o designer mostra a você e o que você pode fazer. Cada mensagem é
renderizada através da região de status não bloqueante do JUM-543 — nunca um
alerta bloqueante. O boot declara os estados de ambiente na inicialização,
ANTES que você invista trabalho; os estados do caminho de escrita emergem no
momento em que acontecem.

### Armazenamento privado/anônimo ou bloqueado — sessão sem persistência

- **O que você vê** (na inicialização, severidade erro): *"Persistent storage
  is unavailable in this browsing context (private/incognito mode, blocked
  storage, or storage not yet wired into this host). The designer cannot save
  your work: anything you build in this session will be lost when it ends."*
  O designer ainda abre e é totalmente explorável — apenas em memória. Se você
  tentar salvar, a falha é exposta (*"A save could not be confirmed…"*),
  nunca aceita silenciosamente; um reload perde a edição e a declaração se
  repete.
- **O que você pode fazer:** exportar o modelo em memória (Export JSON funciona
  sem armazenamento) antes de fechar, e refazer o trabalho em uma
  janela/perfil normal onde o armazenamento é permitido. Nada do que você
  construir nesta sessão pode ser recuperado depois.

### Um navegador sem IndexedDB utilizável — ambiente não suportado

- **O que você vê** (na inicialização, severidade erro): *"This browser
  provides no usable IndexedDB storage. The Service Management designer
  depends on it for persistence, so this environment is unsupported: you can
  explore the designer, but nothing you build here can be saved."* Este é um
  estado distinto do modo privado acima — não é uma tela em branco, e não é a
  mesma mensagem.
- **O que você pode fazer:** explorar e exportar; fazer o trabalho real em um
  navegador com IndexedDB.

### Persistência não concedida — durabilidade degradada

- **O que você vê** (severidade info): *"Storage is working but durability is
  degraded: durability: storage is not persistent; the browser may reclaim it
  under pressure."* Leituras e escritas funcionam; o navegador simplesmente
  não prometeu manter os dados quando o disco ficar apertado, o que torna a
  evicção (abaixo) mais provável.
- **O que você pode fazer:** continuar trabalhando, mas exportar
  regularmente; onde o navegador oferecer a concessão de persistência,
  permita.

### Quota perto do esgotamento — aviso antes da falha

- **O que você vê** (severidade info): *"Storage is working but durability is
  degraded: quota: storage usage is near the origin quota (uso/quota em
  bytes); writes may start failing."* O aviso chega ANTES da falha dura — as
  leituras ainda funcionam, e o caminho de exportação está acessível a partir
  da sessão avisada (comprovado pela célula de quota do JUM-486, que exporta
  `domain-designer.json` exatamente deste estado).
- **O que você pode fazer:** exportar agora, depois liberar armazenamento da
  origem (configurações do navegador) antes de continuar.

### Quota esgotada — a escrita não aconteceu

- **O que você vê:** uma escrita rejeitada por quota é relatada como não
  confirmada (*"A save could not be confirmed (quota: …); reconciling with
  the stored document."*) — nunca como sucesso. A taxonomia do Cana é
  explícita: uma escrita rejeitada por quota NÃO aconteceu; o registro
  durável não carrega a edição condenada, e um reload conta a mesma verdade.
- **O que você pode fazer:** sua edição ainda está na tela nesta sessão —
  exporte-a antes de recarregar, libere armazenamento e então refaça a
  gravação.

### Banco evictado — perda de dados, declarada

- **O que você vê** (na inicialização, severidade erro): *"Previously saved
  designer data is no longer readable (storage eviction or corruption) and
  there is no fallback store. A fresh template was loaded instead; your only
  recourse is a backup/export made earlier."* Um banco evictado e uma
  primeira execução são indistinguíveis por inspeção; somente o veredito do
  tombstone do Cana os diferencia, portanto este estado NUNCA é apresentado
  como primeira execução — e um perfil genuinamente novo nunca é relatado
  como perda de dados (ambas as direções comprovadas).
- **O que você pode fazer:** restaurar a partir de uma exportação anterior ou
  do backup da migração (Import JSON). Não há outro recurso — nenhum store de
  fallback, nenhuma cópia no servidor, nenhuma recuperação pelo suporte.

### Registro corrompido — perdido, não vazio, e o designer se recupera

- **O que acontece:** um payload armazenado que não pode mais ser analisado
  reporta `'lost'` através da porta — nunca `'empty'` — e o designer se
  recupera em vez de quebrar: o template semente é carregado e a gravação de
  recuperação torna o registro legível novamente. **Lacuna honesta:** o boot
  ainda não anuncia essa recuperação de corrupção em tempo de carga na UI; o
  caminho de evicção acima é anunciado, o caminho de corrupção na carga
  atualmente se cura em silêncio. Esse anúncio está pendente como
  [JUM-626](https://linear.app/jumentix/issue/JUM-626/fix-announce-load-time-storage-corruption-recovery-in-the-boot-ui).
- **O que você pode fazer:** restaurar a partir de uma exportação anterior;
  trate qualquer retorno inexplicado ao template semente como um possível
  evento de perda.

### Resultado de escrita desconhecido — falha do worker após o despacho

- **O que você vê:** *"A save could not be confirmed (unknown-outcome: …);
  reconciling with the stored document."* Quando o Cana reporta o resultado
  de uma escrita como desconhecido (um worker de armazenamento que morreu
  depois que a escrita foi despachada, Cana JUM-411), o designer nunca assume
  sucesso: ele lê o documento armazenado de volta. Uma leitura que
  corresponde ao payload tentado confirma a gravação (*"The save was
  confirmed after reconciliation."*); qualquer outra coisa recarrega o último
  estado confirmado no designer, de modo que a tela nunca diverge do que está
  durável. Se a própria leitura falhar, a mensagem diz para exportar
  imediatamente — e fala sério.
- **O que você pode fazer:** nada, no caso comum — a reconciliação é
  automática. Na mensagem de falha: exporte agora.

**Comprovado por:** as oito células de
[`offlinePersistenceMatrix.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/offlinePersistenceMatrix.browser.integration.test.ts)
(a matriz do JUM-486 — persistência offline, idempotência da migração
offline, classificação de falhas, armazenamento privado/bloqueado, IndexedDB
ausente, evicção, corrupção, aviso de quota seguido de falha), executadas em
um navegador WebKit real contra o servidor real e o bundle Cana vendored
real, mais
[`canaDesignerStore.test.ts`](../../apps/backend-template/test/unit/service-management/canaDesignerStore.test.ts)
(o mapeamento taxonomia de erros → porta) em nível unitário. A matriz e esta
seção são a mesma promessa; mudou uma, mude a outra.

## Comportamento multi-abas (JUM-485)

Abra o designer em duas abas do mesmo perfil de navegador e ambas permanecem
consistentes: cada aba mantém seu próprio cliente Cana sobre o mesmo banco, e
as escritas confirmadas atravessam entre as abas por uma ponte
`BroadcastChannel` — os eventos de escrita ordenados do Cana
(`CanaClient.subscribe`, Cana JUM-413) alcançam apenas a instância de cliente
inscrita, portanto o canal é a fronteira entre abas
([`designerSync.js`](../../apps/service-management/src/state/designerSync.js)).
A semântica registrada:

- **Desfazer é apenas local; mudanças remotas não são desfazíveis.** Uma
  mudança de outra aba nunca entra na sua pilha de desfazer, e ela trunca sua
  ramificação de refazer. Desfazer uma ação SUA após uma mudança remota
  restaura seu snapshot e o persiste como uma nova escrita local deliberada —
  nunca é um desfazer DA mudança remota.
- **Uma edição local pendente sobrevive a uma mudança remota.** Quando a
  mudança de outra aba toca o que você está editando, o documento confirmado
  vence (o Cana detém a verdade), mas sua entrada de formulário em andamento,
  foco, cursor e scroll/zoom do canvas são preservados, a região de status
  anuncia a mudança remota, e sua próxima gravação explícita afirma sua
  versão. Nem sua edição pendente nem a mudança remota são descartadas
  silenciosamente. A resolução de conflitos é last-writer-wins de documento
  inteiro — não há merge por campo.
- **A seleção é por aba e reconciliada, nunca importada.** Se outra aba
  excluir o relacionamento ou a entidade que você selecionou, sua seleção é
  limpa; se excluir seu domínio selecionado, a seleção move para o primeiro
  domínio restante. Toda reconciliação é anunciada — uma seleção pendurada é
  impossível e nunca silenciosa.
- **Abas em segundo plano e fechadas se atualizam sem perda nem duplicação.**
  Uma aba congelada que perdeu mensagens do canal ressincroniza por leitura do
  documento quando se torna visível; uma aba reaberta depois já carrega o
  documento atual no boot. O cursor de eventos persistido é apenas
  contabilidade de melhor esforço — perdê-lo apenas significa que o próximo
  início ressincroniza por documento, o que é sempre correto (veja a seção de
  pendências).
- **Um canal indisponível é declarado, não escondido.** Sem um
  `BroadcastChannel` utilizável o designer ainda grava no Cana, mas a região
  de status diz claramente que esta aba não verá as mudanças de outras abas
  até o reload — o designer nunca reverte silenciosamente para uma sessão
  local de aba única.

**Comprovado por:**
[`designerSync.test.ts`](../../apps/backend-template/test/unit/service-management/designerSync.test.ts)
(unitário) e
[`multiTabSync.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/multiTabSync.browser.integration.test.ts)
(contextos reais de navegador com duas abas).

## Exportação e backup

Sob a ausência de fallback, a exportação é o único mecanismo de recuperação
que existe — portanto ela deve ser óbvia, não meramente disponível.

- **Como exportar:** o botão **Export JSON** da barra de ferramentas do Domain
  Designer baixa `domain-designer.json` — o documento do modelo
  (`{ domains, relationships, view }`). O **Import JSON** na mesma barra o
  restaura. Os outros botões de exportação (Markdown, JSON Schema, OAS 3.1,
  AsyncAPI, gRPC proto, boilerplate bundle, pacote de domínio) são artefatos
  de design para ferramentas downstream, não backups.
- **O escopo da exportação, honestamente:** a exportação JSON carrega a fatia
  do modelo. As seções `interfaces`, `serviceConfiguration` e
  `runtimeEnvironment` do estado da suíte não atravessam nenhum caminho de
  exportação hoje — esse limite e sua issue responsável
  ([JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration))
  são nomeados pelo documento E4,
  [Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md).
  Uma importação restaura o modelo, a seleção e a view — não a configuração
  das abas do console.
- **O backup da migração é a única cópia de fidelidade total.** O
  `service-management-v1-backup-<timestamp>.json` que a migração baixa é o
  payload verbatim do `service-management.v1` — todas as seções. Guarde-o: é
  o único backup automático que o designer faz. (Importá-lo pela UI restaura
  a mesma fatia de modelo de qualquer importação; suas seções extras ficam
  preservadas no arquivo, mas não são lidas de volta pelo importador.)
- **Quando exportar:** antes de limpar dados do site ou trocar de
  navegador/perfil/máquina; no momento em que um aviso de quota ou
  durabilidade aparecer; antes e depois de uma grande sessão de redesign; e
  periodicamente em qualquer projeto que você não poderia se dar ao luxo de
  reconstruir. Após uma mensagem de evicção ou corrupção, uma exportação
  anterior é seu único caminho de volta.
- **Por que importa mais aqui:** em um sistema com fallback, exportar é uma
  conveniência. Aqui é a diferença entre um inconveniente e uma perda total e
  irrecuperável — o navegador não deve nada aos seus dados.

## Solução de problemas

- **"Meu design desapareceu e recebi uma mensagem de perda de dados."** Isso é
  uma declaração de evicção (ou corrupção), não uma primeira execução: o
  designer tinha dados, o armazenamento do navegador não tem mais, e não há
  fallback. Restaure sua exportação mais recente com Import JSON. Para tornar
  a recorrência menos provável, mantenha baixa a pressão de armazenamento da
  origem e conceda persistência quando o navegador oferecer.
- **"Meu design desapareceu SEM mensagem."** Se este é um navegador novo, um
  perfil novo, uma máquina nova, ou após limpar dados do site, esta é uma
  primeira execução — seus dados nunca estiveram aqui, porque eles nunca
  saem do perfil de navegador em que foram criados. As duas situações são
  deliberadamente distinguíveis: um início genuinamente novo mostra o template
  semente em silêncio; uma perda real é anunciada.
- **"Tudo funciona em uma janela normal mas some no modo privado."**
  Esperado: a janela privada é uma sessão declarada sem persistência. O
  trabalho feito lá não se transfere — exporte-o antes de fechar se
  precisar dele.
- **"Recebi uma mensagem de ambiente não suportado."** Este navegador não
  fornece IndexedDB utilizável. O designer é explorável, mas nada pode ser
  salvo; use um navegador com IndexedDB.
- **"A save could not be confirmed."** Leia a razão na mensagem: `quota:`
  significa que a origem está cheia (exporte, libere espaço, tente de novo);
  `unknown-outcome:` significa que o resultado era indeterminado e o designer
  já reconciliou por leitura de volta; `unavailable:` significa que o próprio
  ambiente de armazenamento desapareceu (veja as três primeiras linhas da
  matriz).

## Pendências conhecidas

Registradas honestamente, com suas issues responsáveis:

- **[JUM-626](https://linear.app/jumentix/issue/JUM-626/fix-announce-load-time-storage-corruption-recovery-in-the-boot-ui)
  — anúncio de corrupção em tempo de carga pendente.** O caminho de evicção
  declara a perda de dados no boot; um registro corrompido descoberto na carga
  atualmente se cura em silêncio (template semente + gravação de recuperação).
  O anúncio na UI de boot é a correção pendente.
- **O defeito de bundling do bundle Cana — pertence à frente do Cana.** O
  bundle Cana vendored do designer é construído a partir da entrada
  `adapter.ts` do `packages/cana` em vez do índice do pacote, porque o
  bundling de grafo completo do índice pelo bun emite bindings de exportação
  pendurados que o WebKit se recusa a linkar. A verificação de artefato em
  [`ci-cd/sync-service-management-cana-bundle.js`](../../ci-cd/sync-service-management-cana-bundle.js)
  falha fechado contra exatamente essa regressão até que o defeito do bundler
  seja corrigido upstream.
- **A persistência do cursor multi-abas é de melhor esforço.** O cursor de
  sincronização sobrevive a uma lacuna dentro da sessão, mas não a um reload
  de página (um cliente fresco reinicia sua janela de eventos retidos), e
  perdê-lo é seguro por construção — a atualização é sempre por leitura do
  documento. Um cursor mais durável é um refinamento possível, não uma lacuna
  de correção.

## O que este documento deliberadamente não cobre

- **O próprio esquema de armazenamento** — chaves, seções e formatos de
  payload estão fixados no
  [Requisito 126, Contrato 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md);
  este documento o referencia em vez de duplicá-lo.
- **O contrato da porta e os detalhes internos dos módulos** — os conjuntos
  de estados do `IDesignerStore`, o mapeamento da taxonomia de erros do
  adaptador e a construção do módulo de migração pertencem ao documento E3,
  [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md).
- **Garantias de paridade** — incluindo o limite do escopo de exportação e a
  JUM-547 — pertencem ao documento E4,
  [Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md).
- **O contrato das superfícies de status** — como as mensagens são renderizadas
  (região aria-live, severidades, sem `alert()`) pertence ao documento E5,
  [Console de operações do Service Management](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md).
- **O que o motor Cana em si garante** — sua política de durabilidade,
  taxonomia de erros, resultados de transação e API de subscrição são
  documentados pelo Cana:
  [CANA-INDEXEDDB-ADAPTER](./CANA-INDEXEDDB-ADAPTER.pt-BR.md) e
  [CANA-USAGE-GUIDE](./CANA-USAGE-GUIDE.pt-BR.md)
  ([JUM-418](https://linear.app/jumentix/issue/JUM-418/docs-document-cana-architecture-api-migration-and-offline-examples)).

## Referências

- Migração + estados de ambiente: [`apps/service-management/src/store/canaMigration.js`](../../apps/service-management/src/store/canaMigration.js); adaptador Cana: [`apps/service-management/src/store/CanaDesignerStore.js`](../../apps/service-management/src/store/CanaDesignerStore.js); fábrica: [`apps/service-management/src/store/designerStoreFactory.js`](../../apps/service-management/src/store/designerStoreFactory.js)
- Motor de sincronização multi-abas: [`apps/service-management/src/state/designerSync.js`](../../apps/service-management/src/state/designerSync.js); núcleo de estado: [`apps/service-management/src/state/designerState.js`](../../apps/service-management/src/state/designerState.js); fiação de boot e cola de exportação/importação: [`apps/service-management/script.js`](../../apps/service-management/script.js)
- Sincronização do bundle Cana vendored: [`ci-cd/sync-service-management-cana-bundle.js`](../../ci-cd/sync-service-management-cana-bundle.js)
- Suítes: [`canaMigration.test.ts`](../../apps/backend-template/test/unit/service-management/canaMigration.test.ts), [`canaDesignerStore.test.ts`](../../apps/backend-template/test/unit/service-management/canaDesignerStore.test.ts), [`designerSync.test.ts`](../../apps/backend-template/test/unit/service-management/designerSync.test.ts) (unitárias); [`canaMigration.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/canaMigration.browser.integration.test.ts), [`multiTabSync.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/multiTabSync.browser.integration.test.ts) (navegador); a matriz offline/online do JUM-486 [`offlinePersistenceMatrix.browser.integration.test.ts`](../../apps/backend-template/test/integration/ServiceManagement/offlinePersistenceMatrix.browser.integration.test.ts) (navegador, [JUM-486](https://linear.app/jumentix/issue/JUM-486/test-offlineonline-matrix-for-designer-persistence-on-cana))
- Esquema de armazenamento: [Requisito 126, Contrato 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md); paridade bilíngue: [Requisito 076](../../.agents/requirements/project/076-task-documentation-and-bilingual-governance.md)
- Documentação do motor Cana: [CANA-INDEXEDDB-ADAPTER](./CANA-INDEXEDDB-ADAPTER.pt-BR.md), [CANA-USAGE-GUIDE](./CANA-USAGE-GUIDE.pt-BR.md)
- Documentos irmãos da cadeia E: [Contratos de ambiente de runtime](./RUNTIME-ENVIRONMENT-CONTRACTS.pt-BR.md) (E1), [Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md) (E3), [Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md) (E4), [Console de operações do Service Management](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md) (E5), [Aplicativo Service Management](./SERVICE-MANAGEMENT-APPLICATION.pt-BR.md), [Funcionalidades e uso do Domain Designer](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.pt-BR.md)
- Linear: [JUM-483](https://linear.app/jumentix/issue/JUM-483/feature-canadesignerstore-idesignerstore-adapter-over-the-cana-client), [JUM-484](https://linear.app/jumentix/issue/JUM-484/feature-one-way-migration-of-service-managementv1-from-localstorage-to), [JUM-485](https://linear.app/jumentix/issue/JUM-485/feature-write-event-integration-multi-tab-sync-via-cana-message), [JUM-486](https://linear.app/jumentix/issue/JUM-486/test-offlineonline-matrix-for-designer-persistence-on-cana), [JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration), [JUM-626](https://linear.app/jumentix/issue/JUM-626/fix-announce-load-time-storage-corruption-recovery-in-the-boot-ui), Cana [JUM-418](https://linear.app/jumentix/issue/JUM-418/docs-document-cana-architecture-api-migration-and-offline-examples), [JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy), [JUM-411](https://linear.app/jumentix/issue/JUM-411/fix-implement-worker-crash-recovery-and-state-resynchronization), [JUM-415](https://linear.app/jumentix/issue/JUM-415/feature-define-offline-conflicts-migrations-and-data-durability-policy), [JUM-413](https://linear.app/jumentix/issue/JUM-413)
