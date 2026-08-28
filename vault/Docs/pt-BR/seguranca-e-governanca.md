---
id: lorestra.docs.seguranca-governanca.pt-br
slug: seguranca-e-governanca
locale: pt-BR
title: Segurança e governança
description: Guardrails para manter o conhecimento portátil sem torná-lo inseguro.
folderId: folder.docs.pt-br
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-20T10:00:00.000Z
author: Equipe Lorestra
tags: [segurança, governança, privacidade]
relatedDocumentIds:
  [lorestra.engineering.navigation-content-model, lorestra.team.security-escalation]
nav:
  visible: true
  parentId: folder.docs.pt-br
  order: 40
---

# Segurança e governança

A primeira versão é pública e somente leitura. Acesso de leitura, presença no menu, autoridade para propor, autoridade para revisar e autoridade para fazer merge são decisões separadas. Um documento pode aparecer no menu de uma equipe autorizada e continuar fora da projeção pública.

## Proteja a fonte

Trate Markdown como entrada não confiável. Renderize com HTML bruto desabilitado, valide frontmatter, rejeite path traversal e mantenha segredos, credenciais, tokens e dados pessoais desnecessários fora do vault. Slug e visibilidade no menu nunca substituem uma verificação de autorização.

## Proteja o fluxo

Um adapter autenticado futuro resolverá um principal e uma policy de autorização. Flags no cliente não concedem autoridade de escrita ou merge. A proposta registra alvo e versão-base. Aprovação significa que revisores aceitaram o conteúdo; merge é a operação que cria a próxima revisão publicada. O histórico deve ser append-only do ponto de vista do produto.

## Em caso de exposição

Se conteúdo sensível aparecer em uma proposta, interrompa o merge, preserve o identificador da proposta e a localização da evidência, restrinja a projeção afetada e avise a pessoa responsável por segurança. Não copie o valor sensível para outro documento ou conversa. Uma correção é uma nova mudança revisada; reescrever o histórico em silêncio dificulta a investigação.

Veja o [cookbook de incidente](cookbooks/incidente-para-conhecimento.md) e o documento de [escalonamento de segurança](../../Team/security-escalation.md).
