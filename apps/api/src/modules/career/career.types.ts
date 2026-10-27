import { z } from 'zod';
import {
  CareerApplicationStageSchema,
} from '@avenza/shared';

// ==============================================================================
// 1. Stage Transition Matrix & Rules
// ==============================================================================

export {
  CAREER_TERMINAL_STAGES,
  CAREER_STAGE_TRANSITIONS,
  isTerminalStage,
  isValidStageTransition,
  type CareerApplicationStage,
} from '@avenza/shared';

// ==============================================================================
// 2. State Machine Request Schemas
// ==============================================================================

export const TransitionCareerApplicationStageSchema = z.object({
  stage: CareerApplicationStageSchema,
  from_stage: CareerApplicationStageSchema.optional(),
  expected_stage: CareerApplicationStageSchema.optional(),
  notes: z
    .string()
    .max(5000, 'Transition notes must be at most 5000 characters')
    .nullable()
    .optional(),
});

export type TransitionCareerApplicationStageInput = z.infer<
  typeof TransitionCareerApplicationStageSchema
>;

// ==============================================================================
// 3. Service Level Domain Errors
// ==============================================================================

export class CareerServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'CAREER_SERVICE_ERROR',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'CareerServiceError';
  }
}

export class CareerNotFoundHttpError extends CareerServiceError {
  constructor(message = 'Career resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'CareerNotFoundHttpError';
  }
}

export class CareerConflictHttpError extends CareerServiceError {
  constructor(message = 'Resource state conflict') {
    super(message, 'CONFLICT', 409);
    this.name = 'CareerConflictHttpError';
  }
}

export class CareerValidationHttpError extends CareerServiceError {
  constructor(message = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'CareerValidationHttpError';
  }
}

export class CareerForbiddenHttpError extends CareerServiceError {
  constructor(message = 'Access forbidden to referenced resource') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'CareerForbiddenHttpError';
  }
}
