import type {
  EvidenceLinkEntityType,
  EvidenceSourceType,
  EvidenceType,
  EvidenceVerificationStatus,
  EvidenceStrength,
  EvidenceReliability,
  EvidenceDirectness,
  PaginatedList,
  EvidenceSummary,
} from '@avenza/shared';

export interface EvidenceRow {
  id: string;
  user_id: string;
  evidence_type: EvidenceType;
  title: string;
  description: string | null;
  source_type: EvidenceSourceType;
  source_id: string | null;
  source_reference: string | null;
  external_url: string | null;
  occurred_at: string;
  recorded_at: string;
  verification_status: EvidenceVerificationStatus;
  evidence_strength: EvidenceStrength;
  reliability: EvidenceReliability;
  directness: EvidenceDirectness;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EvidenceLinkRow {
  id: string;
  evidence_id: string;
  entity_type: EvidenceLinkEntityType;
  entity_id: string;
  created_at: string;
}

export interface EvidenceCreateData {
  id?: string;
  user_id: string;
  evidence_type: EvidenceType;
  title: string;
  description?: string | null;
  source_type: EvidenceSourceType;
  source_id?: string | null;
  source_reference?: string | null;
  external_url?: string | null;
  occurred_at?: string;
  recorded_at?: string;
  verification_status?: EvidenceVerificationStatus;
  evidence_strength?: EvidenceStrength;
  reliability?: EvidenceReliability;
  directness?: EvidenceDirectness;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EvidenceLinkCreateData {
  entity_type: EvidenceLinkEntityType;
  entity_id: string;
}

export interface EvidenceUpdateData {
  title?: string;
  description?: string | null;
  notes?: string | null;
  external_url?: string | null;
  metadata?: Record<string, unknown>;
  verification_status?: EvidenceVerificationStatus;
}

export interface EvidenceFindOptions {
  userId: string;
  evidence_type?: EvidenceType;
  source_type?: EvidenceSourceType;
  verification_status?: EvidenceVerificationStatus;
  occurred_from?: string;
  occurred_to?: string;
  goal_id?: string;
  milestone_id?: string;
  task_id?: string;
  page?: number;
  limit?: number;
}

export interface IEvidenceRepository {
  createEvidence(
    data: EvidenceCreateData,
    links?: EvidenceLinkCreateData[]
  ): Promise<{ evidence: EvidenceRow; links: EvidenceLinkRow[] }>;

  findEvidenceById(
    id: string,
    userId: string
  ): Promise<{ evidence: EvidenceRow; links: EvidenceLinkRow[] } | null>;

  findEvidenceBySource(
    userId: string,
    sourceType: EvidenceSourceType,
    sourceId: string
  ): Promise<{ evidence: EvidenceRow; links: EvidenceLinkRow[] } | null>;

  findEvidence(
    options: EvidenceFindOptions
  ): Promise<PaginatedList<EvidenceRow> & { summary: EvidenceSummary }>;

  findLinksForEvidenceIds(evidenceIds: string[]): Promise<EvidenceLinkRow[]>;

  findLinksByEntity(
    entityType: EvidenceLinkEntityType,
    entityId: string,
    userId: string
  ): Promise<EvidenceLinkRow[]>;

  updateEvidence(
    id: string,
    userId: string,
    data: EvidenceUpdateData
  ): Promise<EvidenceRow | null>;

  deleteEvidence(id: string, userId: string): Promise<boolean>;
}
