---
id: lorestra.docs.cookbook-incident.pt-br
slug: cookbook-incidente-para-conhecimento
locale: pt-BR
title: 'Cookbook: do incidente ao conhecimento reutilizável'
description: Transforme uma linha do tempo de incidente em um runbook pequeno e verificável.
folderId: folder.docs.pt-br
visibility: public
status: published
version: 1
createdAt: 2026-08-02T09:00:00.000Z
updatedAt: 2026-08-21T09:00:00.000Z
author: Guilda de confiabilidade
tags: [cookbook, incidente, operações]
relatedDocumentIds:
  [lorestra.engineering.incident-response, lorestra.docs.seguranca-governanca.pt-br]
nav:
  visible: true
  parentId: folder.docs.pt-br
  order: 50
---

# Cookbook: do incidente ao conhecimento reutilizável

Use esta receita depois que o sistema estiver estável. O objetivo não é escrever um ensaio perfeito; é deixar a menor lição durável que ajude a próxima pessoa a agir com segurança.

## Passos

1. Crie uma proposta com o identificador do incidente e uma versão-base explícita.
2. Relacione timeline, dashboards, comandos e decisões. Separe fatos observados de hipóteses.
3. Peça a um agente que rascunhe uma lição concisa e a outro que desafie afirmações sem evidência.
4. Converta o resultado em um runbook com gatilho, diagnóstico, mitigação, responsável e acompanhamento.
5. Revise o diff. Confirme que exemplos não contêm credenciais ou dados pessoais.
6. Aprove a proposta somente quando a pessoa responsável aceitar o custo de mantê-la verdadeira.
7. Faça merge com intenção. O merge cria uma nova versão; rascunho e aprovação não alteram o que leitores veem.

## Formato sugerido

```md
## Gatilho

Qual sinal indica que este runbook se aplica?

## Diagnóstico

O que uma pessoa pode verificar sem piorar o incidente?

## Mitigação

Qual é a primeira ação reversível e quem autoriza a próxima?

## Aprendizado

Qual evidência sustenta a lição e o que faria a equipe revisitá-la?
```

Relacione o documento final ao registro do incidente e acrescente uma data de acompanhamento. Se a lição deixar de ser verdadeira, abra uma nova proposta em vez de apagar o raciocínio antigo.
