---
id: 'lorestra.demo.orion.decision.pt-br'
slug: 'demo-orion-decision'
locale: 'pt-BR'
title: 'Órion: cache por revisão'
description: 'Uma decisão de exemplo identifica entradas imutáveis por documento e revisão.'
folderId: 'folder.demo.orion.pt-br'
type: 'decision'
visibility: 'public'
status: 'published'
version: 1
createdAt: '2026-08-30T12:00:00.000Z'
updatedAt: '2026-08-30T12:00:00.000Z'
author: 'Equipe de demonstração Lorestra'
tags: ['demo', 'orion', 'confiabilidade', 'cache', 'latência']
relatedDocumentIds:
  [
    'lorestra.demo.orion.overview.pt-br',
    'lorestra.demo.orion.observations.pt-br',
    'lorestra.demo.orion.incident.pt-br',
    'lorestra.demo.orion.runbook.pt-br',
  ]
nav:
  visible: true
  parentId: folder.demo.orion.pt-br
  order: 30
---

# Órion: cache por revisão

> Demonstração fictícia. Estes exemplos não são registros de incidentes, estudantes ou resultados de pesquisa reais.

Decisão deste serviço fictício: armazenar uma revisão imutável em uma chave que contenha o identificador do documento e sua revisão. Resolver a revisão atual separadamente, com uma política curta e explícita de atualização, evita sobrescrever uma chave ambígua.

Isso acrescenta uma consulta e exige um orçamento de descarte. Reavalie a decisão se medições mostrarem que essa consulta domina a latência ou que reter revisões ficou caro; não enfraqueça silenciosamente o requisito de correção para melhorar um gráfico.

- Responsável: equipe fictícia do serviço.
- Evidências: caderno de latência e incidente de resposta antiga.
- Gatilho de revisão: nova exigência de atualização ou sobrecarga persistente.

## Exemplos conectados

- [Órion: respostas confiáveis](./demo-orion-overview.md)
- [Órion: caderno de latência](./demo-orion-observations.md)
- [Órion: resposta antiga](./demo-orion-incident.md)
- [Órion: roteiro de recuperação](./demo-orion-runbook.md)
