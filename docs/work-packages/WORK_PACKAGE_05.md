# KhedraX Work Package #5
### Documentation Engine — reflect persona, modules, and constraints
### in generated documentation

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.0, `SYSTEM_ARCHITECTURE.md` v1.0,
`WORK_PACKAGE_02.md`, `WORK_PACKAGE_03.md`, `WORK_PACKAGE_04.md`. This
prompt is implementation-ready. Do not make architectural decisions.

This package deepens an existing engine in place (Constitution #11).
Documentation Engine currently writes a three-line `README.md` (name, type,
module list) and never touches `docs/`, which still contains Template
Engine's static "Docs placeholder." file. This package replaces that with
real content reflecting Persona Engine's `BehavioralProfile` and Module
Engine's resolved modules — the same artifacts Prompt Engine already
consumes, per the fixed producer order (`template, module, persona, prompt,
memory, documentation` — Documentation Engine runs last, so every other
artifact is already available to it).

Do not touch Template Engine, Module Engine, Persona Engine, Prompt Engine,
Memory Engine, Packaging Engine, or the fixed producer-invocation order.
Re-run the existing Generation Engine orchestration-order test unmodified
to confirm.

---

## 1. Engineering Objective

Replace `DocumentationEngine.run()`'s current body with one that writes
two files: a concise root `README.md` (name, description, type, persona
summary, module list with one-line capability summaries, and a pointer to
`docs/README.md`), and a detailed `docs/README.md` (full persona
breakdown, the complete deduped constraint list, and a per-module
capability/constraint breakdown) — overwriting Template Engine's static
placeholder at that path, the same way it already overwrites the root
`README.md` placeholder today.

## 2. Why This Exists

Work Package #4 proved five modules compose correctly in `prompts/README.md`
for the LLM-facing prompt. Nothing yet does the equivalent for the
human-facing docs a developer opens after running `khedrax create` — right
now they see three flat lines and a file that literally says "Docs
placeholder." This closes that gap using data that's already fully
computed by the time Documentation Engine runs; no new computation, only
new rendering.

## 3. Architecture Boundaries

- Documentation Engine reads `context.dna`, `context.artifacts.persona.behavioralProfile`
  (Work Package #2's key), and `context.artifacts.module.resolvedModuleDescriptors`
  (the richer per-module data Work Package #2 added to Module Engine's
  artifact, alongside the existing `resolvedModules` name-only array) —
  it does not read Memory Engine's or Prompt Engine's artifacts; those are
  outside Documentation Engine's ownership per the architecture doc.
- Documentation Engine never recomputes anything Persona Engine or Module
  Engine already computed — it only renders what's already there.
- Documentation Engine writes exactly two files:
  `context.tempDir/README.md` and `context.tempDir/docs/README.md`. It does
  not create any other new file or directory.
- No LLM calls, no external formatting library — deterministic string
  templating, consistent with every other engine in this system.

## 4. Files to Modify

```
khedrax/src/engines/documentationEngine.ts   (MODIFY: full rewrite of run())
khedrax/tests/unit/documentationEngine.test.ts  (NEW — no dedicated test
                                                  file exists today; prior
                                                  coverage was incidental,
                                                  via the e2e/fixes tests
                                                  checking only that
                                                  README.md exists)
```

No other file should need to change. If you find yourself wanting to touch
`moduleEngine.ts` or `personaEngine.ts` to expose data they don't already
expose, stop — check whether `resolvedModuleDescriptors` and
`behavioralProfile` already carry what you need first (they do: capability
and constraint arrays per module, plus the flattened, deduped persona-level
constraint list).

## 5. Content Specification

**Root `README.md`:**
```markdown
# {dna.name}

{dna.description}

**Type:** {dna.agent.type}
{only if behavioralProfile.tone !== 'neutral' or traits.length > 0:}
**Persona:** {tone}{if traits present: ` — ` + traits.join(', ')}

## Modules
{for each resolved module, one bullet per module, alphabetically by name:}
- **{moduleName}**: {that module's capabilities joined with '; ', or
  "No declared capabilities." if empty}
{if zero modules:}
_No modules configured._

See `docs/README.md` for full persona details, constraints, and escalation
policy.
```

**`docs/README.md`:**
```markdown
# {dna.name} — Agent Overview

## Persona
- Tone: {behavioralProfile.tone}
- Traits: {traits.join(', ') or "None specified."}
- Escalation Policy: {behavioralProfile.escalationPolicy or "None specified."}

## Constraints
{one bullet per entry in behavioralProfile.constraints, in the order
Persona Engine already produced them — do not re-sort; if empty:}
_No constraints configured._

## Modules
{for each resolved module, alphabetically by name, as its own subsection:}
### {moduleName}
**Capabilities:**
{bullet list from that module's capabilities, or "None declared." if empty}

**Constraints:**
{bullet list from that module's own constraints (from resolvedModuleDescriptors,
not the flattened persona-level list), or "None declared." if empty}
{if zero modules:}
_No modules configured._
```

## 6. Inputs / Outputs

- **Input:** `GenerationContext` with `dna`, `artifacts.persona.behavioralProfile`,
  `artifacts.module.resolvedModuleDescriptors`.
- **Output:** `context.tempDir/README.md` and `context.tempDir/docs/README.md`
  written. `ProducerResult.artifacts` may stay `{ written: true }` — no
  future consumer needs a richer artifact from this engine, since it's the
  last producer in the fixed order.

## 7. Edge Cases

- Zero resolved modules (e.g. `--type basic`, no `--modules`): both files
  render their "no modules configured" fallback text; the Modules section
  header still appears (an empty section header is fine — omitting the
  header entirely would make the two files' structure inconsistent between
  the zero- and non-zero-module cases, which is worse than a short "none"
  line).
  Root `README.md`'s persona line entirely if `tone === 'neutral'` AND
  `traits.length === 0` — a persona-less basic agent shouldn't have a
  misleading "Persona: neutral" line cluttering the concise summary. The
  detailed `docs/README.md` always shows the Persona section regardless
  (it's the "full detail" file, so "Tone: neutral" there is fine and
  expected).
- A module with capabilities but no constraints (or vice versa) — render
  "None declared." for whichever list is empty, never omit the subsection
  entirely (consistent structure across all modules matters more than
  saving a few lines for sparse modules).
- Five modules (reuse Work Package #4's `memory, discord, email, github,
  rag` scenario): confirm both files render all five modules' subsections
  correctly, alphabetically ordered, with no cross-module content bleeding
  into the wrong module's subsection.

## 8. Required Tests

Add `tests/unit/documentationEngine.test.ts` with at minimum:
1. A test with a persona-backed, single-module DNA (mirroring
   `SupportBot`/`customer-support`/`memory`) asserting both files' exact
   expected content (or a close structural match — not just "contains the
   word memory").
2. A test with zero modules and no persona (`basic` type) asserting the
   "no modules configured" / omitted-persona-line fallback behavior in
   root `README.md`, and the "Tone: neutral" / "None specified." fallback
   text in `docs/README.md`.
3. A test reusing the five-module scenario from Work Package #4's
   `moduleExpansion.test.ts` fixture pattern, asserting all five modules'
   subsections appear correctly and alphabetically in `docs/README.md`.

## 9. Acceptance Criteria

1. `khedrax create SupportBot --type customer-support --modules memory
   --force` produces a root `README.md` with the professional-support
   persona summary and the memory module's capability listed, and a
   `docs/README.md` with the full persona breakdown (tone, traits,
   escalation policy), the complete constraint list, and the memory
   module's capability/constraint subsection. Paste both files' actual
   content.
2. `khedrax create MinimalBot --type basic --force` (zero modules, no
   persona) produces a root `README.md` with no persona line and a "no
   modules configured" fallback, and a `docs/README.md` showing "Tone:
   neutral" and "None specified."/"None declared." fallbacks throughout.
   Paste both files' actual content.
3. The five-module scenario from Work Package #4 produces a `docs/README.md`
   with all five modules' subsections present, alphabetically ordered, each
   showing that module's own capabilities and constraints only (no
   cross-contamination between modules' constraint lists).
4. `npm test` and `npm run typecheck` both pass — paste raw terminal output
   directly, per the established pattern, rather than re-zipping.
5. No file outside `documentationEngine.ts` and the new test file was
   modified. Confirm by diffing `src/engines/`, `src/generation/`,
   `src/persona/`, `src/prompt/`, and `src/dna/` against the pre-package
   state — none of those (other than `documentationEngine.ts` itself)
   should differ.

