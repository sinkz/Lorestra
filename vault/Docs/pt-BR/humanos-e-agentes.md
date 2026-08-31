---
id: lorestra.docs.humanos-e-agentes.pt-br
slug: humanos-e-agentes
locale: pt-BR
title: Pessoas e múltiplos agentes
description: Um modelo de colaboração em que cada participante deixa contexto verificável.
folderId: folder.docs.pt-br
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-20T10:00:00.000Z
author: Equipe Lorestra
tags: [agentes, colaboração, handoff]
relatedDocumentIds:
  [lorestra.team.agent-operating-manual, lorestra.docs.seguranca-governanca.pt-br]
nav:
  visible: true
  parentId: folder.docs.pt-br
  order: 30
---

# Pessoas e múltiplos agentes

O Lorestra trata pessoas e agentes como pares na descoberta, mas não como autoridades indistinguíveis. Na integração local durável atual, um agente autenticado herda as capacidades da sessão do navegador: pode buscar, resumir, comparar revisões, conectar documentos e preparar uma proposta, mas não recebe autoridade do texto dos documentos nem da entrada de uma ferramenta. Uma pessoa revisora confirma explicitamente o merge. Identidade compartilhada de agentes e deploy ficam fora do escopo local atual.

## Torne cada handoff verificável

Toda contribuição deve registrar:

- o resultado esperado e o público;
- documentos e fontes externas consultados;
- premissas e nível de confiança;
- o seam ou arquivos alterados;
- dúvidas que ficaram abertas;
- a verificação exata que o próximo participante deve executar.

Vários agentes podem trabalhar em paralelo quando os papéis são distintos. Um reúne evidências, outro desafia contradições e um terceiro melhora a proposta. Atividade paralela não substitui uma pessoa responsável por integrar o resultado.

Na integração atual, as ferramentas herdam a sessão do navegador; agentes não recebem credenciais nem papéis independentes. Duas sessões autorizadas podem propor ao mesmo tempo, mas uma base de documento ou proposta desatualizada gera conflito. Leia a nova versão, compare com o rascunho preservado e reenvie conscientemente. Isso não é coedição em tempo real nem sincronização offline. Quem clonar o projeto pode testar o mesmo fluxo localmente; compartilhar entre máquinas exige o marco separado de identidade e deploy.

## Preserve a origem

Um agente deve citar apenas a evidência necessária, apontar para o documento-fonte e separar observação de inferência. Um parágrafo fluente sem origem não é uma mudança de conhecimento confiável. Se descobrir que um documento publicado está incompleto, abra uma proposta ou deixe um comentário de revisão; não edite o vault em silêncio.

Veja [Ferramentas WebMCP para agentes](ferramentas-webmcp-para-agentes.md), o [cookbook de handoff](cookbooks/handoff-entre-agentes.md) e o guia de [segurança e governança](seguranca-e-governanca.md) antes de automatizar uma escrita.
