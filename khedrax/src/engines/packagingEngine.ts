import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { PackagingResult } from './packagingEngine.ts';

export interface PackagingResult {
  outputPath: string;
  standalone: boolean;
}

export interface PackagingOptions {
  tempDir: string;
  outputDir: string;
  name: string;
}

export class PackagingEngine {
  async run(options: PackagingOptions): Promise<PackagingResult> {
    const scanResult = await this.scanForKhedraXReferences(options.tempDir);
    if (!scanResult.standalone) {
      throw new Error(`Packaging rejected generated output due to KhedraX reference: ${scanResult.reason}`);
    }

    const outputPath = path.join(options.outputDir, options.name);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.rm(outputPath, { recursive: true, force: true });
    await fs.rename(options.tempDir, outputPath);
    return { outputPath, standalone: true };
  }

  private async scanForKhedraXReferences(tempDir: string): Promise<{ standalone: boolean; reason?: string }> {
    const files = await this.collectFiles(tempDir);
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8').catch(() => '');
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
        results.push(...await this.collectFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }
}
