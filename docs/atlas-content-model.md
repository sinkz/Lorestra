# What makes a celestial body?

The living map is a view of knowledge, not a separate set of decorative objects. Document type and publication status choose the body. Existing semantic references choose its neighborhood. A well-connected document can become a larger hub without changing its type.

| Body          | Source metadata                                              | Meaning                                                                  |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Star          | Folder node                                                  | A directory in the vault, not a document type                            |
| Planet        | `type: lesson`; documentation mapped to the UI's `docs` kind | A guide, lesson, or documentation                                        |
| Moon          | `type: note`                                                 | Working observations, an idea, or a short note                           |
| Ringed planet | `type: decision`                                             | An ADR or recorded decision                                              |
| Comet         | `type: incident`                                             | An incident and the lesson it left behind                                |
| Satellite     | `type: process`                                              | A repeatable procedure or runbook                                        |
| Black hole    | `status: archived`                                           | Historical knowledge kept readable; overrides the document's normal body |

The UI also recognizes `runbook` as a satellite, but the transport contract uses `process`. Its `guide` kind comes from the contract's `lesson`. Legacy `document` records become `docs` when tagged `docs`, otherwise a note. These are mappings, not additional transport types.

## Defining examples today

```yaml
type: process
status: published
folderId: folder.demo.orion.pt-br
relatedDocumentIds:
  - lorestra.demo.orion.overview.pt-br
  - lorestra.demo.orion.incident.pt-br
```

This describes a satellite with two references. Changing its status to `archived` makes it a black hole; its original type is preserved. A folder remains a star even when it contains archived documents.

The mock fixture now accepts an explicit `type`; older fixtures keep their legacy title/tag inference. The curated fixture and its Markdown counterpart must be kept in sync. The application does **not** yet import arbitrary YAML frontmatter from the Markdown editor, and the new-memory dialog does **not** yet offer a type selector. Editing body text alone therefore does not change the model. Metadata authoring/import is a later feature, not something these examples pretend to implement.

## The three examples

- **Orion — Engineering:** versioned caches, latency observations, a decision, an incident, a recovery runbook, and a superseded cache strategy.
- **Lyra — Learning:** reading observations, guided exercises, an ambiguous activity, a peer-review process, and a superseded worksheet.
- **Cygnus — Research:** measurement records, a protocol decision, mixed measurement units, a collection checklist, and a superseded spreadsheet.

Each has six documents in each language plus a localized folder. Two cross-topic references create real bridges. Existing vault content is retained, so the entire vault can show more than these three example communities. A folder is a navigation boundary; a galaxy is inferred from relationships. Adding links can change clustering.

Example filenames use their unique slug (`demo-orion-overview.md`). Relative Markdown links remain valid in the exported vault; in the reader, a known filename opens its document route without reloading the application. Unknown or external destinations are not rewritten.

Public archives are historical, not secret. Both read adapters continue to reject drafts and every internal document, including internal archives. Archiving is not a substitute for changing visibility or redacting sensitive information. These fictional examples are local seed content, not user proposals or a claim of real incidents.

## Resumo em português

Pasta vira **estrela**; guia/lição vira **planeta**; nota vira **lua**; decisão vira **planeta com anéis**; incidente vira **cometa**; processo/runbook vira **satélite**. Um documento com `status: archived` vira **buraco negro**, preservando o conhecimento anterior e seu tipo original.

Os exemplos são **Órion (Engenharia)**, **Lira (Aprendizagem)** e **Cisne (Pesquisa)**: seis documentos por grupo em português e inglês, com relações internas e duas pontes entre temas. Os documentos atuais continuam no vault. A galáxia vem das relações, não de um campo `galaxy` nem necessariamente de uma pasta.

Hoje a definição explícita está nos fixtures e nos metadados dos arquivos de exemplo. O editor ainda não interpreta frontmatter para mudar o tipo e não existe seletor visual de modelo. Arquivados públicos continuam legíveis; rascunhos e conteúdo interno continuam ocultos. Arquivar não é tornar privado. Todos os exemplos são fictícios.
