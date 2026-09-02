# Configuração local e testes

[English](local-setup-and-testing.en.md) · [README](../../README.md)

Este guia acompanha um clone novo até o login local, uma alteração revisável de documento e os testes automatizados relevantes. Execute os comandos na raiz do repositório, salvo indicação contrária. Os comandos funcionam em Bash e PowerShell, exceto quando o shell estiver indicado.

O modo local persistente usa a aplicação Worker real com armazenamento D1/R2 local. **Não provisiona recursos nem exige conta na Cloudflare.** O download de dependências e navegadores exige internet. Não faça deploy, configure serviços pagos ou exponha o endpoint de autenticação local à internet como parte deste guia.

## 1. Pré-requisitos e instalação

- Git; no Windows, instale Git for Windows com Git Bash disponível para os hooks do repositório.
- Node.js `>=24.12.0 <25`. CI e Dockerfile fixam `24.20.0`; a referência é o [package.json](../../package.json).
- pnpm `11.24.0`, selecionado via Corepack.
- Um navegador para a interface humana. O navegador integrado do Codex é a superfície validada para WebMCP nativo, não um requisito para usar a interface ou executar Playwright.
- Opcional: Docker engine em execução com Compose v2 para a seção 6.

```sh
git clone https://github.com/sinkz/Lorestra.git
cd Lorestra
node --version
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm --version
pnpm install --frozen-lockfile
```

