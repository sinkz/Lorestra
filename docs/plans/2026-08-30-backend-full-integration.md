# Lorestra — plano de integração completa com o backend

- Data: 2026-08-30.
- Status: **backend local implementado; aceite integral L ainda depende da evidência nativa autenticada e das cláusulas restantes da matriz de testes; S não iniciado**.
- Baseline inspecionada: `8f3aa74` (`feat/celestial-galaxies`).
- Entrega deste documento: escopo, decisões recomendadas, sequência de implementação, critérios de aceite e especificações E2E em Gherkin.
- Nenhuma etapa abaixo autoriza provisionamento, deploy, credenciais, migração destrutiva ou abertura de escrita pública.

## 1. Resultado esperado e significado de “100% funcional”

Uma pessoa ou um agente na sessão do navegador consegue encontrar conhecimento, ler uma revisão, propor uma alteração, receber feedback, corrigir a proposta, aprová-la e publicá-la. Outra sessão encontra a revisão publicada. Recarregar o navegador e reiniciar o Worker não perde documentos, propostas, revisões ou histórico.

O produto mantém Atlas, Library, diretórios, workspace Markdown, Proposals, History e Docs em inglês e português. As três comunidades fictícias — Orion, Lyra e Cygnus — permanecem disponíveis. O caminho de demonstração não depende do estado em memória do navegador.

Há dois marcos distintos:

| Marco                                    | Definição                                                                                             | Limite                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **L — integração local completa**        | UI e WebMCP → HTTP → Worker → D1/R2 locais; políticas, conflitos, persistência e recuperação testados | Identidade de desenvolvimento isolada; não comprova login real nem autoriza exposição à internet          |
| **S — colaboração compartilhada pronta** | Mesmo código, adaptador de identidade real, membros autorizados, limites, backup e smoke em staging   | Exige configuração de conta/identidade e autorização de deploy; não será declarado concluído apenas com L |

“100%” significa cumprir os critérios deste escopo, não ausência de qualquer bug nem um SaaS enterprise ilimitado. Cada marco terá evidências próprias; critérios pendentes continuam visíveis.

## 2. Estado atual verificado

Esta seção registra a baseline anterior à implementação. Para decisões aceitas consulte ADR-0006/0007; para operação local consulte `docs/operations/local-backend.md`. As evidências finais são registradas separadamente, sem transformar cenários ainda não executados em aprovação.

| Área          | Já existe                                                                        | Falta                                                                                                 |
| ------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Contratos     | Zod, `KnowledgeClient`, `ProposalClient`, OpenAPI                                | Precondições de versão, sessão/capabilities, atualização de proposta e erros operacionais completos   |
| HTTP          | Leitura de navegação, documentos, grafo, busca, propostas e histórico            | Escritas e persistência real; não basta trocar a variável do frontend                                 |
| Backend       | Hono/VSA, portas de leitura, adaptador em memória                                | Adapters D1/R2, migrations, writer transacional e identidade                                          |
| Propostas     | Estados `open`, `changes_requested`, `approved`, `merged`; política pura testada | Editar/reenviar, checks calculados no servidor, revisão da proposta, publicação de múltiplos arquivos |
| Versionamento | Mock demonstra revisões e alguns conflitos                                       | Proteção contra edição iniciada em versão antiga e concorrência no Worker                             |
| Frontend      | Composition root, cliente HTTP, Query, Zustand, FSD                              | Erros tipados, cancelamento, permissões, invalidação completa e UX de recuperação                     |
| WebMCP        | Dez ferramentas; mesma camada de clientes                                        | Identidade real, resultado sem `simulated-local`, atualização da UI e permissões por operação         |
| Conteúdo      | Vault bilíngue e galáxias no mock                                                | Um único processo de carga para API, demo e testes                                                    |
| E2E           | Playwright + playwright-bdd; smoke atual usa mock                                | Projeto HTTP isolado, persistência, dois usuários e testes de falha                                   |

A checagem anterior executou 17 testes da API e leu endpoints com o cliente HTTP real. Isso **não** validou um fluxo de escrita HTTP. O seed atual do Worker tem três documentos públicos em inglês e um em português, sem a demo completa.

Fontes do diagnóstico: [composition root](../../apps/web/src/shared/api/composition.ts), [cliente HTTP](../../apps/web/src/shared/api/http-clients.ts), [rotas](../../apps/api/src/app/create-app.ts), [contrato de propostas](../../packages/contracts/src/proposal.ts), [mock](../../packages/mock-vault/src/mock.ts), [configuração E2E](../../apps/e2e/playwright.config.ts).

### Lacunas que não podem ser escondidas pela troca de adapter

- O editor precisa enviar a versão **que foi lida**, não deixar o servidor capturar uma versão mais recente quando a proposta é criada.
- `changes_requested → open` consta na tabela de estados, mas ainda falta a operação para corrigir e reenviar a mesma proposta.
- O contrato aceita até 200 mudanças; o caminho atual do mock trabalha principalmente com o primeiro alvo. Não usar isso como prova de atomicidade de múltiplos arquivos.
- `before`, autoria, checks, timestamps e versão oficial não podem ser acreditados porque vieram do navegador.
- A justificativa da edição deve ficar na proposta, não ser concatenada ao Markdown publicado.
- Um merge precisa invalidar também a listagem `documents`. Escritas WebMCP precisam passar pelo mesmo coordenador de invalidação da UI.
- Paginar Library não resolve navegação: `/navigation` hoje retorna a coleção completa e há consumidores que a usam como catálogo global.

## 3. Escopo e exclusões

### Incluído em L

1. Leitura persistente, busca, filtros e paginação reais.
2. Criação, edição, arquivamento e exclusão lógica de documentos **por proposta**.
3. Metadados editáveis necessários ao produto: título, slug, idioma, tipo, pasta, tags, visibilidade, referências e estado editorial.
4. Correção/reenvio de propostas, revisão, checks, aprovação e merge.
5. Revisões imutáveis, histórico navegável, conflitos e idempotência.
6. Políticas por principal, sessão local explícita e testes de usuários distintos.
7. WebMCP usando a API e refletindo suas operações na UI.
8. Carga idempotente do vault, exportação e restauração local verificável.
9. Estados de loading, erro, acesso negado, perda de conexão e rascunho não enviado.
10. Preservação do layout aprovado e dos limites de renderização.

