export interface ModuleCapabilityLike { name: string; capabilities?: string[]; }

export function mapCapabilities(modules: ModuleCapabilityLike[]): Array<{ moduleName: string; description: string }> {
  return modules.flatMap((module) => {
    if (!Array.isArray(module.capabilities)) {
      return [];
    }
    return module.capabilities.map((description) => ({ moduleName: module.name, description }));
  });
}
