export interface BehavioralProfile {
  tone: string;
  traits: string[];
  constraints: string[];
  escalationPolicy?: string;
  capabilities: CapabilityDescription[];
}

export interface CapabilityDescription {
  moduleName: string;
  description: string;
}
