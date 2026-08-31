import type { FixtureDocument, FixtureFolder, FixtureLocale } from './types'

type DemoGalaxy = 'orion' | 'lyra' | 'cygnus'
type DemoRole =
  'overview' | 'observations' | 'decision' | 'incident' | 'runbook' | 'legacy'

interface DemoCopy {
  title: string
  description: string
  tags: readonly string[]
  records: Record<DemoRole, { title: string; summary: string; body: string }>
}

type DemoGroup = { id: DemoGalaxy } & Record<FixtureLocale, DemoCopy>

const locales: readonly FixtureLocale[] = ['en', 'pt-BR']
const roles: readonly DemoRole[] = [
  'overview',
  'observations',
  'decision',
  'incident',
  'runbook',
  'legacy',
]
const relatedRoles: Record<DemoRole, readonly DemoRole[]> = {
  overview: ['observations', 'decision', 'incident', 'runbook', 'legacy'],
  observations: ['overview', 'decision', 'incident', 'legacy'],
  decision: ['overview', 'observations', 'incident', 'runbook'],
  incident: ['overview', 'observations', 'decision', 'runbook'],
  runbook: ['overview', 'decision', 'incident', 'legacy'],
  legacy: ['overview', 'observations', 'runbook'],
}
const documentTypes = {
  overview: 'lesson',
  observations: 'note',
  decision: 'decision',
  incident: 'incident',
  runbook: 'process',
  legacy: 'note',
} as const
const archivedTypes = {
  orion: 'note',
  lyra: 'lesson',
  cygnus: 'decision',
} as const