### Adicionado em S

- Login real, expiração/logout, revogação de acesso e membros autorizados.
- Implantação mesma origem, política de cache segura, limites de abuso e interrupção controlada de escrita.
- Backup operacional, restauração ensaiada e smoke entre máquinas em staging.
- README, Docs EN/PT-BR e runbooks refletindo o comportamento real.

### Fora deste plano

- Contas/tokens de agentes terceiros, MCP remoto, autoexecução em background ou promessa de integração com qualquer ChatGPT/browser.
- Editor colaborativo caractere a caractere, CRDT, WebSocket e resolução automática de conflitos.
- Multi-tenant SaaS, billing, marketplace, SSO de múltiplas organizações e convites self-service.
- Integração GitHub/GitLab que crie PRs reais; “proposal” continua sendo o domínio do Lorestra.
- Busca vetorial, embeddings e serviços pagos de IA obrigatórios.
- Editor de pastas com drag-and-drop e CRUD independente. Neste marco, pastas persistem, são carregadas pelo importador e podem ser escolhidas ao propor documentos; mudanças de localização seguem a proposta.
- Sincronização offline automática. Um rascunho pode ser recuperado localmente, mas não é apresentado como salvo no servidor.

## 4. Decisões recomendadas

As recomendações abaixo complementam os ADRs aceitos. Não alterar retrospectivamente seu status: antes de implementar, registrar novos ADRs para identidade e consistência de armazenamento.

### 4.1 Armazenamento: manter D1 + R2

| Opção                              | Vantagem                                                                                     | Custo / decisão                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **D1 + R2**                        | Alinha com ADR-0002; Markdown portátil e revisões em objetos; índices e workflow relacionais | Requer protocolo explícito entre dois armazenamentos. Recomendada                                          |
| Somente D1                         | Uma transação também cobre o corpo; implementação inicial mais simples                       | Mudaria a decisão de Markdown canônico em R2. Alternativa válida se simplificação for aprovada em novo ADR |
| Arquivos locais / Git como backend | Fácil inspeção e exportação                                                                  | Não resolve o runtime Worker e concorrência compartilhada. Apenas importação/exportação                    |

Usar os bindings oficiais e SQL parametrizado nas portas D1. Não introduzir ORM, fila ou Durable Object apenas por preferência; reconsiderar com evidência de complexidade ou contenção. Não atualizar todas as dependências como parte da integração: manter lockfile e verificar compatibilidade das adições necessárias.

