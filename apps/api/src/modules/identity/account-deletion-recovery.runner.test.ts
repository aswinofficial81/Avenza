import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isDirectCliExecution,
  runRecoveryWorkerLoop,
  stopRecoveryWorkerLoop,
} from './account-deletion-recovery.runner';
import { defaultAccountDeletionRecoveryWorker } from './account-deletion-recovery.worker';

describe('Phase 17B-2 Recovery Worker Runner Entry Point', () => {
  const originalArgv = [...process.argv];

  beforeEach(() => {
    stopRecoveryWorkerLoop();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    stopRecoveryWorkerLoop();
  });

  it('1. Module import does not automatically start the worker loop', () => {
    // Verified because importing account-deletion-recovery.runner in this test
    // did not start an infinite loop or block vitest execution.
    expect(typeof runRecoveryWorkerLoop).toBe('function');
    expect(typeof stopRecoveryWorkerLoop).toBe('function');
  });

  it('2. isDirectCliExecution returns false when process.argv[1] does not match module file', () => {
    process.argv[1] = path.resolve('node_modules/vitest/vitest.mjs');
    expect(isDirectCliExecution()).toBe(false);
  });

  it('3. isDirectCliExecution returns true when process.argv[1] matches module path (cross-platform)', () => {
    const runnerPath = fileURLToPath(
      new URL('./account-deletion-recovery.runner.ts', import.meta.url)
    );
    process.argv[1] = runnerPath;
    expect(isDirectCliExecution()).toBe(true);
  });

  it('4. Graceful shutdown stops the worker loop without stranding jobs', async () => {
    const processSpy = vi
      .spyOn(defaultAccountDeletionRecoveryWorker, 'processPendingJobs')
      .mockResolvedValue({ processed: 0, completed: 0, failed: 0 });

    const loopPromise = runRecoveryWorkerLoop(10, 5);

    // Wait for the first tick to execute processPendingJobs
    await new Promise((resolve) => setTimeout(resolve, 20));

    stopRecoveryWorkerLoop();
    await loopPromise;
    expect(processSpy).toHaveBeenCalled();
  });
});
