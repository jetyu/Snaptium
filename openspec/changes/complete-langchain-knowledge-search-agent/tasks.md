## 1. Provider Schema and Presentation

- [x] 1.1 Add typed AI Provider constants and migrate AI Source settings schema.
- [x] 1.2 Add exhaustive text-only Provider presentation registry.
- [x] 1.3 Redesign AI Sources cards and add/edit form with Provider selection.
- [x] 1.4 Use text-only source selectors without Provider logos.

## 2. Provider Runtime Integrations

- [x] 2.1 Add required LangChain Provider, LangGraph, text splitter and SQLite persistence dependencies.
- [x] 2.2 Implement Main-process Provider factories for chat, embeddings and rerankers.
- [x] 2.3 Implement SiliconFlow model discovery, Chat/Embedding adapters and reranker compressor.
- [x] 2.4 Add provider-aware connection and Agent Tool Calling validation at the IPC boundary.

## 3. Knowledge Copilot Persistence and Index

- [x] 3.1 Replace Knowledge Agent settings with typed Knowledge Copilot settings and defaults.
- [x] 3.2 Implement SQLite conversation/checkpoint and incremental record persistence.
- [x] 3.3 Implement Snaptium LanceDB LangChain VectorStore adapter with lifecycle operations.
- [x] 3.4 Implement LangChain Document splitting and generation-safe full/incremental indexing.
- [x] 3.5 Connect VFS create/update/rename/move/trash/restore events to the indexing queue.

## 4. Knowledge Ask and Agent Graphs

- [x] 4.1 Implement fixed retrieve/rerank/answer Knowledge Ask graph with source-only fallback.
- [x] 4.2 Implement LangGraph Knowledge Agent with shared conversation context and approved tools.
- [x] 4.3 Implement per-step interrupt/resume confirmation and the confirm/auto permission matrix.
- [x] 4.4 Implement note create/read/update/rename/move/trash/restore tools and exclude permanent delete.
- [x] 4.5 Normalize streaming messages, sources, trace, pending actions and resumed results.

## 5. Electron and Renderer Replacement

- [x] 5.1 Replace Knowledge Agent IPC constants/handlers with validated Knowledge Copilot APIs.
- [x] 5.2 Replace Preload and Renderer bridge namespaces with `knowledgeCopilot`.
- [x] 5.3 Replace the Renderer feature and preserve same-page Knowledge Ask/Knowledge Agent switching.
- [x] 5.4 Replace the old Knowledge Base preferences panel with Knowledge Copilot settings and index status.
- [x] 5.5 Update workbench history/session integration for persistent conversations.

## 6. Migration, Cleanup and Locale

- [x] 6.1 Add idempotent migration preserving notes and AI Sources while resetting knowledge settings/history/index.
- [x] 6.2 Remove obsolete Knowledge Agent services, feature files, IPC surfaces and unused code.
- [x] 6.3 Keep only the external `rag` license entitlement mapping and remove other stale product naming.
- [x] 6.4 Update Simplified Chinese and authorized related brand locale keys without hardcoded UI text.

## 7. Tests and Verification

- [ ] 7.1 Add tests for Provider migration, presentation registry, SiliconFlow discovery and validation. (Skipped by user request.)
- [ ] 7.2 Add tests for indexing lifecycle, Ask fallback and Agent permission/interrupt behavior. (Skipped by user request.)
- [ ] 7.3 Run focused unit tests and locale validation. (Automated tests skipped by user request.)
- [ ] 7.4 Run `npm run build:main`, `npm run build:preload`, `npm run typecheck` and `npm run lint`.
