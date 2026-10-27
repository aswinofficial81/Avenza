import fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from '../identity/profile.repository';
import { ProfileService } from '../identity/profile.service';
import { InMemoryCareerRepository } from './career.repository.impl';
import { CareerService } from './career.service';
import { CareerController } from './career.controller';
import { createCareerRoutes } from './career.routes';
import { registerErrorHandler } from '../../plugins/error-handler';

describe('Career Domain API (/api/v1/career)', () => {
  const mockClerkClient: IClerkClient = {
    async verifyBearerToken(token: string) {
      if (token === 'token-alice') {
        return {
          clerkUserId: 'clerk_alice_id',
          displayName: 'Alice Engineer',
        };
      }
      if (token === 'token-bob') {
        return {
          clerkUserId: 'clerk_bob_id',
          displayName: 'Bob Candidate',
        };
      }
      return null;
    },
  };

  const authService = new AuthService(mockClerkClient);
  const profileRepository = new InMemoryProfileRepository();
  const profileService = new ProfileService(profileRepository);
  const requireAuthMiddleware = createRequireAuthMiddleware(authService, profileService);

  const careerRepository = new InMemoryCareerRepository();
  const careerService = new CareerService(careerRepository);
  const careerController = new CareerController(careerService);

  const customCareerRoutes = createCareerRoutes({
    requireAuthMiddleware,
    careerController,
  });

  function createTestApp() {
    const app = fastify();
    registerErrorHandler(app);
    app.register(customCareerRoutes);
    return app;
  }

  const app = createTestApp();

  let aliceProfileId: string;
  let bobProfileId: string;

  let aliceTargetId: string;
  let aliceOpportunityId: string;
  let aliceApplicationId: string;
  let aliceInterviewId: string;

  const mockSkillId = '00000000-0000-0000-0000-000000000101';
  const mockProjectId = '00000000-0000-0000-0000-000000000201';

  it('sets up test profiles for Alice and Bob', async () => {
    const alice = await profileRepository.createProfile({
      clerk_user_id: 'clerk_alice_id',
      display_name: 'Alice Engineer',
    });
    aliceProfileId = alice.id;

    const bob = await profileRepository.createProfile({
      clerk_user_id: 'clerk_bob_id',
      display_name: 'Bob Candidate',
    });
    bobProfileId = bob.id;

    careerRepository.skills.push({
      id: mockSkillId,
      user_id: aliceProfileId,
      name: 'Distributed Systems',
      slug: 'distributed-systems',
      category: 'Backend',
    });

    careerRepository.projects.push({
      id: mockProjectId,
      user_id: aliceProfileId,
      title: 'Raft Consensus Engine',
      slug: 'raft-consensus-engine',
      status: 'active',
    });

    expect(aliceProfileId).toBeDefined();
    expect(bobProfileId).toBeDefined();
  });

  // ==============================================================================
  // 1. Authentication Gate
  // ==============================================================================

  describe('1. Authentication Gate', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/career/targets',
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid bearer token with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/career/targets',
        headers: { authorization: 'Bearer bad-token' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // ==============================================================================
  // 2. Career Target Endpoints
  // ==============================================================================

  describe('2. Career Target Endpoints', () => {
    it('validates schema and rejects missing required fields with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/career/targets',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: '', // empty title violates min(1)
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('creates a career target for Alice', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/career/targets',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Staff Distributed Systems Engineer',
          target_role: 'Staff Systems Engineer',
          target_locations: ['San Francisco, CA', 'Remote'],
          employment_type: 'full_time',
          min_compensation: 250000,
          currency: 'USD',
          is_primary: true,
          notes: 'Focus on distributed consensus and high throughput',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.user_id).toBe(aliceProfileId);
      expect(body.data.title).toBe('Staff Distributed Systems Engineer');
      expect(body.data.is_primary).toBe(true);

      aliceTargetId = body.data.id;
    });

    it('retrieves target detail including empty skills array', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/career/targets/${aliceTargetId}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(aliceTargetId);
      expect(body.data.skills).toEqual([]);
      expect(body.data.opportunity_count).toBe(0);
    });

    it('lists career targets with pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/career/targets?page=1&pageSize=10',
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('updates career target metadata', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/targets/${aliceTargetId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          min_compensation: 280000,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.min_compensation).toBe(280000);
    });

    it('adds and updates target skills', async () => {
      const addRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/targets/${aliceTargetId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          skill_id: mockSkillId,
          importance: 'required',
        },
      });
      expect(addRes.statusCode).toBe(201);
      const addBody = JSON.parse(addRes.body);
      expect(addBody.success).toBe(true);
      expect(addBody.data.skill_id).toBe(mockSkillId);
      expect(addBody.data.importance).toBe('required');

      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/targets/${aliceTargetId}/skills/${mockSkillId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          importance: 'preferred',
        },
      });
      expect(updateRes.statusCode).toBe(200);
      const updateBody = JSON.parse(updateRes.body);
      expect(updateBody.data.importance).toBe('preferred');

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/targets/${aliceTargetId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.body);
      expect(listBody.data.length).toBe(1);
    });

    it('supports primary target toggle', async () => {
      const unsetRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/career/targets/${aliceTargetId}/primary`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(unsetRes.statusCode).toBe(200);
      const unsetBody = JSON.parse(unsetRes.body);
      expect(unsetBody.data.is_primary).toBe(false);

      const setRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/targets/${aliceTargetId}/primary`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(setRes.statusCode).toBe(200);
      const setBody = JSON.parse(setRes.body);
      expect(setBody.data.is_primary).toBe(true);
    });
  });

  // ==============================================================================
  // 3. Career Opportunity Endpoints
  // ==============================================================================

  describe('3. Career Opportunity Endpoints', () => {
    it('validates salary range and rejects salary_max < salary_min with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/career/opportunities',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          company_name: 'Tech Giant',
          role_title: 'Software Engineer',
          salary_min: 150000,
          salary_max: 120000, // Invalid: max < min
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('creates a career opportunity for Alice linked to her target', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/career/opportunities',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          company_name: 'Stripe',
          role_title: 'Staff Infrastructure Engineer',
          target_id: aliceTargetId,
          employment_type: 'full_time',
          location_type: 'remote',
          location: 'San Francisco, CA',
          source: 'linkedin',
          job_url: 'https://stripe.com/jobs/staff-infra',
          salary_min: 220000,
          salary_max: 300000,
          salary_currency: 'USD',
          description: 'Core payment processing pipelines and distributed infrastructure',
          status: 'active',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.company_name).toBe('Stripe');
      expect(body.data.target_id).toBe(aliceTargetId);

      aliceOpportunityId = body.data.id;
    });

    it('retrieves opportunity detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/career/opportunities/${aliceOpportunityId}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(aliceOpportunityId);
      expect(body.data.company_name).toBe('Stripe');
    });

    it('adds and lists opportunity skill requirements', async () => {
      const addRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/opportunities/${aliceOpportunityId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          skill_id: mockSkillId,
          importance: 'required',
        },
      });
      expect(addRes.statusCode).toBe(201);
      const addBody = JSON.parse(addRes.body);
      expect(addBody.success).toBe(true);
      expect(addBody.data.importance).toBe('required');

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/opportunities/${aliceOpportunityId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.body);
      expect(listBody.data.length).toBe(1);
    });
  });

  // ==============================================================================
  // 4. Career Applications & State Machine
  // ==============================================================================

  describe('4. Career Applications & State Machine', () => {
    it('creates an application atomically recording initial history', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/career/applications',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          opportunity_id: aliceOpportunityId,
          stage: 'saved',
          notes: 'Preparing custom resume tailored to Stripe infra',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.opportunity_id).toBe(aliceOpportunityId);
      expect(body.data.stage).toBe('saved');

      aliceApplicationId = body.data.id;

      // Verify that initial history was created atomically
      const histRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${aliceApplicationId}/history`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(histRes.statusCode).toBe(200);
      const histBody = JSON.parse(histRes.body);
      expect(histBody.success).toBe(true);
      expect(histBody.data.length).toBe(1);
      expect(histBody.data[0].to_stage).toBe('saved');
    });

    it('rejects illegal transition from saved to interview with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          stage: 'interview', // Illegal from 'saved' (must move to applied, withdrawn, or closed)
          notes: 'Direct jump to interview attempt',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain("Illegal stage transition from 'saved' to 'interview'");
    });

    it('executes legal transition: saved -> applied', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          stage: 'applied',
          notes: 'Submitted application on Stripe careers portal',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.application.stage).toBe('applied');
      expect(body.data.history.from_stage).toBe('saved');
      expect(body.data.history.to_stage).toBe('applied');
    });

    it('executes legal transitions: applied -> screening -> interview', async () => {
      const screenRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          stage: 'screening',
          notes: 'Recruiter reached out for initial phone screen',
        },
      });
      expect(screenRes.statusCode).toBe(200);
      expect(JSON.parse(screenRes.body).data.application.stage).toBe('screening');

      const interviewRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          stage: 'interview',
          notes: 'Advanced to technical rounds',
        },
      });
      expect(interviewRes.statusCode).toBe(200);
      expect(JSON.parse(interviewRes.body).data.application.stage).toBe('interview');
    });

    it('treats repeated stage request to interview as idempotent without duplicating history', async () => {
      const histBefore = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${aliceApplicationId}/history`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const historyCountBefore = JSON.parse(histBefore.body).data.length;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          stage: 'interview',
          notes: 'Repeated interview request',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.idempotent).toBe(true);
      expect(body.data.application.stage).toBe('interview');

      // Verify no extra history entry was appended
      const histAfter = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${aliceApplicationId}/history`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const historyCountAfter = JSON.parse(histAfter.body).data.length;
      expect(historyCountAfter).toBe(historyCountBefore);
    });

    it('handles idempotent repeated transition to the same stage without duplicating history', async () => {
      // Transition to offer
      const offerRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          stage: 'offer',
          notes: 'Offer letter received',
        },
      });
      expect(offerRes.statusCode).toBe(200);

      const histBefore = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${aliceApplicationId}/history`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const historyCountBefore = JSON.parse(histBefore.body).data.length;

      // Duplicate repeat request to 'offer'
      const duplicateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          stage: 'offer',
          notes: 'Duplicate repeated request',
        },
      });
      expect(duplicateRes.statusCode).toBe(200);
      const dupBody = JSON.parse(duplicateRes.body);
      expect(dupBody.data.idempotent).toBe(true);
      expect(dupBody.data.application.stage).toBe('offer');

      // Verify no duplicate history row was added
      const histAfter = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${aliceApplicationId}/history`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const historyCountAfter = JSON.parse(histAfter.body).data.length;
      expect(historyCountAfter).toBe(historyCountBefore);
    });

    it('rejects stale-stage race when expected_stage does not match current stage', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          stage: 'accepted',
          expected_stage: 'interview', // Stale: application is already in 'offer'
          notes: 'Attempting accept expecting interview stage',
        },
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toContain("does not match expected stage 'interview'");
    });

    it('handles concurrent incompatible transitions with the same expected stage: exactly one succeeds, loser gets 409', async () => {
      // Create a new opportunity and application for testing concurrent transitions
      const newOppRes = await app.inject({
        method: 'POST',
        url: '/api/v1/career/opportunities',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          company_name: 'Concurrent Corp',
          role_title: 'Concurrent Engineer',
        },
      });
      const concurrentOppId = JSON.parse(newOppRes.body).data.id;

      const appCreateRes = await app.inject({
        method: 'POST',
        url: '/api/v1/career/applications',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          opportunity_id: concurrentOppId,
          stage: 'applied',
        },
      });
      const concurrentAppId = JSON.parse(appCreateRes.body).data.id;

      // Two concurrent incompatible transitions both claiming expected_stage = 'applied'
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/v1/career/applications/${concurrentAppId}/stage`,
          headers: { authorization: 'Bearer token-alice' },
          payload: {
            stage: 'screening',
            expected_stage: 'applied',
            notes: 'Concurrent candidate 1',
          },
        }),
        app.inject({
          method: 'POST',
          url: `/api/v1/career/applications/${concurrentAppId}/stage`,
          headers: { authorization: 'Bearer token-alice' },
          payload: {
            stage: 'withdrawn',
            expected_stage: 'applied',
            notes: 'Concurrent candidate 2',
          },
        }),
      ]);

      const statuses = [res1.statusCode, res2.statusCode].sort();
      // Exactly one succeeds with 200, one fails with 409
      expect(statuses).toEqual([200, 409]);

      // Check the winning response and losing response
      const winnerRes = res1.statusCode === 200 ? res1 : res2;
      const loserRes = res1.statusCode === 409 ? res1 : res2;

      expect(JSON.parse(winnerRes.body).success).toBe(true);
      expect(JSON.parse(loserRes.body).success).toBe(false);
      expect(JSON.parse(loserRes.body).error.code).toBe('CONFLICT');

      // History has exactly 2 entries (initial 'applied' + single winner transition)
      const histRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${concurrentAppId}/history`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const histData = JSON.parse(histRes.body).data;
      expect(histData).toHaveLength(2);
    });

    it('transitions to terminal state accepted and blocks subsequent transitions', async () => {
      // Transition offer -> accepted
      const acceptRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          stage: 'accepted',
          notes: 'Accepted offer!',
        },
      });
      expect(acceptRes.statusCode).toBe(200);
      expect(JSON.parse(acceptRes.body).data.application.stage).toBe('accepted');

      // Attempt transition out of terminal state accepted -> interview
      const reopenRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          stage: 'interview',
          notes: 'Attempting to reopen accepted application',
        },
      });
      expect(reopenRes.statusCode).toBe(409);
      const reopenBody = JSON.parse(reopenRes.body);
      expect(reopenBody.success).toBe(false);
      expect(reopenBody.error.code).toBe('CONFLICT');
      expect(reopenBody.error.message).toContain("Cannot transition application from terminal stage 'accepted'");
    });
  });

  // ==============================================================================
  // 5. Application Projects (Collateral)
  // ==============================================================================

  describe('5. Application Projects (Collateral)', () => {
    it('attaches a user project to the application', async () => {
      const attachRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/projects`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          project_id: mockProjectId,
          is_featured: true,
          talking_points: 'High throughput Raft consensus engine implemented in Rust',
        },
      });
      expect(attachRes.statusCode).toBe(201);
      const body = JSON.parse(attachRes.body);
      expect(body.success).toBe(true);
      expect(body.data.project_id).toBe(mockProjectId);
      expect(body.data.is_featured).toBe(true);

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${aliceApplicationId}/projects`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.body);
      expect(listBody.data.length).toBe(1);
    });

    it('updates attached project talking points', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/applications/${aliceApplicationId}/projects/${mockProjectId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          talking_points: 'Emphasize linearizable reads and zero-copy RPC serialization',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.talking_points).toContain('zero-copy RPC');
    });
  });

  // ==============================================================================
  // 6. Career Interviews
  // ==============================================================================

  describe('6. Career Interviews', () => {
    it('creates an interview round for the application', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/interviews`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          round_number: 1,
          round_type: 'technical_dsa',
          scheduled_at: new Date(Date.now() + 86400000).toISOString(),
          duration_minutes: 60,
          meeting_link: 'https://meet.google.com/xyz-abcd-efg',
          interviewer_names: ['Staff Engineer Lead'],
          status: 'scheduled',
          notes: 'Focus on graphs and dynamic programming',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.round_type).toBe('technical_dsa');

      aliceInterviewId = body.data.id;
    });

    it('retrieves interview detail and updates status/result', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/interviews/${aliceInterviewId}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(getRes.statusCode).toBe(200);
      expect(JSON.parse(getRes.body).data.id).toBe(aliceInterviewId);

      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/interviews/${aliceInterviewId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          status: 'completed',
          result: 'passed',
        },
      });
      expect(updateRes.statusCode).toBe(200);
      const updateBody = JSON.parse(updateRes.body);
      expect(updateBody.data.status).toBe('completed');
      expect(updateBody.data.result).toBe('passed');
    });

    it('lists interviews across applications', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/career/interviews',
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==============================================================================
  // 7. Tenant Isolation & IDOR Protection (Cross-User Access)
  // ==============================================================================

  describe('7. Tenant Isolation & IDOR Protection', () => {
    it('prevents Bob from viewing or modifying Alice target (404)', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/targets/${aliceTargetId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(getRes.statusCode).toBe(404);

      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/targets/${aliceTargetId}`,
        headers: { authorization: 'Bearer token-bob' },
        payload: { title: 'Hacked Target' },
      });
      expect(updateRes.statusCode).toBe(404);

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/career/targets/${aliceTargetId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(deleteRes.statusCode).toBe(404);
    });

    it('prevents Bob from viewing or modifying Alice opportunity (404)', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/opportunities/${aliceOpportunityId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(getRes.statusCode).toBe(404);

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/career/opportunities/${aliceOpportunityId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(deleteRes.statusCode).toBe(404);
    });

    it('prevents Bob from transitioning or viewing Alice application (404)', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${aliceApplicationId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(getRes.statusCode).toBe(404);

      const stageRes = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/stage`,
        headers: { authorization: 'Bearer token-bob' },
        payload: { stage: 'rejected' },
      });
      expect(stageRes.statusCode).toBe(404);

      const histRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/applications/${aliceApplicationId}/history`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(histRes.statusCode).toBe(404);
    });

    it('prevents Bob from accessing or deleting Alice interview (404)', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/career/interviews/${aliceInterviewId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(getRes.statusCode).toBe(404);

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/career/interviews/${aliceInterviewId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(deleteRes.statusCode).toBe(404);
    });

    it('rejects cross-user nested reference when Bob references Alice target (404)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/career/opportunities',
        headers: { authorization: 'Bearer token-bob' },
        payload: {
          company_name: 'Bob Inc',
          role_title: 'Bob Engineer',
          target_id: aliceTargetId, // Belongs to Alice
        },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('rejects cross-user nested reference when Bob references Alice opportunity (404)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/career/applications',
        headers: { authorization: 'Bearer token-bob' },
        payload: {
          opportunity_id: aliceOpportunityId, // Belongs to Alice
        },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('rejects attaching a project that belongs to another user (404)', async () => {
      // Bob tries to attach Alice's project to an application
      const bobProject = '00000000-0000-0000-0000-000000000999';
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceApplicationId}/projects`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          project_id: bobProject, // Non-existent or Bob's
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it('enforces that all terminal states (declined, rejected, withdrawn, closed) block subsequent transitions', async () => {
      // Create a dedicated opportunity & application to test each terminal state
      for (const terminalStage of ['declined', 'rejected', 'withdrawn', 'closed'] as const) {
        const oppRes = await app.inject({
          method: 'POST',
          url: '/api/v1/career/opportunities',
          headers: { authorization: 'Bearer token-alice' },
          payload: {
            company_name: `Company ${terminalStage}`,
            role_title: `Role ${terminalStage}`,
          },
        });
        const oppId = JSON.parse(oppRes.body).data.id;

        const appRes = await app.inject({
          method: 'POST',
          url: '/api/v1/career/applications',
          headers: { authorization: 'Bearer token-alice' },
          payload: {
            opportunity_id: oppId,
            stage: 'applied',
          },
        });
        const appId = JSON.parse(appRes.body).data.id;

        // Transition to terminal stage
        if (terminalStage === 'declined') {
          await app.inject({
            method: 'POST',
            url: `/api/v1/career/applications/${appId}/stage`,
            headers: { authorization: 'Bearer token-alice' },
            payload: { stage: 'offer' },
          });
          await app.inject({
            method: 'POST',
            url: `/api/v1/career/applications/${appId}/stage`,
            headers: { authorization: 'Bearer token-alice' },
            payload: { stage: 'declined' },
          });
        } else {
          await app.inject({
            method: 'POST',
            url: `/api/v1/career/applications/${appId}/stage`,
            headers: { authorization: 'Bearer token-alice' },
            payload: { stage: terminalStage },
          });
        }

        // Now attempt to transition out of terminal state
        const attemptRes = await app.inject({
          method: 'POST',
          url: `/api/v1/career/applications/${appId}/stage`,
          headers: { authorization: 'Bearer token-alice' },
          payload: { stage: 'applied' },
        });
        expect(attemptRes.statusCode).toBe(409);
        const attemptBody = JSON.parse(attemptRes.body);
        expect(attemptBody.error.message).toContain(`Cannot transition application from terminal stage '${terminalStage}'`);
      }
    });
  });
});
