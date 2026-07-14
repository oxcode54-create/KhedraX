export interface AgentTypeDescriptor {
  name: string;
  version: string;
  defaultModules: string[];
  description?: string;
}

export interface ModuleDescriptor {
  name: string;
  version: string;
  path: string;
  requiresMemory?: boolean;
  capabilities?: string[];
  constraints?: string[];
}

export interface PersonaDescriptor {
  name: string;
  version: string;
  tone: string;
  traits: string[];
  constraints: string[];
  escalationPolicy?: string;
}

export interface RegistrySnapshot {
  agentTypes: Record<string, AgentTypeDescriptor>;
  modules: Record<string, ModuleDescriptor>;
  personas: Record<string, PersonaDescriptor>;
}
