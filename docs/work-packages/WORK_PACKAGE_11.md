# KhedraX Work Package #11
### Plugin Ecosystem — external registry directories,
### collision handling, plugin authoring guide

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.0, `SYSTEM_ARCHITECTURE.md` v1.0
(Registry System entries updated for this package), `VERSIONING_POLICY.md`,
`WORK_PACKAGE_10.md` (the registry-growth precedent this package makes
externally reusable). **Targets: Architecture v1.x — no version bump
required.** This is an additive extension of Registry System's existing
ownership (discovery from the filesystem) to additional filesystem
locations — it doesn't change what Registry System owns, doesn't touch the
DNA schema, doesn't change the producer order, and a v1.0-generated
`agent.yaml` remains fully valid. Per `VERSIONING_POLICY.md` §2, this
qualifies as v1.x the same way personas (Work Package #2) and memory
backends (Work Package #6) did when they extended Registry System before.

This prompt is implementation-ready. Do not make architectural decisions.

Unlike Work Package #10, this package **does** touch Registry System's own
code — deliberately. That's the whole point: turning `agentTypes/`,
`modules/`, `personas/`, and `memoryBackends/` from "directories inside the
KhedraX repo" into "directories anywhere, that KhedraX also scans," so a
third party can extend KhedraX without ever touching its core.

---

## 1. Engineering Objective

Extend every registry loader (`agentTypeRegistry.ts`, `moduleRegistry.ts`,
`personaRegistry.ts`, `memoryBackendRegistry.ts`) to scan not just the
built-in root but an ordered list of additional **plugin roots** — external
directories shaped exactly like a (partial) copy of the built-in registry
layout. Add a CLI mechanism (`--plugin-path`, repeatable, plus a
`KHEDRAX_PLUGIN_PATH` environment variable) to supply them. Resolve name
collisions deterministically: built-ins always win, first-scanned plugin
wins over later ones, and every collision is logged as a warning, never
silently swallowed.

## 2. Why This Exists

Work Package #10 proved the architecture scales through registry data —
but every one of those additions still required editing files inside the
KhedraX repository itself. A genuine plugin ecosystem means a third party
can write a `module.json` + supporting files, publish that folder however
they like (a git repo, an npm package extracted to a local path, anything
that ends up as a directory on disk), and use it via KhedraX without a
pull request against KhedraX's own repo. This is the direct enabler for
the roadmap's next step (dogfooding) too — self-hosted tooling for KhedraX
development doesn't have to live inside KhedraX's own registries either.

## 3. Architecture Boundaries

- No new file format. A plugin root directory contains the same
  `agentTypes/`, `modules/`, `personas/`, `memoryBackends/` subdirectories,
  containing the same `agentType.json`/`module.json`/`persona.json`/
  `backend.json` (+ supporting files) shapes already established — a
  plugin author needs zero new documentation beyond what already describes
  the built-in shape, plus this package's authoring guide explaining
  *where* to put it and *how* to point KhedraX at it.
- Built-in roots are always scanned before any plugin root, and always win
  a name collision. A plugin can add a module named `crm`, but it can never
  cause `memory` (or any other built-in name) to resolve to plugin data —
  this is a hard, non-negotiable rule, not a configurable option.
- Among multiple plugin roots, first-listed-wins, with every subsequent
  collision (against a built-in or an earlier plugin) producing a logged
  warning — reusing the exact "skip and warn, don't crash the whole scan"
  pattern every registry loader already applies to a malformed entry. A
  collision is not treated as more severe than malformed data; it's the
  same category of "this one entry doesn't get used, everything else
  still loads."
- Validation Engine, Generation Engine, and every producer engine require
  **zero changes** — they already consume `RegistrySnapshot` generically,
  with no assumption about which directory an entry came from. If you find
  yourself needing to change any of them, stop and explain why; that would
  mean the registry abstraction has a gap this package should have
  avoided, not routed around.
- `getRegistrySnapshot()`'s existing signature gains an additive,
  default-empty parameter (`pluginRoots: string[] = []`) — every existing
  caller in the codebase and every existing test must continue to work
  completely unmodified without passing this parameter at all.

## 4. Files to Modify

```
khedrax/src/registry/
├── index.ts                  (MODIFY: getRegistrySnapshot gains
│                               pluginRoots param, passes to each loader)
├── agentTypeRegistry.ts      (MODIFY: scan built-in root + pluginRoots,
│                               in order, with collision handling)
├── moduleRegistry.ts         (MODIFY: same)
├── personaRegistry.ts        (MODIFY: same)
├── memoryBackendRegistry.ts  (MODIFY: same)
└── collisionPolicy.ts        (NEW: shared helper — given an ordered list
                                of {name, sourceRoot} candidates for a
                                registry category, returns the winning
                                entry per root plus a list of {name,
                                shadowedRoot, winningRoot} collision
                                warnings; all four loaders call this
                                instead of writing their own precedence
                                logic four times)

khedrax/src/cli/bin/khedrax.ts      (MODIFY: parse --plugin-path,
                                      repeatable; read KHEDRAX_PLUGIN_PATH)
khedrax/src/cli/commands/create.ts  (MODIFY: CreateAgentOptions gains
                                      pluginRoots?: string[], threaded to
                                      getRegistrySnapshot)

PLUGIN_AUTHORING_GUIDE.md   (NEW, repo root)
examples/example-plugin/    (NEW — a real, working example plugin living
                              entirely outside khedrax/agentTypes|modules|
                              personas|memoryBackends, proving the
                              mechanism without touching any built-in
                              registry)

khedrax/tests/unit/
├── collisionPolicy.test.ts       (NEW)
├── pluginDiscovery.test.ts       (NEW)
```

## 5. Collision Policy (implement exactly, do not redesign)

```typescript
// src/registry/collisionPolicy.ts
export interface CollisionCandidate<T> {
  name: string;
  descriptor: T;
  sourceRoot: string;   // absolute path this candidate was discovered under
}
export interface CollisionWarning {
  name: string;
  winningRoot: string;
  shadowedRoot: string;
}
export interface ResolvedRegistry<T> {
  entries: Record<string, T>;
  warnings: CollisionWarning[];
}

export function resolveCollisions<T>(
  candidatesInScanOrder: CollisionCandidate<T>[]
): ResolvedRegistry<T> {
  // candidatesInScanOrder is already ordered: built-in root's entries
  // first, then each plugin root's entries in the order pluginRoots was
  // given. For each name, the FIRST candidate encountered wins; every
  // later candidate with the same name produces a CollisionWarning and is
  // dropped. Do not throw — collisions are warnings, never generation-
  // halting errors, matching the malformed-entry-skip precedent.
}
```

Every registry loader builds its `candidatesInScanOrder` by scanning the
built-in root first (unchanged from today), then each `pluginRoots` entry
in the order given, and passes the combined list to `resolveCollisions()`.
Log each returned warning (e.g. via `console.warn`) the same way a
malformed entry is already logged today — don't introduce a second,
differently-formatted warning mechanism.

## 6. CLI / Options Additions

- `--plugin-path <dir>`: repeatable (each occurrence adds one directory,
  in the order given on the command line).
- `KHEDRAX_PLUGIN_PATH` environment variable: colon-separated (matching
  `PATH`/`NODE_PATH` convention), read once at CLI startup.
- Final `pluginRoots` order: environment variable entries first (in the
  order listed), then `--plugin-path` occurrences (in the order given on
  the command line) — this means a command-line flag can be added
  alongside a persistent environment-based configuration without one
  silently discarding the other, and the relative priority (env before
  flags) is a simple, documented, testable rule rather than an
  implementation accident.
- `CreateAgentOptions.pluginRoots?: string[]` — optional, defaults to `[]`
  if omitted, so nothing about existing option-construction call sites
  needs to change unless they want to supply plugin roots.

## 7. `examples/example-plugin/` — the proof

A real, minimal plugin package living entirely outside any of KhedraX's
own registry directories, containing exactly one new module (author's
choice — pick something that doesn't already exist, e.g. `calendar` or
`slack`, following the exact same `module.json` + `implementation/` +
`configuration/` + `prompts/` + `tests/` shape every built-in module
already uses). This is the deliverable that proves third-party extension
actually works, not just that the mechanism compiles.

## 8. Required Tests

1. `collisionPolicy.test.ts`: no collisions (all unique names) resolves
   everything; a built-in vs. plugin collision keeps the built-in and
   produces one warning; two plugin roots colliding keeps the first and
   warns about the second; verify the exact shape of `CollisionWarning`
   objects, not just their count.
2. `pluginDiscovery.test.ts`: using `examples/example-plugin/` as a real
   fixture (not a synthetic one — this is the actual deliverable from §7),
   confirm `getRegistrySnapshot(builtInRoot, [examplePluginRoot])` includes
   the plugin's new module alongside every built-in one; confirm a
   generation using `--plugin-path` pointed at that same fixture correctly
   produces a project using the plugin's module, via `createAgent()` (the
   real path), not just the registry snapshot in isolation.
3. A collision test using a synthetic plugin root that defines a module
   named `memory` (colliding with the real built-in) — confirm the
   built-in's `memory` is what's actually used in the resulting DNA/
   generated project, not the plugin's, and confirm a warning was logged.

## 9. Acceptance Criteria

1. `khedrax create PluginBot --type basic --modules <the example plugin's
   module name> --plugin-path examples/example-plugin --force` succeeds
   and the generated project reflects that plugin module's real
   capabilities/constraints/fragment content, exactly as if it were a
   built-in module. Paste the actual `agent.yaml` and relevant
   `docs/README.md` excerpt.
2. The same command without `--plugin-path` fails with the existing
   "module does not exist" validation error — proving the plugin module
   genuinely isn't discoverable without opting in, not accidentally always
   scanned.
3. The built-in-vs-plugin collision test from §8 item 3 passes.
4. `PLUGIN_AUTHORING_GUIDE.md` exists and is sufficient on its own for a
   third party to author and install a working plugin — it should cover:
   the required folder shape per category, where to put a plugin root,
   how `--plugin-path`/`KHEDRAX_PLUGIN_PATH` work and their precedence,
   and the collision rule (built-ins always win).
5. `npm test` and `npm run typecheck` both pass — paste raw terminal
   output directly.
6. Zero changes to any producer engine, Validation Engine, or Generation
   Engine — confirm by diffing `src/engines/`, `src/generation/`,
   `src/persona/`, `src/prompt/`, `src/validation/`, `src/dna/` against the
   pre-package state.
7. Add a `CHANGELOG.md` entry for this package per `VERSIONING_POLICY.md`
   §4 (version stays v1.x — this is a minor bump, e.g. v1.0 → v1.1;
   confirm what the current version is before incrementing, don't assume).

