#!/usr/bin/env node
import path from 'node:path';
import { createAgent } from '../commands/create.ts';

const [, , command, name, ...rest] = process.argv;
if (command !== 'create' || !name) {
  console.error('Usage: khedrax create <Name>');
  process.exit(1);
}

const args = rest;
let type = 'basic';
let outputDir = path.resolve(process.cwd(), name);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--type' && args[index + 1]) {
    type = args[index + 1];
    index += 1;
  } else if (arg === '--output' && args[index + 1]) {
    outputDir = path.resolve(process.cwd(), args[index + 1]);
    index += 1;
  }
}

try {
  const result = await createAgent({
    name,
    type,
    outputDir,
    modules: [],
    force: false,
    verbose: false,
  });
  console.log(result.outputPath);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
