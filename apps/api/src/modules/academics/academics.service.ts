import type {
  AcademicYearDto,
  AcademicsOverviewDto,
  AssessmentDto,
  ExamDto,
  SubjectDto,
  SubjectTopicDto,
  TermDto,
} from '@avenza/shared';
import type { IAcademicsRepository } from './academics.types';

export class AcademicsError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'ACADEMICS_ERROR',
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AcademicsError';
  }
}

export class AcademicsService {
  constructor(private readonly repo: IAcademicsRepository) {}

  // --- Academic Years ---

  async createAcademicYear(
    userId: string,
    data: Omit<AcademicYearDto, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<AcademicYearDto> {
    if (data.start_date > data.end_date) {
      throw new AcademicsError('start_date must be on or before end_date', 'INVALID_DATES', 400);
    }
    return this.repo.createAcademicYear(userId, data);
  }

  async getAcademicYears(userId: string): Promise<AcademicYearDto[]> {
    return this.repo.getAcademicYears(userId);
  }

  async getAcademicYearById(userId: string, id: string): Promise<AcademicYearDto> {
    const item = await this.repo.getAcademicYearById(userId, id);
    if (!item) {
      throw new AcademicsError('Academic Year not found.', 'NOT_FOUND', 404);
    }
    return item;
  }

  async updateAcademicYear(
    userId: string,
    id: string,
    data: Partial<Omit<AcademicYearDto, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<AcademicYearDto> {
    await this.getAcademicYearById(userId, id);
    const updated = await this.repo.updateAcademicYear(userId, id, data);
    if (!updated) {
      throw new AcademicsError('Failed to update academic year.', 'UPDATE_FAILED', 400);
    }
    return updated;
  }

  async deleteAcademicYear(userId: string, id: string): Promise<boolean> {
    await this.getAcademicYearById(userId, id);
    return this.repo.deleteAcademicYear(userId, id);
  }

  // --- Terms ---

  async createTerm(
    userId: string,
    data: Omit<TermDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'academic_year_name' | 'subject_count'>
  ): Promise<TermDto> {
    if (data.start_date > data.end_date) {
      throw new AcademicsError('start_date must be on or before end_date', 'INVALID_DATES', 400);
    }
    if (data.academic_year_id) {
      const year = await this.repo.getAcademicYearById(userId, data.academic_year_id);
      if (!year) {
        throw new AcademicsError('Referenced Academic Year does not exist or belong to user.', 'INVALID_RELATIONSHIP', 400);
      }
    }
    return this.repo.createTerm(userId, data);
  }

  async getTerms(userId: string): Promise<TermDto[]> {
    return this.repo.getTerms(userId);
  }

  async getTermById(userId: string, id: string): Promise<TermDto> {
    const term = await this.repo.getTermById(userId, id);
    if (!term) {
      throw new AcademicsError('Term not found.', 'NOT_FOUND', 404);
    }
    return term;
  }

  async updateTerm(
    userId: string,
    id: string,
    data: Partial<Omit<TermDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'academic_year_name' | 'subject_count'>>
  ): Promise<TermDto> {
    await this.getTermById(userId, id);
    if (data.start_date && data.end_date && data.start_date > data.end_date) {
      throw new AcademicsError('start_date must be on or before end_date', 'INVALID_DATES', 400);
    }
    if (data.academic_year_id) {
      const year = await this.repo.getAcademicYearById(userId, data.academic_year_id);
      if (!year) {
        throw new AcademicsError('Referenced Academic Year does not exist or belong to user.', 'INVALID_RELATIONSHIP', 400);
      }
    }
    const updated = await this.repo.updateTerm(userId, id, data);
    if (!updated) {
      throw new AcademicsError('Failed to update term.', 'UPDATE_FAILED', 400);
    }
    return updated;
  }

  async deleteTerm(userId: string, id: string): Promise<boolean> {
    await this.getTermById(userId, id);
    return this.repo.deleteTerm(userId, id);
  }

  // --- Subjects ---

  async createSubject(
    userId: string,
    data: Omit<SubjectDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'term_name' | 'coverage'>
  ): Promise<SubjectDto> {
    // Validate term ownership
    const term = await this.repo.getTermById(userId, data.term_id);
    if (!term) {
      throw new AcademicsError('Referenced Term not found or does not belong to user.', 'INVALID_TERM', 400);
    }
    return this.repo.createSubject(userId, data);
  }

  async getSubjects(userId: string, termId?: string): Promise<SubjectDto[]> {
    return this.repo.getSubjects(userId, termId);
  }

  async getSubjectById(userId: string, id: string): Promise<SubjectDto> {
    const subject = await this.repo.getSubjectById(userId, id);
    if (!subject) {
      throw new AcademicsError('Subject not found.', 'NOT_FOUND', 404);
    }
    return subject;
  }

  async getSubjectBundle(
    userId: string,
    subjectId: string
  ): Promise<{
    subject: SubjectDto;
    topics: SubjectTopicDto[];
    assessments: AssessmentDto[];
    exams: ExamDto[];
  }> {
    const subject = await this.getSubjectById(userId, subjectId);
    const topics = await this.repo.getTopicsBySubjectId(userId, subjectId);
    const assessments = await this.repo.getAssessments(userId, subject.term_id, subjectId);
    const exams = await this.repo.getExams(userId, subject.term_id, subjectId);

    return {
      subject,
      topics,
      assessments,
      exams,
    };
  }

  async updateSubject(
    userId: string,
    id: string,
    data: Partial<Omit<SubjectDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'term_name' | 'coverage'>>
  ): Promise<SubjectDto> {
    await this.getSubjectById(userId, id);
    if (data.term_id) {
      const term = await this.repo.getTermById(userId, data.term_id);
      if (!term) {
        throw new AcademicsError('Referenced Term not found or does not belong to user.', 'INVALID_TERM', 400);
      }
    }
    const updated = await this.repo.updateSubject(userId, id, data);
    if (!updated) {
      throw new AcademicsError('Failed to update subject.', 'UPDATE_FAILED', 400);
    }
    return updated;
  }

  async deleteSubject(userId: string, id: string): Promise<boolean> {
    await this.getSubjectById(userId, id);
    return this.repo.deleteSubject(userId, id);
  }

  // --- Topics ---

  async createTopic(
    userId: string,
    subjectId: string,
    data: Omit<SubjectTopicDto, 'id' | 'user_id' | 'subject_id' | 'created_at' | 'updated_at'>
  ): Promise<SubjectTopicDto> {
    const subject = await this.repo.getSubjectById(userId, subjectId);
    if (!subject) {
      throw new AcademicsError('Referenced Subject not found or does not belong to user.', 'INVALID_SUBJECT', 400);
    }
    return this.repo.createTopic(userId, subjectId, data);
  }

  async getTopicsBySubjectId(userId: string, subjectId: string): Promise<SubjectTopicDto[]> {
    await this.getSubjectById(userId, subjectId);
    return this.repo.getTopicsBySubjectId(userId, subjectId);
  }

  async getTopicById(userId: string, id: string): Promise<SubjectTopicDto> {
    const topic = await this.repo.getTopicById(userId, id);
    if (!topic) {
      throw new AcademicsError('Topic not found.', 'NOT_FOUND', 404);
    }
    return topic;
  }

  async updateTopic(
    userId: string,
    id: string,
    data: Partial<Omit<SubjectTopicDto, 'id' | 'user_id' | 'subject_id' | 'created_at' | 'updated_at'>>
  ): Promise<SubjectTopicDto> {
    await this.getTopicById(userId, id);
    const updated = await this.repo.updateTopic(userId, id, data);
    if (!updated) {
      throw new AcademicsError('Failed to update topic.', 'UPDATE_FAILED', 400);
    }
    return updated;
  }

  async deleteTopic(userId: string, id: string): Promise<boolean> {
    await this.getTopicById(userId, id);
    return this.repo.deleteTopic(userId, id);
  }

  // --- Assessments ---

  async createAssessment(
    userId: string,
    data: Omit<AssessmentDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>,
    topicIds: string[] = []
  ): Promise<AssessmentDto> {
    const term = await this.repo.getTermById(userId, data.term_id);
    if (!term) {
      throw new AcademicsError('Referenced Term not found or does not belong to user.', 'INVALID_TERM', 400);
    }
    if (data.subject_id) {
      const subject = await this.repo.getSubjectById(userId, data.subject_id);
      if (!subject) {
        throw new AcademicsError('Referenced Subject not found or does not belong to user.', 'INVALID_SUBJECT', 400);
      }
    }
    // Verify each topic belongs to user
    for (const tid of topicIds) {
      const topic = await this.repo.getTopicById(userId, tid);
      if (!topic) {
        throw new AcademicsError(`Topic ${tid} not found or does not belong to user.`, 'INVALID_TOPIC', 400);
      }
    }

    if (data.obtained_marks != null && data.max_marks != null && data.obtained_marks > data.max_marks) {
      throw new AcademicsError('obtained_marks cannot exceed max_marks', 'INVALID_MARKS', 400);
    }

    return this.repo.createAssessment(userId, data, topicIds);
  }

  async getAssessments(userId: string, termId?: string, subjectId?: string): Promise<AssessmentDto[]> {
    return this.repo.getAssessments(userId, termId, subjectId);
  }

  async getAssessmentById(userId: string, id: string): Promise<AssessmentDto> {
    const asmt = await this.repo.getAssessmentById(userId, id);
    if (!asmt) {
      throw new AcademicsError('Assessment not found.', 'NOT_FOUND', 404);
    }
    return asmt;
  }

  async updateAssessment(
    userId: string,
    id: string,
    data: Partial<Omit<AssessmentDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>>,
    topicIds?: string[]
  ): Promise<AssessmentDto> {
    await this.getAssessmentById(userId, id);
    if (data.term_id) {
      const term = await this.repo.getTermById(userId, data.term_id);
      if (!term) {
        throw new AcademicsError('Referenced Term not found or does not belong to user.', 'INVALID_TERM', 400);
      }
    }
    if (data.subject_id) {
      const subject = await this.repo.getSubjectById(userId, data.subject_id);
      if (!subject) {
        throw new AcademicsError('Referenced Subject not found or does not belong to user.', 'INVALID_SUBJECT', 400);
      }
    }
    if (topicIds) {
      for (const tid of topicIds) {
        const topic = await this.repo.getTopicById(userId, tid);
        if (!topic) {
          throw new AcademicsError(`Topic ${tid} not found or does not belong to user.`, 'INVALID_TOPIC', 400);
        }
      }
    }
    const updated = await this.repo.updateAssessment(userId, id, data, topicIds);
    if (!updated) {
      throw new AcademicsError('Failed to update assessment.', 'UPDATE_FAILED', 400);
    }
    return updated;
  }

  async deleteAssessment(userId: string, id: string): Promise<boolean> {
    await this.getAssessmentById(userId, id);
    return this.repo.deleteAssessment(userId, id);
  }

  // --- Exams ---

  async createExam(
    userId: string,
    data: Omit<ExamDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>,
    topicIds: string[] = []
  ): Promise<ExamDto> {
    const term = await this.repo.getTermById(userId, data.term_id);
    if (!term) {
      throw new AcademicsError('Referenced Term not found or does not belong to user.', 'INVALID_TERM', 400);
    }
    if (data.subject_id) {
      const subject = await this.repo.getSubjectById(userId, data.subject_id);
      if (!subject) {
        throw new AcademicsError('Referenced Subject not found or does not belong to user.', 'INVALID_SUBJECT', 400);
      }
    }
    for (const tid of topicIds) {
      const topic = await this.repo.getTopicById(userId, tid);
      if (!topic) {
        throw new AcademicsError(`Topic ${tid} not found or does not belong to user.`, 'INVALID_TOPIC', 400);
      }
    }

    return this.repo.createExam(userId, data, topicIds);
  }

  async getExams(userId: string, termId?: string, subjectId?: string): Promise<ExamDto[]> {
    return this.repo.getExams(userId, termId, subjectId);
  }

  async getExamById(userId: string, id: string): Promise<ExamDto> {
    const exam = await this.repo.getExamById(userId, id);
    if (!exam) {
      throw new AcademicsError('Exam not found.', 'NOT_FOUND', 404);
    }
    return exam;
  }

  async updateExam(
    userId: string,
    id: string,
    data: Partial<Omit<ExamDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>>,
    topicIds?: string[]
  ): Promise<ExamDto> {
    await this.getExamById(userId, id);
    if (data.term_id) {
      const term = await this.repo.getTermById(userId, data.term_id);
      if (!term) {
        throw new AcademicsError('Referenced Term not found or does not belong to user.', 'INVALID_TERM', 400);
      }
    }
    if (data.subject_id) {
      const subject = await this.repo.getSubjectById(userId, data.subject_id);
      if (!subject) {
        throw new AcademicsError('Referenced Subject not found or does not belong to user.', 'INVALID_SUBJECT', 400);
      }
    }
    if (topicIds) {
      for (const tid of topicIds) {
        const topic = await this.repo.getTopicById(userId, tid);
        if (!topic) {
          throw new AcademicsError(`Topic ${tid} not found or does not belong to user.`, 'INVALID_TOPIC', 400);
        }
      }
    }
    const updated = await this.repo.updateExam(userId, id, data, topicIds);
    if (!updated) {
      throw new AcademicsError('Failed to update exam.', 'UPDATE_FAILED', 400);
    }
    return updated;
  }

  async deleteExam(userId: string, id: string): Promise<boolean> {
    await this.getExamById(userId, id);
    return this.repo.deleteExam(userId, id);
  }

  // --- Bundles ---

  async getSubjectDetailBundle(userId: string, subjectId: string) {
    const bundle = await this.repo.getSubjectDetailBundle(userId, subjectId);
    if (!bundle) {
      throw new AcademicsError('Subject not found.', 'NOT_FOUND', 404);
    }
    return bundle;
  }

  async getAcademicsOverview(userId: string): Promise<AcademicsOverviewDto> {
    return this.repo.getAcademicsOverview(userId);
  }
}
