import type {
  AddCareerOpportunitySkillInput,
  AddCareerTargetSkillInput,
  AttachCareerApplicationProjectInput,
  CareerApplicationDetailDto,
  CareerApplicationDto,
  CareerApplicationHistoryDto,
  CareerApplicationPreparationDto,
  CareerApplicationProjectDto,
  CareerApplicationQueryInput,
  CareerApplicationStage,
  CareerInterviewDto,
  CareerInterviewQueryInput,
  CareerOpportunityDetailDto,
  CareerOpportunityDto,
  CareerOpportunityQueryInput,
  CareerOpportunitySkillDto,
  CareerTargetDetailDto,
  CareerTargetDto,
  CareerTargetQueryInput,
  CareerTargetSkillDto,
  CreateCareerApplicationHistoryInput,
  CreateCareerApplicationInput,
  CreateCareerInterviewInput,
  CreateCareerOpportunityInput,
  CreateCareerTargetInput,
  PaginatedList,
  UpdateCareerApplicationInput,
  UpdateCareerApplicationProjectInput,
  UpdateCareerInterviewInput,
  UpdateCareerOpportunityInput,
  UpdateCareerOpportunitySkillInput,
  UpdateCareerTargetInput,
  UpdateCareerTargetSkillInput,
} from '@avenza/shared';

// ==============================================================================
// Domain Exceptions
// ==============================================================================

export class CareerDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CareerDomainError';
  }
}

export class CareerNotFoundError extends CareerDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'CareerNotFoundError';
  }
}

export class CareerConflictError extends CareerDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'CareerConflictError';
  }
}

export class CareerValidationError extends CareerDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'CareerValidationError';
  }
}

export class CareerOwnershipViolationError extends CareerDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'CareerOwnershipViolationError';
  }
}

// ==============================================================================
// Repository Interface
// ==============================================================================

export interface ICareerRepository {
  // --- Target CRUD ---
  createTarget(userId: string, data: CreateCareerTargetInput): Promise<CareerTargetDto>;
  getTargetById(userId: string, targetId: string): Promise<CareerTargetDto | null>;
  getTargetDetail(userId: string, targetId: string): Promise<CareerTargetDetailDto | null>;
  listTargets(userId: string, query?: CareerTargetQueryInput): Promise<PaginatedList<CareerTargetDto>>;
  updateTarget(userId: string, targetId: string, data: UpdateCareerTargetInput): Promise<CareerTargetDto | null>;
  deleteTarget(userId: string, targetId: string): Promise<boolean>;
  setPrimaryTarget(userId: string, targetId: string): Promise<CareerTargetDto | null>;

  // --- Target Skills ---
  addTargetSkill(userId: string, targetId: string, data: AddCareerTargetSkillInput): Promise<CareerTargetSkillDto>;
  updateTargetSkill(userId: string, targetId: string, skillId: string, data: UpdateCareerTargetSkillInput): Promise<CareerTargetSkillDto | null>;
  removeTargetSkill(userId: string, targetId: string, skillId: string): Promise<boolean>;
  listTargetSkills(userId: string, targetId: string): Promise<CareerTargetSkillDto[]>;

  // --- Opportunity CRUD ---
  createOpportunity(userId: string, data: CreateCareerOpportunityInput): Promise<CareerOpportunityDto>;
  getOpportunityById(userId: string, opportunityId: string): Promise<CareerOpportunityDto | null>;
  getOpportunityDetail(userId: string, opportunityId: string): Promise<CareerOpportunityDetailDto | null>;
  listOpportunities(userId: string, query?: CareerOpportunityQueryInput): Promise<PaginatedList<CareerOpportunityDto>>;
  updateOpportunity(userId: string, opportunityId: string, data: UpdateCareerOpportunityInput): Promise<CareerOpportunityDto | null>;
  deleteOpportunity(userId: string, opportunityId: string): Promise<boolean>;

  // --- Opportunity Skills ---
  addOpportunitySkill(userId: string, opportunityId: string, data: AddCareerOpportunitySkillInput): Promise<CareerOpportunitySkillDto>;
  updateOpportunitySkill(userId: string, opportunityId: string, skillId: string, data: UpdateCareerOpportunitySkillInput): Promise<CareerOpportunitySkillDto | null>;
  removeOpportunitySkill(userId: string, opportunityId: string, skillId: string): Promise<boolean>;
  listOpportunitySkills(userId: string, opportunityId: string): Promise<CareerOpportunitySkillDto[]>;

  // --- Application CRUD ---
  createApplication(userId: string, data: CreateCareerApplicationInput): Promise<CareerApplicationDto>;
  getApplicationById(userId: string, applicationId: string): Promise<CareerApplicationDto | null>;
  getApplicationDetail(userId: string, applicationId: string): Promise<CareerApplicationDetailDto | null>;
  listApplications(userId: string, query?: CareerApplicationQueryInput): Promise<PaginatedList<CareerApplicationDto>>;
  updateApplication(userId: string, applicationId: string, data: UpdateCareerApplicationInput): Promise<CareerApplicationDto | null>;
  deleteApplication(userId: string, applicationId: string): Promise<boolean>;

  // --- Application History (Immutable Audit Trail) ---
  recordApplicationHistory(userId: string, applicationId: string, data: CreateCareerApplicationHistoryInput): Promise<CareerApplicationHistoryDto>;
  listApplicationHistory(userId: string, applicationId: string): Promise<CareerApplicationHistoryDto[]>;
  updateApplicationStageWithHistory(
    userId: string,
    applicationId: string,
    newStage: CareerApplicationStage,
    notes?: string | null,
    expectedStage?: CareerApplicationStage | null
  ): Promise<{ application: CareerApplicationDto; history: CareerApplicationHistoryDto }>;

  // --- Application Projects ---
  attachApplicationProject(userId: string, applicationId: string, data: AttachCareerApplicationProjectInput): Promise<CareerApplicationProjectDto>;
  updateApplicationProject(userId: string, applicationId: string, projectId: string, data: UpdateCareerApplicationProjectInput): Promise<CareerApplicationProjectDto | null>;
  removeApplicationProject(userId: string, applicationId: string, projectId: string): Promise<boolean>;
  listApplicationProjects(userId: string, applicationId: string): Promise<CareerApplicationProjectDto[]>;

  // --- Interview CRUD ---
  createInterview(userId: string, applicationId: string, data: CreateCareerInterviewInput): Promise<CareerInterviewDto>;
  getInterviewById(userId: string, interviewId: string): Promise<CareerInterviewDto | null>;
  listInterviews(userId: string, query?: CareerInterviewQueryInput): Promise<PaginatedList<CareerInterviewDto>>;
  updateInterview(userId: string, interviewId: string, data: UpdateCareerInterviewInput): Promise<CareerInterviewDto | null>;
  deleteInterview(userId: string, interviewId: string): Promise<boolean>;

  // --- Preparation & Readiness Integration ---
  getApplicationPreparation(userId: string, applicationId: string): Promise<CareerApplicationPreparationDto | null>;
}
