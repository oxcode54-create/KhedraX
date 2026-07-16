import fs from 'node:fs';
import path from 'node:path';
import type { AgentDNA } from '../dna/schema.ts';
import type { RegistrySnapshot } from '../registry/types.ts';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const RESERVED_NAMES = new Set(['test', 'khedrax', 'node_modules']);

export function validateAgentDNA(dna: AgentDNA, registry: RegistrySnapshot, outputDir?: string, force?: boolean): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!dna.name || !/^[A-Z][A-Za-z0-9]{2,49}$/.test(dna.name)) {
    errors.push('AgentDNA.name must be PascalCase and 3-50 characters.');
  }
  if (RESERVED_NAMES.has(String(dna.name).toLowerCase())) {
    errors.push('AgentDNA.name cannot be a reserved word.');
  }

  if (!registry.agentTypes[dna.agent.type]) {
    errors.push(`AgentDNA.agent.type '${dna.agent.type}' is not registered.`);
  }

  for (const moduleName of dna.modules) {
    if (!registry.modules[moduleName]) {
      errors.push(`Unknown module '${moduleName}'.`);
    }
  }

  if (dna.persona.presetName && !registry.personas[dna.persona.presetName]) {
    errors.push(`Unknown persona preset '${dna.persona.presetName}'.`);
  }

  if (dna.persona.traits && (!Array.isArray(dna.persona.traits) || dna.persona.traits.some((value) => typeof value !== 'string' || value.trim().length === 0))) {
    errors.push('AgentDNA.persona.traits must be an array of non-empty strings.');
  }

  if (dna.persona.constraints && (!Array.isArray(dna.persona.constraints) || dna.persona.constraints.some((value) => typeof value !== 'string' || value.trim().length === 0))) {
    errors.push('AgentDNA.persona.constraints must be an array of non-empty strings.');
  }

  if (dna.memory.backend && !registry.memoryBackends[dna.memory.backend]) {
    errors.push(`Unknown memory backend '${dna.memory.backend}'.`);
  }

  if (dna.memory.config && (Array.isArray(dna.memory.config) || dna.memory.config === null || typeof dna.memory.config !== 'object')) {
    errors.push('AgentDNA.memory.config must be an object if present.');
  }

  if (dna.modules.includes('memory') && Object.keys(dna.memory).length === 0) {
    warnings.push('Memory module selected without memory configuration; a minimal shape will be scaffolded.');
  }

  if (outputDir) {
    const outputPath = outputDir;
    try {
      const existing = fs.statSync(outputPath);
      if (existing.isDirectory() && !force) {
        const entries = fs.readdirSync(outputPath);
        if (entries.length > 0) {
          warnings.push(`Output path already exists: ${outputPath}. Use --force to overwrite.`);
        }
      }
    } catch {
      // ignore missing paths
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
