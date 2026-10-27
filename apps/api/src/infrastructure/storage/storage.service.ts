import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@avenza/shared';
import { getSupabaseAdminClient } from '../../db/supabase.client';

export interface StorageAssetRef {
  bucket: string;
  path: string;
}

export interface StoragePurgeResult {
  success: boolean;
  filesPurged: number;
  errors: string[];
  unpurgedAssets: StorageAssetRef[];
}

export interface IStorageService {
  purgeUserStorageAssets(userId: string): Promise<StoragePurgeResult>;
  purgeSpecificAssets(assets: StorageAssetRef[]): Promise<{ purged: StorageAssetRef[]; failed: Array<StorageAssetRef & { error: string }> }>;
}

export class SupabaseStorageService implements IStorageService {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  async purgeUserStorageAssets(userId: string): Promise<StoragePurgeResult> {
    const errors: string[] = [];
    const unpurgedAssets: StorageAssetRef[] = [];
    let filesPurged = 0;

    try {
      // 1. Collect user-owned resume files from career_applications
      const { data: applications, error: appError } = await this.client
        .from('career_applications')
        .select('resume_file_url')
        .eq('user_id', userId)
        .not('resume_file_url', 'is', null);

      if (appError) {
        errors.push(`Failed to query career application resumes: ${appError.message}`);
      } else if (applications) {
        const resumePaths: string[] = [];
        for (const app of applications) {
          if (app.resume_file_url) {
            const parsedPath = this.extractStoragePath(app.resume_file_url);
            if (parsedPath) {
              resumePaths.push(parsedPath);
            }
          }
        }

        if (resumePaths.length > 0) {
          try {
            const { data: removed, error: removeErr } = await this.client.storage
              .from('resumes')
              .remove(resumePaths);

            if (removeErr) {
              errors.push(`Failed to remove resumes from storage: ${removeErr.message}`);
              for (const p of resumePaths) {
                unpurgedAssets.push({ bucket: 'resumes', path: p });
              }
            } else {
              const removedSet = new Set((removed || []).map((r) => r.name));
              filesPurged += removed?.length || resumePaths.length;
              for (const p of resumePaths) {
                if (removed && !removedSet.has(p)) {
                  unpurgedAssets.push({ bucket: 'resumes', path: p });
                }
              }
            }
          } catch (err: unknown) {
            errors.push(`Storage exception removing resumes: ${err instanceof Error ? err.message : String(err)}`);
            for (const p of resumePaths) {
              unpurgedAssets.push({ bucket: 'resumes', path: p });
            }
          }
        }
      }

      // 2. Collect user-owned evidence files from evidence metadata
      const { data: evidenceItems, error: evError } = await this.client
        .from('evidence')
        .select('metadata')
        .eq('user_id', userId);

      if (evError) {
        errors.push(`Failed to query evidence artifacts: ${evError.message}`);
      } else if (evidenceItems) {
        const artifactPaths: string[] = [];
        for (const ev of evidenceItems) {
          const meta = ev.metadata as Record<string, unknown> | null;
          if (meta && typeof meta['storage_path'] === 'string') {
            artifactPaths.push(meta['storage_path']);
          }
        }

        if (artifactPaths.length > 0) {
          try {
            const { data: removed, error: removeErr } = await this.client.storage
              .from('evidence-artifacts')
              .remove(artifactPaths);

            if (removeErr) {
              errors.push(`Failed to remove evidence artifacts from storage: ${removeErr.message}`);
              for (const p of artifactPaths) {
                unpurgedAssets.push({ bucket: 'evidence-artifacts', path: p });
              }
            } else {
              const removedSet = new Set((removed || []).map((r) => r.name));
              filesPurged += removed?.length || artifactPaths.length;
              for (const p of artifactPaths) {
                if (removed && !removedSet.has(p)) {
                  unpurgedAssets.push({ bucket: 'evidence-artifacts', path: p });
                }
              }
            }
          } catch (err: unknown) {
            errors.push(`Storage exception removing evidence artifacts: ${err instanceof Error ? err.message : String(err)}`);
            for (const p of artifactPaths) {
              unpurgedAssets.push({ bucket: 'evidence-artifacts', path: p });
            }
          }
        }
      }
    } catch (globalErr: unknown) {
      errors.push(`Global storage purge exception: ${globalErr instanceof Error ? globalErr.message : String(globalErr)}`);
    }

    return {
      success: errors.length === 0 && unpurgedAssets.length === 0,
      filesPurged,
      errors,
      unpurgedAssets,
    };
  }

  async purgeSpecificAssets(
    assets: StorageAssetRef[]
  ): Promise<{ purged: StorageAssetRef[]; failed: Array<StorageAssetRef & { error: string }> }> {
    const purged: StorageAssetRef[] = [];
    const failed: Array<StorageAssetRef & { error: string }> = [];

    // Group by bucket
    const byBucket = new Map<string, string[]>();
    for (const a of assets) {
      const list = byBucket.get(a.bucket) || [];
      list.push(a.path);
      byBucket.set(a.bucket, list);
    }

    for (const [bucket, paths] of byBucket.entries()) {
      try {
        const { error: removeErr } = await this.client.storage.from(bucket).remove(paths);
        if (removeErr) {
          for (const p of paths) {
            failed.push({ bucket, path: p, error: removeErr.message });
          }
        } else {
          for (const p of paths) {
            purged.push({ bucket, path: p });
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        for (const p of paths) {
          failed.push({ bucket, path: p, error: msg });
        }
      }
    }

    return { purged, failed };
  }

  private extractStoragePath(urlOrPath: string): string | null {
    if (!urlOrPath || !urlOrPath.trim()) return null;
    const trimmed = urlOrPath.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return trimmed;
    }
    try {
      const parsed = new URL(trimmed);
      const parts = parsed.pathname.split('/');
      const bucketIdx = parts.indexOf('public');
      if (bucketIdx !== -1 && bucketIdx + 2 < parts.length) {
        return parts.slice(bucketIdx + 2).join('/');
      }
      return parts.slice(-1)[0] || null;
    } catch {
      return null;
    }
  }
}

export class InMemoryStorageService implements IStorageService {
  private userFiles = new Map<string, string[]>();

  setUserFiles(userId: string, files: string[]): void {
    this.userFiles.set(userId, [...files]);
  }

  getUserFiles(userId: string): string[] {
    return this.userFiles.get(userId) || [];
  }

  async purgeUserStorageAssets(userId: string): Promise<StoragePurgeResult> {
    const files = this.userFiles.get(userId) || [];
    this.userFiles.delete(userId);
    return {
      success: true,
      filesPurged: files.length,
      errors: [],
      unpurgedAssets: [],
    };
  }

  async purgeSpecificAssets(
    assets: StorageAssetRef[]
  ): Promise<{ purged: StorageAssetRef[]; failed: Array<StorageAssetRef & { error: string }> }> {
    return {
      purged: [...assets],
      failed: [],
    };
  }
}

export const defaultStorageService = new SupabaseStorageService();
