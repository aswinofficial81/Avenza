import { buildApp } from './app';
import { env } from './config/env';

async function start(): Promise<void> {
  const app = buildApp();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    app.log.info(`Avenza API server listening at ${address}`);

    if (env.ENABLE_DELETION_RECOVERY_WORKER) {
      const { runRecoveryWorkerLoop } = await import('./modules/identity/account-deletion-recovery.runner');
      void runRecoveryWorkerLoop();
      app.log.info('AccountDeletionRecoveryWorker loop started.');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      if (env.ENABLE_DELETION_RECOVERY_WORKER) {
        const { stopRecoveryWorkerLoop } = await import('./modules/identity/account-deletion-recovery.runner');
        stopRecoveryWorkerLoop();
      }
      await app.close();
      process.exit(0);
    });
  }
}

void start();
