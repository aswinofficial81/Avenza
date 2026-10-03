import type {
  NextActionConfidence,
  NextActionReason,
  ScoreBreakdown,
} from '@avenza/shared';
import type { CandidateAction } from '../candidates/candidate.types';

export interface ScoredCandidate {
  candidate: CandidateAction;
  scoreBreakdown: ScoreBreakdown;
  primaryReason: NextActionReason;
  confidence: NextActionConfidence;
}
