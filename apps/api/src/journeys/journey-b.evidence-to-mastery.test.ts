import fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { registerErrorHandler } from '../plugins/error-handler';
import type { requireAuth as defaultRequireAuth } from '../auth/auth.middleware';
import { InMemoryEvidenceRepository } from '../modules/evidence/evidence.repository';
import { EvidenceService } from '../modules/evidence/evidence.service';
import { EvidenceController } from '../modules/evidence/evidence.controller';
import { createEvidenceRoutes } from '../modules/evidence/evidence.routes';
import { InMemorySkillsRepository } from '../modules/skills/skills.repository';
import { SkillsService } from '../modules/skills/skills.service';
import { SkillsController } from '../modules/skills/skills.controller';
import { createSkillsRoutes } from '../modules/skills/skills.routes';

// ==============================================================================
// Phase 17C Journey B: Evidence → Skill Mastery Integration Journey
//
// Invariants Verified:
// 1. Mastery is derived purely from eligible, linked evidence via canonical rules.
// 2. Strict tenant isolation: Cross-tenant evidence or skill linking is rejected.
// 3. Evidence provenance and metadata remain intact across domain boundaries.
// 4. Idempotency & Unique constraint: Duplicate link requests are rejected without inflating mastery.
// 5. Rejected evidence is filtered out and cannot contribute to mastery.
// 6. Unrelated evidence has 0 effect on skill mastery.
// 7. Unlinking evidence truth-preservingly recalibrates mastery back to baseline.
// ==============================================================================

