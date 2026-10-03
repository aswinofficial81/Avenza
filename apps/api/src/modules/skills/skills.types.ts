import type {
  CreateSkillInput,
  EvidenceDto,
  EvidenceSkillDto,
  GoalSkillDto,
  LinkEvidenceToSkillInput,
  LinkGoalToSkillInput,
  LinkTaskToSkillInput,
  LinkTopicToSkillInput,
  SkillDetailDto,
  SkillDto,
  SkillMasteryDto,
  SkillQueryInput,
  SkillWithMasteryDto,
  TaskSkillDto,
  TopicSkillDto,
  UpdateSkillInput,
} from '@avenza/shared';

export interface ISkillsRepository {
  createSkill(userId: string, data: CreateSkillInput): Promise<SkillDto>;
  getSkillById(userId: string, skillId: string): Promise<SkillDto | null>;
  getSkillBySlug(userId: string, slug: string): Promise<SkillDto | null>;
  listSkills(userId: string, query?: SkillQueryInput): Promise<SkillDto[]>;
  updateSkill(userId: string, skillId: string, data: UpdateSkillInput): Promise<SkillDto>;
  archiveSkill(userId: string, skillId: string): Promise<SkillDto>;
  deleteSkill(userId: string, skillId: string): Promise<void>;

  // Evidence links
  linkEvidence(userId: string, data: LinkEvidenceToSkillInput): Promise<EvidenceSkillDto>;
  unlinkEvidence(userId: string, evidenceId: string, skillId: string): Promise<void>;
  getEvidenceForSkill(userId: string, skillId: string): Promise<EvidenceDto[]>;
  getSkillsForEvidence(userId: string, evidenceId: string): Promise<SkillDto[]>;

  // Goal links
  linkGoal(userId: string, data: LinkGoalToSkillInput): Promise<GoalSkillDto>;
  unlinkGoal(userId: string, goalId: string, skillId: string): Promise<void>;
  getGoalsForSkill(
    userId: string,
    skillId: string
  ): Promise<
    Array<{
      id: string;
      title: string;
      status: string;
      target_mastery_state: GoalSkillDto['target_mastery_state'];
    }>
  >;

  // Task links
  linkTask(userId: string, data: LinkTaskToSkillInput): Promise<TaskSkillDto>;
  unlinkTask(userId: string, taskId: string, skillId: string): Promise<void>;
  getTasksForSkill(
    userId: string,
    skillId: string
  ): Promise<Array<{ id: string; title: string; status: string }>>;

  // Topic links
  linkTopic(userId: string, data: LinkTopicToSkillInput): Promise<TopicSkillDto>;
  unlinkTopic(userId: string, topicId: string, skillId: string): Promise<void>;
  getTopicsForSkill(
    userId: string,
    skillId: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      status: string;
      subject_id: string;
      subject_name?: string;
    }>
  >;

  // Children
  getChildSkills(userId: string, parentSkillId: string): Promise<SkillDto[]>;
}

export interface ISkillsService {
  createSkill(userId: string, data: CreateSkillInput): Promise<SkillDto>;
  getSkill(userId: string, skillId: string): Promise<SkillWithMasteryDto>;
  getSkillDetail(userId: string, skillId: string): Promise<SkillDetailDto>;
  listSkills(userId: string, query?: SkillQueryInput): Promise<SkillWithMasteryDto[]>;
  updateSkill(userId: string, skillId: string, data: UpdateSkillInput): Promise<SkillDto>;
  archiveSkill(userId: string, skillId: string): Promise<SkillDto>;
  deleteSkill(userId: string, skillId: string): Promise<void>;
  getSkillMastery(userId: string, skillId: string): Promise<SkillMasteryDto>;

  linkEvidence(userId: string, data: LinkEvidenceToSkillInput): Promise<EvidenceSkillDto>;
  unlinkEvidence(userId: string, evidenceId: string, skillId: string): Promise<void>;

  linkGoal(userId: string, data: LinkGoalToSkillInput): Promise<GoalSkillDto>;
  unlinkGoal(userId: string, goalId: string, skillId: string): Promise<void>;

  linkTask(userId: string, data: LinkTaskToSkillInput): Promise<TaskSkillDto>;
  unlinkTask(userId: string, taskId: string, skillId: string): Promise<void>;

  linkTopic(userId: string, data: LinkTopicToSkillInput): Promise<TopicSkillDto>;
  unlinkTopic(userId: string, topicId: string, skillId: string): Promise<void>;
}
