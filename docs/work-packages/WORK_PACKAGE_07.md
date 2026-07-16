# KhedraX Work Package #7
### Packaging Engine — dependency manifest, hardened standalone scan

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.0, `SYSTEM_ARCHITECTURE.md` v1.0
(Packaging Engine entries updated for this package), `WORK_PACKAGE_01.md`.
This prompt is implementation-ready. Do not make architectural decisions.

This package deepens an existing engine in place (Constitution #11).
Packaging Engine has been at its Work Package #1 minimum-viable level since
the very first package: atomic overwrite protection and a recursive
substring scan for the literal string `khedrax`. This package adds the
dependency manifest the ownership matrix already specified from day one but
was never implemented, and hardens the standalone scan against a failure
mode this project has already hit once for real: a stale, hardcoded
absolute build-time path leaking into checked-in module data (found and
fixed during Work Package #2's review — `modules/memory/module.json`'s
`path` field).

Do not touch Template Engine, Module Engine, Persona Engine, Prompt Engine,
Memory Engine, Documentation Engine, or the fixed producer-invocation
order. This package does require one small, necessary exception to "don't
touch anything else": `GenerationContext` and `commands/create.ts` need a
new field threaded through so Packaging Engine knows the KhedraX
installation root path (see §3). That's the only permitted change outside
`packagingEngine.ts` itself and its test file.

---

## 1. Engineering Objective

Two additions to `PackagingEngine.run()`:
1. Write a deterministic `PACKAGE_MANIFEST.json` into the project (agent
   name, type, version, buildId, and the resolved module list with
   versions) before the standalone scan and atomic commit.
2. Harden `scanForKhedraXReferences()` to also reject any file containing
   the KhedraX installation's own absolute root path (not just the literal
   string `khedrax`), and to skip `.git`/`node_modules` directories during
   the recursive file walk.

## 2. Why This Exists

The ownership matrix has said "generating a dependency manifest for the
generated project" since Work Package #1 — it was simply never built. And
the standalone scan's only check (a case-insensitive substring match on
"khedrax") would **not** have caught the exact real bug this project
already produced once: a module's checked-in `module.json` containing a
literal absolute filesystem path back to the KhedraX repo
(`/workspaces/KhedraX/khedrax/modules/memory`). That specific instance was
harmless because the registry loader overwrites the field at load time —
but Packaging Engine's entire job is to be the last line of defense against
exactly this class of leakage, and right now it has no way to catch it if
a future module or template author makes the same mistake somewhere the
loader doesn't overwrite.

## 3. Architecture Boundaries

- Packaging Engine still never renders templates, resolves modules, or
  computes anything Persona/Prompt/Module Engine already computed — the
  manifest is assembled from data those engines already produced
  (`context.dna`, `context.artifacts.module.resolvedModuleDescriptors`),
  not recomputed.