Se você já clonou o repositório, entre nesse checkout. Se Corepack não estiver disponível, siga as [instruções oficiais de instalação](https://github.com/nodejs/corepack#how-to-install); não substitua a instalação do workspace por `npm install` nem regenere o lockfile para contornar um erro. Em uma instalação restrita do Windows, `corepack enable` pode precisar de permissão para gravar os executáveis auxiliares junto ao Node; corrija as permissões da instalação em vez de desativar os hooks do repositório.

## 2. Executar a aplicação local persistente

Para um armazenamento novo:

```sh
pnpm backend:init
pnpm local:build
pnpm local:start
```

Abra [http://127.0.0.1:4173](http://127.0.0.1:4173). Esse caminho seleciona o adaptador HTTP automaticamente; não exige arquivo `.env`. Mantenha esse terminal aberto. Um supervisor controla o preview e um processo filho privado do Worker; você não precisa iniciar outra API.

### Entrar e preservar o trabalho

1. Abra `.lorestra/state/local-session.json` localmente no editor.
2. Escolha **Entrar** e cole somente o valor de `token`. Não cole o JSON inteiro.
3. A conta sintética padrão é de mantenedor local. Visitantes podem ler conhecimento público; alterações exigem sessão autorizada.

O arquivo de sessão é ignorado pelo Git. Nunca o inclua em commit, captura de tela, conversa, issue ou artefato de teste. Não coloque tokens em variáveis `VITE_*`: elas são visíveis no navegador. Essas credenciais servem ao desenvolvimento local, não a um login de produção compartilhado.

Pare com Ctrl+C e aguarde a saída do processo antes de executar outra operação no mesmo armazenamento. Reinicie com `pnpm local:start`; **não repita a inicialização a cada execução**. Após alterar código, pare, execute `pnpm local:build` e reinicie. Os dados D1/R2 ficam em `.lorestra/state`; edições na aplicação não são gravadas automaticamente em `vault/**/*.md`.

Se a sessão expirou ou você saiu da conta, pare o processo, renove e reinicie:

```sh
pnpm backend:session
pnpm local:start
```

Use o novo token do mesmo arquivo. A renovação não revoga outras sessões ativas; sair revoga a sessão atual. Para testes manuais em um armazenamento separado e descartável, mantenha o mesmo caminho explícito:

```sh
pnpm backend:init --state=.lorestra/manual-demo
pnpm local:start --state=.lorestra/manual-demo
```

A credencial estará em `.lorestra/manual-demo/local-session.json`. Pare esse processo antes de executar `pnpm backend:session --state=.lorestra/manual-demo`. Armazenamentos distintos não criam portas extras: apenas um processo pode usar a porta padrão `4173` por vez. Consulte [operações locais](../operations/local-backend.md) para backup, exportação e restauração em um destino separado.

## 3. Escolher um modo de desenvolvimento

Use um modo por vez. Pare o processo anterior para limitar o uso de memória e a quantidade de processos.

| Modo                                       | Persistência                  | URL do frontend         | Quando usar                                                 |
| ------------------------------------------ | ----------------------------- | ----------------------- | ----------------------------------------------------------- |
| `local:build` + `local:start`              | D1/R2 local                   | `http://127.0.0.1:4173` | Demonstração e verificações manuais persistentes            |
| Servidor web de desenvolvimento com `mock` | Dados descartáveis em memória | `http://127.0.0.1:5173` | Ajustes rápidos de layout, não prova de persistência        |
| `backend:dev` + servidor web com `http`    | D1/R2 local                   | `http://127.0.0.1:5173` | Desenvolvimento completo com recarga automática do frontend |

Nos modos de desenvolvimento, crie `apps/web/.env` a partir [do exemplo](../../apps/web/.env.example) somente se você ainda não tiver configurações locais. Nunca sobrescreva um arquivo de ambiente existente sem conferi-lo.

Bash:

```bash
cp apps/web/.env.example apps/web/.env
```

PowerShell:

```powershell
Copy-Item apps/web/.env.example apps/web/.env
```

Para mock, mantenha `VITE_DATA_ADAPTER=mock` e execute somente o frontend:

```sh
pnpm --filter @lorestra/web dev --host 127.0.0.1 --port 5173 --strictPort
```

Para HTTP, edite esse arquivo ignorado:

```dotenv
VITE_DATA_ADAPTER=http
VITE_LORESTRA_API_URL=/api
LORESTRA_API_ORIGIN=http://127.0.0.1:8787
```

Inicialize uma vez se necessário; depois use dois terminais:

```sh
# Terminal 1: armazenamento local existente, Worker na porta 8787
pnpm backend:dev
```

```sh
# Terminal 2: proxy do frontend na mesma origem, porta 5173
pnpm --filter @lorestra/web dev --host 127.0.0.1 --port 5173 --strictPort
```

Entre novamente nessa origem se necessário. Use `127.0.0.1`, sem misturar com `localhost`; as validações de origem e CSRF são intencionais. Reinicie Vite após alterar `.env`. O `pnpm dev` da raiz inicia vários scripts de desenvolvimento do workspace; prefira os comandos específicos acima quando precisar de apenas um frontend ou do backend local inicializado.

## 4. Executar testes automatizados

### Verificação de qualidade e testes direcionados

```sh
pnpm check
```

Executa formatação, ESLint, limites de dependência, análise de código não usado e peers, TypeScript, testes unitários/de integração/de ferramentas e builds. O build da API usa `wrangler deploy --dry-run`; não faz deploy. **Playwright e testes de mutação são separados.** Essa verificação passar, sozinha, não comprova WebMCP nativo, execução em container nem compatibilidade dos E2E de navegador no Linux; cada item tem seu próprio limite de evidência.

Para um retorno mais rápido:

| Comando                                  | O que verifica                                                   |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `pnpm --filter @lorestra/contracts test` | Schemas em runtime e contratos compartilhados                    |
| `pnpm --filter @lorestra/web test`       | Lógica do frontend, grafo e limites do WebMCP                    |
| `pnpm --filter @lorestra/api test`       | Comportamento do Worker, armazenamento e autorização             |
| `pnpm test:tooling`                      | Seed, migrações, reinício do armazenamento, backup e restauração |
| `pnpm test:local`                        | Pré-condições, proxy e encerramento do executor local            |
| `pnpm lint` / `pnpm typecheck`           | Lint ou tipos sem um build completo                              |

Execute comandos pesados em sequência. As suítes regulares têm concorrência limitada; não aumente workers apenas para acelerar uma execução local. Algumas verificações de ciclo de vida aguardam o encerramento de processos filhos e são mais lentas que testes unitários puros.

### Playwright + Gherkin

Instale somente Chromium, que também cobre os projetos atuais de emulação mobile:

```sh
pnpm --filter @lorestra/e2e exec playwright install chromium
```

No Linux, instale também as bibliotecas de sistema necessárias; isso pode pedir permissão de administrador:

```sh
pnpm --filter @lorestra/e2e exec playwright install --with-deps chromium
```

Execute uma suíte por vez, depois de parar previews/servidores de desenvolvimento desnecessários. Você **não** executa `backend:init`, `backend:dev` ou `local:start` para essas suítes: as fixtures controlam seus próprios servidores e dados.

| Comando                     | Escopo                                        | Portas reservadas |
| --------------------------- | --------------------------------------------- | ----------------- |
| `pnpm test:e2e`             | Smoke de interface com mock, desktop e mobile | `4185`            |
| `pnpm test:e2e:http:smoke`  | Subconjunto smoke com HTTP persistente        | `4176` + `8795`   |
| `pnpm test:e2e:http`        | Suíte HTTP persistente completa               | `4176` + `8795`   |
| `pnpm test:e2e:http:mobile` | Apenas o projeto HTTP mobile                  | `4176` + `8795`   |

A suíte mock não comprova durabilidade do backend. As fixtures HTTP criam armazenamentos temporários privados, preparam um template com banco fechado e isolam cada cenário do seu `.lorestra/state`. Porta de teste ocupada é um erro, não autorização para encerrar outro processo.

Os arquivos Gherkin ficam em [smoke da interface](../../apps/e2e/features/smoke.feature) e [features do backend](../../apps/e2e/features/backend); as implementações dos passos ficam em [steps](../../apps/e2e/steps). Os scripts geram os casos Playwright automaticamente. Para descobrir cenários HTTP sem abrir navegadores ou executar o grupo de concorrência:

```sh
pnpm --filter @lorestra/e2e test:e2e:http --list
pnpm --filter @lorestra/e2e test:e2e:http --grep @concurrency
```

Leia primeiro as falhas no terminal. Abra os relatórios gerados após a suíte encerrar:

```sh
pnpm --filter @lorestra/e2e exec playwright show-report playwright-report
pnpm --filter @lorestra/e2e exec playwright show-report playwright-report/http
```

Escolha o relatório da suíte executada; cada comando inicia um servidor de relatório, então pare com Ctrl+C antes de abrir outro. Capturas e traces de falhas do mock ficam em `apps/e2e/test-results`. Traces, capturas e vídeos HTTP autenticados ficam **desativados intencionalmente** para evitar credenciais nos artefatos. Confira qualquer relatório antes de compartilhá-lo.

**Limite da fixture no Linux:** uma [execução publicada anterior do CI](https://github.com/sinkz/Lorestra/actions/runs/33430905870) revelou uma diferença de `EEXIST` antes das verificações no navegador. A [fixture corrigida](../../apps/e2e/fixtures/backend.ts) agora cria um diretório pai temporário isolado e copia o template fechado para um filho inexistente, mantendo `errorOnExist: true`. Isso preserva a proteção contra sobrescrita de forma consistente no Windows e no Linux. Não desative o isolamento, sobrescreva armazenamento ativo nem apague seu vault para contornar uma falha do harness.

### Testes de mutação direcionados e opcionais

```sh
pnpm --filter @lorestra/api test:mutation --concurrency 1
```

Altera deliberadamente regras de busca e transição de propostas do backend; não faz parte de toda edição. Use um worker em uma máquina com recursos limitados. O atalho da raiz é `pnpm test:mutation`, mas não limita explicitamente a concorrência do Stryker. Relatórios ficam em `apps/api/reports/mutation`; investigue mutantes críticos sobreviventes em vez de reduzir o limite de pontuação para aprovar a execução.

## 5. Verificações manuais do produto e do agente nativo

Use a aplicação local persistente da seção 2 e documentos fictícios. Essas verificações alteram esse vault local; escolha um armazenamento de teste separado para manter suas próprias notas intactas.

1. Como visitante, abra Biblioteca, pesquise, altere um filtro de pasta e troque entre inglês e português brasileiro. Abra prévia, Markdown e Atlas; conteúdos longos devem permanecer dentro da área de trabalho.
2. Entre, edite um documento e envie uma proposta com justificativa. Confira o diff; o documento publicado deve continuar inalterado.
3. Solicite alterações, edite e reenvie a mesma proposta. Uma aprovação anterior não deve sobreviver à alteração de conteúdo. Aprove e confirme que somente aprovar ainda não publica.
4. Faça o merge explícito da versão revisada. Confira a nova revisão, o status da proposta e os links do Histórico. Reinicie o executor local sem seed e verifique novamente o mesmo conteúdo.

Para WebMCP nativo, abra essa página HTTP no navegador integrado do Codex e entre ali. Peça ao agente conectado:

> Leia `lorestra_get_agent_guide`, pesquise um documento fictício existente e leia sua versão atual. Proponha uma pequena melhoria de documentação. Não aprove nem faça merge ainda. Informe o ID da proposta e o que mudou.

Depois revise a proposta. Se você pedir explicitamente ao agente para fazer merge de uma proposta aprovada, a primeira chamada nativa retorna `confirmation_required`. O diálogo humano autoriza aquela versão/hash; ele não publica sozinho. Após a autorização, o agente precisa repetir a mesma operação com a chave de idempotência original. Confira documento e Histórico finais, não apenas o registro bem-sucedido de ferramentas.

O utilitário opcional `pnpm demo:webmcp` abre um **navegador separado controlado pelo Playwright**, não a aba existente do Codex. Para verificar o registro na versão local em execução, selecione sua URL:

```bash
WEBMCP_DEMO_URL=http://127.0.0.1:4173 pnpm demo:webmcp
```

Equivalente em PowerShell:

```powershell
$env:WEBMCP_DEMO_URL = 'http://127.0.0.1:4173'
pnpm demo:webmcp
```

Em um runtime compatível, informa `registerTool: true`, `status: "registered"` e `registeredTools: 11`. O Chromium incluído pode não oferecer essa API; um resultado incompatível não é falha da interface. O utilitário não herda o login do Codex nem valida publicação. Não simule `document.modelContext` para alegar suporte nativo. Veja [evidências da versão local](../operations/local-release-evidence.md) e o [experimento com dois agentes](../operations/dual-webmcp-tabs.md); duas abas podem compartilhar sessão e não comprovam duas pessoas ou máquinas independentes.

## 6. Empacotamento Docker opcional

Este fluxo foi validado em 31/08/2026 e novamente após reiniciar o host em 01/09/2026 com Docker Desktop 27.4 (`linux/amd64`). A execução cobriu build limpo da imagem, importação explícita de 75 documentos, login local, proposta/revisão/reenvio/aprovação/merge, leituras imutáveis de `v1`/`v2`, busca, grafo, leituras WebMCP nativas, recriação do container, reinício do host, renovação de sessão e persistência no volume nomeado. Isso não certifica produção, identidade compartilhada, deploy em nuvem nem outras plataformas de host; veja o [registro de evidência Docker](../operations/docker-local-evidence.md).

Node/pnpm no host são dispensáveis nesse caminho; Git e Docker engine/Compose funcionando são necessários. Reserve alguns gigabytes de espaço temporário: a imagem validada mediu cerca de 2,22 GB antes da limpeza, sem contar o cache do builder. Pare primeiro qualquer executor no host usando a porta `4173`.

```sh
docker compose version
docker compose build
docker compose run --name lorestra-init --no-deps lorestra node scripts/backend-local.mjs init
```

Crie o destino ignorado para a cópia da credencial local. Bash:

```bash
mkdir -p .lorestra/state
```

PowerShell:

```powershell
New-Item -ItemType Directory -Force .lorestra/state
```

A cópia abaixo substitui um arquivo existente nesse destino. Se você também tem armazenamento local nativo, escolha outro destino ignorado para não sobrescrever seu arquivo de sessão.

```sh
docker cp lorestra-init:/app/.lorestra/state/local-session.json .lorestra/state/docker-session.json
docker rm lorestra-init
docker compose up
```

Abra `http://127.0.0.1:4173` e entre com o token de `docker-session.json`. O volume nomeado `lorestra-state` contém o armazenamento D1/R2 do container; ele é separado do armazenamento `.lorestra/state` do host. O `docker rm` acima remove apenas o container parado de inicialização, não esse volume.

Pare com `docker compose down`; ele preserva o volume. **Não adicione `-v`, exceto para apagar intencionalmente o vault local.** Para renovar a sessão, pare Compose, repita o padrão de container temporário/cópia/remoção usando `session` em vez de `init` e inicie novamente. Se a inicialização falhou, examine os logs desse container antes de reutilizar seu nome. Nenhum deploy em nuvem faz parte desse caminho.

## 7. Solução de problemas e checklist final

| Sintoma                                                | Próxima ação segura                                                                                                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versão errada de Node/pnpm ou erro de frozen-lockfile  | Use as versões fixadas e examine o erro; não atualize dependências para contornar a instalação.                                                                                        |
| Executável do shell ou hook não encontrado no Windows  | Abra Git Bash com Node/Corepack no `PATH`, entre no mesmo checkout e repita. Não ignore hooks nem relaxe a política de execução da máquina inteira.                                    |
| Marcador de inicialização / bundle de produção ausente | Execute `backend:init` uma vez para esse armazenamento / execute `local:build`, com o processo anterior parado.                                                                        |
| `operator.lock` / armazenamento em uso                 | Pare o executor responsável. Após um crash, confirme que o PID registrado não usa mais esse armazenamento antes de remover somente o lock obsoleto. Nunca apague o diretório de dados. |
| Porta ocupada / processos demais                       | Pare o terminal ou container específico que você iniciou; aguarde a saída. Nunca encerre todos os processos Node, navegador ou workerd.                                                |
| Login falha / HTTP 401 ou 403                          | Confira armazenamento, validade do token e origem exata. Renove com o servidor parado; mantenha as verificações de origem/CSRF.                                                        |
| Alterações somem ao recarregar                         | Confira se selecionou mock. Alterações duráveis exigem HTTP e merge explícito.                                                                                                         |
| Erros de caminho longo ou SQLite no Windows            | Escolha um caminho curto e explícito para o armazenamento e use-o consistentemente; não mova nem apague um armazenamento ativo.                                                        |
| Build Docker termina com `unexpected EOF` ao carregar  | Confirme que o engine Docker está saudável e repita o mesmo build. O cache pode ser reutilizado, mas não considere a imagem válida até o Compose conseguir iniciá-la.                  |
| Executável do Playwright ou bibliotecas Linux ausentes | Execute a instalação de Chromium acima; examine a preparação da fixture separadamente das verificações no navegador.                                                                   |
| Nenhuma ferramenta WebMCP nativa                       | A interface continua disponível. Confirme a superfície compatível de agente/navegador; um registro simulado não é evidência nativa.                                                    |

A entrega física de Ctrl+C no Windows continua sendo um limite de validação documentado; o teste de encerramento cooperativo/ciclo de vida é uma evidência separada. Se o executor não sair, examine a propriedade exata dos processos antes de tentar novamente. Evite abrir servidores adicionais durante a investigação.

- [ ] A interface local abre na origem esperada; nenhum recurso de nuvem foi criado.
- [ ] Proposta → revisão → merge explícito → Histórico funciona com dados fictícios.
- [ ] Reiniciar preserva a revisão publicada sem reinicialização.
- [ ] `pnpm check` passa; registre resultados de E2E e mutação separadamente, incluindo falhas ou plataformas não verificadas.
- [ ] Credenciais, documentos privados e artefatos locais não aparecem em `git status --short` nem nas evidências compartilhadas.
- [ ] Servidores, visualizadores de relatório e navegadores de teste desnecessários encerraram.

Para contribuir, siga [CONTRIBUTING.md](../../CONTRIBUTING.md), use Conventional Commits e inclua comandos e resultados no PR. Não apresente uma execução histórica aprovada como validação nova do seu checkout.
