import type {
  ConfidenceLevel,
  EvidenceDto,
  MasteryState,
  SkillHealth,
  SkillMasteryDto,
} from '@avenza/shared';

// ==============================================================================
// Pure Deterministic Mastery Engine
// Phase 12: Unified Skills + Mastery Foundation
//
// Rules:
// 1. Pure function: Identical (evidence, referenceTime) => Identical output.
// 2. No Date.now(), no Math.random(), no external network calls, no LLMs.
// 3. Explicit separation: Skill vs Evidence vs Mastery vs Confidence.
// 4. Anti-fabrication: Never award mastery from titles or mere association.
// ==============================================================================

export interface CalculateMasteryOptions {
  evidence: EvidenceDto[];
  referenceTimestamp: string | Date;
}

export function calculateSkillMastery(options: CalculateMasteryOptions): SkillMasteryDto {
  const { evidence, referenceTimestamp } = options;
  const refTime = new Date(referenceTimestamp).getTime();

  if (!evidence || evidence.length === 0) {
    return {
      state: 'unknown',
      score: 0,
      confidence: 'low',
      evidence_count: 0,
      verified_evidence_count: 0,
      health: 'inactive',
      explanation: 'No evidence recorded yet. Mastery state is Unknown.',
      calculated_at: new Date(refTime).toISOString(),
      recent_activity_at: null,
    };
  }

  // Filter out rejected evidence completely
  const validEvidence = evidence.filter((e) => e.verification_status !== 'rejected');

  if (validEvidence.length === 0) {
    return {
      state: 'unknown',
      score: 0,
      confidence: 'low',
      evidence_count: evidence.length,
      verified_evidence_count: 0,
      health: 'inactive',
      explanation:
        'All associated evidence items are rejected. No valid capability demonstrated.',
      calculated_at: new Date(refTime).toISOString(),
      recent_activity_at: null,
    };
  }

  const verifiedCount = validEvidence.filter((e) => e.verification_status === 'verified').length;

  // Track most recent activity
  let mostRecentTimestamp = 0;
  const sourceTypes = new Set<string>();

  // Calculate individual item weights
  const itemScores = validEvidence.map((item) => {
    const occurredTime = new Date(item.occurred_at).getTime();
    if (occurredTime > mostRecentTimestamp) {
      mostRecentTimestamp = occurredTime;
    }
    sourceTypes.add(item.source_type);

    // 1. Base strength weight
    let baseStrength = 12; // medium
    if (item.evidence_strength === 'high') baseStrength = 24;
    else if (item.evidence_strength === 'low') baseStrength = 4;

    // 2. Verification status multiplier
    let verificationMult = 0.8; // unverified
    if (item.verification_status === 'verified') verificationMult = 1.25;

    // 3. Reliability multiplier
    let reliabilityMult = 0.85; // medium
    if (item.reliability === 'high') reliabilityMult = 1.0;
    else if (item.reliability === 'low') reliabilityMult = 0.6;

    // 4. Directness multiplier
    const directnessMult = item.directness === 'direct' ? 1.0 : 0.7;

    // 5. Deterministic Recency Decay
    const diffMs = Math.max(0, refTime - occurredTime);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let recencyWeight = 1.0;
    if (diffDays > 365) {
      recencyWeight = 0.25;
    } else if (diffDays > 180) {
      recencyWeight = 0.45;
    } else if (diffDays > 90) {
      recencyWeight = 0.70;
    } else if (diffDays > 30) {
      recencyWeight = 0.90;
    }

    return baseStrength * verificationMult * reliabilityMult * directnessMult * recencyWeight;
  });

  // Sort item scores descending to apply diminishing returns
  itemScores.sort((a, b) => b - a);

  // Diminishing returns curve: 1st=1.0, 2nd=0.75, 3rd=0.55, 4th=0.40, 5th=0.30, 6th+=0.20
  const diminishingWeights = [1.0, 0.75, 0.55, 0.40, 0.30];
  let accumulated = 0;
  for (let i = 0; i < itemScores.length; i++) {
    const itemScore = itemScores[i] ?? 0;
    const weight = i < diminishingWeights.length ? (diminishingWeights[i] ?? 0.20) : 0.20;
    accumulated += itemScore * weight;
  }

  // Evidence diversity multiplier
  let diversityMultiplier = 1.0;
  if (sourceTypes.size >= 3) {
    diversityMultiplier = 1.20;
  } else if (sourceTypes.size === 2) {
    diversityMultiplier = 1.10;
  }

  const rawScore = accumulated * diversityMultiplier;
  const boundedScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Recency check for inactive or needs_review states
  const daysSinceRecent =
    mostRecentTimestamp > 0
      ? Math.floor(Math.max(0, refTime - mostRecentTimestamp) / (1000 * 60 * 60 * 24))
      : 999;

  // Determine Mastery State
  let state: MasteryState;
  if (daysSinceRecent > 365) {
    state = 'inactive';
  } else if (daysSinceRecent > 180) {
    state = 'needs_review';
  } else {
    if (boundedScore < 10) {
      state = 'unknown';
    } else if (boundedScore < 25) {
      state = 'exploring';
    } else if (boundedScore < 45) {
      state = 'learning';
    } else if (boundedScore < 65) {
      state = 'developing';
    } else if (boundedScore < 80) {
      state = 'proficient';
    } else {
      state = 'strong';
    }
  }

  // Determine Confidence Level
  // High confidence requires multiple evidence, verified proof, and diverse sources
  let confidence: ConfidenceLevel;
  if (
    validEvidence.length >= 4 &&
    verifiedCount >= 2 &&
    sourceTypes.size >= 2 &&
    daysSinceRecent <= 120
  ) {
    confidence = 'high';
  } else if (
    validEvidence.length >= 2 &&
    (verifiedCount >= 1 || validEvidence.length >= 3) &&
    daysSinceRecent <= 180
  ) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Determine Health
  let health: SkillHealth;
  if (state === 'needs_review') {
    health = 'needs_attention';
  } else if (state === 'inactive') {
    health = 'inactive';
  } else if (daysSinceRecent > 90) {
    health = 'needs_attention';
  } else if (state === 'proficient' || state === 'strong') {
    health = 'healthy';
  } else {
    health = 'developing';
  }

  // Deterministic Explanation Generation
  const stateLabel = state.charAt(0).toUpperCase() + state.slice(1).replace('_', ' ');
  const confidenceLabel = confidence.charAt(0).toUpperCase() + confidence.slice(1);
  const diversityText = `${sourceTypes.size} source type${sourceTypes.size === 1 ? '' : 's'}`;
  const verifiedText = `${verifiedCount} verified`;
  const recencyText =
    daysSinceRecent === 0
      ? 'activity today'
      : `${daysSinceRecent} day${daysSinceRecent === 1 ? '' : 's'} ago`;

  let explanation = `Derived as ${stateLabel} (Score: ${boundedScore}/100, Confidence: ${confidenceLabel}) based on ${validEvidence.length} evidence item${validEvidence.length === 1 ? '' : 's'} across ${diversityText} (${verifiedText}). Last demonstrated ${recencyText}.`;

  if (state === 'needs_review') {
    explanation += ' Skill has demonstrated prior capability but has not been reinforced in over 180 days.';
  }

  return {
    state,
    score: boundedScore,
    confidence,
    evidence_count: validEvidence.length,
    verified_evidence_count: verifiedCount,
    health,
    explanation,
    calculated_at: new Date(refTime).toISOString(),
    recent_activity_at: mostRecentTimestamp > 0 ? new Date(mostRecentTimestamp).toISOString() : null,
  };
}
