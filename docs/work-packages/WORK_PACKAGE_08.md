# KhedraX Work Package #8
### Validation Engine — cross-field checks: duplicate modules,
### pre-flight exclusive-prompt-section conflict detection

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.0, `SYSTEM_ARCHITECTURE.md` v1.0
(Validation Engine and Registry System entries updated for this package),
`WORK_PACKAGE_01.md`, `WORK_PACKAGE_03.md` (the exclusive-conflict
mechanism this package moves earlier in the pipeline). This prompt is
implementation-ready. Do not make architectural decisions.

This package deepens an existing engine in place (Constitution #11).
Validation Engine has done schema-shape and existence-in-registry checks
only since Work Package #1. This package adds two genuine cross-field
checks: detecting duplicate entries in `dna.modules`, and catching the
exact same exclusive-prompt-section conflict Prompt Engine already detects
at generation time — but before Template Engine or Module Engine have
written a single file, not after.

---

## 1. Engineering Objective

1. `validateDna.ts` rejects a DNA whose `modules` array contains the same
   module name more than once.
2. Registry System's module discovery (`moduleRegistry.ts`) additionally
   reads each module's `prompts/fragment.meta.json` (if present) during
   discovery, and `ModuleDescriptor` carries the resulting `promptSection`
   and `promptExclusive` fields.
3. `validateDna.ts` uses that data to detect, before generation begins,
   whether two or more of the DNA's requested modules would produce the
   same exclusive-prompt-section conflict Prompt Engine already throws on
   at generation time (Work Package #3 §6) — using the **same**
   conflict-detection logic, extracted into a shared function, not a
   second, independently-written copy of it.

## 2. Why This Exists

Right now, an exclusive-section conflict between two modules is only
caught after Template Engine and Module Engine have already run and
written files into the temp directory — Work Package #3's atomic-commit
guarantee means nothing partial ever reaches `outputDir`, so this was never
a correctness problem, only a wasted-work one. Catching it at validation
time means a bad module combination fails immediately, before any disk I/O
happens at all — a straightforward "fail fast" improvement, and a genuine
test of whether the exclusive-conflict detection logic was written
generically enough to be reused outside Prompt Engine, which is the actual
point of extracting it now rather than writing a second implementation
that could silently drift out of sync with the first.

Duplicate module detection closes a real, previously-unguarded gap:
nothing today stops `dna.modules: ["memory", "memory"]` from reaching
Module Engine, which would harmlessly-but-messily copy the same module's
files over themselves twice.

## 3. Architecture Boundaries

- Validation Engine still never generates files, executes module code, or
  mutates DNA — it only reads (now including each module's declared prompt
  metadata via the registry snapshot, which is a read, not an execution).
- The extracted exclusive-conflict-detection function must produce
  **identical** results to what `composePrompt.ts` already computes today
  — this is a refactor of existing logic into a shared, reusable form, not
  a new algorithm. `composePrompt.test.ts`'s existing exclusive-conflict
  test must pass unmodified after the extraction, proving behavior didn't
  change.
- Prompt Engine's own generation-time exclusive-conflict check is **not**
  removed. It remains as defense-in-depth — Validation Engine catching it
  first is the common case, but Prompt Engine must still independently
  refuse to produce a broken composition if it's ever reached with an
  invalid module combination (e.g. any future caller that constructs a
  `GenerationContext` without going through Validation Engine first).
- Reading `prompts/fragment.meta.json` during registry discovery is a
  read of declarative JSON data, the same kind of read `moduleRegistry.ts`
  already does for `module.json` — this is not "executing module code"
  and stays within Registry System's existing ownership boundary.
- A missing or malformed `fragment.meta.json` during discovery must not
  break discovery of the module itself — fall back to the same defaults
  Prompt Engine's `readFragmentMeta.ts` already uses (`section:
  'instructions'`, `exclusive: false`), and do not treat a malformed
  metadata file as grounds to skip the whole module (that's a stricter
  failure mode than a missing/malformed `agentType.json`/`module.json`
  warrants — those get skipped entirely because the module itself is
  unusable without them; a bad `fragment.meta.json` just means "use prompt
  composition defaults for this module," nothing more).

## 4. Files to Modify

```
khedrax/src/prompt/
├── fragmentMetaDefaults.ts        (NEW: extracted pure function —
│                                    parses a raw JSON value into a
│                                    FragmentMeta with defaults filled in;
│                                    both readFragmentMeta.ts and
│                                    moduleRegistry.ts call this)
├── readFragmentMeta.ts            (MODIFY: use fragmentMetaDefaults
│                                    instead of inline default-filling)
├── detectExclusiveConflicts.ts    (NEW: extracted from composePrompt.ts —
│                                    given a list of {moduleName, section,
│                                    exclusive} entries, returns the
│                                    conflict error message string, or
│                                    null if none)
└── composePrompt.ts               (MODIFY: call detectExclusiveConflicts
                                     instead of its own inline check;
                                     behavior must not change)

khedrax/src/registry/
├── types.ts           (MODIFY: ModuleDescriptor gains promptSection?:
│                        string, promptExclusive?: boolean)
└── moduleRegistry.ts   (MODIFY: read prompts/fragment.meta.json per
                          module during discovery, via fragmentMetaDefaults)

khedrax/src/validation/validateDna.ts   (MODIFY: add both new checks)

khedrax/tests/unit/
├── fragmentMetaDefaults.test.ts        (NEW)
├── detectExclusiveConflicts.test.ts    (NEW)
└── validateDna.test.ts                 (MODIFY/EXTEND — existing tests,
                                          including the memory-warning one,
                                          must still pass unmodified)
```

## 5. Data Shapes

**`src/prompt/fragmentMetaDefaults.ts`:**
```typescript
export function parseFragmentMeta(raw: unknown): FragmentMeta {
  const obj = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  return {
    section: typeof obj.section === 'string' && obj.section.length > 0 ? obj.section : 'instructions',
    priority: typeof obj.priority === 'number' && Number.isFinite(obj.priority) ? obj.priority : 0,
    exclusive: typeof obj.exclusive === 'boolean' ? obj.exclusive : false,
  };
}
```
(This is the exact default-filling behavior `readFragmentMeta.ts` already
has today — extract it verbatim, don't redesign the defaults.)

**`src/prompt/detectExclusiveConflicts.ts`:**
```typescript
export interface ExclusivityEntry {
  moduleName: string;
  section: string;
  exclusive: boolean;
}
export function detectExclusiveConflicts(entries: ExclusivityEntry[]): string | null {
  // group by section; if 2+ entries in the same group have exclusive === true,
  // return the exact message format composePrompt.ts already throws today:
  // `Prompt composition conflict: modules "a", "b" both claim exclusive
  //  ownership of section "c".`
  // module names in the message sorted alphabetically, section names in
  // whatever order groups are naturally encountered (matches existing behavior)
  // return null if no conflict.
}
```

**`ModuleDescriptor` additions (`src/registry/types.ts`):**
```typescript
export interface ModuleDescriptor {
  name: string;
  version: string;
  path: string;
  requiresMemory?: boolean;
  capabilities?: string[];
  constraints?: string[];
  // NEW:
  promptSection?: string;      // from prompts/fragment.meta.json, defaulted
  promptExclusive?: boolean;   // from prompts/fragment.meta.json, defaulted
}
```

## 6. Validation Additions (extend `validateDna.ts`, do not create a parallel validator)

1. **Duplicate modules:** after the existing per-module existence check,
   compute which names in `dna.modules` appear more than once. If any, add
   an error: `Duplicate module(s) in modules list: {names, comma-separated,
   alphabetical, each appearing once in the message regardless of how many
   times it was duplicated}`.
2. **Pre-flight exclusivity conflict:** build an `ExclusivityEntry[]` from
   `dna.modules` (deduplicated first — this check should run on the
   distinct module set, after the duplicate check has already flagged
   literal duplicates as a separate error) by looking up each module's
   `promptSection`/`promptExclusive` in `registry.modules`. Call
   `detectExclusiveConflicts()`. If it returns a message, add that exact
   string as a validation error.
3. Both checks are **errors**, not warnings — they represent DNA that
   cannot successfully generate, not DNA that merely deserves a heads-up
   (unlike the existing memory-required-modules warning, which must remain
   completely unmodified).

## 7. Edge Cases

- Zero or one module: neither new check can fire; both must be no-ops,
  not errors, for the common case.
- A module referenced in `dna.modules` that doesn't exist in the registry
  at all: the existing "module does not exist" error should fire first;
  don't let a missing module cause the exclusivity check to crash on an
  undefined descriptor lookup — skip exclusivity-checking entries for
  modules that already failed the existence check (their error is already
  reported; don't compound it with a confusing second error about a module
  that doesn't exist).
- Two modules with the same section but only one marked `exclusive: true`
  (the normal case established since Work Package #3): not a conflict,
  both checks must correctly report no error.
- A module with no `fragment.meta.json` at all (true of every module
  except ones explicitly given one, e.g. `memory`'s from Work Package #3):
  registry discovery defaults it to `section: 'instructions', exclusive:
  false`, contributing normally to the non-exclusive default group.

## 8. Required Tests

1. `fragmentMetaDefaults.test.ts`: covers missing fields, wrong types,
   completely absent input, and a fully-specified valid input — mirrors
   the existing `readFragmentMeta`-related test coverage from Work Package
   #3, now targeting the extracted function directly.
2. `detectExclusiveConflicts.test.ts`: no conflict (empty/normal cases),
   exactly one conflict (two modules, same section, both exclusive),
   confirms the message format matches what `composePrompt.ts` produces
   character-for-character (compare directly against a
   `composePrompt.ts`-driven expectation in the test, not just an
   independently-typed string that happens to look similar).
3. `validateDna.test.ts` additions: duplicate-module rejection (exact
   duplicated names reported); pre-flight exclusivity rejection using two
   real or fixture modules with conflicting `fragment.meta.json` files
   (reuse Work Package #4's fixture-copying pattern); confirm the
   existing "memory-required modules without memory config" warning test
   still passes completely unmodified.
4. Re-run `composePrompt.test.ts`'s existing exclusive-conflict test
   unmodified — proving the extraction into `detectExclusiveConflicts.ts`
   didn't change Prompt Engine's own behavior.

## 9. Acceptance Criteria

1. `khedrax create X --type basic --modules memory,memory --force` is
   rejected by validation with a clear duplicate-module error, before any
   file is written. Paste the actual error output.
2. Constructing two fixture modules with conflicting exclusive
   `fragment.meta.json` entries for the same section (mirroring Work
   Package #3's `conflict-a`/`conflict-b` fixture pattern) and requesting
   both via `--modules` is rejected by validation, before Template Engine
   or Module Engine ever run — verify this by asserting no temp directory
   or partial output exists after the rejection, the same way earlier
   rounds verified Packaging Engine's atomic-commit guarantee.
3. The same conflicting-module scenario, if it somehow reached
   `GenerationEngine.run()` directly bypassing validation (construct this
   in a test), still fails at Prompt Engine's own check — confirming
   defense-in-depth wasn't removed.
4. `khedrax create SupportBot --type customer-support --modules memory
   --force` (the standing verification command) still succeeds
   identically to before — neither new check fires for the normal case.
5. `npm test` and `npm run typecheck` both pass — paste raw terminal
   output directly.
6. No file outside the ones listed in §4 was modified — confirm by
   diffing `src/engines/`, `src/generation/`, `src/persona/`, `src/dna/`
   against the pre-package state.