D1 suporta batches transacionais; a atomicidade documentada cobre as instruções daquele batch, **não** operações R2. A consistência forte do R2 também não transforma D1 + R2 em uma transação distribuída. [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), [consistência R2](https://developers.cloudflare.com/r2/reference/consistency/).

### 4.2 Identidade: um vault por instalação, membros explícitos

- **Local:** adaptador de identidade de desenvolvimento, opt-in, visivelmente rotulado e restrito ao runtime local. O harness cria sessões de teste pelo processo de preparação, nunca por uma rota pública de “virar admin”.
- **Compartilhado:** recomendar Cloudflare Access como primeiro provedor; manter uma porta que permita OIDC depois. Não implementar ambos agora.
- Proteger uma entrada de login e validar o JWT recebido: assinatura/JWKS, issuer, audience e expiração. Apenas a presença de `Cf-Access-Jwt-Assertion` não autentica ninguém. [Validação oficial](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
- Após login válido, emitir sessão opaca do Lorestra em cookie HttpOnly, Secure em HTTPS, SameSite apropriado; persistir apenas hash do identificador. Prazo de sessão não ultrapassa o prazo da autenticação validada. Sem tokens em localStorage, URL, logs ou bundle.
- A aplicação pública não fica inteira atrás de um login obrigatório. A rota de login é protegida; leituras públicas continuam anônimas; o Worker exige sessão e política nas escritas e leituras privadas.
- Logout revoga a sessão no servidor. Desativar um membro remove sua autoridade na próxima operação, mesmo se a sessão ainda não expirou. Checar membership no servidor; não confiar em capabilities antigas da UI.
- Configurar entradas de login, origem e cookies em staging antes de declarar S pronto. Uma autenticação fake no E2E local não valida o provedor real.

### 4.3 Papéis mínimos

| Ação                                                 | Visitante | Leitor membro | Colaborador | Mantenedor                                |
| ---------------------------------------------------- | --------- | ------------- | ----------- | ----------------------------------------- |
| Ler documento público publicado/arquivado            | Sim       | Sim           | Sim         | Sim                                       |
| Ler conteúdo interno e propostas do vault autorizado | Não       | Sim           | Sim         | Sim                                       |
| Criar proposta                                       | Não       | Não           | Sim         | Sim                                       |
| Corrigir proposta não mesclada                       | Não       | Não           | Próprias    | Qualquer proposta autorizada              |
| Solicitar mudanças / aprovar                         | Não       | Não           | Não         | Sim                                       |
| Fazer merge explícito                                | Não       | Não           | Não         | Sim                                       |
| Gerir membros / backup operacional                   | Não       | Não           | Não         | Mantenedor via configuração/CLI protegida |

Para a equipe pequena, um mantenedor pode revisar sua própria proposta; a autoria e a revisão ficam registradas. Dupla aprovação obrigatória não entra neste marco. Approval e merge permanecem ações distintas. Um agente herda somente a autoridade da sessão em que está rodando, nunca ganha privilégio por dizer seu nome.

Propostas abertas são privadas aos membros. Visitantes só consultam projeções de propostas mescladas inteiramente públicas. Se um evento/proposta contém qualquer alvo sem autorização de leitura, omitir a projeção inteira neste marco; não vazar títulos, trechos, diffs, contagens ou IDs por sanitização parcial improvisada.

### 4.4 Fonte de verdade e conteúdo

- `vault/` versionado é a fonte do **seed/importação**, não um espelho continuamente regravado do ambiente vivo.
- R2 guarda Markdown canônico e snapshots; D1 decide quais revisões estão oficialmente publicadas e guarda índices derivados.
- Extrair o formato/parser compartilhável para um módulo sem dependência de React ou Worker, apenas se houver reutilização real entre CLI e servidor. I/O de filesystem fica na CLI.
- Preservar IDs, slugs, idiomas, links, tipos e a documentação existente. Não inventar um novo formato incompatível para ligar o backend.
- Conteúdo importado tem proveniência de fixture/importação, sem inventar autoria/revisão humana real. História demonstrativa deve ser identificada como fictícia.

## 5. Arquitetura alvo

```text
UI humana ───┐
             ├─ casos de uso do cliente + invalidação ─ HTTP /api ─ slices Hono
WebMCP ──────┘                                               │
                                                     identidade/política
                                                            │
                                              publicação/revisões/conteúdo
                                                  ┌─────────┴─────────┐
                                                  D1                  R2
                                           estado/índices/audit   Markdown/snapshots
```

- Manter FSD e VSA; contratos não importam Cloudflare, React ou fixtures.
- TanStack Query continua responsável pelo estado remoto. Zustand guarda preferências, não a versão oficial dos documentos nem decisões de autorização.
- O modo HTTP deve falhar de forma visível quando a API cai; **não retornar ao mock silenciosamente**.
- Build compartilhado não contém fixtures/adapters de memória. Mock pode permanecer como ferramenta de desenvolvimento/teste explicitamente selecionada.
- Não prometer zero mudanças de consumidores: sessão, conflitos e reenvio são capacidades novas. A troca de storage fica na composition; evolução de contrato é coordenada em UI, tools, mock, HTTP e servidor.
- Preferir mesma origem com prefixo `/api`: proxy Vite em desenvolvimento e roteamento equivalente em staging. O Worker pode continuar registrando caminhos relativos, desde que o prefixo seja resolvido em um único lugar.

## 6. Contratos e slices a completar

### 6.1 Novas operações e evolução controlada

| Superfície relativa da API                      | Entrega                                                 | Regras                                                                                |
| ----------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET /session`                                  | Principal, papel, capabilities, modo e limites efetivos | Visitante recebe capabilities de leitura; sem segredos                                |
| Entrada/saída de login e `POST /session/logout` | Autenticação do ambiente e revogação                    | Proteção de origem/CSRF; sem autenticação fake no build compartilhado                 |
| `POST /proposals`                               | Criar proposta durável                                  | Precondições por alvo, idempotência, metadados e justificativa                        |
| `PATCH /proposals/:id`                          | Corrigir conteúdo/metadata e reenviar                   | `expectedProposalVersion`; mesma identidade da proposta; aprovação/checks invalidados |
| `PATCH /proposals/:id/status`                   | Solicitar mudanças, aprovar, mesclar                    | Autoridade no servidor, versão esperada e motivo quando obrigatório                   |
| GETs existentes                                 | Ler D1/R2 com filtros e autorização                     | Erros e paginação consistentes; nada de arrays seed no runtime HTTP                   |
| Leitura por ID estável                          | Resolver alvo sem buscar o vault inteiro                | Método no cliente/contrato e rota apropriada; slug continua endereço legível          |
| Navegação paginada por pai                      | Carregar diretórios conforme expansão                   | `parentId`, cursor, `pageInfo`, ancestrais do documento selecionado                   |
| Histórico por evento/identidade de revisão      | Deep links diretos                                      | Sem depender de o evento estar na primeira página de `/history`                       |

Não criar uma rota que edite diretamente o documento publicado. Arquivar/excluir/mudar pasta também exige proposta e merge.

### 6.2 Campos e invariantes

- `baseVersion` por alteração de documento existente: versão lida no início da edição. Obrigatória em modified/deleted; null em added. Conflito já na criação quando a base ficou obsoleta, preservando o rascunho; revalidar no merge.
- `proposalVersion`: monotônica para edição, revisão e status. Approval registra a versão exata revisada; modificação posterior torna a aprovação inválida.
- `path` lógico normalizado e locale por alvo; separar caminho do vault de chave física R2. Proibir traversal, caminhos absolutos, IDs duplicados, dois alvos repetidos e pares before/after incoerentes.
- `before` para diff é resolvido da revisão persistida. Não confiar no texto before enviado pelo cliente. O request de escrita e o response de diff podem ter schemas diferentes.
- Metadata explícita para título, slug, locale, tipo, folderId, tags, visibility, status e referências. Metadados reservados (ID oficial, version, autor e datas) são gerados/validados pelo servidor.
- `added` cria um ID estável; `modified` preserva o ID, mesmo com rename/move; `deleted` cria tombstone e revisão de exclusão, sem apagar snapshots históricos. Slug anterior deve resolver para o mesmo ID/redirect, sujeito à política atual de leitura.
- Estado `archived` é conhecimento retido e legível, não privacidade. Documento excluído não aparece na Library/Atlas corrente; histórico autorizado continua legível.
- Uma alteração de idioma não reescreve traduções irmãs. Preferir criar/ligar a tradução com ID próprio; mudança do idioma de um ID existente exige regra explícita e validação.
- Justificativa/reason separada do `after` e preservada em eventos de revisão; não sobrescrever toda a discussão a cada transição.
- `Idempotency-Key` obrigatório nas mutações; chave reutilizada no retry da mesma operação e associada a principal, vault, método, alvo e hash do payload. Mesma chave + outro payload retorna conflito.
- `requestId` em toda falha; códigos distinguem 400/401/403/404/409/413/422/429/503. Adicionar códigos tipados faltantes e `Retry-After` para limitação temporária.
- Sem converter qualquer erro contendo o texto “404” em not-found. O cliente decide por status/código e valida a resposta Zod.
- `AbortSignal` atravessa os clientes HTTP; uma resposta antiga de busca não substitui a nova. Mutation com resultado incerto não gera nova chave automaticamente.

### 6.3 Workflow

1. Create → `open`, versão de proposta 1; nenhum documento oficial muda.
2. Request changes → `changes_requested`, motivo persistido e novo evento.
3. Edit/resubmit → mesma proposta, nova versão, `open`, checks recalculados; nenhuma aprovação anterior vale para o conteúdo novo.
4. Approve → `approved`; documento e índices publicados permanecem intactos. Checks bloqueantes podem continuar impedindo merge.
5. Merge → revalidar autoridade, aprovação, checks, bases, unicidade e limites; publicar atomicamente todos os alvos.
6. `merged` é terminal. Correção posterior nasce em outra proposta; retry da operação concluída retorna o mesmo resultado, não cria outra revisão.

Uma versão aprovada também pode ser corrigida por quem tem permissão: a atualização devolve a proposta a `open`. Esta evolução precisa ser refletida no contrato/state machine; não abrir exceção só na UI.

Exemplo normativo de versões: conteúdo H em proposta `open v1`; approval com `expectedProposalVersion=1` produz `approved v2` e registra `reviewedProposalVersion=1` + hash H. Merge exige `expectedProposalVersion=2`, estado approved, aprovação ativa e hash H ainda igual; sucesso produz `merged v3`. Não comparar a versão anterior revisada com a versão de estado posterior como se devessem ser iguais. Editar `approved v2` produz `open v3`, conteúdo H2 e aprovação invalidada; nova aprovação produz `approved v4`, e só uma confirmação de merge para v4 pode publicá-la. O token de confirmação humana inclui ID, versão de estado aprovada e hash; o backend revalida a versão, mesmo que o browser tenha mostrado uma confirmação antiga.

## 7. Persistência, transação e concorrência

### 7.1 Modelo mínimo

| Dado                            | Local e responsabilidade                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Vault/configuração e membros    | D1: vault único, principal externo, papel, ativo/inativo                                                        |
| Sessões                         | D1: hash, principal, expiração/revogação; nunca exportar como conhecimento                                      |
| Pastas                          | D1: ID, pai, idioma, ordem e título; validação de ciclos                                                        |
| Documentos                      | D1: ID, locale, slug atual/aliases, metadata, currentRevisionId, version, tombstone                             |
| Revisões                        | D1: ID/version, snapshot de metadata, hash/chave R2, autor, proposalId, publicationSequence                     |
| Markdown/snapshots              | R2 privado: objetos imutáveis endereçados por revisão/conteúdo; sem bucket público para drafts                  |
| Propostas e versões             | D1: estado, versão corrente, autor, título/justificativa; payloads imutáveis por versão em R2 quando necessário |
| Alterações e revisões de review | D1: bases por alvo, checks, aprovação vinculada à versão e decisões auditáveis                                  |
| Links, busca e navegação        | D1: projeções derivadas da revisão oficial; atualizadas no commit de publicação                                 |
| Idempotência                    | D1: operação, hash, estado e identidade do resultado; retenção configurada                                      |
| Auditoria                       | D1 append-only pela aplicação: ator real, ação, alvos, versões e requestId                                      |

Índices incluem `(vaultId, locale, slug)` único, `(documentId, version)` único, `(proposalId, proposalVersion)`, filtros de estado/idioma/pasta e desempate por ID para paginação. Consultas usam parâmetros, índices e projeções pequenas. R2 não é varrido para executar uma busca.

### 7.2 Protocolo de publicação

1. Autenticar e autorizar todos os alvos; ler proposta e bases; validar checks determinísticos e limites.
2. Calcular IDs/chaves e hashes estáveis para aquela operação. Preparar todos os objetos imutáveis R2 antes de publicar ponteiros. Escrita condicional ou comparação de hash impede sobrescrever conteúdo diferente com a mesma chave. [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
3. Executar **um batch D1 transacional**: validar precondições dentro da transação, inserir revisões, mudar todos os ponteiros, atualizar metadados/links/busca, registrar auditoria, status merged e resultado da idempotência.
4. Uma precondição falhada deve abortar o batch inteiro. `UPDATE ... WHERE version = ?` que altera zero linhas não é, sozinho, erro SQL: implementar uma guarda que gere falha transacional ou condicione comprovadamente todas as instruções ao mesmo token de commit. Não publicar metade e descobrir o conflito depois.
5. Só responder sucesso após o commit. Um segundo merge concorrente deve obter o resultado idempotente ou conflito, nunca outra versão para a mesma publicação.
6. Se houver R2 preparado e D1 falhar, nada é oficial: objetos órfãos privados podem ser reutilizados no retry ou limpos depois de janela segura. Coleta de órfãos revalida referências e operações em andamento; não apagar objetos de retries, backups ou revisões antigas.
7. Se D1 confirmar e a resposta se perder, retry com a mesma chave recupera o resultado persistido. Consultar resultado/status antes de dizer ao usuário para reenviar como nova operação.

Uma falha durante o batch, incluindo no último arquivo, deve deixar proposta, documentos, índices e histórico sem publicação parcial. Essa é uma prova obrigatória de integração no runtime Workers, não só um mock de repository. Se a guarda não puder ser demonstrada com segurança, bloquear o marco e revisar a estratégia; não improvisar um mutex em variável global do Worker.

### 7.3 Revisões e integridade

- Leitura histórica usa body **e metadata** do snapshot pedido; não mistura body v1 com título/status de v3.
- A autorização considera visibilidade atual e do snapshot: tornar um documento público não libera retrospectivamente uma revisão interna; torná-lo interno retira a projeção pública histórica.
- Auditoria não oferece update/delete pelo produto; ator e datas vêm do servidor. Hashes detectam corrupção quando comparados a uma referência confiável.
- Não prometer histórico “impossível de falsificar”: um administrador com acesso de escrita a D1 e R2 pode alterar ambos. Backup externo e manifesto de hashes melhoram detecção/recuperação, mas não equivalem a prova criptográfica contra o operador.

## 8. Leitura, cache, escala e UX

### 8.1 API

- Paginação real de documentos, propostas, histórico e filhos de pastas. Cursor opaco vinculado a ordenação, filtros, locale e escopo autorizado; máximo de 100 itens conforme contrato existente, com defaults menores por tela.
- Ordem estável com ID de desempate; mudança de filtro reinicia cursor. Cursor incompatível é rejeitado de forma tipada.
- Navegação carrega apenas pastas/filhos necessários. Obter ancestrais e documento por ID evita baixar tudo para abrir um deep link ou preencher uma proposta.
- Busca determinística com normalização EN/PT-BR, filtros e ranking documentado. Começar com índice textual D1; validar FTS/tokenização com os casos existentes antes de escolher implementação. Sem scan do R2 ou busca vetorial obrigatória.
- Atlas mantém 200 nós/500 arestas. Acrescentar sinal explícito de truncamento/escopo e contagens autorizadas; incluir o centro solicitado e apenas arestas cujas pontas foram retornadas. Oferecer estreitar pasta/relações, não fingir mostrar o vault inteiro.
- Graph DTO deve levar o mínimo necessário de tipo/status/identidade para o modelo celeste; não depender de um catálogo completo `/navigation` para decidir planeta/satélite/arquivo.
- Inicialmente sem CDN para respostas de documentos, busca, propostas ou histórico: `private, no-store` evita conteúdo interno residual e reduz problemas de revogação. Só adicionar cache público depois de provar invalidação/isolamento. Assets estáticos continuam cacheáveis.

### 8.2 Frontend

- Query keys incluem vault, principal/escopo de acesso, idioma, filtros, versão e cursor. Logout/troca de principal cancela requests, remove caches privados e descarta placeholderData da sessão anterior.
- Após create/update/transition/merge, um coordenador compartilhado invalida queries afetadas: proposals, proposal, documents, document current, navigation, graph, search, history e counters. UI e WebMCP chamam esse mesmo caminho.
- Não invalidar/regravar snapshots históricos imutáveis como se fossem documento corrente. Revalidar permissão quando a sessão muda.
- Outras sessões recebem dados atuais ao focar a aba ou atualizar. Sem promessa de push em tempo real; indicar dados desatualizados quando aplicável.
- Mostrar estado de requisição; impedir cliques duplicados sem confiar nisso como idempotência de servidor. Não exibir toast de publicado antes do commit.
- Conflito mantém rascunho e explica base versus versão atual; oferecer comparar e reenviar conscientemente. Nunca substituir a base silenciosamente.
- Formulário separa body/justificativa e permite os metadados previstos. Exibir ações conforme capabilities, mas o servidor continua sendo a autoridade.
- Listas de propostas permanecem linhas GitHub/GitLab-like; detalhes por arquivo com added/modified/deleted e navegação teclado. Paginar arquivos/diff quando necessário; resumo não baixa todos os bodies.
- Preservar virtualização do diretório após limiar medido; não confundir menos DOM com menos payload. Memoizar árvore visível por ramo, callbacks e seleção; mudança de seleção não refaz catálogo inteiro.
- Não alterar o renderer/câmera aprovados: animação fora do render React, pan/zoom, tooltips, reduced motion, opção de lista e controles móveis continuam funcionando.
- Rascunho offline é local e opt-in, isolado por vault/usuário, com limpeza no logout; nunca usar cache local como fonte oficial. Sem envio automático no reconnect.
- Todos os novos estados e erros têm textos EN/PT-BR; nenhum erro HTTP bruto substitui explicação útil.

## 9. WebMCP e facilidade para agentes

- Preservar nomes existentes quando possível. Acrescentar ferramenta de atualização/reenvio de proposta somente para a operação nova, com schema e guia correspondentes; não forçar o número antigo de dez tools.
- Guide descreve formato Markdown, metadados, capabilities atuais, limites, baseVersion, conflitos, idempotência e distinção entre propor/aprovar/mesclar.
- Read retorna versão/base e conteúdo como dado não confiável. Links e texto de uma nota não podem alterar papel, chamar outra tool por conta própria nem substituir confirmação de uma operação.
- Create/update não publicam. Merge exige operação explícita e confirmação humana para o caso browser-agent, vinculada a proposalId + proposalVersion; mudança de conteúdo invalida a confirmação. A política de servidor continua obrigatória.
- Tools retornam status real e identidade/revisão de resultado, sem alegar governança simulada quando o backend é persistente. Erros têm código recuperável e instrução de próximo passo sem vazar dados privados.
- Resultados paginados/limitados precisam expor cursor e truncamento, inclusive history/diff/read. Não cortar arrays e esconder como continuar.
- Browser sem WebMCP mantém toda a UI. Verificação de registro fake em teste unitário não prova integração real; manter uma evidência com navegador compatível e tool invocada pelo mecanismo real.
- Multiagente neste marco significa agentes de sessões autorizadas concorrendo sobre o mesmo backend. Não significa aceitar agentes remotos anônimos ou tokens independentes.

## 10. Segurança, operação e economia

- Nenhuma credencial, ID real de recurso ou sessão em código, screenshots de teste, traces publicados ou README. Configuração local ignorada; staging usa secrets/configuração do ambiente.
- Autorização cobre read, list, graph, history, versões, proposal detail e todos os alvos de uma alteração. IDs não são autorização. R2 privado só é lido por operações autorizadas.
- CSRF/origin check em mutações com cookie; JSON obrigatório, CORS allowlist exata se realmente cross-origin; CORS sozinho não protege uma rota.
- Markdown sem HTML arbitrário, URLs perigosas bloqueadas, paths normalizados, tamanhos máximos em bytes e esquema runtime validado antes de gravação.
- Limites configuráveis por principal/IP e globais: requests, propostas abertas, bytes por documento/proposta e número de arquivos. Limites efetivos declarados na sessão/OpenAPI; limites menores que os máximos estruturais do contrato são erros explícitos, nunca truncamento de escrita.
- Limites globais de escrita precisam de contador/quota atômico persistido, não variável por isolate. Rate limiting de plataforma é proteção adicional, não um teto financeiro exato.
- Ao atingir limite: 429 e Retry-After quando temporário; preservar rascunho. API indisponível/quota de storage: falha clara, nenhuma publicação parcial e nenhuma fila infinita.
- Começar sem Queues. Se uma operação não cabe no orçamento validado, limitar o lote ou projetar job durável com status; não simular sucesso e terminar o merge em `waitUntil`.
- Logs estruturados com requestId/operationId, latência, resultado e conflito; sem bodies, tokens, e-mails desnecessários ou diffs privados. Saúde pública não revela bindings ou credenciais.
- Switch operacional server-side de somente leitura, sem mudança destrutiva de dados, com motivo exibido na UI.
- Antes de S, verificar preços, requisitos de ativação e limites vigentes de Workers/D1/R2/Access. “Tier gratuito” não é promessa de uso ilimitado nem de ausência de exigência de billing. Não habilitar recurso pago automaticamente.

### Backup e recuperação

1. Exportação de vault é portabilidade editorial (Markdown + metadata/links); não substitui backup completo do workflow.
2. Backup operacional inclui D1, manifestos de todas as revisões/propostas, objetos R2 referenciados, hashes e versão do schema. Excluir sessões/tokens de artefatos portáteis; invalidar sessões em restore.
3. Primeiro procedimento simples: janela curta de somente leitura para congelar escrita, gerar snapshot consistente D1, copiar objetos privados referenciados e verificar hashes; reabrir escrita após verificar o manifesto.
4. Antes do lançamento e após mudança de schema, restaurar em diretório/bindings vazios, executar smoke e comparar revisões, links e eventos. Nunca testar restauração sobrescrevendo o ambiente ativo.
5. Para S, definir frequência/retenção e destino isolado; sugestão inicial de RPO até 24 horas, validada por execução real. RTO só é informado após medir o ensaio. Proteção nativa D1 não basta para restaurar D1 + R2 como conjunto.

## 11. Etapas executáveis e critérios de saída

Cada etapa termina em commit/PR convencional, com evidência proporcional ao risco. Não iniciar a próxima com inconsistência de contrato ou perda de dados conhecida. Os nomes abaixo são sugestões, não commits já feitos.

### F0 — contrato e ADRs

- [x] Aprovar o escopo L/S e registrar ADRs de persistência/publicação e identidade.
- [x] Evoluir schemas, interfaces, erros e OpenAPI conforme seção 6; criar matriz request/response.
- [x] Definir seed de aceitação e mapeamento dos IDs Gherkin para testes.
- [x] Provar que versões antigas de mock/HTTP não silenciam campos de segurança faltantes.
- Saída: contrato validado em todos os consumidores, mudanças incompatíveis documentadas e nenhum novo endpoint publicamente habilitado.
- Commit: `feat(contracts): define durable proposal and session contracts`.

### F1 — tooling local, migrations e seed único

- [x] Configurar bindings locais D1/R2, tipos gerados, estado persistido ignorado e health/readiness.
- [x] Criar migrations incrementais com constraints/índices e teste em banco vazio e banco anterior.
- [x] Importador valida todo o manifesto antes de publicar carga; seed repetido não duplica nem sobrescreve revisão posterior. Conflitos de ID/path/slug abortam com relatório.
- [x] Carregar Docs e exemplos EN/PT-BR a partir de fonte única; separar fixtures de proposals/história fictícia.
- [x] Scripts sem dependência de shell destrutivo, lock por instalação e encerramento dos runtimes criados; executados no Windows. CI Linux configurado, execução remota não realizada nesta entrega.
- Saída: reiniciar backend mantém seed e IDs; segunda carga é no-op segura; nenhum adapter de memória em HTTP.
- Commit: `feat(storage): add local D1 R2 migrations and vault import`.

### F2 — identidade/política antes da escrita

- [x] Porta Principal/Session, membership e tabela de papéis; adapter local isolado.
- [x] `/session`, logout, cache seguro, origem/CSRF e erros tipados.
- [x] Negar por padrão; testar papéis, alvo interno, sessão expirada e principal forjado.
- Saída: tentativa HTTP direta é negada independentemente de botões/capabilities no cliente; build compartilhado não aceita identidade dev.
- Commit: `feat(auth): enforce session capabilities and vault policy`.

### F3 — leitura persistente e paridade visual

- [x] Implementar portas de leitura usando D1/R2; projection e policy compartilhadas.
- [x] Leitura por ID/revisão, navegação incremental, busca, cursores, history deep link e grafo limitado.
- [x] Adaptar UI/GraphSnapshot ao catálogo parcial, sem “sumir” satélites/arquivos por depender de todas as docs.
- [x] Executar smoke HTTP de exploração com Docs/galáxias equivalentes; manter as 19 regressões visuais/câmera separadas no mock, sem contá-las como E2E HTTP completo de B35.
- Saída: B01–B05/B16/B18/B20/B31 e inspeção visual desktop/mobile; nenhuma leitura cai no mock.
- Commit: `feat(api): serve the vault through persistent read slices`.

### F4 — ciclo de proposta completo sem publicação implícita

- [x] Create, update/resubmit e review/status; versões de proposta, before derivado, metadados e checks.
- [x] Formulário edita body e justificativa separadamente; editor conserva baseVersion.
- [x] Aprovar não publica; corrigir invalidará aprovação; merged não é editável.
- Saída: B06–B09/B17/B21; proposta e decisões sobrevivem reload e restart; diff por arquivo fiel.
- Commit: `feat(proposals): persist editable review workflows`.

### F5 — merge transacional, conflitos e retry

- [x] Implementar protocolo R2 preparado + batch D1 e guarda atômica por todos os alvos.
- [x] Publicar alterações, metadados, relações, índices e auditoria juntos; tombstones e aliases.
- [x] Idempotência, perda de resposta, conflito em create/update/merge e erros recuperáveis.
- [x] Testes de integração com falha na última instrução e corridas reais, não apenas mocks.
- Saída: B10–B15/B22–B25/B32; sem resultados parcialmente publicados ou revisão duplicada.
- Commit: `feat(publication): add atomic versioned merges and idempotency`.

### F6 — UI + WebMCP no mesmo caminho

- [x] Composition HTTP, erros tipados, cancelamento e query invalidation compartilhada.
- [x] Tool de update/resubmit, dados limitados com continuação, capabilities e confirmação explícita de merge implementadas; execução nativa autenticada ainda pendente.
- [x] Expiração/sessão trocada não deixa conteúdo de outro principal no cache.
- [x] Preservar paleta, layout, teclado, foco, câmera, tooltips e reduced motion.
- Saída: B19/B26–B30/B33–B35; merge do agente atualiza Library/Docs/History sem reload.
- Commit: `feat(webmcp): connect governed HTTP workflows to the workspace`.

### F7 — recuperação, escala e operação local

- [x] Export/import portátil e backup/restore consistente; seed seguro; read-only switch e limites testáveis.
- [x] Corpus sintético: 1.000 documentos, 120 pastas, 200 propostas e 500 eventos por suíte dedicada; números são fixture de teste, não promessa de capacidade do plano gratuito.
- [x] Medir payloads e trabalho D1; corrigir projeções excessivas e consulta do grafo. Budgets visuais/DOM permanecem nas regressões próprias; sem alegar SLA p50/p95 de produção.
- [x] Ativar projetos Playwright HTTP isolados e quality gates; não manter cenários sem steps como testes “verdes”.
- Saída: B02/B18/B20/B24/B25/B36–B39; marco L com relatório e limitações registradas.
- Commit: `test(e2e): verify persistent human and agent workflows`.

### F8 — staging compartilhado, somente após autorização

- [ ] Configurar recursos/segredos fora do repo e validar custo/limites antes de provisionar.
- [ ] Implementar/validar Access, troca para sessão, JWT, login/logout, membership e revogação reais.
- [ ] Deploy protegido, migrations não destrutivas e seed explícito; nada de carregar fixture automaticamente em produção.
- [ ] Executar B40–B42, walkthrough em duas máquinas, backup/restore e demo real WebMCP.
- [ ] Atualizar README EN, architecture, SECURITY e Docs EN/PT-BR; gerar evidências sem segredos.
- Saída: marco S aprovado com conta/origem/provedor verificados; se indisponíveis, marcar somente L concluído.
- Commits: `feat(auth): integrate the shared identity provider` e `docs(operations): document deployment backup and recovery`.

Dependência principal: **F0 → F1/F2 → F3/F4 → F5 → F6/F7 → L → F8 → S**. Leitura e identidade podem avançar em paralelo após contrato; mesma área de arquivo não deve ser editada por implementadores concorrentes.

## 12. Estratégia E2E / Gherkin

As especificações estão em [backend-acceptance/](backend-acceptance/README.md). São **cenários planejados**, não testes executáveis concluídos. Permanecem fora de `apps/e2e/features` para não quebrar `bddgen` com steps inexistentes.

### Organização e execução futura

- Reutilizar Playwright + playwright-bdd existentes, não adicionar Cucumber runner paralelo.
- Ao implementar cada fatia, mover os cenários correspondentes para `apps/e2e/features/backend/` e implementar steps/fixtures. Remover a cópia planejada ou deixar referência; não manter duas fontes divergentes.
- Projeto HTTP dedicado configura `VITE_DATA_ADAPTER=http`, proxy/origem e Worker local D1/R2. `reuseExistingServer: false`: não reutilizar acidentalmente o servidor mock aberto pelo usuário.
- Health/readiness informa modo de storage e versão do seed somente no ambiente de teste/local. Pré-condição falha se mock estiver selecionado, API ausente ou seed errado.
- Banco/bucket isolados por execução; suíte serial inicialmente. O reset do harness tem alvo explícito dentro do diretório temporário do teste, nunca o workspace ou banco do usuário. Não criar `/reset` ou `/impersonate` no deploy.
- Dois BrowserContexts isolados para concorrência e principal. Preparação pode usar bindings/CLI; passos de negócio usam UI/tool/HTTP real. Browser route mocks ficam restritos a falhas de transporte intencionais.
- Cenários `@storage` reiniciam apenas o Worker controlado pelo harness; servidor web continua, storage persiste. Fault injection via dependências/configuração **somente do harness**, nunca query/header que o usuário da produção possa acionar.
- E2E comprova resultado visível e confirma API; invariantes SQL/contagens de objetos são integração Workers. Evitar introspecção de React e sleeps fixos; usar eventos, respostas e polling com timeout.
- `@webmcp-real` e `@staging` são gates separados. Browser sem API nativa não torna teste real verde: reportar indisponível e exigir evidência antes do marco correspondente.
- No projeto de login real/staging, desabilitar trace, vídeo, HAR e screenshots automáticos durante toda a execução autenticada. Produzir relatório sanitizado de status/códigos/IDs fictícios, sem assertions, headers ou cookies. Só capturar imagens deliberadas de conteúdo fictício após verificar ausência de dados de identidade.
- Testes locais podem reter trace/screenshot de falha em armazenamento restrito e de curta duração; sessões sintéticas ainda são credenciais. Nunca publicar trace bruto. A publicação de qualquer artefato exige sanitização verificável e varredura dos valores de credenciais utilizados no teste. Congelar seed, animação/clock apenas para comparação visual, não para mascarar erro de sincronização.

### Suítes e frequência

| Gate                           | Quando                           | Conteúdo                                                                                  |
| ------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm check` existente         | Todo PR                          | Format, lint, deps, Knip, peers, types, unit/integration, builds                          |
| `test:e2e:http:smoke` a criar  | Todo PR da integração            | Cenários `@smoke`, incluindo UI→HTTP→storage e falhas críticas selecionadas               |
| `test:e2e:http` a criar        | Antes de merge de milestone      | Todos os cenários HTTP locais, inclusive concorrência e recuperação                       |
| `test:e2e:http:mobile` a criar | Mudanças de UI / milestone       | Fluxos `@mobile` e smoke visual existente no adapter HTTP                                 |
| `test:e2e:webmcp` a criar      | Milestone/demo                   | Registro e invocação reais em navegador compatível                                        |
| `test:e2e:staging` a criar     | Release autorizada               | Login real, revogação, duas sessões/máquinas, limites e rollback                          |
| Mutation direcionada           | Mudança de invariantes / release | Guards de versão/publicação, visibilidade e filtros; sem mutação cosmética de componentes |

Os comandos novos são **entregáveis futuros**, não estão disponíveis por criar este documento. Mutation usa gates de qualidade da lógica crítica; um cenário E2E não substitui testes de atomicidade no adapter D1.

Seleção do smoke HTTP comum: `@http and @smoke and not @webmcp-real and not @staging`. O projeto nativo executa `@webmcp-real` separadamente; sua indisponibilidade bloqueia a evidência nativa do milestone, não provoca um skip apresentado como sucesso no smoke comum.

### Critérios objetivos de UX/performance

- API retorna no máximo o limit pedido e nunca despeja o vault na navegação inicial; diretórios recolhidos não solicitam descendentes.
- No corpus grande, DOM de linhas virtualizadas fica próximo do viewport + overscan configurado; nenhuma lista renderiza todo o corpus. Pequenas listas podem continuar sem virtualização.
- Digitar no filtro mantém foco; mudar filtro invalida cursor; Back preserva URL/seleção; erro/empty state tem recuperação explícita.
- Nenhum overflow horizontal da página em 360 px; linhas longas, tabela Markdown e diff rolam no próprio painel.
- Passos de regressão da câmera, satélites, arquivos, tooltips e movimento reduzido continuam verdes em HTTP. Seleção não provoca reconstrução do grafo por evento de ponteiro.
- Meta inicial de resposta percebida local: registrar p50/p95 no corpus fixo, hardware e ambiente. Não inventar SLA universal nem tornar CI instável com timing de máquina compartilhada; priorizar budgets determinísticos de payload/DOM/query.

## 13. Definition of Done

### Marco L

- [x] Instalação nova → migrations → seed → aplicação HTTP com instruções reproduzíveis.
- [x] Todos os fluxos do modo HTTP usam backend persistente; build HTTP sem chunks do mock.
- [ ] Cenários locais B01–B39 implementados/executados na camada indicada, com evidência e exceções explícitas. Casos WebMCP reais têm evidência própria; não confundir o teste de fallback com suporte nativo.
- [x] Aprovação nunca publica; merge publica todos os alvos uma única vez e registra versões/auditoria.
- [x] Reload, restart, retry e usuários concorrentes não perdem nem sobrescrevem conhecimento silenciosamente nos cenários exercitados.
- [x] Política, isolamento de caches, limites, restauração e invariantes de segurança testados.
- [x] Docs/galáxias, idiomas e layout preservados; o modo HTTP não simula sucesso.
- [x] `pnpm check` (145 testes), HTTP BDD (14/14), mock visual (19/19) e integração storage aprovados; nenhuma falha P0/P1 identificada sem resolução nesse recorte.

### Marco S

- [ ] L completo e B40–B42 aprovados em staging autorizado.
- [ ] Login real, papéis e revogação configurados; nenhum bypass de identidade de desenvolvimento.
- [ ] Credenciais fora do código; acesso público separado de escrita; limites e modo read-only exercitados.
- [ ] Backup e restore verificáveis com destino, frequência, retenção e responsabilidade definidos.
- [ ] README e Docs explicam uso humano/agente, limitações, deploy, custos/quota e recuperação sem prometer invulnerabilidade.
- [ ] Demo final: agente consulta → propõe; mantenedor revisa/mescla; outro usuário encontra a memória após restart.

## 14. Decisões pendentes e controle de mudança

D1+R2 e papéis foram aceitos com a autorização de implementação, registrados em ADR-0006/0007. Antes de F8, o usuário precisa fornecer/escolher conta, origem, provedor e membros autorizados; nunca inferir esses valores. O aceite nativo autenticado também continua dependente da confirmação solicitada para usar uma credencial local sintética no navegador.

Mudança para D1-only, acesso público a propostas abertas, convites de terceiros, sincronização offline ou deploy em conta real altera o escopo e exige decisão explícita. Diretórios, classes celestes e UI aprovados não serão redesenhados como consequência indireta de trocar o backend.

Referências complementares: [ADRs existentes](../decisions), [arquitetura atual](../architecture.md), [modelo celeste](../atlas-content-model.md), [bindings locais suportados](https://developers.cloudflare.com/workers/local-development/bindings-per-env/). D1 e R2 podem ser exercitados com simulação local; isso não substitui os testes de ambiente compartilhado.

## 15. Verificação da entrega documental original (anterior à implementação)

- Cinco arquivos `.feature`, 42 IDs únicos B01–B42 e 64 casos após expansão dos Examples; parser Gherkin sem erros.
- Links locais dos dois documentos Markdown verificados; formatação explícita validada, pois `docs/plans` é ignorado pelo format check padrão do repositório.
- `pnpm check` passou na baseline de código: 78 testes unitários/de integração e builds. Nenhuma feature de backend descrita acima foi implementada nesta entrega.
- Revisão independente corrigiu privacidade histórica, associação aprovação/versão, confirmação obsoleta e proteção de artefatos de autenticação; não restaram bloqueios P0/P1 apontados nesse recorte documental.
- Não foram executados os cenários E2E novos: faltam implementação, steps e harness. Validação de sintaxe não é evidência de funcionamento do backend.

## 16. Evidências da implementação local

Os registros anteriores são históricos. A implementação atual e suas fronteiras são descritas no [relatório de entrega](../operations/backend-delivery.md), [matriz HTTP](../operations/backend-verification.md), [evidência nativa](../operations/native-webmcp-evidence.md), [contrato HTTP](../operations/api-contract.md) e [runbook local](../operations/local-backend.md). Nenhum checkbox transforma as cláusulas ainda não executadas da matriz B01–B39 em aprovação integral L. B40–B42 permanecem fora da entrega local.
