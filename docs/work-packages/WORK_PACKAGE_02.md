# KhedraX Work Package #2
### Persona Engine — persona definitions, constraint derivation,
### capability mapping, behavioral profile generation

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.0, `SYSTEM_ARCHITECTURE.md` v1.0
(Persona Engine and Registry System entries updated for this package),
`WORK_PACKAGE_01.md`. This prompt is implementation-ready. Do not make
architectural decisions — every decision has already been made in the
governing documents. Where this prompt is silent, consult them.

This package deepens an existing engine in place (Constitution #11) — it does
not add a new seam to the Generation Engine's orchestration order. Persona
Engine already sits between Module Engine and Prompt Engine; this package
replaces its pass-through v1 body with a real implementation.

---

## 1. Engineering Objective

Replace Persona Engine's pass-through implementation with one that: resolves
a named persona preset from a new `personas/` registry, merges it with any
DNA-level overrides, derives a final list of behavioral constraints (from
both the persona and from modules that declare their own), maps each
resolved module's capabilities into agent-readable descriptions, and emits
a single `BehavioralProfile` artifact for Prompt Engine and Documentation
Engine to consume.

## 2. Why This Exists

Every future module (discord, rag, email, github, ...) will eventually need
to contribute a capability description and, often, a behavioral constraint
("never DM a user without consent," "never fabricate a search result") to
the generated agent's prompt. If that contribution logic is invented ad hoc
per module, KhedraX drifts into Hydra's early inconsistency. Building the
real merge/derivation logic once, now, means every module from Work Package
#4 onward only needs to *declare* capabilities and constraints in its
`module.json` — Persona Engine does the composition (Constitution #13).

## 3. Architecture Boundaries

- Persona Engine still never writes files directly. Its only output is the
  `BehavioralProfile` artifact placed in `GenerationContext.artifacts['personaEngine']`.
- Persona Engine never overrides or filters a module's declared capabilities
  — it may add human-readable framing, but the underlying capability list is
  Module Engine's data, treated as authoritative.
- Persona Engine does not decide which modules are included (that's DNA +
  Module Engine, already resolved by the time Persona Engine runs).
- Persona presets are pure data (`personas/*/persona.json`) — no persona
  behavior may be hardcoded in `personaEngine.ts` itself (Constitution #3).
- If `AgentDNA.persona.presetName` is omitted, Persona Engine must still
  produce a complete, valid `BehavioralProfile` using sensible defaults —
  never a partial or null profile (Constitution #9's "empty but valid"
  principle applies here too).

## 4. Folder Structure to Create / Modify

```
khedrax/
├── personas/
│   ├── professional-support/persona.json
│   └── friendly-assistant/persona.json
├── src/
│   ├── registry/
│   │   ├── types.ts                 (MODIFY: add PersonaDescriptor, RegistrySnapshot.personas)
│   │   └── personaRegistry.ts       (NEW)
│   ├── persona/
│   │   ├── types.ts                 (NEW: BehavioralProfile)
│   │   ├── resolvePersona.ts        (NEW: preset + override merge)
│   │   ├── deriveConstraints.ts     (NEW)
│   │   └── mapCapabilities.ts       (NEW)
│   ├── engines/
│   │   └── personaEngine.ts         (MODIFY: replace pass-through body)
│   ├── dna/
│   │   └── schema.ts                (MODIFY: give AgentDNA.persona a concrete shape)
│   ├── validation/
│   │   └── validateDna.ts           (MODIFY: validate persona.presetName against registry)
│   └── generation/
│       └── generationEngine.ts      (MODIFY: pass personas snapshot + Module Engine artifact into Persona Engine's context)
├── modules/
│   └── memory/
│       └── module.json              (MODIFY: add capabilities + constraints fields, see §5)
└── tests/unit/
    ├── personaRegistry.test.ts      (NEW)
    ├── resolvePersona.test.ts       (NEW)
    ├── deriveConstraints.test.ts    (NEW)
    ├── mapCapabilities.test.ts      (NEW)
    └── personaEngine.test.ts        (MODIFY: replace pass-through assertions)
```

## 5. Data Shapes

**`personas/professional-support/persona.json`** (example persona definition):
```json
{
  "name": "professional-support",
  "version": "1.0.0",
  "tone": "professional",
  "traits": ["concise", "patient", "solution-oriented"],
  "constraints": [
    "Never promise a refund or credit without escalation.",
    "Never share internal ticket IDs with the end user."
  ],
  "escalationPolicy": "Escalate to a human after two failed resolution attempts."
}
```

**`modules/memory/module.json`** gains two additive fields (Constitution #9
applies to module schemas too — this must not break Work Package #1's
existing module loading):
```json
{
  "name": "memory",
  "version": "1.0.0",
  "capabilities": ["Recall prior conversation context across sessions."],
  "constraints": ["Never expose raw memory contents verbatim to the end user."]
}
```

**`src/persona/types.ts`**:
```typescript
export interface BehavioralProfile {
  tone: string;                    // e.g. "professional"; defaults to "neutral"
  traits: string[];                // deduped union of preset + DNA overrides
  constraints: string[];           // deduped union of preset + DNA + module constraints
  escalationPolicy?: string;
  capabilities: CapabilityDescription[];
}
export interface CapabilityDescription {
  moduleName: string;
  description: string;             // taken verbatim from module.json's capabilities entries
}
```

**`src/registry/types.ts` additions:**
```typescript
export interface PersonaDescriptor {
  name: string;
  version: string;
  tone: string;
  traits: string[];
  constraints: string[];
  escalationPolicy?: string;
}
// RegistrySnapshot gains:
personas: Record<string, PersonaDescriptor>;
```

**`AgentDNA.persona` concrete shape** (was `Record<string, unknown>`, now):
```typescript
persona: {
  presetName?: string;    // key into RegistrySnapshot.personas; optional
  traits?: string[];      // additive overrides
  tone?: string;          // explicit override wins over preset's tone
  constraints?: string[]; // additive overrides
}
```
This is an additive narrowing, not a breaking change — an empty `{}` from
Work Package #1's generated projects remains valid input.

## 6. Merge / Derivation Algorithm (implement exactly, do not redesign)

1. **Resolve preset:** if `dna.persona.presetName` is set, look it up in
   `registry.personas`. If it's set but not found, this is a validation
   error caught by Validation Engine *before* Persona Engine ever runs — do
   not have Persona Engine handle this case defensively; trust validation.
   If `presetName` is omitted, use defaults: `tone: "neutral"`, empty
   `traits`/`constraints`, no `escalationPolicy`.
2. **Merge tone:** `dna.persona.tone` if present, else preset's tone, else `"neutral"`.
3. **Merge traits:** union of preset's `traits` and `dna.persona.traits`, deduped, order-preserving (preset traits first).
4. **Merge constraints:** union of: preset's `constraints`, `dna.persona.constraints`, and every resolved module's `module.json.constraints` (from the Module Engine artifact) — deduped by exact string match.
5. **Map capabilities:** for every resolved module, emit one `CapabilityDescription` per entry in that module's `capabilities` array. Modules with no `capabilities` field contribute nothing (not an error).
6. **Escalation policy:** preset's `escalationPolicy` if present, else omitted — this package does not derive one from modules.

## 7. Inputs / Outputs

- **Input:** `GenerationContext` with `dna.persona`, `registry.personas`, and `context.artifacts['moduleEngine'].resolvedModules` (already present in `GenerationContext` since Module Engine runs immediately before Persona Engine per the fixed orchestration order).
- **Output:** `ProducerResult` with `artifacts: { behavioralProfile: BehavioralProfile }`. No filesystem writes.

## 8. Validation Requirements (extend `validateDna.ts`, do not create a parallel validator)

- If `dna.persona.presetName` is set, it must exist in `registry.personas` — error, not warning.
- `dna.persona.traits` and `dna.persona.constraints`, if present, must be arrays of non-empty strings.
- No new validation is needed for module-declared `capabilities`/`constraints` — those are trusted, structural data validated at Registry System's load time (malformed `module.json` is already excluded per Work Package #1's edge-case handling).

## 9. Edge Cases

- A `presetName` that resolves but whose persona.json has no `constraints` field at all (not even empty array) must be treated as an empty array, not a crash.
- Two modules declaring the identical constraint string must not produce a duplicate entry in the final `BehavioralProfile.constraints`.
- A DNA override trait that's already present in the preset's traits must not be duplicated (case-sensitive exact match for dedup).
- `--resume` after a crash between Module Engine and Persona Engine must re-run Persona Engine fresh (it's cheap and pure) rather than attempting to cache its output across the checkpoint boundary — this is a pure function of already-checkpointed data.
- A persona.json with a `tone` value that doesn't match any predefined tone vocabulary is still accepted as free text — Persona Engine does not enforce a closed tone vocabulary in v1.

## 10. Acceptance Criteria

1. `khedrax create SupportBot --type customer-support` (whose `customer-support/agentType.json` should now set `persona.presetName: "professional-support"` as part of this package's registry data) produces a `BehavioralProfile` artifact containing the `professional-support` persona's tone, traits, and constraints, plus a capability entry contributed by the `memory` module.
2. Omitting any persona preset entirely still produces a complete, non-null `BehavioralProfile` with `tone: "neutral"` and an empty `traits` array, but still includes module-contributed capabilities and constraints.
3. A DNA-level `persona.constraints` override and a module's own constraint that happen to be identical strings appear exactly once in the final profile.
4. Referencing a nonexistent `presetName` fails at the Validation Engine step, before Generation Engine or Persona Engine ever runs — verified by a test asserting Persona Engine is never invoked in this failure path.
5. Adding a brand-new `personas/warm-and-casual/persona.json` with no source-code change is immediately usable via `persona.presetName: "warm-and-casual"` — proving registry-driven discovery, not a hardcoded preset list (Constitution #3).
6. Unit tests exist and pass for: preset resolution (found/not-found/omitted), trait/constraint merge and dedup, capability mapping across zero, one, and multiple modules, and the full Persona Engine producer function against a realistic `GenerationContext`.
7. No change in this package alters Template Engine, Module Engine, Packaging Engine, or the fixed producer-invocation order defined in `SYSTEM_ARCHITECTURE.md` — verified by re-running Work Package #1's existing Generation Engine orchestration-order test unmodified.