- The manifest must be **deterministic** (Constitution #6) — no wall-clock
  timestamp, no random values beyond what's already in `dna.buildId`. Do
  not add a `generatedAt` field or similar.
- The manifest must **never mention KhedraX** — it describes the agent's
  own composition (name, type, version, modules), not the tool that built
  it. A field like `"generatedBy": "KhedraX"` would violate Constitution
  #14 and would (correctly) cause the engine's own standalone scan to
  reject its own output — don't write anything the scan wouldn't accept
  from any other file in the project.
- The one permitted change outside `packagingEngine.ts`: `GenerationContext`
  (in `src/generation/types.ts`) gains a `khedraxRootDir: string` field,
  populated in `commands/create.ts` from the same `rootDir` parameter
  already used to load the registry (`getRegistrySnapshot(rootDir)`) — do
  not introduce a second, different way of locating the KhedraX root.
  `generationEngine.ts` threads this field into the `PackagingOptions` it
  passes to Packaging Engine, alongside the existing `dna` and resolved
  module data it needs to add.

## 4. Files to Modify

```
khedrax/src/generation/types.ts        (MODIFY: add khedraxRootDir to GenerationContext)
khedrax/src/cli/commands/create.ts     (MODIFY: populate khedraxRootDir from the existing rootDir param)
khedrax/src/generation/generationEngine.ts  (MODIFY: pass dna, resolvedModuleDescriptors,
                                              and khedraxRootDir into PackagingOptions)
khedrax/src/engines/packagingEngine.ts (MODIFY: manifest generation + hardened scan)
khedrax/tests/unit/packagingEngine.test.ts  (MODIFY/EXTEND: existing file already
                                              tests standalone rejection — add manifest
                                              and path-leakage coverage here)
```

## 5. Data Shape

**`PACKAGE_MANIFEST.json`** (written to the project root, alongside
`agent.yaml`):
```json
{
  "name": "SupportBot",
  "agentType": "customer-support",
  "agentVersion": "1.0.0",
  "buildId": "build-1234567890",
  "modules": [
    { "name": "memory", "version": "1.0.0" }
  ]
}
```
`modules` array sorted alphabetically by name (matching the ordering
convention already used everywhere else in this system — Prompt Engine's
instruction ordering, Documentation Engine's module subsections).

**`PackagingOptions` additions:**
```typescript
export interface PackagingOptions {
  tempDir: string;
  outputDir: string;
  name: string;
  force?: boolean;
  // NEW:
  dna: AgentDNA;
  resolvedModuleDescriptors: Array<{ name: string; version: string }>;
  khedraxRootDir: string;
}
```

## 6. Implementation Requirements

1. **Manifest generation** (new private method, e.g. `buildManifest()`):
   build the object in §5's shape from `options.dna` and
   `options.resolvedModuleDescriptors`, `JSON.stringify(..., null, 2) + '\n'`,
   write to `path.join(options.tempDir, 'PACKAGE_MANIFEST.json')` **before**
   `scanForKhedraXReferences()` runs — the manifest itself must pass the
   standalone scan like every other file (it will, by construction, since
   it never mentions KhedraX).
2. **Hardened scan:** extend `scanForKhedraXReferences()`'s per-file check
   to also test `content.includes(options.khedraxRootDir)` — if a file's
   content contains the literal KhedraX installation root path, reject
   with a reason distinguishing this case from the existing substring
   checks (e.g. `found leaked build-time path in {relativePath}` vs. the
   existing `found reference in {relativePath}`).
3. **Directory skip:** in `collectFiles()`, skip recursing into any
   directory named `.git` or `node_modules` — these should never appear in
   a freshly generated project today, but skipping them is cheap defensive
   hardening against scanning irrelevant or enormous trees if that ever
   changes.
4. Do not change the existing rejection behavior for the literal `khedrax`
   / `@khedrax/` / `khedrax-runtime` checks — only add the new path-leakage
   check alongside them.

## 7. Edge Cases

- `khedraxRootDir` itself must never accidentally appear in the generated
  manifest or any other legitimately-generated file — if it ever did, the
  engine's own scan would (correctly) reject its own output. This should
  never happen if `buildManifest()` only uses `dna` and module name/version
  data, never any filesystem path.
- A resolved module with no `version` field (shouldn't happen given every
  module's `module.json` requires one, but if the registry ever returns
  `undefined`) — fall back to `"0.0.0"` rather than writing `undefined`
  into the manifest's JSON (which would produce invalid JSON via
  `JSON.stringify` silently omitting the key, which is arguably fine, but
  be deliberate: decide and document which behavior you chose).
- Zero resolved modules: `"modules": []` in the manifest — valid, expected,
  matches the same "empty array, not omitted" convention used everywhere
  else in this system's JSON output.
- The `khedraxRootDir` check must not produce false positives against
  legitimately similar-looking paths — it should be an exact substring
  match against the real root path string, not a fuzzy or partial-segment
  match (e.g. don't match just the word `khedrax` again here — that's
  already covered by the existing check; this new check is specifically
  about the *installation's absolute path*, which could theoretically not
  contain the word "khedrax" at all, e.g. if someone cloned the repo into
  a differently-named directory — test this explicitly, don't assume the
  two checks are redundant).

## 8. Required Tests

Extend `packagingEngine.test.ts` with, at minimum:
1. A successful packaging run asserts `PACKAGE_MANIFEST.json` exists in the
   output and matches the expected shape exactly (`assert.deepEqual`, not a
   loose check) for a DNA with at least one module.
2. Zero modules produces `"modules": []` in the manifest.
3. A file in the temp directory containing the (test-provided)
   `khedraxRootDir` value, but **not** containing the literal word
   "khedrax" anywhere (construct the test's root path value deliberately
   without that substring, e.g. a path like `/opt/build-env-7`), is
   rejected by the hardened scan — this is the test that proves the new
   check is independent of the existing substring checks, not redundant
   with them.
4. The existing standalone-rejection test (literal "khedrax" string) still
   passes unmodified.
5. `.git`/`node_modules` directories (if manually created in a test's temp
   fixture) are not descended into — verify by placing a file inside one
   that *would* fail the scan if read, and confirming packaging still
   succeeds.

## 9. Acceptance Criteria

1. `khedrax create SupportBot --type customer-support --modules memory
   --force` (the standing verification command) produces a
   `PACKAGE_MANIFEST.json` with the correct name, type, version, buildId,
   and `[{"name": "memory", "version": "1.0.0"}]`. Paste the actual file
   content.
2. A generated project's `PACKAGE_MANIFEST.json` and every other file
   still passes the existing standalone guarantee — re-run the "no khedrax
   string anywhere" check from earlier rounds against a fresh generation
   and confirm.
3. The new path-leakage test (§8 item 3) passes and would fail against the
   pre-Work-Package-#7 scan implementation (i.e. it's testing genuinely new
   behavior, not something the old substring check already happened to
   catch).
4. `npm test` and `npm run typecheck` both pass — paste raw terminal output
   directly.
5. No file outside the five listed in §4 (plus the manifest test
   extensions) was modified — confirm by diffing `src/engines/` (other than
   `packagingEngine.ts`), `src/persona/`, `src/prompt/`, `src/dna/` (other
   than nothing, this package shouldn't touch DNA schema at all — verify),
   and `src/registry/` against the pre-package state.

