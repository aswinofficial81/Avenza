import type { Database, PaginatedList, EvidenceSummary } from '@avenza/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type {
  EvidenceCreateData,
  EvidenceFindOptions,
  EvidenceLinkCreateData,
  EvidenceLinkRow,
  EvidenceRow,
  EvidenceUpdateData,
  IEvidenceRepository,
} from './evidence.types';

export class SupabaseEvidenceRepository implements IEvidenceRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  async createEvidence(
    data: EvidenceCreateData,
    links: EvidenceLinkCreateData[] = []
  ): Promise<{ evidence: EvidenceRow; links: EvidenceLinkRow[] }> {
    const now = new Date().toISOString();
    const insertPayload: Database['public']['Tables']['evidence']['Insert'] = {
      user_id: data.user_id,
      evidence_type: data.evidence_type,
      title: data.title,
      description: data.description || null,
      source_type: data.source_type,
      source_id: data.source_id || null,
      source_reference: data.source_reference || null,
      external_url: data.external_url || null,
      occurred_at: data.occurred_at || now,
      recorded_at: data.recorded_at || now,
      verification_status: data.verification_status || 'unverified',
      evidence_strength: data.evidence_strength || 'medium',
      reliability: data.reliability || 'medium',
      directness: data.directness || 'direct',
      notes: data.notes || null,
      metadata: (data.metadata || {}) as unknown as Database['public']['Tables']['evidence']['Insert']['metadata'],
    };

    if (data.id) {
      insertPayload.id = data.id;
    }

    const { data: createdEvidence, error: evError } = await this.client
      .from('evidence')
      .insert(insertPayload)
      .select('*')
      .single();

    if (evError || !createdEvidence) {
      throw new Error(`Failed to create evidence: ${evError?.message || 'Unknown error'}`);
    }

    let createdLinks: EvidenceLinkRow[] = [];
    if (links.length > 0) {
      const linksPayload: Database['public']['Tables']['evidence_links']['Insert'][] = links.map(
        (l) => ({
          evidence_id: createdEvidence.id,
          entity_type: l.entity_type,
          entity_id: l.entity_id,
        })
      );

      const { data: insertedLinks, error: linkError } = await this.client
        .from('evidence_links')
        .insert(linksPayload)
        .select('*');

      if (linkError) {
        // Rollback created evidence on link creation failure
        await this.client.from('evidence').delete().eq('id', createdEvidence.id);
        throw new Error(`Failed to link evidence: ${linkError.message}`);
      }

      createdLinks = (insertedLinks || []) as EvidenceLinkRow[];
    }

    return {
      evidence: createdEvidence as EvidenceRow,
      links: createdLinks,
    };
  }

  async findEvidenceById(
    id: string,
    userId: string
  ): Promise<{ evidence: EvidenceRow; links: EvidenceLinkRow[] } | null> {
    const { data: evidence, error: evError } = await this.client
      .from('evidence')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (evError) {
      throw new Error(`Failed to fetch evidence: ${evError.message}`);
    }
    if (!evidence) return null;

    const { data: links, error: linkError } = await this.client
      .from('evidence_links')
      .select('*')
      .eq('evidence_id', id);

    if (linkError) {
      throw new Error(`Failed to fetch evidence links: ${linkError.message}`);
    }

    return {
      evidence: evidence as EvidenceRow,
      links: (links || []) as EvidenceLinkRow[],
    };
  }

  async findEvidenceBySource(
    userId: string,
    sourceType: string,
    sourceId: string
  ): Promise<{ evidence: EvidenceRow; links: EvidenceLinkRow[] } | null> {
    const { data: evidence, error: evError } = await this.client
      .from('evidence')
      .select('*')
      .eq('user_id', userId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .maybeSingle();

    if (evError) {
      throw new Error(`Failed to fetch evidence by source: ${evError.message}`);
    }
    if (!evidence) return null;

    const { data: links, error: linkError } = await this.client
      .from('evidence_links')
      .select('*')
      .eq('evidence_id', evidence.id);

    if (linkError) {
      throw new Error(`Failed to fetch evidence links: ${linkError.message}`);
    }

    return {
      evidence: evidence as EvidenceRow,
      links: (links || []) as EvidenceLinkRow[],
    };
  }

  async findEvidence(
    options: EvidenceFindOptions
  ): Promise<PaginatedList<EvidenceRow> & { summary: EvidenceSummary }> {
    const {
      userId,
      evidence_type,
      source_type,
      verification_status,
      occurred_from,
      occurred_to,
      goal_id,
      milestone_id,
      task_id,
    } = options;

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const offset = (page - 1) * limit;

    // 1. If filtering by linked entity (goal, milestone, or task), find matching evidence IDs
    let matchedEvidenceIds: string[] | null = null;
    const entityFilters: { type: string; id: string }[] = [];
    if (goal_id) entityFilters.push({ type: 'goal', id: goal_id });
    if (milestone_id) entityFilters.push({ type: 'milestone', id: milestone_id });
    if (task_id) entityFilters.push({ type: 'task', id: task_id });

    if (entityFilters.length > 0) {
      let linkQuery = this.client.from('evidence_links').select('evidence_id');
      for (const filter of entityFilters) {
        linkQuery = linkQuery.eq('entity_type', filter.type).eq('entity_id', filter.id);
      }
      const { data: linkMatches, error: linkMatchError } = await linkQuery;
      if (linkMatchError) {
        throw new Error(`Failed to filter evidence links: ${linkMatchError.message}`);
      }
      matchedEvidenceIds = (linkMatches || []).map((l) => l.evidence_id);
      if (matchedEvidenceIds.length === 0) {
        return {
          data: [],
          pagination: {
            page,
            pageSize: limit,
            total: 0,
            totalPages: 1,
          },
          summary: { total: 0, verified: 0, unverified: 0, rejected: 0 },
        };
      }
    }

    // 2. Build main query
    let query = this.client
      .from('evidence')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (matchedEvidenceIds !== null) {
      query = query.in('id', matchedEvidenceIds);
    }
    if (evidence_type) {
      query = query.eq('evidence_type', evidence_type);
    }
    if (source_type) {
      query = query.eq('source_type', source_type);
    }
    if (verification_status) {
      query = query.eq('verification_status', verification_status);
    }
    if (occurred_from) {
      query = query.gte('occurred_at', occurred_from);
    }
    if (occurred_to) {
      query = query.lte('occurred_at', occurred_to);
    }

    query = query.order('occurred_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      throw new Error(`Failed to list evidence: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // 3. Compute lightweight summary stats for the user
    const { data: summaryRows } = await this.client
      .from('evidence')
      .select('verification_status')
      .eq('user_id', userId);

    const summary: EvidenceSummary = {
      total: summaryRows?.length || 0,
      verified: 0,
      unverified: 0,
      rejected: 0,
    };
    for (const r of summaryRows || []) {
      if (r.verification_status === 'verified') summary.verified += 1;
      else if (r.verification_status === 'unverified') summary.unverified += 1;
      else if (r.verification_status === 'rejected') summary.rejected += 1;
    }

    return {
      data: (data || []) as EvidenceRow[],
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages,
      },
      summary,
    };
  }

  async findLinksForEvidenceIds(evidenceIds: string[]): Promise<EvidenceLinkRow[]> {
    if (evidenceIds.length === 0) return [];
    const { data, error } = await this.client
      .from('evidence_links')
      .select('*')
      .in('evidence_id', evidenceIds);

    if (error) {
      throw new Error(`Failed to fetch links for evidence: ${error.message}`);
    }
    return (data || []) as EvidenceLinkRow[];
  }

  async findLinksByEntity(
    entityType: string,
    entityId: string,
    _userId: string
  ): Promise<EvidenceLinkRow[]> {
    const { data, error } = await this.client
      .from('evidence_links')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error) {
      throw new Error(`Failed to query evidence links for entity: ${error.message}`);
    }
    return (data || []) as EvidenceLinkRow[];
  }

  async updateEvidence(
    id: string,
    userId: string,
    data: EvidenceUpdateData
  ): Promise<EvidenceRow | null> {
    const updatePayload: Database['public']['Tables']['evidence']['Update'] = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.external_url !== undefined) updatePayload.external_url = data.external_url;
    if (data.metadata !== undefined)
      updatePayload.metadata = data.metadata as unknown as Database['public']['Tables']['evidence']['Update']['metadata'];
    if (data.verification_status !== undefined)
      updatePayload.verification_status = data.verification_status;

    const { data: updated, error } = await this.client
      .from('evidence')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update evidence: ${error.message}`);
    }
    return (updated as EvidenceRow) || null;
  }

  async deleteEvidence(id: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('evidence')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete evidence: ${error.message}`);
    }
    return true;
  }
}

