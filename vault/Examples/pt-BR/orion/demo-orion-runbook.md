---
id: 'lorestra.demo.orion.runbook.pt-br'
slug: 'demo-orion-runbook'
locale: 'pt-BR'
title: 'Órion: roteiro de recuperação'
description: 'Um roteiro operacional fictício verifica a revisão antes de restaurar um caminho de cache.'
folderId: 'folder.demo.orion.pt-br'
type: 'process'
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
    'lorestra.demo.orion.decision.pt-br',
    'lorestra.demo.orion.incident.pt-br',
    'lorestra.demo.orion.legacy.pt-br',
  ]
nav:
  visible: true
  parentId: folder.demo.orion.pt-br
  order: 50
---

# Órion: roteiro de recuperação

> Demonstração fictícia. Estes exemplos não são registros de incidentes, estudantes ou resultados de pesquisa reais.

Use este roteiro de exemplo quando a revisão recebida divergir da solicitada. Ele é um material didático, não um procedimento de produção: adapte responsáveis, permissões e reversão antes de aplicar o padrão a um serviço real.

1. Registre revisões solicitada e recebida sem copiar conteúdo sensível.
2. Reproduza com o mesmo rótulo de requisição e janela de observação.
3. Peça à pessoa responsável autorização para um desvio reversível do cache.
4. Verifique correção e latência no caminho alternativo.
5. Restaure o cache apenas depois de revisar a política corrigida de chaves.

Anexe evidências a uma proposta e conecte incidente, decisão e lição atualizada. Mantenha hipóteses separadas de observações.

## Exemplos conectados

- [Órion: respostas confiáveis](./demo-orion-overview.md)
- [Órion: cache por revisão](./demo-orion-decision.md)
- [Órion: resposta antiga](./demo-orion-incident.md)
- [Órion: regra de cache antiga](./demo-orion-legacy.md)
