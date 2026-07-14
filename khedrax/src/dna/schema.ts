export interface AgentDNA {
  buildId: string;
  name: string;
  description?: string;
  agent: {
    type: string;
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

export interface CreateAgentOptions {
  name: string;
  type: string;
  outputDir: string;
  modules: string[];
  force: boolean;
  verbose: boolean;
  resume?: string;
}
