import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  CreateAcademicYearSchema,
  UpdateAcademicYearSchema,
  CreateTermSchema,
  UpdateTermSchema,
  CreateSubjectSchema,
  UpdateSubjectSchema,
  CreateTopicSchema,
  UpdateTopicSchema,
  CreateAssessmentSchema,
  UpdateAssessmentSchema,
  CreateExamSchema,
  UpdateExamSchema,
} from '@avenza/shared';
import { AcademicsError, type AcademicsService } from './academics.service';

export class AcademicsController {
  constructor(private readonly service: AcademicsService) {}

  private getProfileId(request: FastifyRequest): string {
    const profileId = request.auth?.profileId || request.profile?.id;
    if (!profileId) {
      throw new AcademicsError('User profile not resolved.', 'UNAUTHORIZED', 401);
    }
    return profileId;
  }

  private handleError(err: unknown, reply: FastifyReply) {
    if (err instanceof AcademicsError) {
      return reply.status(err.statusCode).send({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }

  // --- Overview ---

  getAcademicsOverview = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const data = await this.service.getAcademicsOverview(userId);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  // --- Academic Years ---

  createAcademicYear = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const parsed = CreateAcademicYearSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const data = await this.service.createAcademicYear(userId, parsed.data);
      return reply.status(201).send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getAcademicYears = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const data = await this.service.getAcademicYears(userId);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getAcademicYearById = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const data = await this.service.getAcademicYearById(userId, id);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  updateAcademicYear = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const parsed = UpdateAcademicYearSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const data = await this.service.updateAcademicYear(userId, id, parsed.data);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  deleteAcademicYear = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      await this.service.deleteAcademicYear(userId, id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  // --- Terms ---

  createTerm = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const parsed = CreateTermSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const data = await this.service.createTerm(userId, {
        ...parsed.data,
        code: parsed.data.code ?? null,
        notes: parsed.data.notes ?? null,
        academic_year_id: parsed.data.academic_year_id ?? null,
      });
      return reply.status(201).send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getTerms = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const data = await this.service.getTerms(userId);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getTermById = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const data = await this.service.getTermById(userId, id);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  updateTerm = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const parsed = UpdateTermSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const data = await this.service.updateTerm(userId, id, parsed.data);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  deleteTerm = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      await this.service.deleteTerm(userId, id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  // --- Subjects ---

  createSubject = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const parsed = CreateSubjectSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const data = await this.service.createSubject(userId, {
        ...parsed.data,
        code: parsed.data.code ?? null,
        description: parsed.data.description ?? null,
        instructor: parsed.data.instructor ?? null,
        credits: parsed.data.credits ?? null,
        color: parsed.data.color ?? null,
        notes: parsed.data.notes ?? null,
      });
      return reply.status(201).send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getSubjects = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { termId } = (request.query || {}) as { termId?: string };
      const data = await this.service.getSubjects(userId, termId);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getSubjectById = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const data = await this.service.getSubjectById(userId, id);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getSubjectBundle = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const data = await this.service.getSubjectBundle(userId, id);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  updateSubject = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const parsed = UpdateSubjectSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const data = await this.service.updateSubject(userId, id, parsed.data);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  deleteSubject = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      await this.service.deleteSubject(userId, id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  // --- Topics ---

  createTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { subjectId } = request.params as { subjectId: string };
      const parsed = CreateTopicSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const data = await this.service.createTopic(userId, subjectId, {
        ...parsed.data,
        description: parsed.data.description ?? null,
        estimated_minutes: parsed.data.estimated_minutes ?? null,
        notes: parsed.data.notes ?? null,
      });
      return reply.status(201).send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getTopicsBySubjectId = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { subjectId } = request.params as { subjectId: string };
      const data = await this.service.getTopicsBySubjectId(userId, subjectId);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getTopicById = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const data = await this.service.getTopicById(userId, id);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  updateTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const parsed = UpdateTopicSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const data = await this.service.updateTopic(userId, id, parsed.data);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  deleteTopic = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      await this.service.deleteTopic(userId, id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  // --- Assessments ---

  createAssessment = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const parsed = CreateAssessmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const { topic_ids, ...rest } = parsed.data;
      const data = await this.service.createAssessment(
        userId,
        {
          ...rest,
          subject_id: rest.subject_id ?? null,
          description: rest.description ?? null,
          due_at: rest.due_at ?? null,
          max_marks: rest.max_marks ?? null,
          obtained_marks: rest.obtained_marks ?? null,
          weight_percent: rest.weight_percent ?? null,
          notes: rest.notes ?? null,
        },
        topic_ids
      );
      return reply.status(201).send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getAssessments = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { termId, subjectId } = (request.query || {}) as { termId?: string; subjectId?: string };
      const data = await this.service.getAssessments(userId, termId, subjectId);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getAssessmentById = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const data = await this.service.getAssessmentById(userId, id);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  updateAssessment = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const parsed = UpdateAssessmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const { topic_ids, ...rest } = parsed.data;
      const data = await this.service.updateAssessment(userId, id, rest, topic_ids);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  deleteAssessment = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      await this.service.deleteAssessment(userId, id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  // --- Exams ---

  createExam = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const parsed = CreateExamSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const { topic_ids, ...rest } = parsed.data;
      const data = await this.service.createExam(
        userId,
        {
          ...rest,
          subject_id: rest.subject_id ?? null,
          duration_minutes: rest.duration_minutes ?? null,
          location: rest.location ?? null,
          weight_percent: rest.weight_percent ?? null,
          notes: rest.notes ?? null,
        },
        topic_ids
      );
      return reply.status(201).send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getExams = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { termId, subjectId } = (request.query || {}) as { termId?: string; subjectId?: string };
      const data = await this.service.getExams(userId, termId, subjectId);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  getExamById = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const data = await this.service.getExamById(userId, id);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  updateExam = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      const parsed = UpdateExamSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.format() },
        });
      }
      const { topic_ids, ...rest } = parsed.data;
      const data = await this.service.updateExam(userId, id, rest, topic_ids);
      return reply.send({ success: true, data });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };

  deleteExam = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = this.getProfileId(request);
      const { id } = request.params as { id: string };
      await this.service.deleteExam(userId, id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (err) {
      return this.handleError(err, reply);
    }
  };
}
