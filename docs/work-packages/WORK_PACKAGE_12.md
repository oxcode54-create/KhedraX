# KhedraX Work Package #12
### Dogfooding — generate tools that develop KhedraX itself

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.1, `SYSTEM_ARCHITECTURE.md` v1.1,
`VERSIONING_POLICY.md`, `CHANGELOG.md`, `WORK_PACKAGE_10.md` (the
registry-growth pattern this package repeats once more, at smaller scale).
**Targets: Architecture v1.x** — pure registry growth, same classification
as Work Package #10 and #11's registry additions.

This is the capstone of the roadmap: *"If KhedraX can reliably generate
tools that improve KhedraX, that's a strong signal the architecture is
practical."* The signal comes from **reliable generation**, not from
actually deploying these tools into KhedraX's live CI — that would be a
separate, later integration effort. This package's job is to generate all
five tools correctly as standalone projects and prove it with integration
tests, exactly as Work Package #10 did for the business-agent portfolio.

---

## 1. Engineering Objective

Add the registry entries needed to generate five dev-tooling agents, each
one meant to operate on KhedraX's own repository and conventions (not a
generic example — reference this project's actual files where it makes
the generated agent's persona/constraints more concrete, e.g. tying the
changelog generator's constraints to `CHANGELOG.md`'s actual established
format from Work Package #11). Generate each as a real project via
`createAgent()` and turn each generation into a permanent integration
test, the same as Work Package #10.

## 2. Scoping Decisions (same reasoning as Work Package #10 §2 — read before starting)

- No engine changes expected. If one seems necessary, stop and explain why
  before making it — that's the trigger condition, not a formality.
- No workflow templates or deployment targets — same as every prior
  package, `dna.workflows`/`dna.deployment` stay empty `{}`.
- Generated tool projects are **not** committed into the repo as static
  output — like every prior work package's example generations, they're
  produced fresh by `createAgent()` inside tests and verified there. What's
  permanent is the registry data (new agentTypes/personas/modules) and the
  tests themselves, not a snapshotted copy of one generation's output,
  which would go stale immediately.
- **One of the five tools needs zero new registry entries at all** —
  Documentation Updater is a direct reuse of `documentation-assistant`,
  the agentType Work Package #10 already built. Confirm this by generating
  it with no new data before assuming any addition is needed for it.

## 3. Portfolio Mapping

