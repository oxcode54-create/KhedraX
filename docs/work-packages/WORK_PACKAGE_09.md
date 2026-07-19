# KhedraX Work Package #9
### Backlog cleanup — checkpoint relocation, --persona CLI flag,
### js-yaml packaging gap

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.0, `SYSTEM_ARCHITECTURE.md` v1.0,
`WORK_PACKAGE_01_FIXES_2.md` (item 4, first raised there), `WORK_PACKAGE_02.md`
(the override-wins-over-preset gap first noted there). This prompt is
implementation-ready. Do not make architectural decisions.

Three small, independent items, each deferred from an earlier round rather
than newly discovered. None of them touch generation behavior for any
already-verified scenario — treat any test that starts failing because of
this package as a signal to investigate, not to loosen.

---

## 1. Checkpoint relocation

**Problem:** `checkpoint.ts` lives under `src/cli/utils/`, but the Workflow
Engine — not the CLI — owns checkpoint file lifecycle per the ownership
matrix (has been true since Work Package #1). `workflow/runner.ts`
importing from `../cli/utils/checkpoint.ts` is a backwards dependency
direction: the generic Workflow Engine reaching into a CLI-specific path
to do its own core job.

**Fix:** Move `src/cli/utils/checkpoint.ts` to `src/workflow/checkpoint.ts`.
Update the two import sites (`workflow/runner.ts`, `cli/commands/create.ts`
— check for any other importers before assuming these are the only two).
This is a pure relocation: no function signature, no behavior, and no test
expectation should change. Every existing test exercising checkpoint
save/load/resume behavior must pass unmodified once import paths are
updated — if any of them fail, that means the move introduced a behavior
change, which it must not.

## 2. `--persona` CLI flag

**Problem:** `AgentDNA.persona.presetName` has had correct
override-wins-over-agentType-default logic in `buildAgentDNA()` since it
was fixed following Work Package #2's review — but there has never been a
way to actually supply a caller-level persona preset through the real CLI.
The override branch is provably correct by code inspection, but has never
been exercised end-to-end, because nothing sets `options.persona` today.

**Fix:**
- `CreateAgentOptions` (`src/dna/schema.ts`) gains an optional
  `persona?: string` field — the requested persona preset name.
- `src/cli/bin/khedrax.ts` parses a new `--persona <presetName>` flag and
  threads it into `options.persona`.
- `buildAgentDNA()` seeds `persona.presetName` from `options.persona`
  (when provided) **before** the existing agentType-default-merge step
  runs — this is what makes the existing "explicit value already truthy,
  so the default merge leaves it alone" guard actually engage for a real
  caller-supplied value, not just an agentType default.
- Existing validation (an unknown persona preset name is rejected) should
  need no changes — it already validates `dna.persona.presetName` against
  the registry regardless of where that value came from. Confirm this
  rather than assuming it — if a gap turns out to exist, report it as a
  separate finding rather than silently patching validation as a side
  effect of this CLI-flag package.

**Required test:** a real CLI (or `createAgent()`) invocation with
`--persona friendly-assistant` on an agent type whose own default is a
*different* preset (e.g. `customer-support`, which defaults to
`professional-support`) must produce a `BehavioralProfile` reflecting
`friendly-assistant`, not the agentType's default — this is the first time
this exact scenario will be exercised end-to-end rather than only proven
correct by reading the loader's merge-order code.

## 3. `js-yaml` packaging gap

**Problem:** Across several review rounds, exported/zipped copies of this
repo have arrived without `js-yaml` actually present in `node_modules`,
even though `package.json` and `package-lock.json` have both been
consistently correct every time this was checked. This is a packaging/export
gap, not a code defect — there's nothing to "fix" in the source, since the
dependency declaration itself has never been wrong.

**Action for this package:** verify (don't just assume) that
`package.json` and `package-lock.json` both still correctly declare
`js-yaml` and `@types/js-yaml` as devDependencies with resolvable, pinned
versions. If they're correct (expected, given every prior check), no code
change is needed — note this explicitly in the summary rather than
inventing an unnecessary workaround (e.g. do not remove the `js-yaml`
dependency or replace it with a hand-rolled YAML check just to route
around an export-tooling issue that has nothing to do with the dependency
itself).

## 4. Files to Modify

```
khedrax/src/workflow/checkpoint.ts       (NEW — relocated from cli/utils/)
khedrax/src/cli/utils/checkpoint.ts      (DELETE)
khedrax/src/workflow/runner.ts           (MODIFY: updated import path)
khedrax/src/cli/commands/create.ts       (MODIFY: updated import path,
                                           plus persona option threading)
khedrax/src/dna/schema.ts                (MODIFY: CreateAgentOptions gains
                                           persona?: string)
khedrax/src/dna/loader.ts                (MODIFY: seed persona.presetName
                                           from options.persona before the
                                           agentType-default merge)
khedrax/src/cli/bin/khedrax.ts           (MODIFY: parse --persona flag)
khedrax/tests/unit/*.test.ts             (MODIFY only where an import path
                                           to the old checkpoint.ts location
                                           needs updating; NEW test for the
                                           --persona override scenario)
```

Do not touch any engine (`src/engines/`), `src/generation/`, `src/persona/`,
`src/prompt/`, `src/registry/`, or `src/validation/` — none of the three
items in this package should require changes there. If one seems to, stop
and explain why before proceeding.

## 5. Acceptance Criteria

1. `grep -r "cli/utils/checkpoint" khedrax/src khedrax/tests` returns zero
   results; `src/cli/utils/checkpoint.ts` no longer exists;
   `src/workflow/checkpoint.ts` does.
2. Every existing checkpoint/resume-related test passes unmodified after
   the relocation.
3. `khedrax create SupportBot --type customer-support --persona
   friendly-assistant --modules memory --force` produces a generated
   project whose behavior (verify via whatever currently surfaces
   persona data — `agent.yaml`'s `persona:` section at minimum) reflects
   `friendly-assistant`, not `professional-support`. Paste the actual
   `agent.yaml` content.
4. Omitting `--persona` entirely on the same command still falls back to
   `customer-support`'s own default (`professional-support`) exactly as
   before — paste that output too, to show the flag is additive, not a
   regression on the no-flag case.
5. `package.json`/`package-lock.json`'s `js-yaml`/`@types/js-yaml` entries
   are confirmed correct (or fixed, if somehow they aren't) — state which,
   explicitly, in the summary.
6. `npm test` and `npm run typecheck` both pass — paste raw terminal
   output directly.
7. No file under `src/engines/`, `src/generation/`, `src/persona/`,
   `src/prompt/`, `src/registry/`, or `src/validation/` was modified —
   confirm by diffing those directories against the pre-package state.
