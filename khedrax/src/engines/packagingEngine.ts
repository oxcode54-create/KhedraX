import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentDNA } from '../dna/schema.ts';

export interface PackagingResult {
  outputPath: string;
  standalone: boolean;
}

export interface PackagingOptions {
  tempDir: string;
  outputDir: string;
  name: string;
  force?: boolean;
  dna: AgentDNA;
  resolvedModuleDescriptors: Array<{ name: string; version?: string }>;
  khedraxRootDir: string;
}

export class PackagingEngine {
  async run(options: PackagingOptions): Promise<PackagingResult> {
    await this.writeManifest(options);

    const scanResult = await this.scanForKhedraXReferences(options.tempDir, options.khedraxRootDir);
    if (!scanResult.standalone) {
      throw new Error(`Packaging rejected generated output due to KhedraX reference: ${scanResult.reason}`);
    }

    const outputPath = options.outputDir;
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    try {
      const existing = await fs.stat(outputPath);
      if (existing.isDirectory() && !options.force) {
        const entries = await fs.readdir(outputPath);
        if (entries.length > 0) {
          throw new Error(`Output path already exists: ${outputPath}. Use --force to overwrite.`);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    if (options.force) {
      await fs.rm(outputPath, { recursive: true, force: true });
    }

    await fs.rename(options.tempDir, outputPath);
    return { outputPath, standalone: true };
  }

  private async writeManifest(options: PackagingOptions): Promise<void> {
    const manifest = {
      name: options.dna.name,
      agentType: options.dna.agent.type,
      agentVersion: options.dna.agent.version,
      buildId: options.dna.buildId,
      modules: (options.resolvedModuleDescriptors ?? [])
        .map((module) => ({
          name: module.name,
          version: module.version ?? '0.0.0',
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    };

    const manifestPath = path.join(options.tempDir, 'PACKAGE_MANIFEST.json');
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  private async scanForKhedraXReferences(tempDir: string, khedraxRootDir: string): Promise<{ standalone: boolean; reason?: string }> {
    const files = await this.collectFiles(tempDir);
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8').catch(() => '');
      if (content.includes(khedraxRootDir)) {
        return { standalone: false, reason: `found leaked build-time path in ${path.relative(tempDir, file)}` };
      }

      if (content.match(/khedrax/i) || content.match(/@khedrax\//i) || content.match(/khedrax-runtime/i)) {
        return { standalone: false, reason: `found reference in ${path.relative(tempDir, file)}` };
      }
    }
    return { standalone: true };
  }

  private async collectFiles(root: string): Promise<string[]> {
    const results: string[] = [];
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') {
          continue;
        }
        results.push(...await this.collectFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }
}