| Tool | agentType | persona | modules |
|---|---|---|---|
| Release Note Writer | `release-note-writer` (NEW) | `audience-focused-narrator` (NEW) | `github` (existing) |
| Documentation Updater | `documentation-assistant` (**existing, Work Package #10 — zero new registry entries**) | `clear-communicator` (existing) | `rag`, `github` (existing) |
| GitHub Triage Assistant | `github-triage-assistant` (NEW) | `efficient-triager` (NEW) | `github`, `memory` (existing) |
| Changelog Generator | `changelog-generator` (NEW) | `terse-technical-logger` (NEW) | `github` (existing) |
| Test Report Analyzer | `test-report-analyzer` (NEW) | `diagnostic-analyst` (NEW) | `test-analysis` (NEW module), `memory` (existing) |

Four of five reuse only existing modules; one needs a genuinely new
module, the same 4:1 ratio Work Package #10 established between reuse and
real growth.

## 4. New Registry Data

**`agentTypes/release-note-writer/agentType.json`:**
```json
{
  "name": "release-note-writer",
  "version": "1.0.0",
  "defaultModules": ["github"],
  "persona": { "presetName": "audience-focused-narrator" }
}
```

**`personas/audience-focused-narrator/persona.json`:**
```json
{
  "name": "audience-focused-narrator",
  "version": "1.0.0",
  "tone": "warm",
  "traits": ["narrative", "audience-aware", "concise"],
  "constraints": [
    "Never include internal implementation details a general user wouldn't care about.",
    "Always group changes by user-facing impact, not by internal component."
  ],
  "escalationPolicy": "Escalate to a human writer when a change's user-facing impact is unclear from the commit history alone."
}
```

**`agentTypes/github-triage-assistant/agentType.json`:**
```json
{
  "name": "github-triage-assistant",
  "version": "1.0.0",
  "defaultModules": ["github", "memory"],
  "persona": { "presetName": "efficient-triager" }
}
```

**`personas/efficient-triager/persona.json`:**
```json
{
  "name": "efficient-triager",
  "version": "1.0.0",
  "tone": "efficient",
  "traits": ["organized", "prioritizing", "responsive"],
  "constraints": [
    "Never close an issue without a clear reason stated.",
    "Never assign a label without evidence from the issue's content."
  ],
  "escalationPolicy": "Escalate to a human maintainer for any issue reporting a security vulnerability or data loss."
}
```

**`agentTypes/changelog-generator/agentType.json`:**
```json
{
  "name": "changelog-generator",
  "version": "1.0.0",
  "defaultModules": ["github"],
  "persona": { "presetName": "terse-technical-logger" }
}
```

**`personas/terse-technical-logger/persona.json`:**
```json
{
  "name": "terse-technical-logger",
  "version": "1.0.0",
  "tone": "terse",
  "traits": ["precise", "consistent", "structured"],
  "constraints": [
    "Never omit a breaking change from the log.",
    "Always follow the project's existing changelog format exactly — see CHANGELOG.md's own template for the required version header, work-package reference, and description shape."
  ],
  "escalationPolicy": "Escalate to a human maintainer when a change's version classification (v1.x vs v2.0, per VERSIONING_POLICY.md) is ambiguous."
}
```

**`agentTypes/test-report-analyzer/agentType.json`:**
```json
{
  "name": "test-report-analyzer",
  "version": "1.0.0",
  "defaultModules": ["test-analysis", "memory"],
  "persona": { "presetName": "diagnostic-analyst" }
}
```

**`personas/diagnostic-analyst/persona.json`:**
```json
{
  "name": "diagnostic-analyst",
  "version": "1.0.0",
  "tone": "analytical",
  "traits": ["precise", "pattern-seeking", "concise"],
  "constraints": [
    "Always distinguish between a new failure and a pre-existing known-flaky test.",
    "Never speculate about root cause without citing the specific error output."
  ],
  "escalationPolicy": "Escalate to a human when a failure pattern spans multiple unrelated test files, suggesting an environment issue rather than a code defect."
}
```

## 5. One New Module

**`modules/test-analysis/module.json`:**
```json
{
  "name": "test-analysis",
  "version": "1.0.0",
  "capabilities": [
    "Parse structured test run output (pass/fail/skip counts, failure messages).",
    "Identify flaky tests across multiple recent runs."
  ],
  "constraints": [
    "Never mark a test as flaky based on a single failure.",
    "Never hide a failing test from the summary regardless of its historical pass rate."
  ]
}
```
`configuration/default.json`: `{ "flakyThreshold": 3, "lookbackRuns": 10 }`
`prompts/fragment.md`: `This module provides test-report analysis scaffolding: parsing structured test run output and identifying flaky tests across recent runs.`
`prompts/fragment.meta.json`: `{ "section": "instructions", "priority": 0, "exclusive": false }`
`implementation/README.md` / `tests/README.md`: same "v1 scaffold — configuration and prompt fragment only; no runtime implementation yet" wording pattern from every prior new module (not "placeholder").

## 6. Required Tests

One integration test per tool (5 total, in a new `tests/unit/dogfood.test.ts`,
reusing Work Package #10's fixture/assertion pattern exactly):
1. Confirm Documentation Updater generates correctly using **only**
   existing registry data (`--type documentation-assistant`, no new
   modules/personas referenced) — this is the test that proves §2's reuse
   claim, not just an assertion in prose.
2. The other four each: generate via `createAgent()` with their real
   `--type`, assert `agent.yaml`'s `agent.type`/`persona.presetName`/
   `modules`, assert `docs/README.md` reflects the persona's tone and
   every module's capabilities/constraints, assert `prompts/README.md`
   composes correctly.
3. Test Report Analyzer specifically: confirm `test-analysis`'s
   capabilities appear correctly alongside `memory`'s, with no collision
   (same composition-at-scale proof Work Package #4/#10 already
   established, now for this specific new module).

## 7. Reflection Requirement

Per this package's own stated purpose, this is meant to be a real test of
the architecture's practicality, not just five more portfolio entries.
While generating these five tools, if anything reveals a genuine gap the
same way Work Package #2's persona-wiring gap or Work Package #8's
duplicate-module gap were found through actual use — report it explicitly
as a finding in the summary, even if you work around it for this package's
own purposes. Do not silently patch around a discovered architectural gap
without naming it; that's the same discipline every prior review round in
this project has applied when checking work, now applied by the person
doing the work.

## 8. Deliverables

1. Updated registries (§4, §5).
2. `tests/unit/dogfood.test.ts` (§6).
3. **`docs/DOGFOOD_CAPABILITY_MATRIX.md`** (new file, repo root `docs/`) —
   same shape as `docs/PORTFOLIO_CAPABILITY_MATRIX.md` from Work Package
   #10, for these five tools.
4. A `CHANGELOG.md` entry for this package (v1.1 → v1.2), following the
   file's own template exactly — given the CHANGELOG formatting history
   from Work Package #11, verify with the same byte-level checks
   (`head -c 1 CHANGELOG.md`, checking for no lines with more than 2
   leading spaces) before reporting this as done, not just a visual read.

## 9. Acceptance Criteria

1. All five tools generate successfully. Paste the real `agent.yaml`
   content for: Documentation Updater (proving zero-new-data reuse),
   Changelog Generator (references this project's own conventions), and
   Test Report Analyzer (exercises the new module).
2. All tests from §6 pass, including the Documentation Updater
   zero-new-registry-data proof.
3. `docs/DOGFOOD_CAPABILITY_MATRIX.md` exists and matches §3.
4. Zero files under `src/` were modified — confirm independently (diff
   against the pre-package state), the same primary proof Work Package
   #10 required.
5. `npm test` and `npm run typecheck` both pass — paste raw terminal
   output directly.
6. `CHANGELOG.md`'s formatting is verified byte-level correct, not just
   visually — paste the exact verification command output.
7. Any finding from §7's reflection requirement is stated explicitly in
   the summary, even if none were found ("no architectural gaps surfaced
   during this package" is an acceptable and expected answer, not a
   requirement to manufacture a finding).

