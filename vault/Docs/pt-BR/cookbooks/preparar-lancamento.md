---
id: lorestra.docs.cookbook-launch.pt-br
slug: cookbook-preparar-lancamento
locale: pt-BR
title: Cookbook: preparar um lançamento
description: Torne uma superfície de conhecimento pronta para publicar sem esconder riscos.
folderId: folder.docs.pt-br
visibility: public
status: published
version: 1
createdAt: 2026-08-03T09:00:00.000Z
updatedAt: 2026-08-22T09:00:00.000Z
author: Produto e entrega
tags: [cookbook, lançamento, qualidade]
relatedDocumentIds: [lorestra.product.launch-readiness, lorestra.engineering.mock-removal]
nav:
  visible: true
  parentId: folder.docs.pt-br
  order: 80
---

# Cookbook: preparar um lançamento

Use esta receita quando uma superfície de conhecimento estiver pronta para um lançamento deliberado. Uma checklist verde só é útil quando continua ligada a uma pessoa responsável, evidências e uma decisão de rollback.

## Verifique o caminho do leitor

- Navegue pelas pastas e abra um documento pelo menu.
- Busque um incidente conhecido e confira suas relações.
- Abra Preview, Markdown, Relações e Histórico sem perder o contexto da URL.
- Verifique fallback entre português e inglês.
- Exercite estados vazio, não encontrado e erro de rede.

## Verifique o caminho de contribuição

- Um rascunho de proposta não altera o corpo publicado.
- Aprovação fica visível, mas não publica.
- Merge cria uma revisão imutável e um evento de histórico.
- Uma versão-base antiga é rejeitada em vez de sobrescrever conhecimento atual.
- Projeções públicas excluem conteúdo interno e rascunhos.

Registre riscos, responsáveis, data de lançamento e condição de rollback na proposta. Observe o uso real depois do lançamento; checklist não substitui feedback.
