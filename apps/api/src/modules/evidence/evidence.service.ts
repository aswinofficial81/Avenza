import type {
  CreateEvidenceInput,
  EvidenceDto,
  EvidenceLinkDto,
  EvidenceLinkEntityType,
  EvidenceListResponse,
  EvidenceQueryInput,
  UpdateEvidenceInput,
} from '@avenza/shared';
import type { IGoalsRepository } from '../goals/goals.types';
import type { ITasksRepository } from '../tasks/tasks.types';
import type { IFocusRepository } from '../focus/focus.types';
import type {
  EvidenceFindOptions,
  EvidenceRow,
  EvidenceLinkRow,
  IEvidenceRepository,
} from './evidence.types';

export class EvidenceError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'BAD_REQUEST',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'EvidenceError';
  }
}

export class EvidenceService {
  constructor(
    private readonly evidenceRepository: IEvidenceRepository,
    private readonly tasksRepository?: ITasksRepository,
    private readonly goalsRepository?: IGoalsRepository,
    private readonly focusRepository?: IFocusRepository
  ) {}

  async createManualEvidence(userId: string, input: CreateEvidenceInput): Promise<EvidenceDto> {
    if (!input.title || input.title.trim().length === 0) {
      throw new EvidenceError('Evidence title cannot be empty.', 'VALIDATION_ERROR', 400);
    }
    if (input.title.length > 255) {
      throw new EvidenceError('Evidence title cannot exceed 255 characters.', 'VALIDATION_ERROR', 400);
    }

    const validatedLinks: { entity_type: EvidenceLinkEntityType; entity_id: string }[] = [];

    // Validate ownership of any linked entities
    if (input.links && input.links.length > 0) {
      for (const link of input.links) {
        if (link.entity_type === 'task') {
          if (this.tasksRepository) {
            const task = await this.tasksRepository.findTaskById(link.entity_id, userId);
            if (!task) {
              throw new EvidenceError(
                `Linked task with ID '${link.entity_id}' not found or access denied.`,
                'FORBIDDEN',
                403
              );
            }
          }
          validatedLinks.push({ entity_type: 'task', entity_id: link.entity_id });
        } else if (link.entity_type === 'goal') {
          if (this.goalsRepository) {
            const goal = await this.goalsRepository.findGoalById(link.entity_id, userId);
            if (!goal) {
              throw new EvidenceError(
                `Linked goal with ID '${link.entity_id}' not found or access denied.`,
                'FORBIDDEN',
                403
              );
            }
          }
          validatedLinks.push({ entity_type: 'goal', entity_id: link.entity_id });
        } else if (link.entity_type === 'milestone') {
          // Milestone validation requires goalId which is not available in this context;
          // ownership will be enforced by RLS at the database layer.
          validatedLinks.push({ entity_type: 'milestone', entity_id: link.entity_id });
        }
      }
    }

    const now = new Date().toISOString();
    const created = await this.evidenceRepository.createEvidence(
      {
        user_id: userId,
        evidence_type: input.evidence_type,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        source_type: 'user',
        source_id: null,
        source_reference: null,
        external_url: input.external_url?.trim() || null,
        occurred_at: input.occurred_at || now,
        recorded_at: now,
        verification_status: 'unverified',
        evidence_strength: 'medium',
        reliability: 'low',
        directness: 'indirect',
        notes: input.notes?.trim() || null,
        metadata: input.metadata || {},
      },
      validatedLinks
    );

    return this.enrichEvidence(created.evidence, created.links, userId);
  }

