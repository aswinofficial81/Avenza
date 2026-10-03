import type {
  CreateSkillInput,
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
import { calculateSkillMastery } from './skills.mastery';
import type { ISkillsRepository, ISkillsService } from './skills.types';

export class SkillsService implements ISkillsService {
  constructor(private readonly repository: ISkillsRepository) {}

  async createSkill(userId: string, data: CreateSkillInput): Promise<SkillDto> {
    if (data.parent_skill_id) {
      const parent = await this.repository.getSkillById(userId, data.parent_skill_id);
      if (!parent) {
        throw new Error('Parent skill not found or does not belong to user');
      }
    }

    return this.repository.createSkill(userId, data);
  }

  async getSkill(userId: string, skillId: string): Promise<SkillWithMasteryDto> {
    const skill = await this.repository.getSkillById(userId, skillId);
    if (!skill) {
      throw new Error('Skill not found');
    }

    const evidence = await this.repository.getEvidenceForSkill(userId, skillId);
    const mastery = calculateSkillMastery({
      evidence,
      referenceTimestamp: new Date().toISOString(),
    });

    return {
      skill,
      mastery,
    };
  }

  async getSkillDetail(userId: string, skillId: string): Promise<SkillDetailDto> {
    const skill = await this.repository.getSkillById(userId, skillId);
    if (!skill) {
      throw new Error('Skill not found');
    }

    const [evidence, goals, tasks, topics, children] = await Promise.all([
      this.repository.getEvidenceForSkill(userId, skillId),
      this.repository.getGoalsForSkill(userId, skillId),
      this.repository.getTasksForSkill(userId, skillId),
      this.repository.getTopicsForSkill(userId, skillId),
      this.repository.getChildSkills(userId, skillId),
    ]);

    const mastery = calculateSkillMastery({
      evidence,
      referenceTimestamp: new Date().toISOString(),
    });

    return {
      skill,
      mastery,
      evidence,
      goals,
      tasks,
      topics,
      children,
    };
  }

  async listSkills(userId: string, query?: SkillQueryInput): Promise<SkillWithMasteryDto[]> {
    const skills = await this.repository.listSkills(userId, query);
    const nowIso = new Date().toISOString();

    // Calculate derived mastery for each skill
    const skillsWithMastery = await Promise.all(
      skills.map(async (skill) => {
        const evidence = await this.repository.getEvidenceForSkill(userId, skill.id);
        const mastery = calculateSkillMastery({
          evidence,
          referenceTimestamp: nowIso,
        });
        return {
          skill,
          mastery,
        };
      })
    );

    return skillsWithMastery;
  }

  async updateSkill(userId: string, skillId: string, data: UpdateSkillInput): Promise<SkillDto> {
    const existing = await this.repository.getSkillById(userId, skillId);
    if (!existing) {
      throw new Error('Skill not found');
    }

    if (data.parent_skill_id) {
      if (data.parent_skill_id === skillId) {
        throw new Error('A skill cannot be its own parent');
      }

      const parent = await this.repository.getSkillById(userId, data.parent_skill_id);
      if (!parent) {
        throw new Error('Parent skill not found or does not belong to user');
      }

      // Check cycle: walk ancestors of candidate parent
      let currentParentId: string | null = parent.id;
      let depth = 0;
      while (currentParentId && depth < 25) {
        depth++;
        if (currentParentId === skillId) {
          throw new Error('Circular hierarchy detected in skills');
        }
        const ancestor = await this.repository.getSkillById(userId, currentParentId);
        currentParentId = ancestor?.parent_skill_id ?? null;
      }
    }

    return this.repository.updateSkill(userId, skillId, data);
  }

  async archiveSkill(userId: string, skillId: string): Promise<SkillDto> {
    const existing = await this.repository.getSkillById(userId, skillId);
    if (!existing) {
      throw new Error('Skill not found');
    }
    return this.repository.archiveSkill(userId, skillId);
  }

  async deleteSkill(userId: string, skillId: string): Promise<void> {
    const existing = await this.repository.getSkillById(userId, skillId);
    if (!existing) {
      throw new Error('Skill not found');
    }
    await this.repository.deleteSkill(userId, skillId);
  }

  async getSkillMastery(userId: string, skillId: string): Promise<SkillMasteryDto> {
    const existing = await this.repository.getSkillById(userId, skillId);
    if (!existing) {
      throw new Error('Skill not found');
    }

    const evidence = await this.repository.getEvidenceForSkill(userId, skillId);
    return calculateSkillMastery({
      evidence,
      referenceTimestamp: new Date().toISOString(),
    });
  }

  // ----------------------------------------------------------------------------
  // Relationship Linking
  // ----------------------------------------------------------------------------
  async linkEvidence(userId: string, data: LinkEvidenceToSkillInput): Promise<EvidenceSkillDto> {
    const skill = await this.repository.getSkillById(userId, data.skill_id);
    if (!skill) {
      throw new Error('Skill not found');
    }
    return this.repository.linkEvidence(userId, data);
  }

  async unlinkEvidence(userId: string, evidenceId: string, skillId: string): Promise<void> {
    const skill = await this.repository.getSkillById(userId, skillId);
    if (!skill) {
      throw new Error('Skill not found');
    }
    await this.repository.unlinkEvidence(userId, evidenceId, skillId);
  }

  async linkGoal(userId: string, data: LinkGoalToSkillInput): Promise<GoalSkillDto> {
    const skill = await this.repository.getSkillById(userId, data.skill_id);
    if (!skill) {
      throw new Error('Skill not found');
    }
    return this.repository.linkGoal(userId, data);
  }

  async unlinkGoal(userId: string, goalId: string, skillId: string): Promise<void> {
    const skill = await this.repository.getSkillById(userId, skillId);
    if (!skill) {
      throw new Error('Skill not found');
    }
    await this.repository.unlinkGoal(userId, goalId, skillId);
  }

  async linkTask(userId: string, data: LinkTaskToSkillInput): Promise<TaskSkillDto> {
    const skill = await this.repository.getSkillById(userId, data.skill_id);
    if (!skill) {
      throw new Error('Skill not found');
    }
    return this.repository.linkTask(userId, data);
  }

  async unlinkTask(userId: string, taskId: string, skillId: string): Promise<void> {
    const skill = await this.repository.getSkillById(userId, skillId);
    if (!skill) {
      throw new Error('Skill not found');
    }
    await this.repository.unlinkTask(userId, taskId, skillId);
  }

  async linkTopic(userId: string, data: LinkTopicToSkillInput): Promise<TopicSkillDto> {
    const skill = await this.repository.getSkillById(userId, data.skill_id);
    if (!skill) {
      throw new Error('Skill not found');
    }
    return this.repository.linkTopic(userId, data);
  }

  async unlinkTopic(userId: string, topicId: string, skillId: string): Promise<void> {
    const skill = await this.repository.getSkillById(userId, skillId);
    if (!skill) {
      throw new Error('Skill not found');
    }
    await this.repository.unlinkTopic(userId, topicId, skillId);
  }
}
