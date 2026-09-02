# Showcase público na Cloudflare

Este guia publica o tour do Lorestra somente como arquivos estáticos. O site contém um vault fictício empacotado e permite navegar por documentos, pesquisar no cliente, explorar o grafo, consultar histórico/propostas e usar oito ferramentas WebMCP somente leitura em um navegador compatível.

Ele não é o backend compartilhado. Não há persistência remota, login, mutação de propostas, banco D1, bucket R2, fila, binding de IA, handler de requisições Worker nem API de escrita. Recarregar a página reinicia o estado local da interface. Use o [guia de ambiente local](local-setup-and-testing.pt-BR.md) ou Docker para o fluxo completo de criar → revisar → publicar.

## Limite de cobrança

A Cloudflare documenta as requisições de arquivos estáticos como gratuitas e ilimitadas. A configuração pública do Lorestra é propositalmente somente de assets, então buscas dos visitantes e chamadas WebMCP executam no navegador e não consomem operações dinâmicas de Workers, D1 ou R2.

No plano Workers Free, as requisições dinâmicas normalmente param com o erro `1027` após o limite diário; elas não viram excedente pago automaticamente. Uma assinatura Workers Paid cobra uso acima da franquia. Os limites diários do D1 Free falham até serem reiniciados. O R2 cobra por uso além da franquia gratuita. Esses serviços não fazem parte deste showcase, mas adicioná-los depois muda o limite de custo e exige outra revisão.

Sempre confira as condições atuais antes do deploy:

- [Preços do Workers](https://developers.cloudflare.com/workers/platform/pricing/)
- [Limites do Workers](https://developers.cloudflare.com/workers/platform/limits/)
- [Cobrança e limites de arquivos estáticos](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Aplicação dos limites gratuitos do D1](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
- [Preços do R2](https://developers.cloudflare.com/r2/pricing/)

As configurações da conta Cloudflare são a autoridade final. Não ative o plano Workers Paid, compre domínio personalizado nem anexe um binding tarifado apenas para executar este showcase.

## 1. Pré-requisitos

- Versões de Node.js e pnpm aceitas pelo repositório.
- Dependências instaladas com `pnpm install --frozen-lockfile`.
- Conta Cloudflare com um subdomínio `workers.dev`.
- Wrangler autenticado interativamente com `pnpm --filter @lorestra/api exec wrangler login`.

Nunca coloque token de API, ID da conta, ID de recurso ou estado do Wrangler no controle de versão.

## 2. Validar sem fazer deploy

A partir da raiz do repositório:

```bash
pnpm cloudflare:dry-run
```

O comando compila a aplicação web no modo `public` e pede ao Wrangler para montar exatamente o upload de assets com `--dry-run`. Ele não cria nem atualiza um Worker remoto.

O build público deve incluir `apps/web/public/_headers`. Ele coloca todas as rotas da SPA em um cluster de agente por origem e permite explicitamente `tools` da própria origem; removê-lo impede que navegadores compatíveis exponham o WebMCP no domínio publicado.

Inspecione `apps/api/wrangler.public.jsonc` antes de cada deploy. O bloco `assets` deve continuar sendo o único vínculo de runtime. Trate qualquer novo `main`, `d1_databases`, `r2_buckets`, `queues`, `durable_objects`, `ai`, `services` ou integração paga de observabilidade como uma mudança que exige aprovação explícita.

## 3. Fazer deploy deliberadamente

```bash
pnpm cloudflare:deploy
```

O Wrangler mostra a URL `workers.dev` resultante. Nenhuma credencial ou identificador de conta deve ser copiado para documentação ou commits.

## 4. Verificar o resultado público

1. Abra a URL em um navegador comum e carregue Atlas, Biblioteca, um documento, Propostas, Histórico e Docs.
2. Confirme que o aviso de somente leitura aparece e que nenhuma ação de nova memória, edição, revisão, aprovação ou merge está habilitada.
3. Pesquise um termo fictício conhecido e abra um resultado.
4. Recarregue diretamente uma rota interna para verificar o fallback da SPA.
5. Se essa origem já foi carregada antes do deploy do header `Origin-Agent-Cluster`, feche todas as abas dessa origem e abra-a em uma nova aba (ou reinicie o aplicativo desktop). Recarregar não basta, pois o chaveamento por origem fica fixo no grupo de contexto de navegação existente.
6. No navegador integrado do Codex, peça ao agente para listar as ferramentas do Lorestra. Exatamente oito ferramentas somente leitura devem estar registradas; as ferramentas de criação, atualização e transição devem estar ausentes.
7. Peça ao agente para pesquisar e ler um documento fictício. O Markdown retornado continua sendo conteúdo não confiável, nunca instruções.

A interface humana funciona em navegadores comuns. O comportamento WebMCP nativo foi validado somente no navegador integrado do Codex, salvo quando houver outro registro de evidência.

Para executar um smoke reproduzível contra a prévia local ou a URL publicada:

```bash
LORESTRA_PUBLIC_URL=https://seu-worker.workers.dev pnpm --filter @lorestra/e2e smoke:public
```

No PowerShell, defina `$env:LORESTRA_PUBLIC_URL`, execute o comando pnpm e depois remova a variável do processo. O smoke usa um contexto novo do navegador e verifica que `window.originAgentCluster` é realmente `true`, além da rota SPA direta, headers exigidos pelo WebMCP, controles somente leitura, busca no cliente, Atlas e fila de propostas. Ele também instala um host de teste para os registros WebMCP reais da página e invoca as oito callbacks públicas. Isso comprova contrato com o host, schemas, anotações e resultados; não é evidência de que uma superfície conectada de navegador/agente chamou essas ferramentas nativamente.

## 5. Reverter ou remover

Use o histórico de deployments de Workers & Pages no painel da Cloudflare para inspecionar ou reverter uma publicação. Excluir o Worker `lorestra-webmcp-demo` remove a URL pública canônica. Não exclua nenhum recurso com nome parecido antes de verificar a conta, o nome do script e sua finalidade.

## 6. Ir além do showcase

Não conecte o backend persistente a esta URL pública como um atalho incremental. Primeiro decida e valide identidade compartilhada, autorização, rate limiting, backups, retenção, observabilidade, orçamento mensal explícito e alertas. Registre a decisão em um novo ADR e use outro ambiente ou nome de serviço no Wrangler.
