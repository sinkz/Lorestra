---
id: 'lorestra.demo.cygnus.incident.pt-br'
slug: 'demo-cygnus-incident'
locale: 'pt-BR'
title: 'Cisne: unidades misturadas'
description: 'Uma importação fictícia combinou durações em segundos e milissegundos sem metadados de conversão.'
folderId: 'folder.demo.cygnus.pt-br'
type: 'incident'
visibility: 'public'
status: 'published'
version: 1
createdAt: '2026-08-30T12:00:00.000Z'
updatedAt: '2026-08-30T12:00:00.000Z'
author: 'Equipe de demonstração Lorestra'
tags: ['demo', 'cygnus', 'pesquisa', 'unidades', 'reprodutibilidade']
relatedDocumentIds:
  [
    'lorestra.demo.cygnus.overview.pt-br',
    'lorestra.demo.cygnus.observations.pt-br',
    'lorestra.demo.cygnus.decision.pt-br',
    'lorestra.demo.cygnus.runbook.pt-br',
  ]
nav:
  visible: true
  parentId: folder.demo.cygnus.pt-br
  order: 40
---

# Cisne: unidades misturadas

> Demonstração fictícia. Estes exemplos não são registros de incidentes, estudantes ou resultados de pesquisa reais.

Nesta demonstração, duas exportações usaram o mesmo nome de coluna para durações, mas uma continha segundos e a outra milissegundos. Um gráfico combinado exagerou a diferença porque a importação perdeu os metadados de unidade. Nenhum resultado de estudo real está representado.

A resposta de exemplo marca a tabela combinada como inválida, preserva as exportações originais e refaz valores derivados só após confirmar as unidades. Quando a evidência não permite estabelecê-las, mantenha o registro como não resolvido em vez de inventar uma conversão.

- Sintoma: diferença aparente muito grande entre sessões.
- Problema confirmado no exemplo: unidades inconsistentes sob um único rótulo.
- Acompanhamento: atualizar roteiro de coleta e decisão de unidades declaradas.

## Exemplos conectados

- [Cisne: evidência reproduzível](./demo-cygnus-overview.md)
- [Cisne: registro de observações](./demo-cygnus-observations.md)
- [Cisne: unidades declaradas](./demo-cygnus-decision.md)
- [Cisne: protocolo de coleta](./demo-cygnus-runbook.md)