  async recordFocusSessionEvidence(userId: string, focusSessionId: string): Promise<EvidenceDto> {
    if (!this.focusRepository) {
      throw new EvidenceError('Focus repository is not configured.', 'INTERNAL_ERROR', 500);
    }

    const session = await this.focusRepository.findSessionById(focusSessionId, userId);
    if (!session) {
      throw new EvidenceError(
        `Focus session '${focusSessionId}' not found or access denied.`,
        'NOT_FOUND',
        404
      );
    }

    if (session.status !== 'completed') {
      throw new EvidenceError(
        `Cannot record evidence for focus session with status '${session.status}'. Only completed sessions produce execution evidence.`,
        'CONFLICT',
        409
      );
    }

    // Check duplicate: if evidence for this focus session already exists, return existing
    const existing = await this.evidenceRepository.findEvidenceBySource(
      userId,
      'focus_session',
      focusSessionId
    );
    if (existing) {
      return this.enrichEvidence(existing.evidence, existing.links, userId);
    }

    const links: { entity_type: EvidenceLinkEntityType; entity_id: string }[] = [];
    let taskTitle = 'Focused Execution';

    if (session.task_id && this.tasksRepository) {
      const task = await this.tasksRepository.findTaskById(session.task_id, userId);
      if (task) {
        taskTitle = task.title;
        links.push({ entity_type: 'task', entity_id: task.id });
        if (task.goal_id) {
          links.push({ entity_type: 'goal', entity_id: task.goal_id });
        }
        if (task.milestone_id) {
          links.push({ entity_type: 'milestone', entity_id: task.milestone_id });
        }
      }
    }

    const actualMins = session.actual_minutes ?? 0;
    const title = `Focus Session: ${taskTitle} (${actualMins}m)`;
    const description = `Completed ${actualMins} minutes of intentional ${session.session_type} work.`;

    const created = await this.evidenceRepository.createEvidence(
      {
        user_id: userId,
        evidence_type: 'focus_session',
        title,
        description,
        source_type: 'focus_session',
        source_id: session.id,
        source_reference: null,
        external_url: null,
        occurred_at: session.started_at,
        recorded_at: session.ended_at || new Date().toISOString(),
        verification_status: 'verified',
        evidence_strength: actualMins >= 25 ? 'high' : 'medium',
        reliability: 'high',
        directness: 'direct',
        notes: session.notes,
        metadata: {
          focus_session_id: session.id,
          task_id: session.task_id,
          planned_minutes: session.planned_minutes,
          actual_minutes: session.actual_minutes,
          session_type: session.session_type,
        },
      },
      links
    );

    return this.enrichEvidence(created.evidence, created.links, userId);
  }

  async getEvidence(userId: string, query: EvidenceQueryInput): Promise<EvidenceListResponse> {
    const options: EvidenceFindOptions = {
      userId,
      evidence_type: query.evidence_type,
      source_type: query.source_type,
      verification_status: query.verification_status,
      occurred_from: query.occurred_from,
      occurred_to: query.occurred_to,
      goal_id: query.goal_id,
      milestone_id: query.milestone_id,
      task_id: query.task_id,
      page: query.page || 1,
      limit: query.limit || 20,
    };

    const paginated = await this.evidenceRepository.findEvidence(options);
    const evidenceIds = paginated.data.map((e) => e.id);
    const links = await this.evidenceRepository.findLinksForEvidenceIds(evidenceIds);

    const linksMap = new Map<string, EvidenceLinkRow[]>();
    for (const l of links) {
      if (!linksMap.has(l.evidence_id)) {
        linksMap.set(l.evidence_id, []);
      }
      linksMap.get(l.evidence_id)!.push(l);
    }

    const enrichedList: EvidenceDto[] = [];
    for (const ev of paginated.data) {
      const evLinks = linksMap.get(ev.id) || [];
      const enriched = await this.enrichEvidence(ev, evLinks, userId);
      enrichedList.push(enriched);
    }

    return {
      data: enrichedList,
      pagination: paginated.pagination,
      summary: paginated.summary,
    };
  }

  async getEvidenceById(id: string, userId: string): Promise<EvidenceDto> {
    const item = await this.evidenceRepository.findEvidenceById(id, userId);
    if (!item) {
      throw new EvidenceError('Evidence not found or access denied.', 'NOT_FOUND', 404);
    }
    return this.enrichEvidence(item.evidence, item.links, userId);
  }

