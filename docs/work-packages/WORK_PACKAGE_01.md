# KhedraX Work Package #1
### DNA System + Registry System + Workflow Engine + Generation Engine
### (orchestrating Template Engine + Module Engine, with Persona/Prompt/Memory/
### Documentation/Packaging Engines present as real stub/minimal implementations)

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.0, `SYSTEM_ARCHITECTURE.md` v1.0.
This prompt is implementation-ready. Do not make architectural decisions —
every decision has already been made in the two governing documents above.
Where this prompt is silent, consult those documents before improvising.

---

## 1. Engineering Objective

Implement the full generation pipeline for KhedraX from `khedrax create <Name>`
down to a written, standalone project on disk — with every engine from the
System Architecture Overview represented in code at its correct dependency
position, even where its v1 behavior is intentionally minimal.

## 2. Why This Exists

This is the foundation every later work package (deepening Persona Engine,
Prompt Engine, adding real modules, etc.) plugs into. Per Constitution #11
("build the core before the capability") and #13 ("composition over
specialization"), nothing in this package may contain logic specific to any
one agent type or module — that knowledge lives entirely in `agentTypes/`
and `modules/` data, discovered at runtime by the Registry System.

## 3. Architecture Boundaries (non-negotiable — see ownership matrix)

- The CLI never validates business rules or writes generated files.
- The Workflow Engine never knows what a step does internally.
- The Generation Engine never renders templates or resolves modules itself —
  it only orchestrates Template Engine, Module Engine, Persona Engine,
  Prompt Engine, Memory Engine, and Documentation Engine, then hands the
  result to Packaging Engine.
- No engine other than Packaging Engine may write to the final `outputDir`.
  All producer engines write into a temp directory; Packaging Engine commits
  it atomically.
- Persona Engine, Prompt Engine, Memory Engine, and Documentation Engine
  **must exist as real, callable, tested modules in this work package**,
  even though their v1 logic is intentionally thin (see §6). They are not
  placeholders — a placeholder violates Constitution #10. A thin-but-real
  implementation does not.
