import { beforeEach, describe, expect, it } from 'vitest';
import {
  CareerConflictError,
  CareerNotFoundError,
} from './career.repository';
import { InMemoryCareerRepository } from './career.repository.impl';

describe('Phase 16B Career Domain Repository Layer & Invariants', () => {
  let repo: InMemoryCareerRepository;

  const ALICE_ID = '11111111-1111-4111-8111-111111111111';
  const BOB_ID = '22222222-2222-4222-8222-222222222222';

  // Seed mocked external dependencies
  const ALICE_GOAL_ID = '33333333-3333-4333-8333-333333333331';
  const BOB_GOAL_ID = '33333333-3333-4333-8333-333333333332';

  const ALICE_SKILL_1 = '44444444-4444-4444-8444-444444444441';
  const ALICE_SKILL_2 = '44444444-4444-4444-8444-444444444442';
  const BOB_SKILL_1 = '44444444-4444-4444-8444-444444444443';

  const ALICE_PROJECT_1 = '55555555-5555-4555-8555-555555555551';
  const BOB_PROJECT_1 = '55555555-5555-4555-8555-555555555552';

  beforeEach(() => {
    repo = new InMemoryCareerRepository();

    // Populate mock entities
    repo.goals = [
      { id: ALICE_GOAL_ID, user_id: ALICE_ID, title: 'Land Staff SWE Role' },
      { id: BOB_GOAL_ID, user_id: BOB_ID, title: "Bob's Goal" },
    ];

    repo.skills = [
      { id: ALICE_SKILL_1, user_id: ALICE_ID, name: 'Distributed Systems', slug: 'distributed-systems', category: 'Backend' },
      { id: ALICE_SKILL_2, user_id: ALICE_ID, name: 'Kubernetes', slug: 'kubernetes', category: 'DevOps' },
      { id: BOB_SKILL_1, user_id: BOB_ID, name: 'Solidity', slug: 'solidity', category: 'Blockchain' },
    ];

    repo.projects = [
      { id: ALICE_PROJECT_1, user_id: ALICE_ID, title: 'Raft Consensus Engine', slug: 'raft-consensus', status: 'completed' },
      { id: BOB_PROJECT_1, user_id: BOB_ID, title: "Bob's Crypto Wallet", slug: 'bobs-wallet', status: 'in_progress' },
    ];
  });

  // ============================================================================
  // 1. Career Targets CRUD & Invariants
  // ============================================================================
  describe('1. Career Targets', () => {
    it('creates a career target with all valid fields', async () => {
      const created = await repo.createTarget(ALICE_ID, {
        title: 'Backend Staff Role 2026',
        target_role: 'Staff Software Engineer',
        target_locations: ['San Francisco, CA', 'Remote'],
        employment_type: 'full_time',
        target_date: '2026-12-31',
        min_compensation: 250000,
        currency: 'USD',
        is_primary: true,
        notes: 'Targeting Tier-1 infrastructure platforms',
        goal_id: ALICE_GOAL_ID,
      });

      expect(created.id).toBeDefined();
      expect(created.user_id).toBe(ALICE_ID);
      expect(created.title).toBe('Backend Staff Role 2026');
      expect(created.target_role).toBe('Staff Software Engineer');
      expect(created.target_locations).toEqual(['San Francisco, CA', 'Remote']);
      expect(created.employment_type).toBe('full_time');
      expect(created.min_compensation).toBe(250000);
      expect(created.currency).toBe('USD');
      expect(created.is_primary).toBe(true);
      expect(created.goal_id).toBe(ALICE_GOAL_ID);
    });

    it('enforces single primary career target invariant per user', async () => {
      const t1 = await repo.createTarget(ALICE_ID, {
        title: 'Primary Target 1',
        target_role: 'Role 1',
        is_primary: true,
      });
      expect(t1.is_primary).toBe(true);

      const t2 = await repo.createTarget(ALICE_ID, {
        title: 'Primary Target 2',
        target_role: 'Role 2',
        is_primary: true,
      });
      expect(t2.is_primary).toBe(true);

      // t1 should now be un-primary
      const refetchedT1 = await repo.getTargetById(ALICE_ID, t1.id);
      expect(refetchedT1?.is_primary).toBe(false);

      // Explicit setPrimaryTarget switches it back
      await repo.setPrimaryTarget(ALICE_ID, t1.id);
      const refetchedT1Again = await repo.getTargetById(ALICE_ID, t1.id);
      const refetchedT2Again = await repo.getTargetById(ALICE_ID, t2.id);
      expect(refetchedT1Again?.is_primary).toBe(true);
      expect(refetchedT2Again?.is_primary).toBe(false);
    });

    it('does not affect other users primary targets when switching primary', async () => {
      const aliceTarget = await repo.createTarget(ALICE_ID, {
        title: 'Alice Target',
        target_role: 'Role A',
        is_primary: true,
      });
      const bobTarget = await repo.createTarget(BOB_ID, {
        title: 'Bob Target',
        target_role: 'Role B',
        is_primary: true,
      });

      expect(aliceTarget.is_primary).toBe(true);
      expect(bobTarget.is_primary).toBe(true);

      // Alice creates another primary
      await repo.createTarget(ALICE_ID, {
        title: 'Alice Target 2',
        target_role: 'Role A2',
        is_primary: true,
      });

      // Bob target remains unaffected
      const bobRefetched = await repo.getTargetById(BOB_ID, bobTarget.id);
      expect(bobRefetched?.is_primary).toBe(true);
    });

    it('rejects cross-user goal linkage on career target creation', async () => {
      await expect(
        repo.createTarget(ALICE_ID, {
          title: 'Alice Target with Bob Goal',
          target_role: 'Engineer',
          goal_id: BOB_GOAL_ID, // Belongs to Bob
        })
      ).rejects.toThrow(CareerNotFoundError);
    });

    it('retrieves target detail with joined skills and goal title', async () => {
      const target = await repo.createTarget(ALICE_ID, {
        title: 'Target with Skills',
        target_role: 'Architect',
        goal_id: ALICE_GOAL_ID,
      });

      await repo.addTargetSkill(ALICE_ID, target.id, {
        skill_id: ALICE_SKILL_1,
        importance: 'required',
      });

      const detail = await repo.getTargetDetail(ALICE_ID, target.id);
      expect(detail).not.toBeNull();
      expect(detail?.goal_title).toBe('Land Staff SWE Role');
      expect(detail?.skills).toHaveLength(1);
      expect(detail?.skills[0]?.skill_name).toBe('Distributed Systems');
    });

    it('updates career target fields preserving unmentioned attributes', async () => {
      const target = await repo.createTarget(ALICE_ID, {
        title: 'Old Title',
        target_role: 'Old Role',
        min_compensation: 100000,
      });

      const updated = await repo.updateTarget(ALICE_ID, target.id, {
        title: 'New Title',
        min_compensation: 180000,
      });

      expect(updated?.title).toBe('New Title');
      expect(updated?.target_role).toBe('Old Role');
      expect(updated?.min_compensation).toBe(180000);
    });

    it('deletes career target and cascades target-skill links', async () => {
      const target = await repo.createTarget(ALICE_ID, {
        title: 'To Delete',
        target_role: 'Delete',
      });
      await repo.addTargetSkill(ALICE_ID, target.id, {
        skill_id: ALICE_SKILL_1,
        importance: 'required',
      });

      const deleted = await repo.deleteTarget(ALICE_ID, target.id);
      expect(deleted).toBe(true);

      const found = await repo.getTargetById(ALICE_ID, target.id);
      expect(found).toBeNull();

      const skills = await repo.listTargetSkills(ALICE_ID, target.id);
      expect(skills).toHaveLength(0);
    });

    it('supports pagination and search filtering on target listing', async () => {
      await repo.createTarget(ALICE_ID, { title: 'Backend Lead', target_role: 'Backend' });
      await repo.createTarget(ALICE_ID, { title: 'Frontend Lead', target_role: 'Frontend' });
      await repo.createTarget(ALICE_ID, { title: 'ML Researcher', target_role: 'ML' });

      const searchResult = await repo.listTargets(ALICE_ID, { search: 'Backend' });
      expect(searchResult.data).toHaveLength(1);
      expect(searchResult.data[0]?.title).toBe('Backend Lead');

      const paginated = await repo.listTargets(ALICE_ID, { page: 1, pageSize: 2 });
      expect(paginated.data).toHaveLength(2);
      expect(paginated.pagination.total).toBe(3);
      expect(paginated.pagination.totalPages).toBe(2);
    });
  });

  // ============================================================================
  // 2. Career Target Skills
  // ============================================================================
  describe('2. Career Target Skills', () => {
    it('attaches skill to career target with importance level', async () => {
      const target = await repo.createTarget(ALICE_ID, { title: 'Target', target_role: 'Role' });
      const skillLink = await repo.addTargetSkill(ALICE_ID, target.id, {
        skill_id: ALICE_SKILL_1,
        importance: 'required',
      });

      expect(skillLink.id).toBeDefined();
      expect(skillLink.importance).toBe('required');
      expect(skillLink.skill_name).toBe('Distributed Systems');
    });

    it('rejects duplicate skill attachments to the same target', async () => {
      const target = await repo.createTarget(ALICE_ID, { title: 'Target', target_role: 'Role' });
      await repo.addTargetSkill(ALICE_ID, target.id, { skill_id: ALICE_SKILL_1, importance: 'required' });

      await expect(
        repo.addTargetSkill(ALICE_ID, target.id, { skill_id: ALICE_SKILL_1, importance: 'preferred' })
      ).rejects.toThrow(CareerConflictError);
    });

    it('rejects attaching another user skill to own target', async () => {
      const target = await repo.createTarget(ALICE_ID, { title: 'Alice Target', target_role: 'Role' });
      await expect(
        repo.addTargetSkill(ALICE_ID, target.id, {
          skill_id: BOB_SKILL_1, // Bob's skill
          importance: 'required',
        })
      ).rejects.toThrow(CareerNotFoundError);
    });

    it('updates skill importance on target', async () => {
      const target = await repo.createTarget(ALICE_ID, { title: 'Target', target_role: 'Role' });
      await repo.addTargetSkill(ALICE_ID, target.id, { skill_id: ALICE_SKILL_1, importance: 'required' });

      const updated = await repo.updateTargetSkill(ALICE_ID, target.id, ALICE_SKILL_1, { importance: 'bonus' });
      expect(updated?.importance).toBe('bonus');
    });

    it('removes skill from target', async () => {
      const target = await repo.createTarget(ALICE_ID, { title: 'Target', target_role: 'Role' });
      await repo.addTargetSkill(ALICE_ID, target.id, { skill_id: ALICE_SKILL_1, importance: 'required' });

      const removed = await repo.removeTargetSkill(ALICE_ID, target.id, ALICE_SKILL_1);
      expect(removed).toBe(true);

      const list = await repo.listTargetSkills(ALICE_ID, target.id);
      expect(list).toHaveLength(0);
    });
  });

  // ============================================================================
  // 3. Career Opportunities CRUD & Skills
  // ============================================================================
  describe('3. Career Opportunities & Opportunity Skills', () => {
    it('creates career opportunity with all valid fields', async () => {
      const target = await repo.createTarget(ALICE_ID, { title: 'Target', target_role: 'Role' });
      const opp = await repo.createOpportunity(ALICE_ID, {
        company_name: 'Stripe',
        role_title: 'Staff Infrastructure Engineer',
        target_id: target.id,
        employment_type: 'full_time',
        location_type: 'remote',
        location: 'US Remote',
        source: 'referral',
        job_url: 'https://stripe.com/jobs/staff-infra',
        salary_min: 220000,
        salary_max: 280000,
        salary_currency: 'USD',
        status: 'active',
      });

      expect(opp.id).toBeDefined();
      expect(opp.company_name).toBe('Stripe');
      expect(opp.salary_min).toBe(220000);
      expect(opp.salary_max).toBe(280000);
      expect(opp.target_id).toBe(target.id);
    });

    it('rejects attaching another user target to opportunity', async () => {
      const bobTarget = await repo.createTarget(BOB_ID, { title: "Bob's Target", target_role: 'Role' });

      await expect(
        repo.createOpportunity(ALICE_ID, {
          company_name: 'Apple',
          role_title: 'SWE',
          target_id: bobTarget.id, // Bob's target
        })
      ).rejects.toThrow(CareerNotFoundError);
    });

    it('attaches, updates, and removes opportunity skills', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, { company_name: 'Datadog', role_title: 'Core Backend' });

      const added = await repo.addOpportunitySkill(ALICE_ID, opp.id, {
        skill_id: ALICE_SKILL_2,
        importance: 'required',
      });
      expect(added.importance).toBe('required');
      expect(added.skill_name).toBe('Kubernetes');

      const updated = await repo.updateOpportunitySkill(ALICE_ID, opp.id, ALICE_SKILL_2, {
        importance: 'preferred',
      });
      expect(updated?.importance).toBe('preferred');

      const skills = await repo.listOpportunitySkills(ALICE_ID, opp.id);
      expect(skills).toHaveLength(1);

      const removed = await repo.removeOpportunitySkill(ALICE_ID, opp.id, ALICE_SKILL_2);
      expect(removed).toBe(true);
    });

    it('retrieves opportunity detail with joined target and skills', async () => {
      const target = await repo.createTarget(ALICE_ID, { title: 'Platform Goal', target_role: 'Platform' });
      const opp = await repo.createOpportunity(ALICE_ID, {
        company_name: 'Netflix',
        role_title: 'Senior Platform Engineer',
        target_id: target.id,
      });
      await repo.addOpportunitySkill(ALICE_ID, opp.id, { skill_id: ALICE_SKILL_1, importance: 'required' });

      const detail = await repo.getOpportunityDetail(ALICE_ID, opp.id);
      expect(detail).not.toBeNull();
      expect(detail?.target_title).toBe('Platform Goal');
      expect(detail?.skills).toHaveLength(1);
    });
  });

  // ============================================================================
  // 4. Career Applications CRUD & Boundary
  // ============================================================================
  describe('4. Career Applications', () => {
    it('creates application and automatically records initial history record', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, { company_name: 'Meta', role_title: 'E6 SWE' });

      const app = await repo.createApplication(ALICE_ID, {
        opportunity_id: opp.id,
        stage: 'saved',
        notes: 'Bookmarked for referral outreach',
      });

      expect(app.id).toBeDefined();
      expect(app.stage).toBe('saved');
      expect(app.opportunity_id).toBe(opp.id);

      // Verify history has initial record
      const history = await repo.listApplicationHistory(ALICE_ID, app.id);
      expect(history).toHaveLength(1);
      expect(history[0]?.from_stage).toBeNull();
      expect(history[0]?.to_stage).toBe('saved');
      expect(history[0]?.notes).toBe('Initial application entry created');
    });

    it('rejects duplicate application for the same opportunity per user', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, { company_name: 'Figma', role_title: 'Systems SWE' });

      await repo.createApplication(ALICE_ID, { opportunity_id: opp.id, stage: 'saved' });

      await expect(
        repo.createApplication(ALICE_ID, { opportunity_id: opp.id, stage: 'applied' })
      ).rejects.toThrow(CareerConflictError);
    });

    it('rejects creating application for another user opportunity', async () => {
      const bobOpp = await repo.createOpportunity(BOB_ID, { company_name: 'Google', role_title: 'L5 SWE' });

      await expect(
        repo.createApplication(ALICE_ID, { opportunity_id: bobOpp.id, stage: 'saved' })
      ).rejects.toThrow(CareerNotFoundError);
    });

    it('retrieves application detail with joined composite data', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, { company_name: 'Uber', role_title: 'Staff SWE' });
      const app = await repo.createApplication(ALICE_ID, { opportunity_id: opp.id, stage: 'applied' });

      await repo.attachApplicationProject(ALICE_ID, app.id, {
        project_id: ALICE_PROJECT_1,
        is_featured: true,
        talking_points: 'Distributed consensus implementation',
      });

      await repo.createInterview(ALICE_ID, app.id, {
        round_number: 1,
        round_type: 'technical_dsa',
        duration_minutes: 60,
      });

      const detail = await repo.getApplicationDetail(ALICE_ID, app.id);
      expect(detail).not.toBeNull();
      expect(detail?.opportunity?.company_name).toBe('Uber');
      expect(detail?.projects).toHaveLength(1);
      expect(detail?.interviews).toHaveLength(1);
      expect(detail?.history).toHaveLength(1);
    });
  });

  // ============================================================================
  // 5. Application History Boundary (Phase 16C Boundary Enforced)
  // ============================================================================
  describe('5. Application History Boundary', () => {
    it('records application history transition with from_stage and to_stage', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, { company_name: 'Coinbase', role_title: 'Backend' });
      const app = await repo.createApplication(ALICE_ID, { opportunity_id: opp.id, stage: 'saved' });

      const hist = await repo.recordApplicationHistory(ALICE_ID, app.id, {
        from_stage: 'saved',
        to_stage: 'applied',
        notes: 'Submitted via employee referral',
      });

      expect(hist.from_stage).toBe('saved');
      expect(hist.to_stage).toBe('applied');
      expect(hist.notes).toBe('Submitted via employee referral');

      const historyList = await repo.listApplicationHistory(ALICE_ID, app.id);
      expect(historyList).toHaveLength(2);
      expect(historyList[0]?.to_stage).toBe('applied'); // newest first
    });

    it('atomically updates application stage and records history in updateApplicationStageWithHistory', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, { company_name: 'Airbnb', role_title: 'Infrastructure' });
      const app = await repo.createApplication(ALICE_ID, { opportunity_id: opp.id, stage: 'screening' });

      const result = await repo.updateApplicationStageWithHistory(
        ALICE_ID,
        app.id,
        'interview',
        'Passed recruiter screen, scheduled round 1'
      );

      expect(result.application.stage).toBe('interview');
      expect(result.history.from_stage).toBe('screening');
      expect(result.history.to_stage).toBe('interview');
      expect(result.history.notes).toContain('Passed recruiter screen');

      // Verify persistence
      const refetchedApp = await repo.getApplicationById(ALICE_ID, app.id);
      expect(refetchedApp?.stage).toBe('interview');
    });

    it('does not expose general-purpose history update or delete methods on repository', () => {
      // Intentionally verify repository contract has NO history update/delete methods
      const repositoryUnknown = repo as unknown as Record<string, unknown>;
      expect(repositoryUnknown['updateApplicationHistory']).toBeUndefined();
      expect(repositoryUnknown['deleteApplicationHistory']).toBeUndefined();
    });
  });

  // ============================================================================
  // 6. Career Application Projects
  // ============================================================================
  describe('6. Career Application Projects', () => {
    it('attaches, updates, and removes application project link', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, { company_name: 'Palantir', role_title: 'Forward Deployed' });
      const app = await repo.createApplication(ALICE_ID, { opportunity_id: opp.id, stage: 'applied' });

      const link = await repo.attachApplicationProject(ALICE_ID, app.id, {
        project_id: ALICE_PROJECT_1,
        is_featured: false,
        talking_points: 'High throughput Paxos implementation',
      });

      expect(link.is_featured).toBe(false);
      expect(link.project_title).toBe('Raft Consensus Engine');

      const updated = await repo.updateApplicationProject(ALICE_ID, app.id, ALICE_PROJECT_1, {
        is_featured: true,
        talking_points: 'Updated talking points for VP interview',
      });
      expect(updated?.is_featured).toBe(true);

      const list = await repo.listApplicationProjects(ALICE_ID, app.id);
      expect(list).toHaveLength(1);

      const removed = await repo.removeApplicationProject(ALICE_ID, app.id, ALICE_PROJECT_1);
      expect(removed).toBe(true);
    });

    it('rejects attaching another user project to own application', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, { company_name: 'Apple', role_title: 'SWE' });
      const app = await repo.createApplication(ALICE_ID, { opportunity_id: opp.id, stage: 'applied' });

      await expect(
        repo.attachApplicationProject(ALICE_ID, app.id, {
          project_id: BOB_PROJECT_1, // Bob's project
          is_featured: true,
        })
      ).rejects.toThrow(CareerNotFoundError);
    });

    it('rejects duplicate project attachment to the same application', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, { company_name: 'Apple', role_title: 'SWE' });
      const app = await repo.createApplication(ALICE_ID, { opportunity_id: opp.id, stage: 'applied' });

      await repo.attachApplicationProject(ALICE_ID, app.id, { project_id: ALICE_PROJECT_1 });

      await expect(
        repo.attachApplicationProject(ALICE_ID, app.id, { project_id: ALICE_PROJECT_1 })
      ).rejects.toThrow(CareerConflictError);
    });
  });

  // ============================================================================
  // 7. Career Interviews
  // ============================================================================
  describe('7. Career Interviews', () => {
    it('creates, retrieves, updates, and deletes interview round', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, { company_name: 'Snowflake', role_title: 'Database Kernel' });
      const app = await repo.createApplication(ALICE_ID, { opportunity_id: opp.id, stage: 'interview' });

      const interview = await repo.createInterview(ALICE_ID, app.id, {
        round_number: 1,
        round_type: 'technical_dsa',
        scheduled_at: '2026-11-15T14:00:00.000Z',
        duration_minutes: 60,
        meeting_link: 'https://meet.google.com/abc-defg-hij',
        status: 'scheduled',
        result: 'pending',
        interviewer_names: ['Jane Senior Staff'],
        notes: 'Prepare graphs and concurrency',
      });

      expect(interview.id).toBeDefined();
      expect(interview.round_number).toBe(1);
      expect(interview.round_type).toBe('technical_dsa');

      const updated = await repo.updateInterview(ALICE_ID, interview.id, {
        status: 'completed',
        result: 'passed',
        notes: 'Crushed graph traversal question in 30 mins',
      });
      expect(updated?.status).toBe('completed');
      expect(updated?.result).toBe('passed');

      const list = await repo.listInterviews(ALICE_ID, { application_id: app.id });
      expect(list.data).toHaveLength(1);

      const deleted = await repo.deleteInterview(ALICE_ID, interview.id);
      expect(deleted).toBe(true);
    });

    it('rejects creating interview for another user application', async () => {
      const bobOpp = await repo.createOpportunity(BOB_ID, { company_name: 'Google', role_title: 'SWE' });
      const bobApp = await repo.createApplication(BOB_ID, { opportunity_id: bobOpp.id });

      await expect(
        repo.createInterview(ALICE_ID, bobApp.id, {
          round_number: 1,
          round_type: 'recruiter_screen',
        })
      ).rejects.toThrow(CareerNotFoundError);
    });
  });

  // ============================================================================
  // 8. Multi-Tenant Isolation & IDOR Protection
  // ============================================================================
  describe('8. Tenant Isolation & IDOR Protection', () => {
    it('does not reveal whether another user record exists on read', async () => {
      const bobTarget = await repo.createTarget(BOB_ID, { title: "Bob's Target", target_role: 'Role' });
      const bobOpp = await repo.createOpportunity(BOB_ID, { company_name: "Bob's Co", role_title: 'Role' });
      const bobApp = await repo.createApplication(BOB_ID, { opportunity_id: bobOpp.id });
      const bobInterview = await repo.createInterview(BOB_ID, bobApp.id, { round_number: 1 });

      // Alice querying Bob's IDs returns null cleanly without IDOR leakage
      expect(await repo.getTargetById(ALICE_ID, bobTarget.id)).toBeNull();
      expect(await repo.getTargetDetail(ALICE_ID, bobTarget.id)).toBeNull();
      expect(await repo.getOpportunityById(ALICE_ID, bobOpp.id)).toBeNull();
      expect(await repo.getOpportunityDetail(ALICE_ID, bobOpp.id)).toBeNull();
      expect(await repo.getApplicationById(ALICE_ID, bobApp.id)).toBeNull();
      expect(await repo.getApplicationDetail(ALICE_ID, bobApp.id)).toBeNull();
      expect(await repo.getInterviewById(ALICE_ID, bobInterview.id)).toBeNull();
    });

    it('prevents cross-user updates and deletes returning null or false', async () => {
      const bobTarget = await repo.createTarget(BOB_ID, { title: "Bob's Target", target_role: 'Role' });
      const bobOpp = await repo.createOpportunity(BOB_ID, { company_name: "Bob's Co", role_title: 'Role' });
      const bobApp = await repo.createApplication(BOB_ID, { opportunity_id: bobOpp.id });
      const bobInterview = await repo.createInterview(BOB_ID, bobApp.id, { round_number: 1 });

      // Alice attempting to update Bob's records returns null
      expect(await repo.updateTarget(ALICE_ID, bobTarget.id, { title: 'Hacked' })).toBeNull();
      expect(await repo.updateOpportunity(ALICE_ID, bobOpp.id, { company_name: 'Hacked' })).toBeNull();
      expect(await repo.updateApplication(ALICE_ID, bobApp.id, { notes: 'Hacked' })).toBeNull();
      expect(await repo.updateInterview(ALICE_ID, bobInterview.id, { notes: 'Hacked' })).toBeNull();

      // Alice attempting to delete Bob's records returns false
      expect(await repo.deleteTarget(ALICE_ID, bobTarget.id)).toBe(false);
      expect(await repo.deleteOpportunity(ALICE_ID, bobOpp.id)).toBe(false);
      expect(await repo.deleteApplication(ALICE_ID, bobApp.id)).toBe(false);
      expect(await repo.deleteInterview(ALICE_ID, bobInterview.id)).toBe(false);

      // Verify Bob's original data remains intact
      const bobRefetched = await repo.getTargetById(BOB_ID, bobTarget.id);
      expect(bobRefetched?.title).toBe("Bob's Target");
    });
  });

  // ============================================================================
  // 9. Transaction Safety, Failure Rollback & Concurrency
  // ============================================================================
  describe('9. Transaction Safety, Failure Rollback & Concurrency', () => {
    it('failed createTarget with is_primary = true preserves existing primary target', async () => {
      const initialPrimary = await repo.createTarget(ALICE_ID, {
        title: 'Initial Primary Target',
        target_role: 'Senior SWE',
        is_primary: true,
      });
      expect(initialPrimary.is_primary).toBe(true);

      // Attempt to create a new primary target with an invalid goal reference (should fail)
      await expect(
        repo.createTarget(ALICE_ID, {
          title: 'Failing New Primary Target',
          target_role: 'Lead SWE',
          is_primary: true,
          goal_id: '99999999-9999-4999-8999-999999999999', // Non-existent goal
        })
      ).rejects.toThrow(CareerNotFoundError);

      // Verify initial primary target was NOT unset by the aborted operation
      const refetched = await repo.getTargetById(ALICE_ID, initialPrimary.id);
      expect(refetched?.is_primary).toBe(true);

      const targets = await repo.listTargets(ALICE_ID, { is_primary: true });
      expect(targets.data).toHaveLength(1);
      expect(targets.data[0]!.id).toBe(initialPrimary.id);
    });

    it('failed updateTarget with is_primary = true preserves existing primary target', async () => {
      const t1 = await repo.createTarget(ALICE_ID, {
        title: 'Target 1 (Primary)',
        target_role: 'Senior SWE',
        is_primary: true,
      });
      const t2 = await repo.createTarget(ALICE_ID, {
        title: 'Target 2 (Secondary)',
        target_role: 'Staff SWE',
        is_primary: false,
      });

      expect(t1.is_primary).toBe(true);
      expect(t2.is_primary).toBe(false);

      // Attempt to promote t2 with an invalid goal_id (fails validation)
      await expect(
        repo.updateTarget(ALICE_ID, t2.id, {
          is_primary: true,
          goal_id: '99999999-9999-4999-8999-999999999999', // Non-existent goal
        })
      ).rejects.toThrow(CareerNotFoundError);

      // Verify t1 is still primary and t2 is still non-primary
      const refetchedT1 = await repo.getTargetById(ALICE_ID, t1.id);
      const refetchedT2 = await repo.getTargetById(ALICE_ID, t2.id);
      expect(refetchedT1?.is_primary).toBe(true);
      expect(refetchedT2?.is_primary).toBe(false);
    });

    it('concurrent primary target switches maintain exactly one primary target invariant', async () => {
      const targets = await Promise.all([
        repo.createTarget(ALICE_ID, { title: 'T1', target_role: 'Role 1', is_primary: true }),
        repo.createTarget(ALICE_ID, { title: 'T2', target_role: 'Role 2', is_primary: false }),
        repo.createTarget(ALICE_ID, { title: 'T3', target_role: 'Role 3', is_primary: false }),
        repo.createTarget(ALICE_ID, { title: 'T4', target_role: 'Role 4', is_primary: false }),
        repo.createTarget(ALICE_ID, { title: 'T5', target_role: 'Role 5', is_primary: false }),
      ]);

      // Trigger concurrent switches to primary
      await Promise.all([
        repo.setPrimaryTarget(ALICE_ID, targets[1]!.id),
        repo.setPrimaryTarget(ALICE_ID, targets[2]!.id),
        repo.setPrimaryTarget(ALICE_ID, targets[3]!.id),
        repo.setPrimaryTarget(ALICE_ID, targets[4]!.id),
      ]);

      const allTargets = await repo.listTargets(ALICE_ID, { pageSize: 100 });
      const primaryCount = allTargets.data.filter((t) => t.is_primary).length;
      expect(primaryCount).toBe(1);
    });

    it('atomically creates application and initial history record together', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, {
        company_name: 'Apple',
        role_title: 'Kernel Engineer',
      });

      const app = await repo.createApplication(ALICE_ID, {
        opportunity_id: opp.id,
        stage: 'applied',
        applied_at: new Date().toISOString(),
      });

      expect(app.id).toBeDefined();
      expect(app.stage).toBe('applied');

      const history = await repo.listApplicationHistory(ALICE_ID, app.id);
      expect(history).toHaveLength(1);
      expect(history[0]!.from_stage).toBeNull();
      expect(history[0]!.to_stage).toBe('applied');
    });

    it('atomically updates application stage and records transition history together', async () => {
      const opp = await repo.createOpportunity(ALICE_ID, {
        company_name: 'Netflix',
        role_title: 'Cloud Systems Engineer',
      });

      const app = await repo.createApplication(ALICE_ID, {
        opportunity_id: opp.id,
        stage: 'applied',
      });

      const { application: updatedApp, history: newHist } =
        await repo.updateApplicationStageWithHistory(
          ALICE_ID,
          app.id,
          'interview',
          'Passed recruiter screen, scheduled system design round'
        );

      expect(updatedApp.stage).toBe('interview');
      expect(newHist.from_stage).toBe('applied');
      expect(newHist.to_stage).toBe('interview');
      expect(newHist.notes).toBe('Passed recruiter screen, scheduled system design round');

      const allHist = await repo.listApplicationHistory(ALICE_ID, app.id);
      expect(allHist).toHaveLength(2);
      expect(allHist[0]!.to_stage).toBe('interview');
      expect(allHist[1]!.to_stage).toBe('applied');
    });
  });
});