  async updateEvidence(id: string, userId: string, input: UpdateEvidenceInput): Promise<EvidenceDto> {
    const existing = await this.evidenceRepository.findEvidenceById(id, userId);
    if (!existing) {
      throw new EvidenceError('Evidence not found or access denied.', 'NOT_FOUND', 404);
    }

    if (input.title !== undefined) {
      if (input.title.trim().length === 0) {
        throw new EvidenceError('Evidence title cannot be empty.', 'VALIDATION_ERROR', 400);
      }
      if (input.title.length > 255) {
        throw new EvidenceError('Evidence title cannot exceed 255 characters.', 'VALIDATION_ERROR', 400);
      }
    }

    const updated = await this.evidenceRepository.updateEvidence(id, userId, {
      title: input.title !== undefined ? input.title.trim() : undefined,
      description: input.description !== undefined ? input.description : undefined,
      notes: input.notes !== undefined ? input.notes : undefined,
      external_url: input.external_url !== undefined ? input.external_url : undefined,
      metadata: input.metadata !== undefined ? input.metadata : undefined,
      verification_status: input.verification_status !== undefined ? input.verification_status : undefined,
    });

    if (!updated) {
      throw new EvidenceError('Failed to update evidence.', 'INTERNAL_ERROR', 500);
    }

    return this.enrichEvidence(updated, existing.links, userId);
  }

  async deleteEvidence(id: string, userId: string): Promise<void> {
    const existing = await this.evidenceRepository.findEvidenceById(id, userId);
    if (!existing) {
      throw new EvidenceError('Evidence not found or access denied.', 'NOT_FOUND', 404);
    }

    const deleted = await this.evidenceRepository.deleteEvidence(id, userId);
    if (!deleted) {
      throw new EvidenceError('Failed to delete evidence.', 'INTERNAL_ERROR', 500);
    }
  }

  async getEvidenceForEntity(
    entityType: EvidenceLinkEntityType,
    entityId: string,
    userId: string
  ): Promise<EvidenceDto[]> {
    const links = await this.evidenceRepository.findLinksByEntity(entityType, entityId, userId);
    if (links.length === 0) return [];

    const evidenceIds = links.map((l) => l.evidence_id);
    const results: EvidenceDto[] = [];
    for (const evId of evidenceIds) {
      const item = await this.evidenceRepository.findEvidenceById(evId, userId);
      if (item) {
        const enriched = await this.enrichEvidence(item.evidence, item.links, userId);
        results.push(enriched);
      }
    }
    return results;
  }

  private async enrichEvidence(
    evidence: EvidenceRow,
    links: EvidenceLinkRow[],
    userId: string
  ): Promise<EvidenceDto> {
    const enrichedLinks: EvidenceLinkDto[] = [];

    for (const link of links) {
      let entityTitle: string | null = null;
      if (link.entity_type === 'task' && this.tasksRepository) {
        const task = await this.tasksRepository.findTaskById(link.entity_id, userId);
        if (task) entityTitle = task.title;
      } else if (link.entity_type === 'goal' && this.goalsRepository) {
        const goal = await this.goalsRepository.findGoalById(link.entity_id, userId);
        if (goal) entityTitle = goal.title;
      } else if (link.entity_type === 'milestone') {
        // Cannot enrich milestone title without goalId; leave entityTitle as null.
        entityTitle = null;
      }

      enrichedLinks.push({
        id: link.id,
        evidence_id: link.evidence_id,
        entity_type: link.entity_type,
        entity_id: link.entity_id,
        created_at: link.created_at,
        entity_title: entityTitle,
      });
    }

    return {
      id: evidence.id,
      user_id: evidence.user_id,
      evidence_type: evidence.evidence_type,
      title: evidence.title,
      description: evidence.description,
      source_type: evidence.source_type,
      source_id: evidence.source_id,
      source_reference: evidence.source_reference,
      external_url: evidence.external_url,
      occurred_at: evidence.occurred_at,
      recorded_at: evidence.recorded_at,
      verification_status: evidence.verification_status,
      evidence_strength: evidence.evidence_strength,
      reliability: evidence.reliability,
      directness: evidence.directness,
      notes: evidence.notes,
      metadata: evidence.metadata,
      created_at: evidence.created_at,
      updated_at: evidence.updated_at,
      links: enrichedLinks,
    };
  }
}