describe('Phase 17C Journey B: Evidence → Skill Mastery', () => {
  let app: FastifyInstance;

  let evidenceRepo: InMemoryEvidenceRepository;
  let evidenceService: EvidenceService;
  let evidenceController: EvidenceController;

  let skillsRepo: InMemorySkillsRepository;
  let skillsService: SkillsService;
  let skillsController: SkillsController;

  const ALICE_ID = '00000000-0000-4000-8000-000000000001';
  const BOB_ID = '00000000-0000-4000-8000-000000000002';

  let currentUserId: string = ALICE_ID;

  beforeEach(async () => {
    currentUserId = ALICE_ID;

    // 1. Repositories
    evidenceRepo = new InMemoryEvidenceRepository();
    skillsRepo = new InMemorySkillsRepository([], evidenceRepo);

    // 2. Services
    evidenceService = new EvidenceService(evidenceRepo);
    skillsService = new SkillsService(skillsRepo);

    // 3. Controllers
    evidenceController = new EvidenceController(evidenceService);
    skillsController = new SkillsController(skillsService);

    // 4. Fastify App & Auth Hook
    app = fastify();
    registerErrorHandler(app);

    const mockAuthHook = async (request: FastifyRequest) => {
      (request as unknown as { profile: { id: string } }).profile = { id: currentUserId };
    };

    app.register(
      createEvidenceRoutes({
        requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth,
        evidenceController,
      })
    );

    app.register(
      createSkillsRoutes({
        requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth,
        skillsController,
      })
    );

    await app.ready();
  });

  // ============================================================================
  // Complete End-to-End Journey B Test Suite
  // ============================================================================

  it('executes complete Evidence → Skill Mastery journey adhering to canonical scoring and domain rules', async () => {
    // --------------------------------------------------------------------------
    // Step 1: Create a Skill owned by Alice (User A)
    // --------------------------------------------------------------------------
    const createSkillRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      payload: {
        name: 'Distributed Consensus',
        category: 'systems',
        description: 'Raft, Paxos, Viewstamped Replication, and formal TLA+ verification.',
      },
    });

    expect(createSkillRes.statusCode).toBe(201);
    const skill = JSON.parse(createSkillRes.body).data;
    expect(skill.id).toBeDefined();
    expect(skill.user_id).toBe(ALICE_ID);
    expect(skill.name).toBe('Distributed Consensus');
    expect(skill.slug).toBe('distributed-consensus');
    expect(skill.status).toBe('active');

    // Baseline mastery verification: Initial skill with 0 evidence is strictly Unknown / 0 score
    const initialMasteryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/mastery`,
    });
    expect(initialMasteryRes.statusCode).toBe(200);
    const initialMastery = JSON.parse(initialMasteryRes.body).data;
    expect(initialMastery.score).toBe(0);
    expect(initialMastery.state).toBe('unknown');
    expect(initialMastery.confidence).toBe('low');
    expect(initialMastery.evidence_count).toBe(0);
    expect(initialMastery.verified_evidence_count).toBe(0);
    expect(initialMastery.health).toBe('inactive');
    expect(initialMastery.explanation).toContain('No evidence recorded yet');

    // --------------------------------------------------------------------------
    // Step 2: Create Valid Traceable Evidence via Canonical Evidence API
    // --------------------------------------------------------------------------
    const createEvidenceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/evidence',
      payload: {
        evidence_type: 'artifact',
        title: 'TLA+ Model Checking Specification for Raft',
        description: 'Exhaustive verification of leader election and log safety with TLC model checker.',
        external_url: 'https://github.com/avenza/consensus-core/pull/101',
      },
    });

    expect(createEvidenceRes.statusCode).toBe(201);
    const evidence1 = JSON.parse(createEvidenceRes.body).data;
    expect(evidence1.id).toBeDefined();
    expect(evidence1.user_id).toBe(ALICE_ID);
    expect(evidence1.source_type).toBe('user');
    expect(evidence1.verification_status).toBe('unverified');
    expect(evidence1.evidence_strength).toBe('medium');

    // --------------------------------------------------------------------------
    // Step 3: Associate Evidence with Skill via Supported Endpoint
    // --------------------------------------------------------------------------
    const linkRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${skill.id}/evidence`,
      payload: {
        evidence_id: evidence1.id,
      },
    });

    expect(linkRes.statusCode).toBe(201);
    const linkData = JSON.parse(linkRes.body).data;
    expect(linkData.evidence_id).toBe(evidence1.id);
    expect(linkData.skill_id).toBe(skill.id);
    expect(linkData.user_id).toBe(ALICE_ID);

    // --------------------------------------------------------------------------
    // Step 4: Verify Initial Derived Mastery for Unverified Medium Evidence
    // Canonical scoring formula for single unverified item:
    // baseStrength(12) * verificationMult(0.8) * reliabilityMult(0.6) * directnessMult(0.7) * recency(1.0)
    // = 12 * 0.8 * 0.6 * 0.7 = 4.032 => rounded = 4
    // State is 'unknown' (< 10)
    // --------------------------------------------------------------------------
    const masteryAfterUnverifiedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/mastery`,
    });
    expect(masteryAfterUnverifiedRes.statusCode).toBe(200);
    const masteryAfterUnverified = JSON.parse(masteryAfterUnverifiedRes.body).data;
    expect(masteryAfterUnverified.score).toBe(4);
    expect(masteryAfterUnverified.state).toBe('unknown');
    expect(masteryAfterUnverified.confidence).toBe('low');
    expect(masteryAfterUnverified.evidence_count).toBe(1);
    expect(masteryAfterUnverified.verified_evidence_count).toBe(0);
    expect(masteryAfterUnverified.health).toBe('developing');

    // --------------------------------------------------------------------------
    // Step 5: Advance Verification Status and Confirm Truthful Recalibration
    // Updating evidence1 to 'verified' should dynamically update mastery:
    // baseStrength(12) * verificationMult(1.25) * reliabilityMult(0.6) * directnessMult(0.7) * recency(1.0)
    // = 12 * 1.25 * 0.6 * 0.7 = 6.3 => rounded = 6
    // --------------------------------------------------------------------------
    const verifyEvidenceRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/evidence/${evidence1.id}`,
      payload: {
        verification_status: 'verified',
      },
    });
    expect(verifyEvidenceRes.statusCode).toBe(200);
    expect(JSON.parse(verifyEvidenceRes.body).data.verification_status).toBe('verified');

    const masteryAfterVerifiedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/mastery`,
    });
    expect(masteryAfterVerifiedRes.statusCode).toBe(200);
    const masteryAfterVerified = JSON.parse(masteryAfterVerifiedRes.body).data;
    expect(masteryAfterVerified.score).toBe(6);
    expect(masteryAfterVerified.verified_evidence_count).toBe(1);

    // --------------------------------------------------------------------------
    // Step 6: Link High-Strength Verified Project Evidence to Prove Mastery Progression
    // Item 2: high strength (24), verified (1.25), reliability high (1.0), direct (1.0), project source
    // Item 2 score = 24 * 1.25 * 1.0 * 1.0 = 30
    // Item 1 score = 6.3
    // Diminishing returns: Item 2 (weight 1.0) = 30, Item 1 (weight 0.75) = 4.725
    // Accumulated = 34.725
    // Evidence diversity: 2 source types ('user' + 'project') => diversity multiplier = 1.10
    // Raw score = 34.725 * 1.10 = 38.1975 => bounded = 38
    // Mastery state: 25 <= score < 45 => 'learning'
    // --------------------------------------------------------------------------
    const createdProjectEvidence = await evidenceRepo.createEvidence({
      user_id: ALICE_ID,
      evidence_type: 'project_activity',
      title: 'Production Raft Cluster Deployment and Live Chaos Testing',
      description: 'Zero uncommitted data loss verified under Jepsen partition testing.',
      source_type: 'project',
      source_id: 'jepsen-raft-test-01',
      occurred_at: new Date().toISOString(),
      verification_status: 'verified',
      evidence_strength: 'high',
      reliability: 'high',
      directness: 'direct',
    });

    const linkProjectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${skill.id}/evidence`,
      payload: {
        evidence_id: createdProjectEvidence.evidence.id,
      },
    });
    expect(linkProjectRes.statusCode).toBe(201);

    // Retrieve full detail endpoint to check both score and traceable provenance
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/detail`,
    });
    expect(detailRes.statusCode).toBe(200);
    const detailData = JSON.parse(detailRes.body).data;

    expect(detailData.mastery.score).toBe(38);
    expect(detailData.mastery.state).toBe('learning');
    expect(detailData.mastery.confidence).toBe('medium');
    expect(detailData.mastery.evidence_count).toBe(2);
    expect(detailData.mastery.verified_evidence_count).toBe(2);
    expect(detailData.mastery.explanation).toContain('Derived as Learning (Score: 38/100, Confidence: Medium)');
    expect(detailData.mastery.explanation).toContain('across 2 source types');

    // Traceable provenance: Detail must include the exact 2 evidence records
    expect(detailData.evidence).toHaveLength(2);
    expect(detailData.evidence.map((e: { id: string }) => e.id)).toEqual(
      expect.arrayContaining([evidence1.id, createdProjectEvidence.evidence.id])
    );
  });

  // ============================================================================
  // Multi-Tenant Isolation & Cross-Tenant Boundary Enforcement
  // ============================================================================

  it('rejects cross-tenant evidence-skill associations and preserves strict tenant boundaries', async () => {
    // 1. Create Alice's skill and evidence
    const aliceSkillRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      payload: { name: 'Distributed Systems', category: 'engineering' },
    });
    const aliceSkill = JSON.parse(aliceSkillRes.body).data;

    const aliceEvidenceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/evidence',
      payload: { evidence_type: 'artifact', title: "Alice's System Architecture Document" },
    });
    const aliceEvidence = JSON.parse(aliceEvidenceRes.body).data;

    // Link Alice's evidence to Alice's skill
    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${aliceSkill.id}/evidence`,
      payload: { evidence_id: aliceEvidence.id },
    });

    // 2. Switch context to Bob (User B)
    currentUserId = BOB_ID;

    const bobSkillRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      payload: { name: 'Frontend Architecture', category: 'web' },
    });
    const bobSkill = JSON.parse(bobSkillRes.body).data;

    const bobEvidenceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/evidence',
      payload: { evidence_type: 'artifact', title: "Bob's React Component Library" },
    });
    const bobEvidence = JSON.parse(bobEvidenceRes.body).data;

    // --------------------------------------------------------------------------
    // Violation Attempt A: Bob attempts to link Alice's evidence to Bob's skill
    // Must be rejected by ownership validation trigger logic
    // --------------------------------------------------------------------------
    const bobStealEvidenceRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${bobSkill.id}/evidence`,
      payload: { evidence_id: aliceEvidence.id },
    });
    expect(bobStealEvidenceRes.statusCode).toBe(400);
    const bobStealErr = JSON.parse(bobStealEvidenceRes.body);
    expect(bobStealErr.error.message).toContain('User ID must match across evidence and skill records');

    // Verify Bob's skill remains untouched with 0 evidence
    const bobMasteryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${bobSkill.id}/mastery`,
    });
    expect(JSON.parse(bobMasteryRes.body).data.evidence_count).toBe(0);
    expect(JSON.parse(bobMasteryRes.body).data.score).toBe(0);

    // --------------------------------------------------------------------------
    // Violation Attempt B: Bob attempts to associate Bob's evidence with Alice's skill
    // SkillsService must enforce skill ownership and throw 400 'Skill not found'
    // --------------------------------------------------------------------------
    const bobAttachToAliceRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${aliceSkill.id}/evidence`,
      payload: { evidence_id: bobEvidence.id },
    });
    expect(bobAttachToAliceRes.statusCode).toBe(400);
    expect(JSON.parse(bobAttachToAliceRes.body).error.message).toContain('Skill not found');

    // --------------------------------------------------------------------------
    // Violation Attempt C: Bob attempts to read Alice's skill mastery
    // --------------------------------------------------------------------------
    const bobReadAliceRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${aliceSkill.id}/mastery`,
    });
    expect(bobReadAliceRes.statusCode).toBe(400);
    expect(JSON.parse(bobReadAliceRes.body).error.message).toContain('Skill not found');

    // --------------------------------------------------------------------------
    // Violation Attempt D: Switch back to Alice and attempt to link Bob's evidence
    // --------------------------------------------------------------------------
    currentUserId = ALICE_ID;
    const aliceStealEvidenceRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${aliceSkill.id}/evidence`,
      payload: { evidence_id: bobEvidence.id },
    });
    expect(aliceStealEvidenceRes.statusCode).toBe(400);
    expect(JSON.parse(aliceStealEvidenceRes.body).error.message).toContain(
      'User ID must match across evidence and skill records'
    );

    // Assert Alice's skill evidence count and mastery are completely unchanged
    const aliceMasteryCheck = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${aliceSkill.id}/mastery`,
    });
    expect(JSON.parse(aliceMasteryCheck.body).data.evidence_count).toBe(1);
  });

  // ============================================================================
  // Duplicate Association & Primary Key Constraint Handling
  // ============================================================================

  it('rejects duplicate evidence associations without inflating mastery score', async () => {
    // 1. Create skill and evidence
    const skillRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      payload: { name: 'Rust Memory Safety', category: 'systems' },
    });
    const skill = JSON.parse(skillRes.body).data;

    const evidenceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/evidence',
      payload: { evidence_type: 'artifact', title: 'Zero-cost Abstractions in Rust' },
    });
    const evidence = JSON.parse(evidenceRes.body).data;

    // 2. Link evidence for the first time (succeeds)
    const firstLinkRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${skill.id}/evidence`,
      payload: { evidence_id: evidence.id },
    });
    expect(firstLinkRes.statusCode).toBe(201);

    // Verify baseline score after single link
    const scoreBeforeDuplicate = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/mastery`,
    });
    const baselineScore = JSON.parse(scoreBeforeDuplicate.body).data.score;
    expect(baselineScore).toBe(4);

    // 3. Attempt duplicate link with identical (evidence_id, skill_id)
    const duplicateLinkRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${skill.id}/evidence`,
      payload: { evidence_id: evidence.id },
    });

    expect(duplicateLinkRes.statusCode).toBe(400);
    const dupBody = JSON.parse(duplicateLinkRes.body);
    expect(dupBody.error.message).toContain('duplicate key value violates unique constraint pk_evidence_skills');

    // 4. Assert score and evidence count are NOT inflated
    const scoreAfterDuplicate = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/mastery`,
    });
    const postDupData = JSON.parse(scoreAfterDuplicate.body).data;
    expect(postDupData.score).toBe(baselineScore);
    expect(postDupData.evidence_count).toBe(1);
  });

  // ============================================================================
  // Rejected and Invalid Evidence Handling
  // ============================================================================

  it('proves that rejected or invalid evidence cannot improperly increase mastery score', async () => {
    // 1. Create skill
    const skillRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      payload: { name: 'Formal Methods', category: 'math' },
    });
    const skill = JSON.parse(skillRes.body).data;

    // 2. Link valid verified evidence
    const validEvidenceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/evidence',
      payload: { evidence_type: 'artifact', title: 'TLA+ Invariant Model Checked' },
    });
    const validEvidence = JSON.parse(validEvidenceRes.body).data;
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/evidence/${validEvidence.id}`,
      payload: { verification_status: 'verified' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${skill.id}/evidence`,
      payload: { evidence_id: validEvidence.id },
    });

    const scoreWithValid = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/mastery`,
    });
    const baselineValidScore = JSON.parse(scoreWithValid.body).data.score;
    expect(baselineValidScore).toBe(6);

    // 3. Create rejected evidence (e.g., invalidated test / disputed proof)
    const rejectedEvidence = await evidenceRepo.createEvidence({
      user_id: ALICE_ID,
      evidence_type: 'assessment',
      title: 'Disputed Architecture Review',
      verification_status: 'rejected',
      evidence_strength: 'high',
      reliability: 'high',
      directness: 'direct',
      source_type: 'assessment',
      occurred_at: new Date().toISOString(),
    });

    // Link rejected evidence to skill
    const linkRejectedRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${skill.id}/evidence`,
      payload: { evidence_id: rejectedEvidence.evidence.id },
    });
    expect(linkRejectedRes.statusCode).toBe(201);

    // 4. Assert mastery score DID NOT increase and rejected evidence is excluded from valid count
    const scoreAfterRejected = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/mastery`,
    });
    const afterRejectedData = JSON.parse(scoreAfterRejected.body).data;
    expect(afterRejectedData.score).toBe(baselineValidScore); // Exactly 6, not inflated
    expect(afterRejectedData.evidence_count).toBe(1); // Only 1 valid evidence counted
    expect(afterRejectedData.verified_evidence_count).toBe(1);

    // 5. Test dedicated skill with ONLY rejected evidence
    const rejectedSkillRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      payload: { name: 'Revoked Competency', category: 'audit' },
    });
    const rejectedSkill = JSON.parse(rejectedSkillRes.body).data;

    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${rejectedSkill.id}/evidence`,
      payload: { evidence_id: rejectedEvidence.evidence.id },
    });

    const allRejectedMasteryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${rejectedSkill.id}/mastery`,
    });
    const allRejectedData = JSON.parse(allRejectedMasteryRes.body).data;
    expect(allRejectedData.score).toBe(0);
    expect(allRejectedData.state).toBe('unknown');
    expect(allRejectedData.health).toBe('inactive');
    expect(allRejectedData.explanation).toContain('All associated evidence items are rejected');
  });

  // ============================================================================
  // Unrelated Evidence Non-Interference
  // ============================================================================

  it('guarantees unrelated unlinked evidence has 0 effect on skill mastery', async () => {
    // 1. Create skill with no evidence
    const skillRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      payload: { name: 'Kernel Internals', category: 'systems' },
    });
    const skill = JSON.parse(skillRes.body).data;

    // 2. Create 5 unrelated evidence records across various types for Alice
    for (let i = 1; i <= 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/evidence',
        payload: {
          evidence_type: 'task_completion',
          title: `Unrelated Task Completion ${i}`,
        },
      });
    }

    // 3. Assert skill mastery remains completely untouched at 0 / unknown
    const masteryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/mastery`,
    });
    const masteryData = JSON.parse(masteryRes.body).data;
    expect(masteryData.score).toBe(0);
    expect(masteryData.state).toBe('unknown');
    expect(masteryData.evidence_count).toBe(0);
  });

  // ============================================================================
  // Evidence Unlinking & Deterministic Recalibration
  // ============================================================================

  it('truthfully recalibrates skill mastery when evidence is unlinked', async () => {
    // 1. Create skill
    const skillRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      payload: { name: 'Database Query Optimization', category: 'databases' },
    });
    const skill = JSON.parse(skillRes.body).data;

    // 2. Create high-strength verified evidence and link it
    const evidence = await evidenceRepo.createEvidence({
      user_id: ALICE_ID,
      evidence_type: 'artifact',
      title: 'PostgreSQL Index Tuning and EXPLAIN ANALYZE Optimization',
      verification_status: 'verified',
      evidence_strength: 'high',
      reliability: 'high',
      directness: 'direct',
      source_type: 'user',
      occurred_at: new Date().toISOString(),
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${skill.id}/evidence`,
      payload: { evidence_id: evidence.evidence.id },
    });

    // Assert initial active mastery (score 30, state 'learning')
    const activeMasteryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/mastery`,
    });
    expect(JSON.parse(activeMasteryRes.body).data.score).toBe(30);
    expect(JSON.parse(activeMasteryRes.body).data.state).toBe('learning');

    // 3. Unlink evidence via supported DELETE endpoint
    const unlinkRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/skills/${skill.id}/evidence/${evidence.evidence.id}`,
    });
    expect(unlinkRes.statusCode).toBe(200);
    expect(JSON.parse(unlinkRes.body).data.message).toBe('Evidence unlinked successfully.');

    // 4. Verify mastery recalibrates cleanly back to 0 / unknown / inactive
    const recalibratedMasteryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/mastery`,
    });
    const recalibratedData = JSON.parse(recalibratedMasteryRes.body).data;
    expect(recalibratedData.score).toBe(0);
    expect(recalibratedData.state).toBe('unknown');
    expect(recalibratedData.evidence_count).toBe(0);
    expect(recalibratedData.verified_evidence_count).toBe(0);
    expect(recalibratedData.health).toBe('inactive');
    expect(recalibratedData.explanation).toContain('No evidence recorded yet');

    // Detail endpoint confirms no orphaned links in persisted state
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${skill.id}/detail`,
    });
    expect(JSON.parse(detailRes.body).data.evidence).toHaveLength(0);
  });

  // ============================================================================
  // Validation & Error Handling
  // ============================================================================

  it('rejects associations with non-existent evidence IDs and malformed payloads', async () => {
    const skillRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      payload: { name: 'Type Systems', category: 'pl' },
    });
    const skill = JSON.parse(skillRes.body).data;

    // Non-existent evidence UUID
    const nonExistentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${skill.id}/evidence`,
      payload: { evidence_id: '00000000-0000-4000-8000-999999999999' },
    });
    expect(nonExistentRes.statusCode).toBe(400);
    expect(JSON.parse(nonExistentRes.body).error.message).toContain('Referenced evidence does not exist');

    // Malformed UUID string
    const malformedRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${skill.id}/evidence`,
      payload: { evidence_id: 'not-a-valid-uuid' },
    });
    expect(malformedRes.statusCode).toBe(400);
    expect(JSON.parse(malformedRes.body).error.code).toBe('VALIDATION_ERROR');
  });
});