export class InMemoryEvidenceRepository implements IEvidenceRepository {
  private evidenceList: EvidenceRow[] = [];
  private linksList: EvidenceLinkRow[] = [];

  constructor(initialEvidence: EvidenceRow[] = [], initialLinks: EvidenceLinkRow[] = []) {
    this.evidenceList = [...initialEvidence];
    this.linksList = [...initialLinks];
  }

  async createEvidence(
    data: EvidenceCreateData,
    links: EvidenceLinkCreateData[] = []
  ): Promise<{ evidence: EvidenceRow; links: EvidenceLinkRow[] }> {
    // Check duplicate source constraint: (user_id, source_type, source_id) when source_id is not null
    if (data.source_id) {
      const existing = this.evidenceList.find(
        (e) =>
          e.user_id === data.user_id &&
          e.source_type === data.source_type &&
          e.source_id === data.source_id
      );
      if (existing) {
        throw new Error('Evidence with this source already exists.');
      }
    }

    const now = new Date().toISOString();
    const newEvidence: EvidenceRow = {
      id: data.id || crypto.randomUUID(),
      user_id: data.user_id,
      evidence_type: data.evidence_type,
      title: data.title,
      description: data.description || null,
      source_type: data.source_type,
      source_id: data.source_id || null,
      source_reference: data.source_reference || null,
      external_url: data.external_url || null,
      occurred_at: data.occurred_at || now,
      recorded_at: data.recorded_at || now,
      verification_status: data.verification_status || 'unverified',
      evidence_strength: data.evidence_strength || 'medium',
      reliability: data.reliability || 'medium',
      directness: data.directness || 'direct',
      notes: data.notes || null,
      metadata: data.metadata || {},
      created_at: now,
      updated_at: now,
    };

    this.evidenceList.push(newEvidence);

    const createdLinks: EvidenceLinkRow[] = [];
    for (const l of links) {
      const newLink: EvidenceLinkRow = {
        id: crypto.randomUUID(),
        evidence_id: newEvidence.id,
        entity_type: l.entity_type,
        entity_id: l.entity_id,
        created_at: now,
      };
      this.linksList.push(newLink);
      createdLinks.push(newLink);
    }

    return {
      evidence: { ...newEvidence },
      links: createdLinks.map((l) => ({ ...l })),
    };
  }

