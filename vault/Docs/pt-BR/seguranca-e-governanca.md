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

Visitantes anônimos podem ler conhecimento público. O backend local persistente também oferece sessões autenticadas de desenvolvimento: leitores consultam conhecimento interno, colaboradores propõem e editam o próprio trabalho, e mantenedores revisam e fazem merge. Login compartilhado na internet e deploy são um marco separado. Presença no menu e autorização são decisões diferentes.

## Proteja a fonte

Trate Markdown como entrada não confiável. Renderize com HTML bruto desabilitado, valide frontmatter, rejeite path traversal e mantenha segredos, credenciais, tokens e dados pessoais desnecessários fora do vault. Slug e visibilidade no menu nunca substituem uma verificação de autorização.

## Proteja o fluxo

O servidor resolve a sessão e aplica permissões independentemente dos botões da interface. Propostas registram a base dos documentos e sua própria versão de conteúdo. Aprovar não publica. Editar reabre a mesma proposta e invalida a aprovação; somente merge publica as próximas revisões imutáveis. Conflitos preservam o rascunho em vez de sobrescrever conhecimento mais novo. Repetir uma requisição incerta com a mesma chave de idempotência e conteúdo recupera seu resultado original.

Contexto privado atual ou histórico não pode vazar em listas, contagens, relações ou diffs. Se alguma versão da proposta contém contexto privado, sua projeção pública de revisão fica inteiramente oculta. O histórico é append-only pela aplicação, mas isso não é uma garantia criptográfica contra um administrador do storage. Backups incluem o Markdown referenciado e o fluxo de revisão, excluem sessões e são restaurados em um destino separado e vazio.

## Em caso de exposição

Se conteúdo sensível aparecer em uma proposta, interrompa o merge, preserve o identificador da proposta e a localização da evidência, restrinja a projeção afetada e avise a pessoa responsável por segurança. Não copie o valor sensível para outro documento ou conversa. Uma correção é uma nova mudança revisada; reescrever o histórico em silêncio dificulta a investigação.

Veja o [cookbook de incidente](cookbooks/incidente-para-conhecimento.md) e o documento de [escalonamento de segurança](../../Team/security-escalation.md).
