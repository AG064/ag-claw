/**
 * Container Sandbox Feature
 *
 * Isolated code execution in Docker containers with resource limits,
 * network isolation, and temporary filesystems.
 */

import { FeatureModule, FeatureContext, FeatureMeta, HealthStatus } from '../core/plugin-loader';

/** Container sandbox configuration */
export interface ContainerSandboxConfig {
  enabled: boolean;
  defaultImage: string;
  memoryLimit: string;
  cpuLimit: number;
  timeoutMs: number;
  maxContainers: number;
  networkMode: 'none' | 'bridge' | 'host';
  allowedLanguages: string[];
}

/** Execution request */
export interface ExecutionRequest {
  language: string;
  code: string;
  stdin?: string;
  files?: Record<string, string>; // filename -> content
  environment?: Record<string, string>;
}

/** Execution result */
export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  memoryUsedMb: number;
  files?: Record<string, string>; // output files
}

/** Container instance */
interface ContainerInstance {
  id: string;
  language: string;
  createdAt: number;
  status: 'running' | 'stopped' | 'error';
}

/** Language image mapping */
const LANGUAGE_IMAGES: Record<string, string> = {
  python: 'python:3.12-slim',
  javascript: 'node:20-slim',
  typescript: 'node:20-slim',
  java: 'openjdk:21-slim',
  go: 'golang:1.22-alpine',
  rust: 'rust:1.76-slim',
  bash: 'ubuntu:22.04',
  ruby: 'ruby:3.3-slim',
};

/**
 * Container Sandbox feature — isolated code execution.
 *
 * Runs untrusted code in isolated Docker containers with resource
 * limits, network restrictions, and automatic cleanup.
 */
class ContainerSandboxFeature implements FeatureModule {
  readonly meta: FeatureMeta = {
    name: 'container-sandbox',
    version: '0.1.0',
    description: 'Isolated code execution in Docker containers',
    dependencies: [],
  };

  private config: ContainerSandboxConfig = {
    enabled: false,
    defaultImage: 'ubuntu:22.04',
    memoryLimit: '256m',
    cpuLimit: 0.5,
    timeoutMs: 30000,
    maxContainers: 5,
    networkMode: 'none',
    allowedLanguages: ['python', 'javascript', 'typescript', 'bash'],
  };
  private ctx!: FeatureContext;
  private containers: Map<string, ContainerInstance> = new Map();

  async init(config: Record<string, unknown>, context: FeatureContext): Promise<void> {
    this.ctx = context;
    this.config = { ...this.config, ...(config as Partial<ContainerSandboxConfig>) };
  }

  async start(): Promise<void> {
    // Verify Docker is available
    this.ctx.logger.info('Container Sandbox active', {
      maxContainers: this.config.maxContainers,
      networkMode: this.config.networkMode,
    });
  }

  async stop(): Promise<void> {
    // Clean up all containers
    for (const [id] of this.containers) {
      await this.stopContainer(id);
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const running = Array.from(this.containers.values()).filter(c => c.status === 'running').length;
    return {
      healthy: running < this.config.maxContainers,
      details: {
        containers: this.containers.size,
        running,
        maxContainers: this.config.maxContainers,
      },
    };
  }

  /** Check if a language is supported */
  isLanguageSupported(language: string): boolean {
    return this.config.allowedLanguages.includes(language);
  }

  /** Execute code in a sandboxed container */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (!this.isLanguageSupported(request.language)) {
      return {
        success: false,
        stdout: '',
        stderr: `Language not supported: ${request.language}`,
        exitCode: -1,
        durationMs: 0,
        memoryUsedMb: 0,
      };
    }

    if (this.containers.size >= this.config.maxContainers) {
      return {
        success: false,
        stdout: '',
        stderr: 'Maximum container limit reached',
        exitCode: -1,
        durationMs: 0,
        memoryUsedMb: 0,
      };
    }

    const containerId = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const image = LANGUAGE_IMAGES[request.language] ?? this.config.defaultImage;

    this.containers.set(containerId, {
      id: containerId,
      language: request.language,
      createdAt: Date.now(),
      status: 'running',
    });

    const startTime = Date.now();

    try {
      // Build docker command
      const dockerCmd = this.buildDockerCommand(containerId, image, request);

      // Execute (this would use child_process.spawn in real implementation)
      this.ctx.logger.debug('Executing in sandbox', {
        containerId,
        language: request.language,
        image,
      });

      // Simulate execution result
      const result: ExecutionResult = {
        success: true,
        stdout: '[Sandbox execution placeholder]',
        stderr: '',
        exitCode: 0,
        durationMs: Date.now() - startTime,
        memoryUsedMb: 0,
      };

      this.containers.get(containerId)!.status = 'stopped';
      return result;
    } catch (err) {
      const container = this.containers.get(containerId);
      if (container) container.status = 'error';

      return {
        success: false,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: -1,
        durationMs: Date.now() - startTime,
        memoryUsedMb: 0,
      };
    } finally {
      await this.cleanupContainer(containerId);
    }
  }

  /** Build Docker run command */
  private buildDockerCommand(containerId: string, image: string, request: ExecutionRequest): string[] {
    const cmd = [
      'docker', 'run',
      '--rm',
      '--name', containerId,
      '--memory', this.config.memoryLimit,
      '--cpus', String(this.config.cpuLimit),
      '--network', this.config.networkMode,
      '--read-only',
      '--tmpfs', '/tmp:size=64m',
      '--pids-limit', '64',
    ];

    // Add environment variables
    if (request.environment) {
      for (const [key, value] of Object.entries(request.environment)) {
        cmd.push('-e', `${key}=${value}`);
      }
    }

    cmd.push(image);

    // Add execution command based on language
    switch (request.language) {
      case 'python':
        cmd.push('python', '-c', request.code);
        break;
      case 'javascript':
        cmd.push('node', '-e', request.code);
        break;
      case 'bash':
        cmd.push('bash', '-c', request.code);
        break;
      default:
        cmd.push('sh', '-c', request.code);
    }

    return cmd;
  }

  /** Stop a container */
  private async stopContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (container) {
      container.status = 'stopped';
      // docker stop would go here
    }
  }

  /** Clean up container resources */
  private async cleanupContainer(containerId: string): Promise<void> {
    this.containers.delete(containerId);
  }
}

export default new ContainerSandboxFeature();
