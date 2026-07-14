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
}

export interface RegistrySnapshot {
  agentTypes: Record<string, AgentTypeDescriptor>;
  modules: Record<string, ModuleDescriptor>;
}
