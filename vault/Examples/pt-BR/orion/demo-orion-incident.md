---
id: 'lorestra.demo.orion.incident.pt-br'
slug: 'demo-orion-incident'
locale: 'pt-BR'
title: 'Órion: resposta antiga'
description: 'Um incidente fictício mostra por que um acerto de cache pode entregar conteúdo antigo.'
folderId: 'folder.demo.orion.pt-br'
type: 'incident'
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
    'lorestra.demo.orion.decision.pt-br',
    'lorestra.demo.orion.runbook.pt-br',
  ]
nav:
  visible: true
  parentId: folder.demo.orion.pt-br
  order: 40
---

# Órion: resposta antiga

> Demonstração fictícia. Estes exemplos não são registros de incidentes, estudantes ou resultados de pesquisa reais.

Nesta demonstração, uma publicação terminou enquanto uma chave de cache ainda guardava a revisão anterior. As requisições tiveram sucesso, mas a revisão recebida não correspondia à selecionada pela pessoa leitora. Nenhuma indisponibilidade ou cliente real está representado.

A mitigação de exemplo desvia o caminho de cache afetado e verifica a revisão oficial antes de restaurar o tráfego. A lição é observar a correção explicitamente: código de sucesso e taxa alta de acertos não a comprovam.

- Sintoma: entrega de uma revisão anterior.
- Fator contribuinte: chave sem distinção entre revisões imutáveis.
- Acompanhamento: revisar decisão de cache e procedimento de recuperação.

## Exemplos conectados

- [Órion: respostas confiáveis](./demo-orion-overview.md)
- [Órion: caderno de latência](./demo-orion-observations.md)
- [Órion: cache por revisão](./demo-orion-decision.md)
- [Órion: roteiro de recuperação](./demo-orion-runbook.md)
