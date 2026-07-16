# KhedraX Work Package #6
### Memory Engine — backend registry, config resolution,
### module memory-requirement cross-referencing

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.0, `SYSTEM_ARCHITECTURE.md` v1.0
(Registry System and Memory Engine entries updated for this package),
`WORK_PACKAGE_02.md` (the persona-registry pattern this package mirrors),
`WORK_PACKAGE_04.md`. This prompt is implementation-ready. Do not make
architectural decisions.

This package deepens an existing engine in place (Constitution #11).
Memory Engine currently writes a single `memory/README.md` containing a raw
JSON dump of `dna.memory` (or a hardcoded `{backend: 'memory'}` fallback)
and never reads module data at all. This package makes it mirror the exact
pattern Work Package #2 established for Persona Engine: a filesystem-
discovered registry of presets (here, memory backends instead of personas),
resolved against DNA with override-wins-over-default semantics, plus real
cross-referencing of module-declared requirements that today only produces
a validation warning and nothing else.

Do not touch Template Engine, Module Engine, Persona Engine, Prompt Engine,
Documentation Engine, Packaging Engine, or the fixed producer-invocation
order. Re-run the existing Generation Engine orchestration-order test
unmodified to confirm.

---

## 1. Engineering Objective

Add a `memoryBackends/` filesystem registry (mirroring `personas/` from
Work Package #2), give `AgentDNA.memory` a concrete shape (`backend`,
`config`), and rewrite `MemoryEngine.run()` to: resolve the requested (or
default) backend from the registry, merge `dna.memory.config` overrides
onto that backend's declared defaults, cross-reference which resolved
modules declare `requiresMemory: true`, and write a structured
`memory/config.json` plus a human-readable `memory/README.md` — never a
raw JSON dump.

## 2. Why This Exists

Right now `dna.memory` is genuinely inert: `validateDna.ts` already warns
when a memory-requiring module is present with no memory config, but that
warning has no effect on what actually gets generated — Memory Engine
scaffolds the same generic file regardless. This closes that gap using the
exact registry-preset-plus-override pattern already proven twice in this
system (Persona Engine in Work Package #2, and implicitly the
agentType-default pattern from Work Package #1), rather than inventing a
new mechanism.

## 3. Architecture Boundaries

- Memory Engine still never implements actual runtime memory storage
  logic — no read/write/query functions, no database client code. It
  writes configuration and documentation describing what backend and
  settings a generated agent *would* use, exactly as before, just with
  real content instead of a placeholder dump.
- A memory backend definition (`backend.json`) is pure data — no backend
  behavior may be hardcoded into `memoryEngine.ts` itself (Constitution
  #3). Adding a new backend later must mean "add a folder," matching every
  other registry in this system.
- `dna.memory.backend`, if the caller supplies it, always wins over any
  default — same override-wins-over-preset rule used for persona and
  agentType defaults throughout this system.
- The existing `validateDna.ts` warning ("memory-required modules without
  memory config") must continue to fire under the exact same conditions as
  today — do not change when it fires, only optionally add a new,
  separate check (see §8) alongside it.
- Do not add a `path` field to the checked-in `backend.json` files
  (same reasoning as Work Package #4 §3 for modules — the registry loader
  synthesizes it, a hardcoded one in checked-in data is misleading).

## 4. Folder Structure to Create / Modify

```
khedrax/
├── memoryBackends/
│   ├── in-memory/
│   │   └── backend.json
│   └── redis/
│       └── backend.json
├── src/
│   ├── registry/
│   │   ├── types.ts                    (MODIFY: add MemoryBackendDescriptor, RegistrySnapshot.memoryBackends)
│   │   ├── memoryBackendRegistry.ts    (NEW: discovery, mirrors personaRegistry.ts)
│   │   └── index.ts                    (MODIFY: include memoryBackends in the snapshot)
│   ├── dna/
│   │   └── schema.ts                   (MODIFY: give AgentDNA.memory a concrete shape)
│   ├── validation/
│   │   └── validateDna.ts              (MODIFY: validate memory.backend against registry, additively)
│   └── engines/
│       └── memoryEngine.ts             (MODIFY: full rewrite of run())
└── tests/unit/
    ├── memoryBackendRegistry.test.ts   (NEW)
    └── memoryEngine.test.ts            (NEW — no dedicated test file exists
                                          today; prior coverage was
                                          incidental)
```

## 5. Data Shapes

**`memoryBackends/in-memory/backend.json`:**
```json
{
  "name": "in-memory",
  "version": "1.0.0",
  "description": "Ephemeral in-process memory store, cleared on restart.",
  "configDefaults": { "maxEntries": 1000 }
}
```

**`memoryBackends/redis/backend.json`:**
```json
{
  "name": "redis",
  "version": "1.0.0",
  "description": "Persistent memory store backed by Redis.",
  "configDefaults": { "host": "localhost", "port": 6379, "ttlSeconds": 86400 }
}
```

**`src/registry/types.ts` additions:**
```typescript
export interface MemoryBackendDescriptor {
  name: string;
  version: string;
  description: string;
  configDefaults: Record<string, unknown>;
}
// RegistrySnapshot gains:
memoryBackends: Record<string, MemoryBackendDescriptor>;
```

**`AgentDNA.memory` concrete shape** (was `Record<string, unknown>`, now):
```typescript
memory: {
  backend?: string;                  // key into registry.memoryBackends; optional
  config?: Record<string, unknown>;  // shallow-merged onto the backend's configDefaults, override wins
}
```
This is an additive narrowing (Constitution #9) — an empty `{}` from any
prior work package's generated projects, or from any existing test fixture,
remains valid input and must resolve to the default backend with its
unmodified defaults.

## 6. Resolution Algorithm (implement exactly, do not redesign)

1. **Resolve backend name:** `dna.memory.backend` if set and non-empty,
   else `'in-memory'` as the hardcoded default (this one default name is
   the single allowed exception to "nothing hardcoded" — every *other*
   backend must come from the registry, but the fallback default name
   itself has to live somewhere, exactly as `'neutral'` does for persona
   tone in Work Package #2).
2. **Look up the descriptor:** if the resolved name isn't in
   `registry.memoryBackends`, this is a validation error (see §8) caught
   *before* Memory Engine ever runs — trust validation, don't defensively
   re-check inside Memory Engine.
3. **Merge config:** shallow merge — `descriptor.configDefaults` as the
   base, `dna.memory.config` keys override on top (caller-supplied keys
   win; keys the caller didn't specify keep the backend's default).
4. **Cross-reference modules:** from `context.artifacts.module.resolvedModuleDescriptors`,
   collect the names of every module whose descriptor has
   `requiresMemory === true`.
5. Write `memory/config.json`: `{ "backend": resolvedName, "config": mergedConfig }`.
6. Write `memory/README.md`: backend name, its `description`, the merged
   config (pretty-printed), and — only if non-empty — a "Required by
   modules:" list from step 4; if no module requires memory, omit that
   section entirely rather than showing "Required by modules: none."

## 7. Inputs / Outputs

- **Input:** `GenerationContext` with `dna.memory`, `registry.memoryBackends`,
  `context.artifacts.module.resolvedModuleDescriptors`.
- **Output:** `context.tempDir/memory/config.json` and
  `context.tempDir/memory/README.md`. `ProducerResult.artifacts` may stay
  `{ written: true }`.

## 8. Validation Requirements (extend `validateDna.ts`, do not create a parallel validator)

- If `dna.memory.backend` is set, it must exist in
  `registry.memoryBackends` — error, not warning (mirrors persona preset
  validation from Work Package #2 exactly).
- `dna.memory.config`, if present, must be a plain object (not an array or
  primitive).
- The existing "memory-required modules without memory config" warning
  must be preserved unmodified — re-run its existing test as-is to
  confirm. Do not merge this new backend-existence check into that
  warning's logic; they're separate concerns (one is about a missing
  config given a memory-requiring module, the other is about an invalid
  backend name) and must remain two separate checks.

## 9. Edge Cases

- `dna.memory` entirely empty (`{}`, the default for any agent that
  doesn't specify memory settings) — resolves to backend `in-memory` with
  its unmodified `configDefaults`, no error, no warning (unless the
  existing memory-required-module warning applies, which is orthogonal).
- `dna.memory.config` supplies a key not present in the backend's
  `configDefaults` (e.g. a `redis`-specific key while using `in-memory`) —
  this is not an error; the merged config simply includes it. Memory
  Engine doesn't validate config keys against a backend's schema in v1,
  only merges them (matching this system's established pattern of trusting
  already-validated input rather than re-validating downstream).
- Two or more resolved modules both declare `requiresMemory: true` (e.g. a
  future module alongside `memory` itself) — both names appear in the
  "Required by modules:" list, alphabetically ordered, no duplicates.
- A module's descriptor has no `requiresMemory` field at all (every module
  from Work Package #4 except `memory` itself) — treated as `false`,
  contributes nothing to the list, exactly like a missing `capabilities`
  field contributes nothing in Persona Engine.

## 10. Required Tests

1. `memoryBackendRegistry.test.ts`: discovers both built-in backends;
   skips a malformed `backend.json` the same way agentType/module/persona
   discovery already does (don't reinvent this — mirror the existing
   malformed-entry-skip test pattern).
2. `memoryEngine.test.ts`, at minimum:
   - Empty `dna.memory` resolves to `in-memory` with unmodified defaults.
   - An explicit `backend: 'redis'` with a partial `config` override
     produces a merged config where overridden keys differ from
     `configDefaults` and non-overridden keys match them exactly.
   - A resolved module with `requiresMemory: true` (use the real `memory`
     module's descriptor) appears in `memory/README.md`'s "Required by
     modules:" section; a generation with zero modules omits that section
     entirely.
   - An invalid `dna.memory.backend` value is rejected by validation
     *before* Memory Engine runs — verify this the same way Work Package
     #2 verified persona preset rejection (assert Memory Engine is never
     invoked in this failure path).

## 11. Acceptance Criteria

1. `khedrax create SupportBot --type customer-support --modules memory
   --force` (the standing verification command) produces a
   `memory/config.json` with `backend: "in-memory"` and its default config,
   and a `memory/README.md` listing `memory` under "Required by modules:"
   (since the `memory` module's own descriptor declares
   `requiresMemory: true`). Paste both files' actual content.
2. The same command but with an added `--modules` selection that has zero
   memory-requiring modules (e.g. `discord,email` only) produces a
   `memory/README.md` with no "Required by modules:" section at all. Paste
   the actual content.
3. Re-running the existing "Validation reports a warning for
   memory-required modules without memory config" test unmodified still
   passes.
4. `npm test` and `npm run typecheck` both pass — paste raw terminal
   output directly.
5. No file under `src/engines/` other than `memoryEngine.ts`, and no file
   under `src/generation/`, `src/persona/`, `src/prompt/`, was modified —
   confirm by diffing those directories against the pre-package state.
