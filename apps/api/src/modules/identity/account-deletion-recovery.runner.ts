import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env';
import { defaultAccountDeletionRecoveryWorker } from './account-deletion-recovery.worker';

let isRunning = false;
let stopRequested = false;

export async function runRecoveryWorkerLoop(
  intervalMs: number = env.DELETION_RECOVERY_INTERVAL_MS,
  batchSize: number = env.DELETION_RECOVERY_BATCH_SIZE
): Promise<void> {
  stopRequested = false;

  // eslint-disable-next-line no-console
  console.log(
    `[AccountDeletionRecoveryWorker] Starting recovery loop (Interval: ${intervalMs}ms, Batch: ${batchSize})...`
  );

  while (!stopRequested) {
    if (!isRunning) {
      isRunning = true;
      try {
        const result = await defaultAccountDeletionRecoveryWorker.processPendingJobs(batchSize);
        if (result.processed > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `[AccountDeletionRecoveryWorker] Processed ${result.processed} jobs (${result.completed} completed, ${result.failed} failed/retrying).`
          );
        }
      } catch (err) {
        console.error('[AccountDeletionRecoveryWorker] Error in processing loop:', err);
      } finally {
        isRunning = false;
      }
    }

    // Sleep for configured interval or break early if shutdown requested
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // eslint-disable-next-line no-console
  console.log('[AccountDeletionRecoveryWorker] Worker loop stopped gracefully.');
}

export function stopRecoveryWorkerLoop(): void {
  stopRequested = true;
}

export function isDirectCliExecution(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    const invokedScriptPath = path.resolve(process.argv[1]);
    return currentFilePath.toLowerCase() === invokedScriptPath.toLowerCase();
  } catch {
    return false;
  }
}

// If invoked directly from CLI
if (isDirectCliExecution()) {
  const shutdown = () => {
    stopRecoveryWorkerLoop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  void runRecoveryWorkerLoop().catch((err) => {
    console.error('[AccountDeletionRecoveryWorker] Fatal startup error:', err);
    process.exit(1);
  });
}
