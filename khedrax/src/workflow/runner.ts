import type { Checkpoint, StepResult, WorkflowStep } from './runner.ts';

export interface StepResult { artifacts?: Record<string, unknown>; }
export interface WorkflowStep {
  name: string;
  fn: (checkpoint: Checkpoint) => Promise<StepResult>;
  skip?: boolean;
}
export interface Checkpoint {
  buildId: string;
  completed: string[];
  artifacts: Record<string, unknown>;
}

export async function runWorkflow(steps: WorkflowStep[], checkpoint: Checkpoint): Promise<Checkpoint> {
  const updated = { ...checkpoint, completed: [...checkpoint.completed] };
  for (const step of steps) {
    if (step.skip || updated.completed.includes(step.name)) {
      continue;
    }
    const result = await step.fn(updated);
    updated.completed.push(step.name);
    if (result.artifacts) {
      updated.artifacts[step.name] = result.artifacts;
    }
  }
  return updated;
}
