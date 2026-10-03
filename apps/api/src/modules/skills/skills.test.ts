import type { EvidenceDto, SkillDto } from '@avenza/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { calculateSkillMastery } from './skills.mastery';
import { createSkillsRoutes } from './skills.routes';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import type { ISkillsRepository } from './skills.types';

// ==============================================================================
// Mock Repository for Pure Unit Testing
// ==============================================================================
class MockSkillsRepository implements ISkillsRepository {
  public skills: SkillDto[] = [];
  public evidenceMap = new Map<string, string[]>(); // skillId -> evidenceIds
  public evidenceStore = new Map<string, EvidenceDto>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public goalLinks: Array<{ goal_id: string; skill_id: string; user_id: string; target_mastery_state: any }> = [];
  public taskLinks: Array<{ task_id: string; skill_id: string; user_id: string }> = [];
  public topicLinks: Array<{ topic_id: string; skill_id: string; user_id: string }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createSkill(userId: string, data: any): Promise<SkillDto> {
    const skill: SkillDto = {
      id: `skill-${this.skills.length + 1}`,
      user_id: userId,
      parent_skill_id: data.parent_skill_id ?? null,
      name: data.name,
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
      description: data.description ?? null,
      category: data.category ?? null,
      status: 'active',
      source: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.skills.push(skill);
    return skill;
  }

  async getSkillById(userId: string, skillId: string): Promise<SkillDto | null> {
    const s = this.skills.find((x) => x.id === skillId && x.user_id === userId);
    return s ? { ...s } : null;
  }

  async getSkillBySlug(userId: string, slug: string): Promise<SkillDto | null> {
    const s = this.skills.find((x) => x.slug === slug && x.user_id === userId);
    return s ? { ...s } : null;
  }

  async listSkills(userId: string): Promise<SkillDto[]> {
    return this.skills.filter((x) => x.user_id === userId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateSkill(userId: string, skillId: string, data: any): Promise<SkillDto> {
    const idx = this.skills.findIndex((x) => x.id === skillId && x.user_id === userId);
    if (idx === -1) throw new Error('Skill not found');
    this.skills[idx] = { ...this.skills[idx]!, ...data, updated_at: new Date().toISOString() };
    return this.skills[idx]!;
  }

  async archiveSkill(userId: string, skillId: string): Promise<SkillDto> {
    return this.updateSkill(userId, skillId, { status: 'archived' });
  }

  async deleteSkill(userId: string, skillId: string): Promise<void> {
    this.skills = this.skills.filter((x) => !(x.id === skillId && x.user_id === userId));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async linkEvidence(userId: string, data: any): Promise<any> {
    const current = this.evidenceMap.get(data.skill_id) || [];
    if (!current.includes(data.evidence_id)) {
      current.push(data.evidence_id);
      this.evidenceMap.set(data.skill_id, current);
    }
    return { ...data, user_id: userId, created_at: new Date().toISOString() };
  }

  async unlinkEvidence(_userId: string, evidenceId: string, skillId: string): Promise<void> {
    const current = this.evidenceMap.get(skillId) || [];
    this.evidenceMap.set(
      skillId,
      current.filter((id) => id !== evidenceId)
    );
  }

  async getEvidenceForSkill(_userId: string, skillId: string): Promise<EvidenceDto[]> {
    const ids = this.evidenceMap.get(skillId) || [];
    return ids.map((id) => this.evidenceStore.get(id)!).filter(Boolean);
  }

  async getSkillsForEvidence(_userId: string, evidenceId: string): Promise<SkillDto[]> {
    const skillIds: string[] = [];
    for (const [skId, evIds] of this.evidenceMap.entries()) {
      if (evIds.includes(evidenceId)) skillIds.push(skId);
    }
    return this.skills.filter((s) => skillIds.includes(s.id));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async linkGoal(userId: string, data: any): Promise<any> {
    const link = { ...data, user_id: userId, created_at: new Date().toISOString() };
    this.goalLinks.push(link);
    return link;
  }

  async unlinkGoal(_userId: string, goalId: string, skillId: string): Promise<void> {
    this.goalLinks = this.goalLinks.filter((l) => !(l.goal_id === goalId && l.skill_id === skillId));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getGoalsForSkill(_userId: string, skillId: string): Promise<any[]> {
    return this.goalLinks
      .filter((l) => l.skill_id === skillId)
      .map((l) => ({
        id: l.goal_id,
        title: 'Goal Title',
        status: 'active',
        target_mastery_state: l.target_mastery_state,
      }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async linkTask(userId: string, data: any): Promise<any> {
    const link = { ...data, user_id: userId, created_at: new Date().toISOString() };
    this.taskLinks.push(link);
    return link;
  }

  async unlinkTask(_userId: string, taskId: string, skillId: string): Promise<void> {
    this.taskLinks = this.taskLinks.filter((l) => !(l.task_id === taskId && l.skill_id === skillId));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getTasksForSkill(_userId: string, skillId: string): Promise<any[]> {
    return this.taskLinks
      .filter((l) => l.skill_id === skillId)
      .map((l) => ({
        id: l.task_id,
        title: 'Task Title',
        status: 'completed',
      }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async linkTopic(userId: string, data: any): Promise<any> {
    const link = { ...data, user_id: userId, created_at: new Date().toISOString() };
    this.topicLinks.push(link);
    return link;
  }

  async unlinkTopic(_userId: string, topicId: string, skillId: string): Promise<void> {
    this.topicLinks = this.topicLinks.filter((l) => !(l.topic_id === topicId && l.skill_id === skillId));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getTopicsForSkill(_userId: string, skillId: string): Promise<any[]> {
    return this.topicLinks
      .filter((l) => l.skill_id === skillId)
      .map((l) => ({
        id: l.topic_id,
        name: 'Topic Name',
        status: 'covered',
        subject_id: 'subj-1',
        subject_name: 'DBMS',
      }));
  }

  async getChildSkills(_userId: string, parentSkillId: string): Promise<SkillDto[]> {
    return this.skills.filter((s) => s.parent_skill_id === parentSkillId);
  }
}

describe('Mastery Engine & Skills Domain Module', () => {
  const refTime = '2026-10-03T12:00:00.000Z';

  const makeEvidence = (overrides: Partial<EvidenceDto> = {}): EvidenceDto => ({
    id: `ev-${Math.random()}`,
    user_id: 'user-1',
    evidence_type: 'task_completion',
    title: 'Completed Practice',
    description: null,
    source_type: 'task',
    source_id: 'task-1',
    source_reference: null,
    external_url: null,
    occurred_at: '2026-10-01T10:00:00.000Z',
    recorded_at: '2026-10-01T10:00:00.000Z',
    verification_status: 'verified',
    evidence_strength: 'medium',
    reliability: 'high',
    directness: 'direct',
    notes: null,
    metadata: {},
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    links: [],
    ...overrides,
  });

  describe('calculateSkillMastery (Deterministic Pure Function)', () => {
    it('returns unknown and 0 score when no evidence exists', () => {
      const res = calculateSkillMastery({ evidence: [], referenceTimestamp: refTime });
      expect(res.state).toBe('unknown');
      expect(res.score).toBe(0);
      expect(res.confidence).toBe('low');
      expect(res.health).toBe('inactive');
      expect(res.explanation).toContain('No evidence recorded yet');
    });

    it('returns identical results for identical inputs (deterministic)', () => {
      const evList = [
        makeEvidence({ evidence_strength: 'high', verification_status: 'verified' }),
        makeEvidence({ evidence_strength: 'medium', source_type: 'assessment' }),
      ];

      const res1 = calculateSkillMastery({ evidence: evList, referenceTimestamp: refTime });
      const res2 = calculateSkillMastery({ evidence: evList, referenceTimestamp: refTime });

      expect(res1).toEqual(res2);
    });

    it('filters out rejected evidence', () => {
      const rejected = makeEvidence({ verification_status: 'rejected', evidence_strength: 'high' });
      const res = calculateSkillMastery({ evidence: [rejected], referenceTimestamp: refTime });

      expect(res.score).toBe(0);
      expect(res.state).toBe('unknown');
      expect(res.explanation).toContain('rejected');
    });

    it('demonstrates that a single verified high-strength item beats multiple weak items', () => {
      const singleStrong = [
        makeEvidence({
          evidence_strength: 'high',
          verification_status: 'verified',
          reliability: 'high',
          directness: 'direct',
        }),
      ];
      const multipleWeak = [
        makeEvidence({ evidence_strength: 'low', verification_status: 'unverified', reliability: 'low', directness: 'indirect' }),
        makeEvidence({ evidence_strength: 'low', verification_status: 'unverified', reliability: 'low', directness: 'indirect' }),
        makeEvidence({ evidence_strength: 'low', verification_status: 'unverified', reliability: 'low', directness: 'indirect' }),
      ];

      const strongRes = calculateSkillMastery({ evidence: singleStrong, referenceTimestamp: refTime });
      const weakRes = calculateSkillMastery({ evidence: multipleWeak, referenceTimestamp: refTime });

      expect(strongRes.score).toBeGreaterThan(weakRes.score);
    });

    it('transitions to needs_review when evidence is older than 180 days', () => {
      const oldEvidence = [
        makeEvidence({
          occurred_at: '2026-03-01T00:00:00.000Z',
          evidence_strength: 'high',
          verification_status: 'verified',
        }),
        makeEvidence({
          occurred_at: '2026-03-05T00:00:00.000Z',
          evidence_strength: 'high',
          verification_status: 'verified',
        }),
      ];

      const res = calculateSkillMastery({ evidence: oldEvidence, referenceTimestamp: refTime });
      expect(res.state).toBe('needs_review');
      expect(res.health).toBe('needs_attention');
      expect(res.explanation).toContain('not been reinforced in over 180 days');
    });

    it('awards high confidence only for diverse, verified, and recent evidence', () => {
      const diverseEvidence = [
        makeEvidence({ source_type: 'task', verification_status: 'verified', occurred_at: '2026-09-20T00:00:00Z' }),
        makeEvidence({ source_type: 'assessment', verification_status: 'verified', occurred_at: '2026-09-25T00:00:00Z' }),
        makeEvidence({ source_type: 'focus_session', verification_status: 'verified', occurred_at: '2026-09-28T00:00:00Z' }),
        makeEvidence({ source_type: 'user', verification_status: 'unverified', occurred_at: '2026-10-01T00:00:00Z' }),
      ];

      const res = calculateSkillMastery({ evidence: diverseEvidence, referenceTimestamp: refTime });
      expect(res.confidence).toBe('high');
      expect(res.score).toBeGreaterThanOrEqual(45);
    });
  });

  describe('SkillsService & Hierarchy Logic', () => {
    let repo: MockSkillsRepository;
    let service: SkillsService;

    beforeEach(() => {
      repo = new MockSkillsRepository();
      service = new SkillsService(repo);
    });

    it('creates skill and auto-generates slug', async () => {
      const skill = await service.createSkill('user-1', {
        name: 'PostgreSQL Database',
      });
      expect(skill.name).toBe('PostgreSQL Database');
      expect(skill.slug).toBe('postgresql-database');
    });

    it('rejects self-parenting on update', async () => {
      const skill = await service.createSkill('user-1', { name: 'React' });
      await expect(
        service.updateSkill('user-1', skill.id, { parent_skill_id: skill.id })
      ).rejects.toThrow(/cannot be its own parent/);
    });

    it('detects and prevents hierarchy cycles (A -> B -> A)', async () => {
      const skillA = await service.createSkill('user-1', { name: 'Root' });
      const skillB = await service.createSkill('user-1', { name: 'Child', parent_skill_id: skillA.id });

      // Attempt to make A the child of B
      await expect(
        service.updateSkill('user-1', skillA.id, { parent_skill_id: skillB.id })
      ).rejects.toThrow(/Circular hierarchy detected/);
    });

    it('assembles skill detail with all relations', async () => {
      const skill = await service.createSkill('user-1', { name: 'Algorithms' });
      const ev = makeEvidence({ id: 'ev-1' });
      repo.evidenceStore.set('ev-1', ev);

      await service.linkEvidence('user-1', { skill_id: skill.id, evidence_id: 'ev-1' });
      await service.linkGoal('user-1', { skill_id: skill.id, goal_id: 'g-1', target_mastery_state: 'proficient' });
      await service.linkTask('user-1', { skill_id: skill.id, task_id: 't-1' });
      await service.linkTopic('user-1', { skill_id: skill.id, topic_id: 'top-1' });

      const detail = await service.getSkillDetail('user-1', skill.id);
      expect(detail.skill.id).toBe(skill.id);
      expect(detail.evidence).toHaveLength(1);
      expect(detail.goals).toHaveLength(1);
      expect(detail.tasks).toHaveLength(1);
      expect(detail.topics).toHaveLength(1);
      expect(detail.mastery.evidence_count).toBe(1);
    });
  });

  describe('HTTP API Endpoints', () => {
    it('requires authentication for /api/v1/skills', async () => {
      const app = buildApp();
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/skills',
      });
      expect(res.statusCode).toBe(401);
    });

    it('supports authenticated CRUD and mastery queries with mock auth hook', async () => {
      const repo = new MockSkillsRepository();
      const service = new SkillsService(repo);

      // Create app with bypass auth middleware for testing
      const testRoutes = createSkillsRoutes({
        requireAuthMiddleware: async (req) => {
          req.auth = { clerkUserId: 'clerk_test', profileId: 'user-1' };
        },
        skillsController: new SkillsController(service),
      });

      const fastify = (await import('fastify')).default();
      fastify.register(testRoutes);
      await fastify.ready();

      // 1. Create skill
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/skills',
        payload: {
          name: 'Distributed Systems',
          category: 'Engineering',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.body).data;
      expect(created.name).toBe('Distributed Systems');

      // 2. List skills
      const listRes = await fastify.inject({
        method: 'GET',
        url: '/api/v1/skills',
      });
      expect(listRes.statusCode).toBe(200);
      const listData = JSON.parse(listRes.body).data;
      expect(listData).toHaveLength(1);
      expect(listData[0].mastery.state).toBe('unknown');

      // 3. Get mastery
      const masteryRes = await fastify.inject({
        method: 'GET',
        url: `/api/v1/skills/${created.id}/mastery`,
      });
      expect(masteryRes.statusCode).toBe(200);
      const masteryData = JSON.parse(masteryRes.body).data;
      expect(masteryData.score).toBe(0);

      // 4. Archive skill
      const archiveRes = await fastify.inject({
        method: 'POST',
        url: `/api/v1/skills/${created.id}/archive`,
      });
      expect(archiveRes.statusCode).toBe(200);
      expect(JSON.parse(archiveRes.body).data.status).toBe('archived');
    });
  });
});
