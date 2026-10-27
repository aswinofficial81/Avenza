import {
  CreateDsaProblemInputSchema,
  UpdateDsaProblemInputSchema,
  DsaProblemQuerySchema,
  CreateDsaAttemptInputSchema,
  UpdateDsaAttemptInputSchema,
  CreateDsaTopicInputSchema,
  UpdateDsaTopicInputSchema,
  LinkDsaProblemTopicInputSchema,
  LinkDsaProblemSkillInputSchema,
  LinkDsaProblemGoalInputSchema,
  LinkDsaProblemTaskInputSchema,
} from '@avenza/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IDsaService } from './dsa.service';

export class DsaError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'DSA_ERROR',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'DsaError';
  }
}

export class DsaController {
  constructor(private readonly dsaService: IDsaService) {}

  private getUserId(request: FastifyRequest): string {
    const userId = request.auth?.profileId || request.profile?.id || (request.headers['x-user-id'] as string);
    if (!userId) {
      throw new DsaError('User not authenticated', 'UNAUTHORIZED', 401);
    }
    return userId;
  }

  // Problem CRUD handlers
  createProblem = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const parsed = CreateDsaProblemInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid problem input.',
            details: parsed.error.format(),
          },
        });
      }

      const problem = await this.dsaService.createProblem(userId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: problem,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  getProblem = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      const problem = await this.dsaService.getProblem(userId, problemId);
      if (!problem) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Problem not found',
          },
        });
      }
      return reply.status(200).send({
        success: true,
        data: problem,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  getProblemDetail = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      const problem = await this.dsaService.getProblemDetail(userId, problemId);
      if (!problem) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Problem not found',
          },
        });
      }
      return reply.status(200).send({
        success: true,
        data: problem,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  listProblems = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const parsed = DsaProblemQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters.',
            details: parsed.error.format(),
          },
        });
      }

      const problems = await this.dsaService.listProblems(userId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: problems,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  updateProblem = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      const parsed = UpdateDsaProblemInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload.',
            details: parsed.error.format(),
          },
        });
      }

      const problem = await this.dsaService.updateProblem(userId, problemId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: problem,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  archiveProblem = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      const problem = await this.dsaService.archiveProblem(userId, problemId);
      return reply.status(200).send({
        success: true,
        data: problem,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  deleteProblem = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      await this.dsaService.deleteProblem(userId, problemId);
      return reply.status(204).send({
        success: true,
        data: { message: 'Problem deleted successfully' },
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  // Attempt CRUD handlers
  createAttempt = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      const parsed = CreateDsaAttemptInputSchema.safeParse({
        ...(request.body || {}),
        problem_id: problemId,
      });
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid attempt input.',
            details: parsed.error.format(),
          },
        });
      }

      const attempt = await this.dsaService.createAttempt(userId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: attempt,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  getAttempt = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { attemptId } = request.params as { attemptId: string };
      const attempt = await this.dsaService.getAttempt(userId, attemptId);
      if (!attempt) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Attempt not found',
          },
        });
      }
      return reply.status(200).send({
        success: true,
        data: attempt,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  listAttemptsByProblem = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      const attempts = await this.dsaService.listAttemptsByProblem(userId, problemId);
      return reply.status(200).send({
        success: true,
        data: attempts,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  updateAttempt = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { attemptId } = request.params as { attemptId: string };
      const parsed = UpdateDsaAttemptInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload.',
            details: parsed.error.format(),
          },
        });
      }

      const attempt = await this.dsaService.updateAttempt(userId, attemptId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: attempt,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  // Topic CRUD handlers
  createTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const parsed = CreateDsaTopicInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid topic input.',
            details: parsed.error.format(),
          },
        });
      }

      const topic = await this.dsaService.createTopic(userId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: topic,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  getTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { topicId } = request.params as { topicId: string };
      const topic = await this.dsaService.getTopic(userId, topicId);
      if (!topic) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Topic not found',
          },
        });
      }
      return reply.status(200).send({
        success: true,
        data: topic,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  listTopics = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      // For simplicity, we'll use an empty query object since we don't have a specific schema for topic queries
      const topics = await this.dsaService.listTopics(userId, {});
      return reply.status(200).send({
        success: true,
        data: topics,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  updateTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { topicId } = request.params as { topicId: string };
      const parsed = UpdateDsaTopicInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload.',
            details: parsed.error.format(),
          },
        });
      }

      const topic = await this.dsaService.updateTopic(userId, topicId, parsed.data);
      return reply.status(200).send({
        success: true,
        data: topic,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  archiveTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { topicId } = request.params as { topicId: string };
      const topic = await this.dsaService.archiveTopic(userId, topicId);
      return reply.status(200).send({
        success: true,
        data: topic,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  deleteTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { topicId } = request.params as { topicId: string };
      await this.dsaService.deleteTopic(userId, topicId);
      return reply.status(204).send({
        success: true,
        data: { message: 'Topic deleted successfully' },
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  // Relationship handlers
  linkProblemTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      const parsed = LinkDsaProblemTopicInputSchema.safeParse({
        ...(request.body || {}),
        problem_id: problemId,
      });
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid link problem-topic payload.',
            details: parsed.error.format(),
          },
        });
      }

      await this.dsaService.linkProblemTopic(userId, parsed.data);
      return reply.status(204).send();
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  unlinkProblemTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId, topicId } = request.params as { problemId: string; topicId: string };
      await this.dsaService.unlinkProblemTopic(userId, problemId, topicId);
      return reply.status(204).send();
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  linkProblemSkill = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      const parsed = LinkDsaProblemSkillInputSchema.safeParse({
        ...(request.body || {}),
        problem_id: problemId,
      });
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid link problem-skill payload.',
            details: parsed.error.format(),
          },
        });
      }

      await this.dsaService.linkProblemSkill(userId, parsed.data);
      return reply.status(204).send();
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  unlinkProblemSkill = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId, skillId } = request.params as { problemId: string; skillId: string };
      await this.dsaService.unlinkProblemSkill(userId, problemId, skillId);
      return reply.status(204).send();
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  linkProblemGoal = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      const parsed = LinkDsaProblemGoalInputSchema.safeParse({
        ...(request.body || {}),
        problem_id: problemId,
      });
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid link problem-goal payload.',
            details: parsed.error.format(),
          },
        });
      }

      await this.dsaService.linkProblemGoal(userId, parsed.data);
      return reply.status(204).send();
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  unlinkProblemGoal = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId, goalId } = request.params as { problemId: string; goalId: string };
      await this.dsaService.unlinkProblemGoal(userId, problemId, goalId);
      return reply.status(204).send();
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  linkProblemTask = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId } = request.params as { problemId: string };
      const parsed = LinkDsaProblemTaskInputSchema.safeParse({
        ...(request.body || {}),
        problem_id: problemId,
      });
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid link problem-task payload.',
            details: parsed.error.format(),
          },
        });
      }

      await this.dsaService.linkProblemTask(userId, parsed.data);
      return reply.status(204).send();
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  unlinkProblemTask = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const { problemId, taskId } = request.params as { problemId: string; taskId: string };
      await this.dsaService.unlinkProblemTask(userId, problemId, taskId);
      return reply.status(204).send();
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  // Overview and analytics
  getOverview = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getUserId(request);
      const overview = await this.dsaService.getOverview(userId);
      return reply.status(200).send({
        success: true,
        data: overview,
      });
    } catch (err: unknown) {
      this.handleError(err, reply);
    }
  };

  private handleError(err: unknown, reply: FastifyReply) {
    if (err instanceof DsaError) {
      return reply.status(err.statusCode).send({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const isClientError =
      message.includes('not found') ||
      message.includes('belong') ||
      message.includes('Circular') ||
      message.includes('violates');

    return reply.status(isClientError ? 400 : 500).send({
      success: false,
      error: {
        code: isClientError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
        message,
      },
    });
  }
}