/**
 * Mesh Workflows Feature
 *
 * Multi-step workflow orchestration with conditional branching,
 * parallel execution, and error handling.
 */

import { FeatureModule, FeatureContext, FeatureMeta, HealthStatus } from '../core/plugin-loader';

/** Mesh workflow configuration */
export interface MeshWorkflowsConfig {
  enabled: boolean;
  maxConcurrent: number;
  defaultTimeout: number;
  persistState: boolean;
}

/** Workflow step definition */
export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'condition' | 'parallel' | 'loop' | 'delay';
  config: Record<string, unknown>;
  nextSteps: string[];
  errorStep?: string;
  timeout?: number;
}

/** Workflow definition */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  entryStep: string;
  variables: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Workflow execution state */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  currentStep: string;
  variables: Record<string, unknown>;
  stepResults: Map<string, unknown>;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

/** Step handler function */
export type StepHandler = (step: WorkflowStep, context: Record<string, unknown>) => Promise<unknown>;

/**
 * Mesh Workflows feature — multi-step workflow orchestration.
 *
 * Define, execute, and monitor complex workflows with conditional
 * branching, parallel execution, and persistent state.
 */
class MeshWorkflowsFeature implements FeatureModule {
  readonly meta: FeatureMeta = {
    name: 'mesh-workflows',
    version: '0.1.0',
    description: 'Multi-step workflow orchestration engine',
    dependencies: [],
  };

  private config: MeshWorkflowsConfig = {
    enabled: false,
    maxConcurrent: 10,
    defaultTimeout: 300000,
    persistState: true,
  };
  private ctx!: FeatureContext;
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private stepHandlers: Map<string, StepHandler> = new Map();
  private runningCount = 0;

  async init(config: Record<string, unknown>, context: FeatureContext): Promise<void> {
    this.ctx = context;
    this.config = { ...this.config, ...(config as Partial<MeshWorkflowsConfig>) };
  }

  async start(): Promise<void> {
    this.ctx.logger.info('Mesh Workflows active', { maxConcurrent: this.config.maxConcurrent });
  }

  async stop(): Promise<void> {
    // Pause all running executions
    for (const [, exec] of this.executions) {
      if (exec.status === 'running') {
        exec.status = 'paused';
      }
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const running = Array.from(this.executions.values()).filter(e => e.status === 'running').length;
    return {
      healthy: running < this.config.maxConcurrent,
      details: {
        workflows: this.workflows.size,
        executions: this.executions.size,
        running,
      },
    };
  }

  /** Register a workflow definition */
  registerWorkflow(workflow: Omit<Workflow, 'createdAt' | 'updatedAt'>): Workflow {
    const now = Date.now();
    const full: Workflow = { ...workflow, createdAt: now, updatedAt: now };
    this.workflows.set(workflow.id, full);
    this.ctx.logger.info('Workflow registered', { id: workflow.id, name: workflow.name });
    return full;
  }

  /** Register a step handler */
  registerStepHandler(type: string, handler: StepHandler): void {
    this.stepHandlers.set(type, handler);
  }

  /** Execute a workflow */
  async execute(workflowId: string, variables: Record<string, unknown> = {}): Promise<WorkflowExecution> {
    if (this.runningCount >= this.config.maxConcurrent) {
      throw new Error('Maximum concurrent executions reached');
    }

    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'running',
      currentStep: workflow.entryStep,
      variables: { ...workflow.variables, ...variables },
      stepResults: new Map(),
      startedAt: Date.now(),
    };

    this.executions.set(executionId, execution);
    this.runningCount++;

    // Execute asynchronously
    this.runExecution(execution, workflow).catch(err => {
      this.ctx.logger.error('Workflow execution error', {
        executionId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return execution;
  }

  /** Run execution steps */
  private async runExecution(execution: WorkflowExecution, workflow: Workflow): Promise<void> {
    try {
      let currentStepId = execution.currentStep;

      while (currentStepId && execution.status === 'running') {
        const step = workflow.steps.find(s => s.id === currentStepId);
        if (!step) {
          execution.status = 'failed';
          execution.error = `Step not found: ${currentStepId}`;
          break;
        }

        execution.currentStep = currentStepId;
        this.ctx.logger.debug('Executing step', { step: step.name, type: step.type });

        try {
          const handler = this.stepHandlers.get(step.type);
          if (handler) {
            const result = await handler(step, execution.variables);
            execution.stepResults.set(step.id, result);
          }

          // Determine next step
          currentStepId = step.nextSteps[0] ?? '';
        } catch (err) {
          if (step.errorStep) {
            currentStepId = step.errorStep;
          } else {
            execution.status = 'failed';
            execution.error = err instanceof Error ? err.message : String(err);
          }
        }
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
      }
    } finally {
      execution.completedAt = Date.now();
      this.runningCount--;
    }
  }

  /** Get execution status */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /** Pause execution */
  pauseExecution(executionId: string): boolean {
    const exec = this.executions.get(executionId);
    if (exec?.status === 'running') {
      exec.status = 'paused';
      return true;
    }
    return false;
  }

  /** Resume paused execution */
  async resumeExecution(executionId: string): Promise<boolean> {
    const exec = this.executions.get(executionId);
    if (exec?.status === 'paused') {
      exec.status = 'running';
      const workflow = this.workflows.get(exec.workflowId);
      if (workflow) {
        this.runExecution(exec, workflow);
      }
      return true;
    }
    return false;
  }
}

export default new MeshWorkflowsFeature();