  async findEvidenceById(
    id: string,
    userId: string
  ): Promise<{ evidence: EvidenceRow; links: EvidenceLinkRow[] } | null> {
    const evidence = this.evidenceList.find((e) => e.id === id && e.user_id === userId);
    if (!evidence) return null;

    const links = this.linksList.filter((l) => l.evidence_id === id);
    return {
      evidence: { ...evidence },
      links: links.map((l) => ({ ...l })),
    };
  }

  async findEvidenceBySource(
    userId: string,
    sourceType: string,
    sourceId: string
  ): Promise<{ evidence: EvidenceRow; links: EvidenceLinkRow[] } | null> {
    const evidence = this.evidenceList.find(
      (e) => e.user_id === userId && e.source_type === sourceType && e.source_id === sourceId
    );
    if (!evidence) return null;

    const links = this.linksList.filter((l) => l.evidence_id === evidence.id);
    return {
      evidence: { ...evidence },
      links: links.map((l) => ({ ...l })),
    };
  }

  async findEvidence(
    options: EvidenceFindOptions
  ): Promise<PaginatedList<EvidenceRow> & { summary: EvidenceSummary }> {
    let filtered = this.evidenceList.filter((e) => e.user_id === options.userId);

    // Entity links filter
    if (options.task_id) {
      const matchingIds = this.linksList
        .filter((l) => l.entity_type === 'task' && l.entity_id === options.task_id)
        .map((l) => l.evidence_id);
      filtered = filtered.filter((e) => matchingIds.includes(e.id));
    }
    if (options.goal_id) {
      const matchingIds = this.linksList
        .filter((l) => l.entity_type === 'goal' && l.entity_id === options.goal_id)
        .map((l) => l.evidence_id);
      filtered = filtered.filter((e) => matchingIds.includes(e.id));
    }
    if (options.milestone_id) {
      const matchingIds = this.linksList
        .filter((l) => l.entity_type === 'milestone' && l.entity_id === options.milestone_id)
        .map((l) => l.evidence_id);
      filtered = filtered.filter((e) => matchingIds.includes(e.id));
    }

    if (options.evidence_type) {
      filtered = filtered.filter((e) => e.evidence_type === options.evidence_type);
    }
    if (options.source_type) {
      filtered = filtered.filter((e) => e.source_type === options.source_type);
    }
    if (options.verification_status) {
      filtered = filtered.filter((e) => e.verification_status === options.verification_status);
    }
    if (options.occurred_from) {
      filtered = filtered.filter((e) => e.occurred_at >= options.occurred_from!);
    }
    if (options.occurred_to) {
      filtered = filtered.filter((e) => e.occurred_at <= options.occurred_to!);
    }

    filtered.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const paged = filtered.slice(offset, offset + limit);

    // Summary across all user's evidence
    const userAll = this.evidenceList.filter((e) => e.user_id === options.userId);
    const summary: EvidenceSummary = {
      total: userAll.length,
      verified: userAll.filter((e) => e.verification_status === 'verified').length,
      unverified: userAll.filter((e) => e.verification_status === 'unverified').length,
      rejected: userAll.filter((e) => e.verification_status === 'rejected').length,
    };

    return {
      data: paged.map((e) => ({ ...e })),
      pagination: {
        page,
        pageSize: limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit) || 1,
      },
      summary,
    };
  }

  async findLinksForEvidenceIds(evidenceIds: string[]): Promise<EvidenceLinkRow[]> {
    return this.linksList
      .filter((l) => evidenceIds.includes(l.evidence_id))
      .map((l) => ({ ...l }));
  }

  async findLinksByEntity(
    entityType: string,
    entityId: string,
    _userId: string
  ): Promise<EvidenceLinkRow[]> {
    return this.linksList
      .filter((l) => l.entity_type === entityType && l.entity_id === entityId)
      .map((l) => ({ ...l }));
  }

  async updateEvidence(
    id: string,
    userId: string,
    data: EvidenceUpdateData
  ): Promise<EvidenceRow | null> {
    const idx = this.evidenceList.findIndex((e) => e.id === id && e.user_id === userId);
    if (idx === -1) return null;

    const existing = this.evidenceList[idx]!;
    const updated: EvidenceRow = {
      ...existing,
      title: data.title !== undefined ? data.title : existing.title,
      description: data.description !== undefined ? data.description : existing.description,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      external_url: data.external_url !== undefined ? data.external_url : existing.external_url,
      metadata: data.metadata !== undefined ? data.metadata : existing.metadata,
      verification_status:
        data.verification_status !== undefined
          ? data.verification_status
          : existing.verification_status,
      updated_at: new Date().toISOString(),
    };

    this.evidenceList[idx] = updated;
    return { ...updated };
  }

  async deleteEvidence(id: string, userId: string): Promise<boolean> {
    const idx = this.evidenceList.findIndex((e) => e.id === id && e.user_id === userId);
    if (idx === -1) return false;

    this.evidenceList.splice(idx, 1);
    this.linksList = this.linksList.filter((l) => l.evidence_id !== id);
    return true;
  }
}
