import type { SyncContext, SyncResult } from './provider.types';

export interface ISyncProvider {
  sync(context: SyncContext): Promise<SyncResult>;
}