- Generated projects must contain zero references to KhedraX (no imports,
  no `package.json` dependency, no comment mentioning the generator) —
  Packaging Engine enforces this as a hard gate (Constitution #14).

## 4. Folder Structure to Create

```
khedrax/
├── src/
│   ├── cli/
│   │   ├── bin/khedrax.ts
│   │   ├── index.ts
│   │   ├── commands/create.ts
│   │   └── utils/checkpoint.ts
│   ├── workflow/
│   │   ├── runner.ts
│   │   └── createAgentWorkflow.ts
│   ├── dna/
│   │   ├── schema.ts
│   │   ├── defaults.ts
│   │   └── loader.ts
│   ├── registry/
│   │   ├── types.ts
│   │   ├── agentTypeRegistry.ts
│   │   └── moduleRegistry.ts
│   ├── validation/
│   │   └── validateDna.ts
│   ├── generation/
│   │   ├── types.ts
│   │   └── generationEngine.ts
│   └── engines/
│       ├── templateEngine.ts
│       ├── moduleEngine.ts
│       ├── personaEngine.ts
│       ├── promptEngine.ts
│       ├── memoryEngine.ts
│       ├── documentationEngine.ts
│       └── packagingEngine.ts
├── agentTypes/
│   ├── basic/agentType.json
│   ├── research/agentType.json
│   └── customer-support/agentType.json
├── modules/
│   └── memory/
│       ├── module.json
│       ├── implementation/README.md
│       ├── configuration/default.json
│       ├── prompts/fragment.md
│       └── tests/README.md
├── templates/agent-base/
│   ├── agent.yaml.template
│   ├── README.md.template
│   ├── docs/README.md
│   ├── src/README.md
│   ├── skills/README.md
│   ├── memory/README.md
│   ├── tools/README.md
│   ├── workflows/README.md
│   ├── prompts/README.md
│   ├── tests/README.md
│   ├── deployment/README.md
│   └── configuration/README.md
└── tests/unit/
    ├── dna.test.ts
    ├── registry.test.ts
    ├── validateDna.test.ts
    ├── generationEngine.test.ts
    ├── packagingEngine.test.ts
    └── createWorkflow.e2e.test.ts
```

Only one module (`memory`) ships in v1, to prove the Module Engine's
generic-loading contract without needing every module built yet.

## 5. Core Interfaces

```typescript
// src/dna/schema.ts
export interface AgentDNA {
  buildId: string;
  name: string;
  description?: string;
  agent: {
    type: string;      // validated against Registry System at runtime, not a union type
    version: string;
  };
  persona: Record<string, unknown>;
  modules: string[];
  memory: Record<string, unknown>;
  tools: Record<string, unknown>;
  workflows: Record<string, unknown>;
  deployment: Record<string, unknown>;
  testing: Record<string, unknown>;
}

// src/registry/types.ts
export interface AgentTypeDescriptor {
  name: string;
  version: string;
  defaultModules: string[];
  description?: string;
}
export interface ModuleDescriptor {
  name: string;
  version: string;
  path: string;              // absolute path to the module directory
  requiresMemory?: boolean;
}
export interface RegistrySnapshot {
  agentTypes: Record<string, AgentTypeDescriptor>;
  modules: Record<string, ModuleDescriptor>;
}

// src/validation/validateDna.ts
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// src/generation/types.ts
export interface GenerationContext {
  dna: AgentDNA;
  registry: RegistrySnapshot;
  tempDir: string;                          // in-progress project directory
  artifacts: Record<string, unknown>;       // keyed by producer engine name
}
export interface ProducerResult {
  artifacts?: Record<string, unknown>;
}
export interface ProducerEngine {
  name: string;
  run: (context: GenerationContext) => Promise<ProducerResult>;
}

// src/engines/packagingEngine.ts
export interface PackagingResult {
  outputPath: string;
  standalone: boolean;
}

// src/workflow/runner.ts (unchanged shape from prior design, still governs Workflow Engine)
export interface StepResult { artifacts?: Record<string, unknown>; }
export interface WorkflowStep {
  name: string;
  fn: (checkpoint: Checkpoint) => Promise<StepResult>;
  skip?: boolean;
}
export interface Checkpoint {
  buildId: string;
  completed: string[];
  artifacts: Record<string, unknown>;
}
```

## 6. Inputs / Outputs Per Engine

- **CLI** — Input: `khedrax create <Name> --type <agentType> --output <dir> [--modules a,b] [--force] [--resume <buildId>] [--verbose]`. Output: a draft `AgentDNA`, handed to the Workflow Engine.
- **DNA System** — Input: CLI draft + selected `AgentTypeDescriptor.defaultModules` (merged with any `--modules` override, union not replacement unless `--modules-exact`). Output: complete `AgentDNA` object, and later, `agent.yaml` written into the project by the Template Engine using DNA System's serializer.
- **Registry System** — Input: `agentTypes/` and `modules/` directory trees. Output: `RegistrySnapshot`, computed once per run and passed down through `GenerationContext`.
- **Validation Engine** — Input: draft `AgentDNA` + `RegistrySnapshot`. Output: `ValidationResult`; a non-valid result halts the Workflow Engine before Generation Engine ever runs.
- **Generation Engine** — Input: validated `AgentDNA` + `RegistrySnapshot`. Output: a committed project directory (via Packaging Engine). Internally invokes producer engines in this fixed order: Template → Module → Persona → Prompt → Memory → Documentation.
- **Template Engine** — Input: `templates/agent-base/**`, `AgentDNA`. Output: rendered scaffold (all 11 top-level folders from the KhedraX spec, `agent.yaml`, `README.md`) written into `tempDir`.
- **Module Engine** — Input: `AgentDNA.modules`, `RegistrySnapshot.modules`. Output: each selected module's `implementation/`, `configuration/`, `prompts/`, `tests/` merged into `tempDir`, plus an artifact `{ resolvedModules: ModuleDescriptor[] }` for downstream engines.
- **Persona Engine (v1: pass-through)** — Input: `AgentDNA.persona`. Output: artifact `{ persona: AgentDNA['persona'] }`, unchanged — no file writes of its own.
- **Prompt Engine (v1: verbatim assembly)** — Input: Persona Engine's artifact + each resolved module's `prompts/fragment.md`. Output: `prompts/README.md` in `tempDir`, concatenating fragments under module-name headers. No LLM calls, no rewriting.
- **Memory Engine (v1: shape-only scaffold)** — Input: `AgentDNA.memory`, resolved modules' `requiresMemory` flags. Output: `memory/README.md` in `tempDir` listing configured shape; no backend implementation code.
- **Documentation Engine (v1: static-template)** — Input: final `AgentDNA`, resolved modules, Persona Engine artifact. Output: `README.md` in `tempDir` describing name, type, and module list; templated, not generated prose.
- **Packaging Engine** — Input: fully-assembled `tempDir`. Output: `PackagingResult`; performs the standalone-reference scan (§3), then atomically renames `tempDir` to `outputDir/<name>`.

## 7. Validation Requirements

- `AgentDNA.name`: PascalCase, 3–50 chars, not a reserved word (`test`, `khedrax`, `node_modules`).
- `AgentDNA.agent.type` must exist in `RegistrySnapshot.agentTypes` — Registry System, not a hardcoded union, is the source of truth.
- Every entry in `AgentDNA.modules` must exist in `RegistrySnapshot.modules`; unknown modules are a validation error, not a warning.
- Node.js < 18 aborts before any file I/O.
- `outputDir/<name>` must not already exist as a non-empty directory unless `--force` is passed.
- Packaging Engine must reject (and roll back) any generated output containing the case-insensitive string `khedrax` in a `package.json` dependency field, or any import path containing `@khedrax/` or `khedrax-runtime` — this is the automated enforcement of Constitution #14.

## 8. Edge Cases

- `--resume <buildId>` after a mid-generation crash must skip only the steps recorded complete in the checkpoint, and must not re-invoke Packaging Engine's standalone scan on an already-committed project.
- A module in `AgentDNA.modules` that sets `requiresMemory: true` but `AgentDNA.memory` is empty must produce a validation **warning**, not an error — Memory Engine still scaffolds a minimal shape.
- Two modules that both write to the same relative path (e.g. both ship a `configuration/default.json`) must cause the Module Engine to fail generation loudly, not silently overwrite — this is a Module Engine responsibility, not Packaging Engine's.
- If `agentTypes/` or `modules/` contains a directory with a malformed or missing `agentType.json`/`module.json`, Registry System must exclude it from the snapshot and log a warning, not crash the whole discovery pass.
- Killing the process between Module Engine and Persona Engine, then resuming, must not re-run Template Engine or Module Engine (already checkpointed) but must still run Persona Engine through Packaging Engine in order.

## 9. Acceptance Criteria

1. `khedrax create SupportBot --type customer-support` produces a complete, standalone project at the expected path with a fully populated `agent.yaml` (all top-level DNA sections present, several legitimately empty per Constitution #9), a rendered `README.md`, and the `memory` module's files merged in because `customer-support`'s `agentType.json` declares it as a default module.
2. Deleting any one of Persona Engine, Prompt Engine, Memory Engine, or Documentation Engine from the orchestration order causes a Generation Engine unit test to fail — proving they are wired in, not optional.
3. A generated project passes a standalone-dependency scan with zero KhedraX references, verified by an automated test that `grep`s the output for `khedrax`.
4. Adding a brand-new `agentTypes/support-plus/agentType.json` (with no corresponding source-code change) is immediately usable via `--type support-plus` — proving Registry System discovery, not a hardcoded union.
5. Killing the process after Module Engine completes and resuming via `--resume` completes successfully with no duplicated or corrupted files, verified by a checksum comparison against a non-interrupted run.
6. Running `create` twice without `--force` exits non-zero and leaves the first run's output untouched.
7. Unit tests exist and pass for: DNA validation (valid/invalid name, type, modules), Registry discovery (including malformed-entry skip), Generation Engine orchestration order, and Packaging Engine's standalone-scan rejection path.
8. No `TODO`, `PLACEHOLDER`, or stub function bodies that silently no-op without being named and documented as intentional v1 pass-throughs per §6.
