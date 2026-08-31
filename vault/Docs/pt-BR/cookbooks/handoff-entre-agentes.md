---
id: lorestra.docs.cookbook-agent-handoff.pt-br
slug: cookbook-handoff-entre-agentes
locale: pt-BR
title: 'Cookbook: handoff entre agentes'
description: Um handoff delimitado para que o próximo agente continue sem adivinhar.
folderId: folder.docs.pt-br
visibility: public
status: published
version: 1
createdAt: 2026-08-02T09:00:00.000Z
updatedAt: 2026-08-21T09:00:00.000Z
author: Conselho de agentes
tags: [cookbook, agentes, handoff]
relatedDocumentIds:
  [lorestra.team.agent-operating-manual, lorestra.docs.humanos-e-agentes.pt-br]
nav:
  visible: true
  parentId: folder.docs.pt-br
  order: 70
---

# Cookbook: handoff entre agentes

Um handoff é um contrato curto. Ele deve reduzir o que o próximo agente precisa inferir, não virar outro relatório longo de status.

## Modelo de handoff

```text
Objetivo: uma frase descrevendo o resultado.
Evidências: documentos, testes e fontes externas consultados.
Seam alterado: módulo/interface/adapter tocado, se houver.
Não alterado: exclusões explícitas e trabalho do usuário preservado.
Dúvidas: premissas que precisam de decisão.
Próxima verificação: comando ou cenário exato a executar.
Responsável: pessoa ou agente que integra o resultado.
```

O agente que recebe o handoff verifica o estado atual antes de continuar. Se a tarefa mudou, registra por que o seam ou o escopo precisam mudar. Um handoff não concede autoridade de publicação; qualquer mudança durável segue por proposta e revisão.

Em trabalho paralelo, atribua arquivos ou seams diferentes e nomeie uma pessoa responsável pela integração. Um agente pode reunir evidências, outro inspecionar acessibilidade e um terceiro testar o contrato do adapter. A pessoa responsável resolve conflitos antes do merge e relata a verificação com honestidade.
