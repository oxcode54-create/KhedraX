# KhedraX Work Package #3
### Prompt Engine — composition, layer merging, conflict resolution,
### prompt assembly pipeline

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.0, `SYSTEM_ARCHITECTURE.md` v1.0
(Prompt Engine entries updated for this package), `WORK_PACKAGE_01.md`,
`WORK_PACKAGE_02.md`. This prompt is implementation-ready. Do not make
architectural decisions — every decision has already been made in the
governing documents. Where this prompt is silent, consult them.

This package deepens an existing engine in place (Constitution #11). Prompt
Engine already sits between Persona Engine and Memory Engine in the fixed
orchestration order; this package replaces its verbatim-concatenation body
with real layered composition. Do not touch Template Engine, Module Engine,
Persona Engine, Memory Engine, Documentation Engine, Packaging Engine, or
the fixed producer-invocation order — re-run the existing Generation Engine
orchestration-order test unmodified to confirm.

---

## 1. Engineering Objective

Replace Prompt Engine's current behavior — read each resolved module's
`prompts/<moduleName>/fragment.md` and concatenate them under a `## moduleName`
heading — with a real composition pipeline: assemble the final prompt as
named, ordered **layers** (identity, constraints, capabilities,
instructions, escalation), merge module contributions within the
`instructions` layer by an explicit **section** they declare (defaulting to
`instructions` if undeclared), and deterministically resolve the case where
two modules both claim exclusive ownership of the same section.

## 2. Why This Exists

Right now, `prompts/README.md` is a flat concatenation of module fragments
with no relationship to Persona Engine's `BehavioralProfile` at all — the
tone, traits, constraints, capability descriptions, and escalation policy
that Work Package #2 built are computed but never surfaced anywhere a
generated agent could actually use them. This package closes that gap and
gives every future module a single, well-defined way to contribute prompt
content without needing to invent its own formatting or worry about
colliding with another module's contribution.

## 3. Architecture Boundaries

- Prompt Engine reads `context.artifacts.persona.behavioralProfile` (the
  exact key Persona Engine writes to, per Work Package #2) and
  `context.artifacts.module.resolvedModules` — it does not recompute
  anything Persona Engine or Module Engine already computed.
- Prompt Engine never talks to an LLM. All composition is deterministic
  string assembly.
- Prompt Engine never decides which modules are selected or what a
  module's capabilities/constraints are — those are Module Engine's and
  Persona Engine's authoritative outputs, treated as given.
- Section conflict resolution must be **deterministic and loud on genuine
  conflict** — never a silent coin-flip. This mirrors the same principle
  Module Engine already applies to colliding file paths (Work Package #1
  §7 edge cases): two modules both claiming exclusive ownership of the same
  section is a hard failure, not a "last one wins" resolution.
- Fragment metadata (`fragment.meta.json`) is optional per module — a
  module with no metadata file must behave exactly as it does today
  (default section, default priority, non-exclusive). This is required for
  backward compatibility with the existing `memory` module data
  (Constitution #9's additive-schema principle applies to module data too,
  not just `agent.yaml`).
- Continue writing to `prompts/README.md` (do not introduce a second output
  file) — this keeps existing consumers and tests pointed at one place.

## 4. Folder Structure to Create / Modify

```
khedrax/
├── src/
│   ├── prompt/
│   │   ├── types.ts              (NEW: FragmentMeta, ComposedLayer, etc.)
│   │   ├── readFragmentMeta.ts   (NEW: loads fragment.meta.json with defaults)
│   │   └── composePrompt.ts      (NEW: the layering + conflict-resolution algorithm)
│   └── engines/
│       └── promptEngine.ts       (MODIFY: replace body with composePrompt call)
├── modules/
│   └── memory/
│       └── prompts/
│           └── fragment.meta.json (NEW: explicit reference example — see §5)
└── tests/unit/
    ├── composePrompt.test.ts     (NEW)
    └── promptEngine.test.ts      (NEW — no prior dedicated test file existed;
                                    prior coverage was via fixes.test.ts's
                                    "module prompt fragments are assembled"
                                    test, which must still pass unmodified)
```

## 5. Data Shapes

**`src/prompt/types.ts`:**
```typescript
export interface FragmentMeta {
  section: string;      // default: 'instructions'
  priority: number;      // default: 0; higher renders first within a section
  exclusive: boolean;    // default: false
}

export interface ModuleFragment {
  moduleName: string;
  content: string;       // raw fragment.md content
  meta: FragmentMeta;
}

export interface ComposedPrompt {
  sections: Array<{ name: string; content: string }>;
  markdown: string;      // the final assembled prompts/README.md content
}
```

**`modules/memory/prompts/fragment.meta.json`** (new reference example —
mirrors how Work Package #2 added `capabilities`/`constraints` to
`module.json` as the reference data for future modules):
```json
{
  "section": "instructions",
  "priority": 0,
  "exclusive": false
}
```
This is functionally identical to today's default behavior — it exists so
the memory module demonstrates the metadata format explicitly rather than
relying on defaults, the same way Work Package #2 made memory's
capabilities/constraints explicit rather than implicit.

## 6. Layering / Conflict-Resolution Algorithm (implement exactly, do not redesign)

Fixed layer order, each rendered as a `##` heading in the final markdown,
omitted entirely if it would be empty:

1. **`## Identity`** — from `behavioralProfile.tone` and `.traits`. Render
   as: `Tone: {tone}` then, if traits is non-empty, `Traits: {comma-joined
   traits}`.
2. **`## Constraints`** — from `behavioralProfile.constraints`, rendered as
   a markdown bullet list, one constraint per line, in the order Persona
   Engine already produced them (do not re-sort or re-dedupe — that's
   Persona Engine's job, already done).
3. **`## Capabilities`** — from `behavioralProfile.capabilities`, rendered
   as a bullet list: `- ({moduleName}) {description}` per entry.
4. **`## Instructions`** — see merge algorithm below.
5. **`## Escalation`** — from `behavioralProfile.escalationPolicy`, rendered
   as a single line, only if present.

**Instructions layer merge:**
1. For each resolved module (in `resolvedModules` order), read
   `prompts/<moduleName>/fragment.md` (skip silently if missing, matching
   today's behavior) and `prompts/<moduleName>/fragment.meta.json` via
   `readFragmentMeta()` (return defaults if missing or malformed — do not
   throw for a missing/malformed metadata file, only warn).
2. Group all fragments by `meta.section`.
3. Within each group:
   - If more than one fragment in the group has `meta.exclusive === true`,
     throw an error naming the section and every module that claimed
     exclusivity for it (e.g. `Prompt composition conflict: modules
     "moduleA", "moduleB" both claim exclusive ownership of section
     "instructions".`). This must halt generation — do not catch this
     error inside Prompt Engine and silently continue.
   - If exactly one fragment has `exclusive: true`, that fragment alone
     represents the group; all other (non-exclusive) fragments in the same
     group are dropped.
   - Otherwise (no exclusive fragment in the group), render every fragment
     in the group in order: `priority` descending, then `moduleName`
     ascending as a stable tie-break.
4. Render each group as its own `###` sub-heading using the section name
   (e.g. `### instructions`), with each module's fragment content below a
   `#### {moduleName}` line, in the resolved order from step 3. If the
   group name is exactly `"instructions"` (the default), omit the `###`
   sub-heading — it would be redundant with the `## Instructions` layer
   heading — and go straight to the `#### {moduleName}` entries.

## 7. Inputs / Outputs

- **Input:** `GenerationContext` with `context.artifacts.persona.behavioralProfile`,
  `context.artifacts.module.resolvedModules`, `context.tempDir` (where
  Module Engine already copied each module's namespaced `prompts/<moduleName>/`
  directory, per the Work Package #1 fix pass).
- **Output:** `prompts/README.md` written into `context.tempDir`, containing
  the fully composed layered prompt. `ProducerResult.artifacts` may include
  `{ composedSections: string[] }` (the list of top-level layer names that
  were actually rendered) for potential future consumers — Documentation
  Engine does not consume this in this package; that's out of scope.

## 8. Validation Requirements

- No new `AgentDNA` validation is needed — this package operates entirely
  on already-validated DNA and already-resolved module/persona artifacts.
- `readFragmentMeta()` must validate that `section` (if present) is a
  non-empty string, `priority` (if present) is a finite number, and
  `exclusive` (if present) is a boolean. A malformed `fragment.meta.json`
  produces a console warning and falls back to full defaults — it must
  never throw and must never halt generation (only the exclusive-conflict
  case in §6 halts generation).

## 9. Edge Cases

- Zero resolved modules: `## Instructions` layer is omitted entirely (per
  §6's "omitted entirely if it would be empty" rule), and the rest of the
  layers (Identity, Constraints, Capabilities, Escalation) still render
  based on `behavioralProfile` alone — a persona with no modules still
  produces a meaningful prompt.
- A module with a `fragment.md` but no `fragment.meta.json` (this is the
  memory module's situation before this package updates it, and will be
  every future module's situation unless they opt in) — must behave
  identically to a module with an explicit
  `{section: "instructions", priority: 0, exclusive: false}` file.
- Two modules in the *default* `"instructions"` section, neither exclusive
  — both render, ordered by priority then module name; this is normal
  composition, not a conflict, and must not throw.
- A module's `fragment.md` exists but is an empty file — render its
  `#### {moduleName}` heading with empty content beneath rather than
  skipping it (an explicitly-empty fragment is different from a missing
  one, and skipping it silently would hide a module author's mistake).
- **Known limitation, note it rather than solving it in this package:**
  the real conflict-resolution failure path (two modules both exclusive on
  the same section) cannot currently be exercised by an actual `khedrax
  create` run, since only one real module (`memory`) exists in the repo.
  Cover it with synthetic module descriptors in `composePrompt.test.ts`
  instead of a real fixture, the same way Work Package #2's persona
  override-wins logic was proven correct but not yet exercisable via the
  CLI. This is expected to close naturally once Work Package #4 adds more
  real modules — don't manufacture a second fake module in `modules/` just
  to close this gap now.

## 10. Acceptance Criteria

1. `khedrax create SupportBot --type customer-support --modules memory
   --force` (the now-standard verification command from prior rounds)
   produces a `prompts/README.md` containing an `## Identity` section with
   `professional-support`'s tone, a `## Constraints` section listing both
   the persona's and the memory module's constraints, a `## Capabilities`
   section listing the memory module's capability description, an
   `## Instructions` section containing the memory module's fragment text,
   and an `## Escalation` section with the persona's escalation policy.
   Paste the actual file content as proof, not just a passing test.
2. A synthetic two-module test where both declare the same non-default
   section and neither is exclusive renders both fragments, ordered by
   priority then module name — verified by an exact string/structure
   assertion in `composePrompt.test.ts`, not a substring check.
3. A synthetic two-module test where both declare `exclusive: true` for
   the same section throws an error naming both modules and the section —
   verified by asserting the thrown error's message, and verified that
   this error actually propagates out of `PromptEngine.run()` and would
   halt `GenerationEngine.run()` (add or extend a Generation Engine test
   for this propagation, don't only test `composePrompt()` in isolation).
4. A module with no `fragment.meta.json` behaves identically before and
   after this package — the existing `fixes.test.ts` "module prompt
   fragments are assembled into prompts readme" test must still pass
   unmodified (its assertions may need updating only if they were checking
   for the old flat `## moduleName` heading format instead of the new
   layered structure — if so, explain the change in the summary, the same
   way the YAML fix pass explained its one necessary assertion update).
5. Zero resolved modules still produces a valid, non-empty `prompts/README.md`
   driven entirely by persona data.
6. `npm test` and `npm run typecheck` both pass with zero errors — run and
   report both, don't just report `npm test`.
7. Re-running the existing Generation Engine orchestration-order test
   confirms the fixed producer order (`template, module, persona, prompt,
   memory, documentation`) is untouched by this package.
