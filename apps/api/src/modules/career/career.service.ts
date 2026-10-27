import type {
  AddCareerOpportunitySkillInput,
  AddCareerTargetSkillInput,
  AttachCareerApplicationProjectInput,
  CareerApplicationDetailDto,
  CareerApplicationDto,
  CareerApplicationHistoryDto,
  CareerApplicationPreparationDto,
  CareerApplicationProjectDto,
  CareerTaskReadinessItem,
  CareerApplicationQueryInput,
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
import {
  CareerConflictError,
  CareerNotFoundError,
  CareerOwnershipViolationError,
  CareerValidationError,
  type ICareerRepository,
} from './career.repository';
import { SupabaseCareerRepository } from './career.repository.impl';
import {
  CAREER_STAGE_TRANSITIONS,
  CareerConflictHttpError,
  CareerForbiddenHttpError,
  CareerNotFoundHttpError,
  CareerServiceError,
  CareerValidationHttpError,
  isTerminalStage,
  isValidStageTransition,
  type TransitionCareerApplicationStageInput,
} from './career.types';

export class CareerService {
  constructor(
    private readonly repository: ICareerRepository = new SupabaseCareerRepository()
  ) {}

  private mapRepoError(err: unknown, defaultMessage = 'Career operation failed'): never {
    if (err instanceof CareerNotFoundError) {
      throw new CareerNotFoundHttpError(err.message);
    }
    if (err instanceof CareerOwnershipViolationError) {
      throw new CareerForbiddenHttpError(err.message);
    }
    if (err instanceof CareerConflictError) {
      throw new CareerConflictHttpError(err.message);
    }
    if (err instanceof CareerValidationError) {
      throw new CareerValidationHttpError(err.message);
    }
    if (err instanceof CareerServiceError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : defaultMessage;
    throw new CareerServiceError(message, 'CAREER_SERVICE_ERROR', 500);
  }

  // ==============================================================================
  // 1. Career Targets
  // ==============================================================================

  async createTarget(
    userId: string,
    data: CreateCareerTargetInput
  ): Promise<CareerTargetDto> {
    try {
      return await this.repository.createTarget(userId, data);
    } catch (err) {
      this.mapRepoError(err, 'Failed to create career target');
    }
  }

  async getTargetById(
    userId: string,
    targetId: string
  ): Promise<CareerTargetDto> {
    try {
      const target = await this.repository.getTargetById(userId, targetId);
      if (!target) {
        throw new CareerNotFoundHttpError('Career target not found');
      }
      return target;
    } catch (err) {
      this.mapRepoError(err, 'Failed to retrieve career target');
    }
  }

  async getTargetDetail(
    userId: string,
    targetId: string
  ): Promise<CareerTargetDetailDto> {
    try {
      const detail = await this.repository.getTargetDetail(userId, targetId);
      if (!detail) {
        throw new CareerNotFoundHttpError('Career target not found');
      }
      return detail;
    } catch (err) {
      this.mapRepoError(err, 'Failed to retrieve career target detail');
    }
  }

  async listTargets(
    userId: string,
    query?: CareerTargetQueryInput
  ): Promise<PaginatedList<CareerTargetDto>> {
    try {
      return await this.repository.listTargets(userId, query);
    } catch (err) {
      this.mapRepoError(err, 'Failed to list career targets');
    }
  }

  async updateTarget(
    userId: string,
    targetId: string,
    data: UpdateCareerTargetInput
  ): Promise<CareerTargetDto> {
    try {
      const updated = await this.repository.updateTarget(userId, targetId, data);
      if (!updated) {
        throw new CareerNotFoundHttpError('Career target not found');
      }
      return updated;
    } catch (err) {
      this.mapRepoError(err, 'Failed to update career target');
    }
  }

  async deleteTarget(userId: string, targetId: string): Promise<boolean> {
    try {
      const deleted = await this.repository.deleteTarget(userId, targetId);
      if (!deleted) {
        throw new CareerNotFoundHttpError('Career target not found');
      }
      return true;
    } catch (err) {
      this.mapRepoError(err, 'Failed to delete career target');
    }
  }

  async setPrimaryTarget(
    userId: string,
    targetId: string
  ): Promise<CareerTargetDto> {
    try {
      const updated = await this.repository.setPrimaryTarget(userId, targetId);
      if (!updated) {
        throw new CareerNotFoundHttpError('Career target not found');
      }
      return updated;
    } catch (err) {
      this.mapRepoError(err, 'Failed to set career target as primary');
    }
  }

  async unsetPrimaryTarget(
    userId: string,
    targetId: string
  ): Promise<CareerTargetDto> {
    try {
      const target = await this.repository.getTargetById(userId, targetId);
      if (!target) {
        throw new CareerNotFoundHttpError('Career target not found');
      }
      if (!target.is_primary) {
        return target;
      }
      const updated = await this.repository.updateTarget(userId, targetId, {
        is_primary: false,
      });
      if (!updated) {
        throw new CareerNotFoundHttpError('Career target not found');
      }
      return updated;
    } catch (err) {
      this.mapRepoError(err, 'Failed to unset primary career target');
    }
  }

  // ==============================================================================
  // 2. Career Target Skills
  // ==============================================================================

  async listTargetSkills(
    userId: string,
    targetId: string
  ): Promise<CareerTargetSkillDto[]> {
    try {
      const target = await this.repository.getTargetById(userId, targetId);
      if (!target) {
        throw new CareerNotFoundHttpError('Career target not found');
      }
      return await this.repository.listTargetSkills(userId, targetId);
    } catch (err) {
      this.mapRepoError(err, 'Failed to list career target skills');
    }
  }

  async addTargetSkill(
    userId: string,
    targetId: string,
    data: AddCareerTargetSkillInput
  ): Promise<CareerTargetSkillDto> {
    try {
      return await this.repository.addTargetSkill(userId, targetId, data);
    } catch (err) {
      this.mapRepoError(err, 'Failed to add skill to career target');
    }
  }

  async updateTargetSkill(
    userId: string,
    targetId: string,
    skillId: string,
    data: UpdateCareerTargetSkillInput
  ): Promise<CareerTargetSkillDto> {
    try {
      const updated = await this.repository.updateTargetSkill(
        userId,
        targetId,
        skillId,
        data
      );
      if (!updated) {
        throw new CareerNotFoundHttpError('Target skill association not found');
      }
      return updated;
    } catch (err) {
      this.mapRepoError(err, 'Failed to update career target skill');
    }
  }

  async removeTargetSkill(
    userId: string,
    targetId: string,
    skillId: string
  ): Promise<boolean> {
    try {
      const removed = await this.repository.removeTargetSkill(
        userId,
        targetId,
        skillId
      );
      if (!removed) {
        throw new CareerNotFoundHttpError('Target skill association not found');
      }
      return true;
    } catch (err) {
      this.mapRepoError(err, 'Failed to remove career target skill');
    }
  }

  // ==============================================================================
  // 3. Career Opportunities
  // ==============================================================================

  async createOpportunity(
    userId: string,
    data: CreateCareerOpportunityInput
  ): Promise<CareerOpportunityDto> {
    try {
      return await this.repository.createOpportunity(userId, data);
    } catch (err) {
      this.mapRepoError(err, 'Failed to create career opportunity');
    }
  }

  async getOpportunityById(
    userId: string,
    opportunityId: string
  ): Promise<CareerOpportunityDto> {
    try {
      const opp = await this.repository.getOpportunityById(userId, opportunityId);
      if (!opp) {
        throw new CareerNotFoundHttpError('Career opportunity not found');
      }
      return opp;
    } catch (err) {
      this.mapRepoError(err, 'Failed to retrieve career opportunity');
    }
  }

  async getOpportunityDetail(
    userId: string,
    opportunityId: string
  ): Promise<CareerOpportunityDetailDto> {
    try {
      const detail = await this.repository.getOpportunityDetail(userId, opportunityId);
      if (!detail) {
        throw new CareerNotFoundHttpError('Career opportunity not found');
      }
      return detail;
    } catch (err) {
      this.mapRepoError(err, 'Failed to retrieve career opportunity detail');
    }
  }

  async listOpportunities(
    userId: string,
    query?: CareerOpportunityQueryInput
  ): Promise<PaginatedList<CareerOpportunityDto>> {
    try {
      return await this.repository.listOpportunities(userId, query);
    } catch (err) {
      this.mapRepoError(err, 'Failed to list career opportunities');
    }
  }

  async updateOpportunity(
    userId: string,
    opportunityId: string,
    data: UpdateCareerOpportunityInput
  ): Promise<CareerOpportunityDto> {
    try {
      const updated = await this.repository.updateOpportunity(
        userId,
        opportunityId,
        data
      );
      if (!updated) {
        throw new CareerNotFoundHttpError('Career opportunity not found');
      }
      return updated;
    } catch (err) {
      this.mapRepoError(err, 'Failed to update career opportunity');
    }
  }

  async deleteOpportunity(
    userId: string,
    opportunityId: string
  ): Promise<boolean> {
    try {
      const deleted = await this.repository.deleteOpportunity(userId, opportunityId);
      if (!deleted) {
        throw new CareerNotFoundHttpError('Career opportunity not found');
      }
      return true;
    } catch (err) {
      this.mapRepoError(err, 'Failed to delete career opportunity');
    }
  }

  // ==============================================================================
  // 4. Career Opportunity Skills
  // ==============================================================================

  async listOpportunitySkills(
    userId: string,
    opportunityId: string
  ): Promise<CareerOpportunitySkillDto[]> {
    try {
      const opp = await this.repository.getOpportunityById(userId, opportunityId);
      if (!opp) {
        throw new CareerNotFoundHttpError('Career opportunity not found');
      }
      return await this.repository.listOpportunitySkills(userId, opportunityId);
    } catch (err) {
      this.mapRepoError(err, 'Failed to list career opportunity skills');
    }
  }

  async addOpportunitySkill(
    userId: string,
    opportunityId: string,
    data: AddCareerOpportunitySkillInput
  ): Promise<CareerOpportunitySkillDto> {
    try {
      return await this.repository.addOpportunitySkill(userId, opportunityId, data);
    } catch (err) {
      this.mapRepoError(err, 'Failed to add skill requirement to opportunity');
    }
  }

  async updateOpportunitySkill(
    userId: string,
    opportunityId: string,
    skillId: string,
    data: UpdateCareerOpportunitySkillInput
  ): Promise<CareerOpportunitySkillDto> {
    try {
      const updated = await this.repository.updateOpportunitySkill(
        userId,
        opportunityId,
        skillId,
        data
      );
      if (!updated) {
        throw new CareerNotFoundHttpError('Opportunity skill requirement not found');
      }
      return updated;
    } catch (err) {
      this.mapRepoError(err, 'Failed to update opportunity skill requirement');
    }
  }

  async removeOpportunitySkill(
    userId: string,
    opportunityId: string,
    skillId: string
  ): Promise<boolean> {
    try {
      const removed = await this.repository.removeOpportunitySkill(
        userId,
        opportunityId,
        skillId
      );
      if (!removed) {
        throw new CareerNotFoundHttpError('Opportunity skill requirement not found');
      }
      return true;
    } catch (err) {
      this.mapRepoError(err, 'Failed to remove opportunity skill requirement');
    }
  }

  // ==============================================================================
  // 5. Career Applications & State Machine
  // ==============================================================================

  async createApplication(
    userId: string,
    data: CreateCareerApplicationInput
  ): Promise<CareerApplicationDto> {
    try {
      return await this.repository.createApplication(userId, data);
    } catch (err) {
      this.mapRepoError(err, 'Failed to create career application');
    }
  }

  async getApplicationById(
    userId: string,
    applicationId: string
  ): Promise<CareerApplicationDto> {
    try {
      const app = await this.repository.getApplicationById(userId, applicationId);
      if (!app) {
        throw new CareerNotFoundHttpError('Career application not found');
      }
      return app;
    } catch (err) {
      this.mapRepoError(err, 'Failed to retrieve career application');
    }
  }

  async getApplicationDetail(
    userId: string,
    applicationId: string
  ): Promise<CareerApplicationDetailDto> {
    try {
      const detail = await this.repository.getApplicationDetail(userId, applicationId);
      if (!detail) {
        throw new CareerNotFoundHttpError('Career application not found');
      }
      return detail;
    } catch (err) {
      this.mapRepoError(err, 'Failed to retrieve career application detail');
    }
  }

  async listApplications(
    userId: string,
    query?: CareerApplicationQueryInput
  ): Promise<PaginatedList<CareerApplicationDto>> {
    try {
      return await this.repository.listApplications(userId, query);
    } catch (err) {
      this.mapRepoError(err, 'Failed to list career applications');
    }
  }

  async updateApplication(
    userId: string,
    applicationId: string,
    data: UpdateCareerApplicationInput
  ): Promise<CareerApplicationDto> {
    try {
      // If a stage change is requested via metadata update, route through state machine
      if (data.stage !== undefined) {
        const currentApp = await this.repository.getApplicationById(userId, applicationId);
        if (!currentApp) {
          throw new CareerNotFoundHttpError('Career application not found');
        }
        if (currentApp.stage !== data.stage) {
          await this.transitionApplicationStage(userId, applicationId, {
            stage: data.stage,
            notes: data.notes ?? null,
          });
        }
      }

      // Update remaining permitted metadata
      const { stage: _stage, ...metadataToUpdate } = data;
      if (Object.keys(metadataToUpdate).length === 0) {
        const app = await this.repository.getApplicationById(userId, applicationId);
        if (!app) throw new CareerNotFoundHttpError('Career application not found');
        return app;
      }

      const updated = await this.repository.updateApplication(
        userId,
        applicationId,
        metadataToUpdate
      );
      if (!updated) {
        throw new CareerNotFoundHttpError('Career application not found');
      }
      return updated;
    } catch (err) {
      this.mapRepoError(err, 'Failed to update career application');
    }
  }

  async deleteApplication(
    userId: string,
    applicationId: string
  ): Promise<boolean> {
    try {
      const deleted = await this.repository.deleteApplication(userId, applicationId);
      if (!deleted) {
        throw new CareerNotFoundHttpError('Career application not found');
      }
      return true;
    } catch (err) {
      this.mapRepoError(err, 'Failed to delete career application');
    }
  }

  async listApplicationHistory(
    userId: string,
    applicationId: string
  ): Promise<CareerApplicationHistoryDto[]> {
    try {
      const app = await this.repository.getApplicationById(userId, applicationId);
      if (!app) {
        throw new CareerNotFoundHttpError('Career application not found');
      }
      return await this.repository.listApplicationHistory(userId, applicationId);
    } catch (err) {
      this.mapRepoError(err, 'Failed to list application history');
    }
  }

  /**
   * Explicit, atomic application stage transition state machine.
   * Enforces legal lifecycle transitions, terminal states, optimistic current-stage validation,
   * idempotency on repeated requests, and atomic history recording via database RPC.
   */
  async transitionApplicationStage(
    userId: string,
    applicationId: string,
    input: TransitionCareerApplicationStageInput
  ): Promise<{
    application: CareerApplicationDto;
    history?: CareerApplicationHistoryDto;
    idempotent?: boolean;
  }> {
    try {
      const app = await this.repository.getApplicationById(userId, applicationId);
      if (!app) {
        throw new CareerNotFoundHttpError('Career application not found');
      }

      const currentStage = app.stage;
      const requestedStage = input.stage;

      // 1. Optimistic current-stage / stale-stage validation
      const expectedStage = input.expected_stage ?? input.from_stage;
      if (expectedStage && expectedStage !== currentStage) {
        throw new CareerConflictHttpError(
          `Current application stage '${currentStage}' does not match expected stage '${expectedStage}'. The stage may have been modified concurrently.`
        );
      }

      // 2. Idempotent repeated request handling
      if (currentStage === requestedStage) {
        const history = await this.repository.listApplicationHistory(userId, applicationId);
        return {
          application: app,
          history: history[0],
          idempotent: true,
        };
      }

      // 3. Terminal state guard
      if (isTerminalStage(currentStage)) {
        throw new CareerConflictHttpError(
          `Cannot transition application from terminal stage '${currentStage}'. Applications in accepted, declined, rejected, withdrawn, or closed state cannot be reopened.`
        );
      }

      // 4. State machine lifecycle validation
      if (!isValidStageTransition(currentStage, requestedStage)) {
        const allowed = CAREER_STAGE_TRANSITIONS[currentStage] || [];
        throw new CareerValidationHttpError(
          `Illegal stage transition from '${currentStage}' to '${requestedStage}'. Permitted transitions: ${
            allowed.length > 0 ? allowed.join(', ') : 'none'
          }.`
        );
      }

      // 5. Atomic persistence via database RPC with expected_stage guard
      const result = await this.repository.updateApplicationStageWithHistory(
        userId,
        applicationId,
        requestedStage,
        input.notes ?? null,
        expectedStage ?? null
      );

      return {
        application: result.application,
        history: result.history,
        idempotent: false,
      };
    } catch (err) {
      this.mapRepoError(err, 'Failed to transition application stage');
    }
  }

  // ==============================================================================
  // 6. Career Application Projects
  // ==============================================================================

  async listApplicationProjects(
    userId: string,
    applicationId: string
  ): Promise<CareerApplicationProjectDto[]> {
    try {
      const app = await this.repository.getApplicationById(userId, applicationId);
      if (!app) {
        throw new CareerNotFoundHttpError('Career application not found');
      }
      return await this.repository.listApplicationProjects(userId, applicationId);
    } catch (err) {
      this.mapRepoError(err, 'Failed to list application projects');
    }
  }

  async attachApplicationProject(
    userId: string,
    applicationId: string,
    data: AttachCareerApplicationProjectInput
  ): Promise<CareerApplicationProjectDto> {
    try {
      return await this.repository.attachApplicationProject(userId, applicationId, data);
    } catch (err) {
      this.mapRepoError(err, 'Failed to attach project to application');
    }
  }

  async updateApplicationProject(
    userId: string,
    applicationId: string,
    projectId: string,
    data: UpdateCareerApplicationProjectInput
  ): Promise<CareerApplicationProjectDto> {
    try {
      const updated = await this.repository.updateApplicationProject(
        userId,
        applicationId,
        projectId,
        data
      );
      if (!updated) {
        throw new CareerNotFoundHttpError('Application project attachment not found');
      }
      return updated;
    } catch (err) {
      this.mapRepoError(err, 'Failed to update application project attachment');
    }
  }

  async removeApplicationProject(
    userId: string,
    applicationId: string,
    projectId: string
  ): Promise<boolean> {
    try {
      const removed = await this.repository.removeApplicationProject(
        userId,
        applicationId,
        projectId
      );
      if (!removed) {
        throw new CareerNotFoundHttpError('Application project attachment not found');
      }
      return true;
    } catch (err) {
      this.mapRepoError(err, 'Failed to remove project from application');
    }
  }

  // ==============================================================================
  // 7. Career Interviews
  // ==============================================================================

  async createInterview(
    userId: string,
    applicationId: string,
    data: CreateCareerInterviewInput
  ): Promise<CareerInterviewDto> {
    try {
      return await this.repository.createInterview(userId, applicationId, data);
    } catch (err) {
      this.mapRepoError(err, 'Failed to create career interview round');
    }
  }

  async getInterviewById(
    userId: string,
    interviewId: string
  ): Promise<CareerInterviewDto> {
    try {
      const interview = await this.repository.getInterviewById(userId, interviewId);
      if (!interview) {
        throw new CareerNotFoundHttpError('Career interview not found');
      }
      return interview;
    } catch (err) {
      this.mapRepoError(err, 'Failed to retrieve career interview');
    }
  }

  async listInterviews(
    userId: string,
    query?: CareerInterviewQueryInput
  ): Promise<PaginatedList<CareerInterviewDto>> {
    try {
      return await this.repository.listInterviews(userId, query);
    } catch (err) {
      this.mapRepoError(err, 'Failed to list career interviews');
    }
  }

  async updateInterview(
    userId: string,
    interviewId: string,
    data: UpdateCareerInterviewInput
  ): Promise<CareerInterviewDto> {
    try {
      const updated = await this.repository.updateInterview(
        userId,
        interviewId,
        data
      );
      if (!updated) {
        throw new CareerNotFoundHttpError('Career interview not found');
      }
      return updated;
    } catch (err) {
      this.mapRepoError(err, 'Failed to update career interview');
    }
  }

  async deleteInterview(
    userId: string,
    interviewId: string
  ): Promise<boolean> {
    try {
      const deleted = await this.repository.deleteInterview(userId, interviewId);
      if (!deleted) {
        throw new CareerNotFoundHttpError('Career interview not found');
      }
      return true;
    } catch (err) {
      this.mapRepoError(err, 'Failed to delete career interview');
    }
  }

  // ==============================================================================
  // 8. Readiness & Preparation Integration
  // ==============================================================================

  async getApplicationPreparation(
    userId: string,
    applicationId: string
  ): Promise<CareerApplicationPreparationDto> {
    try {
      const prep = await this.repository.getApplicationPreparation(userId, applicationId);
      if (!prep) {
        throw new CareerNotFoundHttpError('Career application not found');
      }
      return prep;
    } catch (err) {
      this.mapRepoError(err, 'Failed to retrieve application preparation');
    }
  }

  async listApplicationTasks(
    userId: string,
    applicationId: string
  ): Promise<CareerTaskReadinessItem[]> {
    try {
      const prep = await this.getApplicationPreparation(userId, applicationId);
      return [...prep.tasks.open, ...prep.tasks.completed];
    } catch (err) {
      this.mapRepoError(err, 'Failed to list application tasks');
    }
  }
}

export const defaultCareerService = new CareerService();
