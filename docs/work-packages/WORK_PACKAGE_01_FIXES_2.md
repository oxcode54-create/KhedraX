# KhedraX Work Package #1 — Closure Pass

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.0, `SYSTEM_ARCHITECTURE.md` v1.0,
`WORK_PACKAGE_01.md`, `WORK_PACKAGE_01_FIXES.md`. This is a small, targeted
pass to close out Work Package #1. Do not begin Work Package #2 scope.

The previous fix pass correctly implemented `buildCreateAgentStep()` and
wired the CLI through the Workflow Engine, but left the old hardcoded
workflow in place alongside it. This pass removes the duplication and closes
the two remaining correctness gaps.

---

## Must fix before closing Work Package #1

### 1. Remove the orphaned workflow implementation

- Delete `src/workflow/createAgentWorkflow.ts` entirely. It hardcodes
  `name: 'SupportBot'` and is not used by the real CLI path —
  `commands/create.ts`'s `buildCreateAgentStep()` is the only workflow entry
  point going forward.
- Search the repo for any remaining import of `createAgentWorkflow` and
  remove it. There must be exactly one function that builds a
  create-agent `WorkflowStep`: `buildCreateAgentStep()` in
  `commands/create.ts`.

### 2. Rewrite the e2e test against the real path

- Delete `tests/unit/createWorkflow.e2e.test.ts` in its current form (it
  imports the file being deleted in item 1).
- Replace it with a test that calls `createAgent()` directly — the actual
  production entry point — and asserts on the real generated output:
  the returned `outputPath` exists, contains `agent.yaml`, and passes a
  standalone-reference check (no `khedrax` string anywhere in the output).
  This can reuse the `copyFixture`/fixture-root pattern already established
  in `fixes.test.ts` rather than inventing a new one.

### 3. Fix the unsafe force default

- In `generationEngine.ts`, change:
  ```ts
  const effectiveForce = context.force ?? true;
  ```
  to:
  ```ts
  const effectiveForce = context.force ?? false;
  ```
- After this change, re-run the full suite and confirm nothing relied on
  the old default silently overwriting. In particular, check
  `generationEngine.test.ts` — it currently omits `force` from its context
  object — and confirm it still passes with the safe default. If it only
  passed before because of the unsafe default, add `force: true` explicitly
  to that test's context, since that test's actual purpose (verifying
  producer-engine wiring) has nothing to do with overwrite behavior and
  shouldn't depend on it implicitly.

---

## Good follow-up (not blocking Work Package #1 closure)

### 4. Relocate checkpoint ownership

- Move `src/cli/utils/checkpoint.ts` to `src/workflow/checkpoint.ts`.
  The Workflow Engine owns checkpoint persistence per the ownership
  matrix — it shouldn't reach into a CLI-specific path to do its own core
  job. Update the two import sites (`workflow/runner.ts`,
  `cli/commands/create.ts`) accordingly. This is a pure relocation — no
  behavior change, so the existing tests should pass unmodified once
  imports are updated.

### 5. Add a true kill-and-resume integration test

- Add a test (in `fixes.test.ts` or a new file) that: runs a real
  `createAgent()` generation via `buildCreateAgentStep()`'s underlying
  steps but stops after the `template` and `module` steps have completed
  (simulate the interruption by checkpointing after those two and not
  invoking the rest — the workflow's own checkpoint file is the natural
  place to control this, not a process kill), then resumes via
  `runWorkflow` with `--resume`-equivalent checkpoint loading through to
  completion.
- Compare the final output directory against a second, uninterrupted
  `createAgent()` run with identical DNA, using the existing
  `hashDirectory()` helper from `fixes.test.ts`. They must match exactly.
- This is the actual scenario AC#5 describes, not just the underlying
  skip-completed-steps mechanism the current resume test proves.

---

## Acceptance Criteria for Closure

1. `grep -r "createAgentWorkflow" khedrax/src khedrax/tests` returns zero
   results.
2. There is exactly one function in the codebase that constructs a
   create-agent `WorkflowStep`.
3. The e2e test exercises `createAgent()` and fails if `createAgent()` is
   broken — verified by temporarily breaking `createAgent()` and confirming
   the e2e test (and only the e2e test, not incidentally some other test)
   catches it.
4. `generationEngine.ts` defaults to `force: false` when unset; a new or
   existing test asserts that omitting `force` entirely refuses to
   overwrite an existing non-empty output directory.
5. `npm test` and `npm run typecheck` both pass with zero errors.
6. (Follow-up items 4–5, if completed) `checkpoint.ts` lives under
   `src/workflow/`, and a true kill-and-resume test produces
   checksum-identical output to an uninterrupted run.

Once items 1–3 are done and verified, Work Package #1 is closed. Items 4–5
can land in this pass or as a fast-follow — they don't block moving to
Work Package #2 (Persona Engine).