// Every relationship is backed by a portable Markdown link in the corresponding body.
const groups: readonly DemoGroup[] = [
  {
    id: 'orion',
    en: {
      title: 'Orion · Engineering',
      description:
        'Fictional reliability examples: latency, versioned caches, and incident learning.',
      tags: ['reliability', 'cache', 'latency'],
      records: {
        overview: {
          title: 'Orion: reliable responses',
          summary:
            'A fictional lesson connecting latency evidence, versioned caches, and safe recovery.',
          body: 'A fast response is useful only when it is also the expected revision. In this fictional service, the team treats correctness and latency as separate signals: a cache hit alone cannot prove that a reader received current knowledge.\n\nReview the observation window before changing a cache policy. Keep the cache decision, failure timeline, and recovery procedure connected so the next engineer can distinguish a measured improvement from an optimistic assumption.\n\n- Name the response revision alongside elapsed milliseconds.\n- Compare like-for-like requests before and after a change.\n- Preserve the previous procedure as an archived record.',
        },
        observations: {
          title: 'Orion: latency notebook',
          summary:
            'A fictional measurement notebook distinguishes cache hits, revisions, and sample windows.',
          body: 'The sample notebook records a request label, response revision, cache result, duration in milliseconds, and observation window. The numbers are demonstration data, not a benchmark or a promise about Lorestra performance.\n\nAverages can hide a small set of slow requests. Record the sample size and distribution, then repeat the same request mix after a change. The linked Cygnus collection procedure provides the shared unit and provenance checklist for this comparison.\n\n- Record the unit at collection time.\n- Preserve failed and slow observations rather than silently dropping them.\n- Mark a changed request mix before comparing two windows.',
        },
        decision: {
          title: 'Orion: versioned cache',
          summary:
            'An example decision keys immutable cache entries by document and revision.',
          body: 'Decision for this fictional service: cache an immutable revision under a key containing the document identifier and revision. Resolve the current revision separately, with a short, explicit freshness policy, instead of overwriting one ambiguous document key.\n\nThis adds an extra lookup and requires an eviction budget. Revisit the decision if measurements show that the lookup dominates latency or if revision retention becomes too costly; do not silently weaken the correctness requirement to improve a chart.\n\n- Owner: the fictional service team.\n- Evidence: the latency notebook and stale-response incident.\n- Review trigger: changed freshness requirements or sustained lookup overhead.',
        },
        incident: {
          title: 'Orion: stale response',
          summary:
            'A fictional incident shows why successful cache hits can still return old content.',
          body: 'In this demonstration, a publication completed while one cache key still held the previous revision. Requests returned successfully, but the response revision did not match the revision selected by the reader. No real outage or customer is represented.\n\nThe example mitigation is to bypass the affected cache path and verify the authoritative revision before restoring traffic to that path. The lesson is to observe correctness explicitly; a successful status code and a high hit rate do not establish it.\n\n- Symptom: an older revision was returned.\n- Contributing design: a key did not distinguish immutable revisions.\n- Follow-up: review the versioned-cache decision and recovery procedure.',
        },
        runbook: {
          title: 'Orion: recovery checklist',
          summary:
            'A fictional operational checklist verifies revision correctness before restoring a cache path.',
          body: 'Use this example checklist when the returned revision disagrees with the requested revision. It is a teaching artifact, not a production runbook: adapt ownership, permissions, and rollback steps before using the pattern in a real service.\n\n1. Record the requested and returned revision without copying sensitive content.\n2. Reproduce with the same request label and observation window.\n3. Ask the service owner to authorize a reversible cache bypass.\n4. Verify correctness and latency on the bypassed path.\n5. Restore the cache only after the corrected keying policy is reviewed.\n\nAttach the evidence to a proposal and connect the incident, cache decision, and updated lesson. Keep hypotheses separate from observations.',
        },
        legacy: {
          title: 'Orion: retired cache rule',
          summary:
            'Archived fictional guidance that treated a cache hit as sufficient evidence of freshness.',
          body: 'This archived demonstration records a discarded rule: treat any successful cache hit as proof that a document is current. The assumption was convenient but failed to distinguish response success from revision correctness.\n\nDo not apply this rule. It remains visible to explain the stale-response incident and why the team replaced its original workflow; retaining the rejected assumption makes the later decision easier to understand.',
        },
      },
    },
    'pt-BR': {
      title: 'Órion · Engenharia',
      description:
        'Exemplos fictícios de confiabilidade: latência, cache versionado e aprendizado com incidentes.',
      tags: ['confiabilidade', 'cache', 'latência'],
      records: {
        overview: {
          title: 'Órion: respostas confiáveis',
          summary:
            'Uma lição fictícia conecta evidências de latência, cache versionado e recuperação segura.',
          body: 'Uma resposta rápida só é útil quando também entrega a revisão esperada. Neste serviço fictício, a equipe trata correção e latência como sinais separados: um acerto de cache, sozinho, não comprova que a pessoa recebeu conhecimento atualizado.\n\nRevise a janela de observação antes de mudar a política de cache. Mantenha a decisão, a linha do tempo da falha e o procedimento de recuperação conectados para distinguir uma melhoria medida de uma suposição otimista.\n\n- Registre a revisão da resposta junto ao tempo em milissegundos.\n- Compare requisições equivalentes antes e depois da mudança.\n- Preserve o procedimento anterior como registro arquivado.',
        },
        observations: {
          title: 'Órion: caderno de latência',
          summary:
            'Um caderno fictício distingue acertos de cache, revisões e janelas de amostragem.',
          body: 'O caderno registra um rótulo de requisição, revisão recebida, resultado do cache, duração em milissegundos e janela de observação. Os dados são demonstrativos, não um benchmark nem uma promessa sobre o desempenho do Lorestra.\n\nMédias podem esconder um pequeno conjunto de requisições lentas. Registre o tamanho e a distribuição da amostra e repita o mesmo conjunto após a mudança. O procedimento de coleta do Cisne, vinculado abaixo, oferece a lista comum de unidades e proveniência para essa comparação.\n\n- Registre a unidade no momento da coleta.\n- Preserve observações lentas e falhas, sem descartá-las silenciosamente.\n- Sinalize mudanças no conjunto de requisições antes de comparar janelas.',
        },
        decision: {
          title: 'Órion: cache por revisão',
          summary:
            'Uma decisão de exemplo identifica entradas imutáveis por documento e revisão.',
          body: 'Decisão deste serviço fictício: armazenar uma revisão imutável em uma chave que contenha o identificador do documento e sua revisão. Resolver a revisão atual separadamente, com uma política curta e explícita de atualização, evita sobrescrever uma chave ambígua.\n\nIsso acrescenta uma consulta e exige um orçamento de descarte. Reavalie a decisão se medições mostrarem que essa consulta domina a latência ou que reter revisões ficou caro; não enfraqueça silenciosamente o requisito de correção para melhorar um gráfico.\n\n- Responsável: equipe fictícia do serviço.\n- Evidências: caderno de latência e incidente de resposta antiga.\n- Gatilho de revisão: nova exigência de atualização ou sobrecarga persistente.',
        },
        incident: {
          title: 'Órion: resposta antiga',
          summary:
            'Um incidente fictício mostra por que um acerto de cache pode entregar conteúdo antigo.',
          body: 'Nesta demonstração, uma publicação terminou enquanto uma chave de cache ainda guardava a revisão anterior. As requisições tiveram sucesso, mas a revisão recebida não correspondia à selecionada pela pessoa leitora. Nenhuma indisponibilidade ou cliente real está representado.\n\nA mitigação de exemplo desvia o caminho de cache afetado e verifica a revisão oficial antes de restaurar o tráfego. A lição é observar a correção explicitamente: código de sucesso e taxa alta de acertos não a comprovam.\n\n- Sintoma: entrega de uma revisão anterior.\n- Fator contribuinte: chave sem distinção entre revisões imutáveis.\n- Acompanhamento: revisar decisão de cache e procedimento de recuperação.',
        },
        runbook: {
          title: 'Órion: roteiro de recuperação',
          summary:
            'Um roteiro operacional fictício verifica a revisão antes de restaurar um caminho de cache.',
          body: 'Use este roteiro de exemplo quando a revisão recebida divergir da solicitada. Ele é um material didático, não um procedimento de produção: adapte responsáveis, permissões e reversão antes de aplicar o padrão a um serviço real.\n\n1. Registre revisões solicitada e recebida sem copiar conteúdo sensível.\n2. Reproduza com o mesmo rótulo de requisição e janela de observação.\n3. Peça à pessoa responsável autorização para um desvio reversível do cache.\n4. Verifique correção e latência no caminho alternativo.\n5. Restaure o cache apenas depois de revisar a política corrigida de chaves.\n\nAnexe evidências a uma proposta e conecte incidente, decisão e lição atualizada. Mantenha hipóteses separadas de observações.',
        },
        legacy: {
          title: 'Órion: regra de cache antiga',
          summary:
            'Orientação fictícia arquivada que confundia acerto de cache com atualização.',
          body: 'Esta demonstração arquivada registra uma regra abandonada: considerar qualquer acerto de cache como prova de que um documento está atualizado. A suposição era conveniente, mas não distinguia sucesso da resposta e correção da revisão.\n\nNão aplique esta regra. Ela permanece visível para explicar o incidente de resposta antiga e por que a equipe substituiu seu fluxo original; preservar a suposição rejeitada facilita compreender a decisão posterior.',
        },
      },
    },
  },
  {
    id: 'lyra',
    en: {
      title: 'Lyra · Learning',
      description:
        'Fictional classroom examples: reading, evidence, and paired revision.',
      tags: ['reading', 'learning', 'peer-review'],
      records: {
        overview: {
          title: 'Lyra: reading together',
          summary:
            'A fictional learning sequence connects interpretation, textual evidence, and paired revision.',
          body: 'In this fictional classroom, a reading response has three parts: an interpretation, a passage that supports it, and a question that remains open. The aim is to make reasoning visible, not to reward whoever speaks first or writes the longest answer.\n\nLearners first draft individually, then exchange feedback in pairs and revise one claim. The teacher uses the observation notebook to adapt the next lesson; no real student record or evaluation is included in this demonstration.\n\n- Separate the author’s words from a reader’s inference.\n- Ask for a passage before accepting a broad claim.\n- Preserve both the first answer and the reason for revision.',
        },
        observations: {
          title: 'Lyra: reading notebook',
          summary:
            'Fictional observations separate a learner’s claim, cited passage, and remaining uncertainty.',
          body: 'The sample notebook records a task identifier, the claim being discussed, the passage cited, and whether the revision made the reasoning clearer. It does not record names, grades, diagnoses, or information about real learners.\n\nKeep observations descriptive: “the response names a passage” is different from “the learner understood everything.” The linked Cygnus observation guide reinforces the same distinction between a recorded observation and an interpretation.\n\n- Record the prompt and the version of the text.\n- Note what changed after feedback, not just whether an answer grew longer.\n- Treat one exercise as a limited observation, not a fixed judgment about ability.',
        },
        decision: {
          title: 'Lyra: paired revision',
          summary:
            'An example teaching decision gives each learner an individual draft before peer feedback.',
          body: 'Decision for this fictional lesson: require a short individual draft before paired review, and ask each reviewer for one evidence question and one specific suggestion. This leaves a trace of each learner’s reasoning while keeping feedback manageable.\n\nPairs are a support structure, not an automatic guarantee of learning. The teacher checks whether both participants can explain the final change and adjusts the format when one person dominates or when the task needs individual support.\n\n- Intended benefit: make revisions explainable.\n- Trade-off: more time than collecting only a final response.\n- Review signal: feedback repeatedly fails to change the evidence or reasoning.',
        },
        incident: {
          title: 'Lyra: copied conclusions',
          summary:
            'A fictional classroom mismatch exposed a gap between fluent answers and supported reasoning.',
          body: 'In the demonstration, several final responses used polished conclusions but did not point to any passage. The task had asked for a correct-sounding answer without making the evidence requirement visible. This is not a report about real students.\n\nThe teacher responded by modeling one claim-to-passage link, then asking for a small revision rather than restarting the whole assignment. The follow-up changes the prompt and review checklist instead of labeling learners as careless.\n\n- Observation: conclusions appeared without textual support.\n- Unconfirmed interpretation: why any particular learner omitted evidence.\n- Follow-up: check the paired-review decision and the next revision notes.',
        },
        runbook: {
          title: 'Lyra: review routine',
          summary:
            'A fictional facilitation routine gives pairs a bounded way to question and improve a reading claim.',
          body: 'This example routine supports a short reading task with a text available to both participants. The teacher can adapt timing, accessibility supports, and response format to the class; the example does not prescribe a universal assessment method.\n\n1. Read the prompt and mark one relevant passage.\n2. Draft an interpretation independently.\n3. Exchange drafts and ask where the passage supports the claim.\n4. Suggest one precise change without rewriting the partner’s answer.\n5. Revise and explain which evidence or reasoning changed.\n\nCollect the explanations, not a ranking of pairs. Use recurring questions to plan the next lesson and record the learning in a proposal.',
        },
        legacy: {
          title: 'Lyra: answer-only activity',
          summary:
            'Archived fictional activity that collected a final answer without a reasoning trail.',
          body: 'This archived example asked only for a final interpretation and rewarded a complete-looking paragraph. It left too little evidence to distinguish independent reasoning, useful peer support, and copied conclusions.\n\nDo not reuse the activity unchanged. It remains in the vault as context for the revised lesson and the copied-conclusions incident, showing why the process now includes an individual draft and an explanation of the revision.',
        },
      },
    },
    'pt-BR': {
      title: 'Lira · Aprendizagem',
      description:
        'Exemplos fictícios de sala de aula: leitura, evidências e revisão em dupla.',
      tags: ['leitura', 'aprendizagem', 'revisão-em-dupla'],
      records: {
        overview: {
          title: 'Lira: leitura compartilhada',
          summary:
            'Uma sequência fictícia conecta interpretação, evidência textual e revisão em dupla.',
          body: 'Nesta turma fictícia, uma resposta de leitura tem três partes: uma interpretação, um trecho que a sustente e uma pergunta ainda aberta. O objetivo é tornar o raciocínio visível, não premiar quem fala primeiro ou escreve a resposta mais longa.\n\nCada pessoa escreve primeiro individualmente, troca comentários em dupla e revisa uma afirmação. A pessoa docente usa o caderno de observações para adaptar a próxima aula; esta demonstração não inclui registros nem avaliações de estudantes reais.\n\n- Separe as palavras do texto da inferência de quem lê.\n- Peça um trecho antes de aceitar uma afirmação ampla.\n- Preserve a primeira resposta e o motivo da revisão.',
        },
        observations: {
          title: 'Lira: caderno de leitura',
          summary:
            'Observações fictícias distinguem afirmação, trecho citado e dúvida ainda aberta.',
          body: 'O caderno registra o identificador da atividade, a afirmação discutida, o trecho citado e se a revisão tornou o raciocínio mais claro. Não registra nomes, notas, diagnósticos nem informações de estudantes reais.\n\nMantenha as observações descritivas: “a resposta identifica um trecho” é diferente de “a pessoa compreendeu tudo”. O guia de observações do Cisne, vinculado abaixo, reforça essa mesma distinção entre registro e interpretação.\n\n- Registre o enunciado e a versão do texto.\n- Anote o que mudou após os comentários, não apenas se a resposta cresceu.\n- Trate uma atividade como observação limitada, não como julgamento fixo de capacidade.',
        },
        decision: {
          title: 'Lira: revisão em dupla',
          summary:
            'Uma decisão pedagógica de exemplo prevê um rascunho individual antes dos comentários da dupla.',
          body: 'Decisão desta aula fictícia: pedir um rascunho individual curto antes da revisão em dupla, com uma pergunta sobre evidência e uma sugestão específica de cada pessoa revisora. Isso deixa um registro do raciocínio individual e limita o volume de comentários.\n\nA dupla é uma estrutura de apoio, não garantia automática de aprendizagem. A pessoa docente verifica se ambas conseguem explicar a mudança final e ajusta o formato quando uma domina a conversa ou quando há necessidade de apoio individual.\n\n- Benefício esperado: tornar a revisão explicável.\n- Custo: mais tempo que recolher apenas uma resposta final.\n- Sinal de revisão: comentários que repetidamente não mudam evidências nem raciocínio.',
        },
        incident: {
          title: 'Lira: conclusões copiadas',
          summary:
            'Uma situação fictícia expôs a distância entre respostas fluentes e raciocínio sustentado.',
          body: 'Na demonstração, várias respostas finais apresentavam conclusões bem escritas sem apontar para qualquer trecho. A atividade pedia uma resposta que parecesse correta, mas não tornava visível a exigência de evidências. Este não é um relato sobre estudantes reais.\n\nA pessoa docente modelou uma ligação entre afirmação e trecho e pediu uma revisão pequena, sem reiniciar toda a atividade. O acompanhamento altera enunciado e lista de revisão, em vez de rotular estudantes como desatentos.\n\n- Observação: conclusões sem apoio textual.\n- Interpretação não confirmada: por que cada pessoa omitiu a evidência.\n- Acompanhamento: conferir a decisão de revisão em dupla e os próximos registros.',
        },
        runbook: {
          title: 'Lira: rotina de revisão',
          summary:
            'Uma rotina fictícia dá às duplas um caminho limitado para questionar e melhorar uma interpretação.',
          body: 'Esta rotina de exemplo apoia uma atividade curta com o texto disponível para ambas as pessoas. Tempo, recursos de acessibilidade e formato da resposta podem ser adaptados à turma; o exemplo não prescreve um método universal de avaliação.\n\n1. Leia o enunciado e marque um trecho relevante.\n2. Escreva uma interpretação individualmente.\n3. Troque rascunhos e pergunte onde o trecho sustenta a afirmação.\n4. Sugira uma mudança precisa, sem reescrever a resposta da outra pessoa.\n5. Revise e explique qual evidência ou raciocínio mudou.\n\nRecolha as explicações, não um ranking de duplas. Use perguntas recorrentes para planejar a próxima aula e registrar a aprendizagem em uma proposta.',
        },
        legacy: {
          title: 'Lira: atividade sem revisão',
          summary:
            'Atividade fictícia arquivada que recolhia a resposta final sem acompanhar o raciocínio.',
          body: 'Este exemplo arquivado pedia apenas uma interpretação final e valorizava um parágrafo com aparência de completo. Havia poucas evidências para distinguir raciocínio independente, apoio útil da dupla e conclusões copiadas.\n\nNão reutilize a atividade sem mudanças. Ela permanece no vault como contexto da lição revisada e do incidente de conclusões copiadas, mostrando por que o processo passou a incluir rascunho individual e explicação da revisão.',
        },
      },
    },
  },
  {
    id: 'cygnus',
    en: {
      title: 'Cygnus · Research',
      description:
        'Fictional reproducibility examples: collection, units, and observation provenance.',
      tags: ['research', 'units', 'reproducibility'],
      records: {
        overview: {
          title: 'Cygnus: repeatable evidence',
          summary:
            'A fictional study links a research question to units, raw observations, and a repeatable collection procedure.',
          body: 'This fictional desk-light study asks whether two observation sessions can be compared fairly. Its purpose is to demonstrate provenance and reproducibility, not to claim a scientific result or provide a calibrated measurement standard.\n\nA useful record states the question, instrument, unit, conditions, and transformation applied to each value. Keep the raw observation separate from the derived table so another person can repeat the steps and locate a disagreement.\n\n- Declare the unit before collection.\n- Retain the original values and mark corrections as new records.\n- Compare sessions only after checking their conditions and method.',
        },
        observations: {
          title: 'Cygnus: observation ledger',
          summary:
            'A fictional ledger separates collected values from interpretations and derived comparisons.',
          body: 'The demonstration ledger stores a session identifier, instrument label, declared unit, location description, timestamp, and raw value. It contains no real participant data, and an instrument label is not a claim that the device is calibrated.\n\nRecord “the displayed value changed” before concluding why it changed. A changed location, sampling interval, or unit can explain an apparent effect; attach those conditions before interpreting the comparison.\n\n- Preserve missing values explicitly.\n- Keep an annotation separate from a raw reading.\n- Link each derived result to the source row and transformation.',
        },
        decision: {
          title: 'Cygnus: declared units',
          summary:
            'An example research decision requires explicit units and preserves raw values before conversion.',
          body: 'Decision for this fictional study: every observation declares its unit, and conversion creates a derived value with a named rule. The raw value remains unchanged. A column heading alone is not enough when records from different sessions may later be combined.\n\nThis adds metadata and makes invalid combinations easier to reject. Revisit the schema when the question or instrument changes; do not guess a missing unit merely to complete a table.\n\n- Owner: the fictional research pair.\n- Evidence: the observation ledger and mixed-units incident.\n- Review signal: a new measurement method or an ambiguous imported record.',
        },
        incident: {
          title: 'Cygnus: mixed units',
          summary:
            'A fictional import combined durations recorded in seconds and milliseconds without conversion metadata.',
          body: 'In this demonstration, two session exports used the same column label for durations, but one contained seconds and the other milliseconds. A combined chart exaggerated the difference because the import had lost the unit metadata. No real study result is represented.\n\nThe example response marks the combined table as invalid, preserves the original exports, and rebuilds derived values only after the units are known. If a unit cannot be established from evidence, retain the record as unresolved rather than inventing a conversion.\n\n- Symptom: a large apparent difference between sessions.\n- Confirmed issue in the example: inconsistent units under one label.\n- Follow-up: update the collection checklist and declared-units decision.',
        },
        runbook: {
          title: 'Cygnus: collection protocol',
          summary:
            'A fictional collection checklist records conditions, units, and provenance before comparing sessions.',
          body: 'This example protocol is shared with the Orion latency notebook because both need declared units and comparable observation windows. It describes record keeping, not laboratory safety, calibration, or a claim that two instruments are interchangeable.\n\n1. State the question and identify the observation session.\n2. Record the instrument label, unit, conditions, and sampling interval.\n3. Preserve each raw value, including missing readings and annotations.\n4. Create derived values with an explicit conversion or aggregation rule.\n5. Ask a second person to reproduce one derived row from its sources.\n\nPublish the method and its limitations together. Reopen the decision when conditions change instead of silently combining incompatible sessions.',
        },
        legacy: {
          title: 'Cygnus: unlabeled sheet',
          summary:
            'Archived fictional spreadsheet convention that stored values without unit or provenance columns.',
          body: 'This archived demonstration kept only a value and an informal session name. The compact sheet looked convenient but could not explain units, collection conditions, or which transformation produced a later result.\n\nDo not use this format for new observations. It remains available as evidence of the mixed-units failure and as a comparison with the replacement workflow, which preserves raw records and explicit provenance.',
        },
      },
    },
    'pt-BR': {
      title: 'Cisne · Pesquisa',
      description:
        'Exemplos fictícios de reprodutibilidade: coleta, unidades e proveniência das observações.',
      tags: ['pesquisa', 'unidades', 'reprodutibilidade'],
      records: {
        overview: {
          title: 'Cisne: evidência reproduzível',
          summary:
            'Um estudo fictício conecta pergunta, unidades, observações brutas e coleta reproduzível.',
          body: 'Este estudo fictício de iluminação de uma mesa pergunta se duas sessões de observação podem ser comparadas de modo justo. Seu objetivo é demonstrar proveniência e reprodutibilidade, não afirmar um resultado científico nem oferecer um padrão calibrado de medição.\n\nUm registro útil declara pergunta, instrumento, unidade, condições e transformação aplicada a cada valor. Separe a observação bruta da tabela derivada para que outra pessoa repita os passos e localize uma divergência.\n\n- Declare a unidade antes da coleta.\n- Preserve valores originais e registre correções separadamente.\n- Compare sessões só depois de conferir condições e método.',
        },
        observations: {
          title: 'Cisne: registro de observações',
          summary:
            'Um registro fictício separa valores coletados, interpretações e comparações derivadas.',
          body: 'O registro demonstrativo guarda identificador de sessão, rótulo do instrumento, unidade declarada, descrição do local, horário e valor bruto. Não contém dados de participantes reais, e o rótulo de um instrumento não comprova sua calibração.\n\nRegistre “o valor exibido mudou” antes de concluir por que ele mudou. Alterações de local, intervalo de amostragem ou unidade podem explicar um efeito aparente; anexe essas condições antes de interpretar a comparação.\n\n- Preserve valores ausentes explicitamente.\n- Separe uma anotação da leitura bruta.\n- Vincule cada resultado derivado à linha de origem e à transformação.',
        },
        decision: {
          title: 'Cisne: unidades declaradas',
          summary:
            'Uma decisão de pesquisa de exemplo exige unidades explícitas e preserva valores brutos antes da conversão.',
          body: 'Decisão deste estudo fictício: toda observação declara sua unidade e cada conversão gera um valor derivado com uma regra identificada. O valor bruto permanece intacto. Só o título da coluna não basta quando registros de sessões diferentes podem ser combinados.\n\nIsso acrescenta metadados e facilita rejeitar combinações inválidas. Reavalie o esquema quando a pergunta ou o instrumento mudar; não adivinhe uma unidade ausente apenas para completar a tabela.\n\n- Responsáveis: dupla fictícia de pesquisa.\n- Evidências: registro de observações e incidente de unidades misturadas.\n- Sinal de revisão: método novo ou registro importado ambíguo.',
        },
        incident: {
          title: 'Cisne: unidades misturadas',
          summary:
            'Uma importação fictícia combinou durações em segundos e milissegundos sem metadados de conversão.',
          body: 'Nesta demonstração, duas exportações usaram o mesmo nome de coluna para durações, mas uma continha segundos e a outra milissegundos. Um gráfico combinado exagerou a diferença porque a importação perdeu os metadados de unidade. Nenhum resultado de estudo real está representado.\n\nA resposta de exemplo marca a tabela combinada como inválida, preserva as exportações originais e refaz valores derivados só após confirmar as unidades. Quando a evidência não permite estabelecê-las, mantenha o registro como não resolvido em vez de inventar uma conversão.\n\n- Sintoma: diferença aparente muito grande entre sessões.\n- Problema confirmado no exemplo: unidades inconsistentes sob um único rótulo.\n- Acompanhamento: atualizar roteiro de coleta e decisão de unidades declaradas.',
        },
        runbook: {
          title: 'Cisne: protocolo de coleta',
          summary:
            'Um roteiro fictício registra condições, unidades e proveniência antes de comparar sessões.',
          body: 'Este protocolo de exemplo é compartilhado com o caderno de latência do Órion porque ambos precisam de unidades declaradas e janelas comparáveis. Ele trata de registros, não de segurança laboratorial, calibração ou equivalência entre instrumentos.\n\n1. Declare a pergunta e identifique a sessão de observação.\n2. Registre instrumento, unidade, condições e intervalo de amostragem.\n3. Preserve cada valor bruto, incluindo leituras ausentes e anotações.\n4. Gere valores derivados com regra explícita de conversão ou agregação.\n5. Peça a outra pessoa que reproduza uma linha derivada a partir das fontes.\n\nPublique o método junto de suas limitações. Reabra a decisão quando as condições mudarem, em vez de combinar sessões incompatíveis silenciosamente.',
        },
        legacy: {
          title: 'Cisne: planilha sem unidades',
          summary:
            'Convenção fictícia arquivada que guardava valores sem colunas de unidade ou proveniência.',
          body: 'Esta demonstração arquivada guardava apenas um valor e um nome informal de sessão. A planilha compacta parecia conveniente, mas não explicava unidades, condições de coleta nem qual transformação produziu um resultado posterior.\n\nNão use este formato para novas observações. Ele permanece disponível como evidência da falha de unidades misturadas e para comparação com o fluxo substituto, que preserva registros brutos e proveniência explícita.',
        },
      },
    },
  },
]

const suffix = (locale: FixtureLocale) => locale.toLowerCase()
const documentId = (galaxy: DemoGalaxy, role: DemoRole, locale: FixtureLocale) =>
  `lorestra.demo.${galaxy}.${role}.${suffix(locale)}`
const folderId = (galaxy: DemoGalaxy, locale: FixtureLocale) =>
  `folder.demo.${galaxy}.${suffix(locale)}`

function crossGalaxyTarget(galaxy: DemoGalaxy, role: DemoRole): DemoRole | null {
  if (role !== 'observations') return null
  if (galaxy === 'orion') return 'runbook'
  if (galaxy === 'lyra') return 'observations'
  return null
}

function bodyFor(group: DemoGroup, locale: FixtureLocale, role: DemoRole): string {
  const copy = group[locale]
  const notice =
    locale === 'en'
      ? '> Fictional demonstration. These examples are not records of real incidents, learners, or research results.'
      : '> Demonstração fictícia. Estes exemplos não são registros de incidentes, estudantes ou resultados de pesquisa reais.'
  const replacement =
    role === 'legacy'
      ? locale === 'en'
        ? `Superseded by [${copy.records.overview.title}](./demo-${group.id}-overview.md).`
        : `Substituído por [${copy.records.overview.title}](./demo-${group.id}-overview.md).`
      : null
  const connections = relatedRoles[role].map(
    (related) => `- [${copy.records[related].title}](./demo-${group.id}-${related}.md)`,
  )
  const crossRole = crossGalaxyTarget(group.id, role)
  if (crossRole) {
    const target = groups.find((entry) => entry.id === 'cygnus')![locale].records[
      crossRole
    ]
    connections.push(`- [${target.title}](../cygnus/demo-cygnus-${crossRole}.md)`)
  }
  return [
    notice,
    copy.records[role].body,
    replacement,
    locale === 'en' ? '## Connected examples' : '## Exemplos conectados',
    connections.join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const celestialDemoFolders: readonly FixtureFolder[] = groups.flatMap(
  (group, index) =>
    locales.map((locale) => ({
      id: folderId(group.id, locale),
      slug: `demo-${group.id}-${suffix(locale)}`,
      title: group[locale].title,
      description: group[locale].description,
      parentId: null,
      order: 60 + index * 10,
      visibility: 'public' as const,
      locale,
    })),
)

export const celestialDemoDocuments: readonly FixtureDocument[] = groups.flatMap(
  (group) =>
    locales.flatMap((locale) =>
      roles.map((role) => {
        const copy = group[locale]
        const record = copy.records[role]
        const crossRole = crossGalaxyTarget(group.id, role)
        return {
          id: documentId(group.id, role, locale),
          slug: `demo-${group.id}-${role}`,
          title: record.title,
          description: record.summary,
          excerpt: record.summary,
          content: bodyFor(group, locale, role),
          locale,
          folderId: folderId(group.id, locale),
          folderPath: ['Examples', locale, group.id],
          kind: 'document' as const,
          type: role === 'legacy' ? archivedTypes[group.id] : documentTypes[role],
          visibility: 'public' as const,
          status: role === 'legacy' ? ('archived' as const) : ('published' as const),
          version: 1,
          author:
            locale === 'en' ? 'Lorestra demo team' : 'Equipe de demonstração Lorestra',
          createdAt: '2026-08-30T12:00:00.000Z',
          updatedAt: '2026-08-30T12:00:00.000Z',
          tags: ['demo', group.id, ...copy.tags],
          relatedDocumentIds: [
            ...relatedRoles[role].map((related) =>
              documentId(group.id, related, locale),
            ),
            ...(crossRole ? [documentId('cygnus', crossRole, locale)] : []),
          ],
          path: `vault/Examples/${locale}/${group.id}/demo-${group.id}-${role}.md`,
        }
      }),
    ),
)
