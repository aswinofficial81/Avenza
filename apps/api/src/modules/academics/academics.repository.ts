import type {
  AcademicYearDto,
  AcademicsOverviewDto,
  AssessmentDto,
  Database,
  ExamDto,
  SubjectDto,
  SubjectTopicDto,
  SyllabusCoverageSummary,
  TermDto,
} from '@avenza/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type { IAcademicsRepository } from './academics.types';

export function calculateTopicCoverage(topics: SubjectTopicDto[]): SyllabusCoverageSummary {
  const total = topics.length;
  const covered = topics.filter((t) => t.status === 'covered').length;
  const inProgress = topics.filter((t) => t.status === 'in_progress').length;
  const needsReview = topics.filter((t) => t.status === 'needs_review').length;
  const notStarted = topics.filter((t) => t.status === 'not_started').length;
  const percentage = total === 0 ? 0 : Math.round((covered / total) * 100);

  return {
    total_topics: total,
    covered_topics: covered,
    in_progress_topics: inProgress,
    needs_review_topics: needsReview,
    not_started_topics: notStarted,
    coverage_percentage: percentage,
  };
}

export class SupabaseAcademicsRepository implements IAcademicsRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  // --- Academic Years ---

  async createAcademicYear(
    userId: string,
    data: Omit<AcademicYearDto, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<AcademicYearDto> {
    const { data: row, error } = await this.client
      .from('academic_years')
      .insert({
        user_id: userId,
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        is_current: data.is_current,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to create academic year: ${error?.message}`);
    }
    return row as AcademicYearDto;
  }

  async getAcademicYears(userId: string): Promise<AcademicYearDto[]> {
    const { data, error } = await this.client
      .from('academic_years')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get academic years: ${error.message}`);
    }
    return (data || []) as AcademicYearDto[];
  }

  async getAcademicYearById(userId: string, id: string): Promise<AcademicYearDto | null> {
    const { data, error } = await this.client
      .from('academic_years')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get academic year: ${error.message}`);
    }
    return (data as AcademicYearDto) || null;
  }

  async updateAcademicYear(
    userId: string,
    id: string,
    data: Partial<Omit<AcademicYearDto, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<AcademicYearDto | null> {
    const { data: row, error } = await this.client
      .from('academic_years')
      .update(data)
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update academic year: ${error.message}`);
    }
    return (row as AcademicYearDto) || null;
  }

  async deleteAcademicYear(userId: string, id: string): Promise<boolean> {
    const { error } = await this.client
      .from('academic_years')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete academic year: ${error.message}`);
    }
    return true;
  }

  // --- Terms ---

  async createTerm(
    userId: string,
    data: Omit<TermDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'academic_year_name' | 'subject_count'>
  ): Promise<TermDto> {
    const { data: row, error } = await this.client
      .from('terms')
      .insert({
        user_id: userId,
        academic_year_id: data.academic_year_id || null,
        name: data.name,
        code: data.code || null,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
        is_current: data.is_current,
        notes: data.notes || null,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to create term: ${error?.message}`);
    }
    return row as TermDto;
  }

  async getTerms(userId: string): Promise<TermDto[]> {
    const { data: terms, error } = await this.client
      .from('terms')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get terms: ${error.message}`);
    }

    const termList = (terms || []) as TermDto[];
    if (termList.length === 0) return [];

    // Query subject counts per term
    const { data: subjects } = await this.client
      .from('subjects')
      .select('term_id')
      .eq('user_id', userId);

    const counts: Record<string, number> = {};
    for (const s of subjects || []) {
      counts[s.term_id] = (counts[s.term_id] || 0) + 1;
    }

    return termList.map((t) => ({
      ...t,
      subject_count: counts[t.id] || 0,
    }));
  }

  async getTermById(userId: string, id: string): Promise<TermDto | null> {
    const { data, error } = await this.client
      .from('terms')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get term: ${error.message}`);
    }
    if (!data) return null;

    // Attach subject count
    const { count } = await this.client
      .from('subjects')
      .select('*', { count: 'exact', head: true })
      .eq('term_id', id);

    return {
      ...(data as TermDto),
      subject_count: count || 0,
    };
  }

  async updateTerm(
    userId: string,
    id: string,
    data: Partial<Omit<TermDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'academic_year_name' | 'subject_count'>>
  ): Promise<TermDto | null> {
    const { data: row, error } = await this.client
      .from('terms')
      .update(data)
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update term: ${error.message}`);
    }
    return (row as TermDto) || null;
  }

  async deleteTerm(userId: string, id: string): Promise<boolean> {
    const { error } = await this.client
      .from('terms')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete term: ${error.message}`);
    }
    return true;
  }

  // --- Subjects ---

  async createSubject(
    userId: string,
    data: Omit<SubjectDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'term_name' | 'coverage'>
  ): Promise<SubjectDto> {
    const { data: row, error } = await this.client
      .from('subjects')
      .insert({
        user_id: userId,
        term_id: data.term_id,
        name: data.name,
        code: data.code || null,
        description: data.description || null,
        instructor: data.instructor || null,
        credits: data.credits != null ? data.credits : null,
        color: data.color || null,
        status: data.status,
        notes: data.notes || null,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to create subject: ${error?.message}`);
    }
    return {
      ...(row as SubjectDto),
      coverage: {
        total_topics: 0,
        covered_topics: 0,
        in_progress_topics: 0,
        needs_review_topics: 0,
        not_started_topics: 0,
        coverage_percentage: 0,
      },
    };
  }

  async getSubjects(userId: string, termId?: string): Promise<SubjectDto[]> {
    let query = this.client
      .from('subjects')
      .select('*')
      .eq('user_id', userId);

    if (termId) {
      query = query.eq('term_id', termId);
    }

    const { data: subjects, error } = await query.order('name', { ascending: true });
    if (error) {
      throw new Error(`Failed to get subjects: ${error.message}`);
    }

    const subjectList = (subjects || []) as SubjectDto[];
    if (subjectList.length === 0) return [];

    // Query topics to compute coverage per subject
    const subjectIds = subjectList.map((s) => s.id);
    const { data: topics } = await this.client
      .from('subject_topics')
      .select('id, subject_id, status')
      .eq('user_id', userId)
      .in('subject_id', subjectIds);

    const topicsBySubject: Record<string, SubjectTopicDto[]> = {};
    for (const t of (topics || []) as unknown as SubjectTopicDto[]) {
      const list = topicsBySubject[t.subject_id] ?? (topicsBySubject[t.subject_id] = []);
      list.push(t);
    }

    return subjectList.map((s) => ({
      ...s,
      coverage: calculateTopicCoverage(topicsBySubject[s.id] || []),
    }));
  }

  async getSubjectById(userId: string, id: string): Promise<SubjectDto | null> {
    const { data, error } = await this.client
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get subject: ${error.message}`);
    }
    if (!data) return null;

    const { data: topics } = await this.client
      .from('subject_topics')
      .select('*')
      .eq('user_id', userId)
      .eq('subject_id', id);

    return {
      ...(data as SubjectDto),
      coverage: calculateTopicCoverage((topics || []) as unknown as SubjectTopicDto[]),
    };
  }

  async updateSubject(
    userId: string,
    id: string,
    data: Partial<Omit<SubjectDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'term_name' | 'coverage'>>
  ): Promise<SubjectDto | null> {
    const { data: row, error } = await this.client
      .from('subjects')
      .update(data)
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update subject: ${error.message}`);
    }
    return (row as SubjectDto) || null;
  }

  async deleteSubject(userId: string, id: string): Promise<boolean> {
    const { error } = await this.client
      .from('subjects')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete subject: ${error.message}`);
    }
    return true;
  }

  // --- Topics ---

  async createTopic(
    userId: string,
    subjectId: string,
    data: Omit<SubjectTopicDto, 'id' | 'user_id' | 'subject_id' | 'created_at' | 'updated_at'>
  ): Promise<SubjectTopicDto> {
    const { data: row, error } = await this.client
      .from('subject_topics')
      .insert({
        user_id: userId,
        subject_id: subjectId,
        name: data.name,
        description: data.description || null,
        order_index: data.order_index ?? 0,
        status: data.status,
        importance: data.importance,
        estimated_minutes: data.estimated_minutes != null ? data.estimated_minutes : null,
        resources: (data.resources || []) as unknown as Database['public']['Tables']['subject_topics']['Insert']['resources'],
        notes: data.notes || null,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to create topic: ${error?.message}`);
    }
    return row as unknown as SubjectTopicDto;
  }

  async getTopicsBySubjectId(userId: string, subjectId: string): Promise<SubjectTopicDto[]> {
    const { data, error } = await this.client
      .from('subject_topics')
      .select('*')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get topics: ${error.message}`);
    }
    return (data || []) as unknown as SubjectTopicDto[];
  }

  async getTopicById(userId: string, id: string): Promise<SubjectTopicDto | null> {
    const { data, error } = await this.client
      .from('subject_topics')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get topic: ${error.message}`);
    }
    return (data as unknown as SubjectTopicDto) || null;
  }

  async updateTopic(
    userId: string,
    id: string,
    data: Partial<Omit<SubjectTopicDto, 'id' | 'user_id' | 'subject_id' | 'created_at' | 'updated_at'>>
  ): Promise<SubjectTopicDto | null> {
    const payload: Record<string, unknown> = { ...data };
    if (data.resources) {
      payload.resources = data.resources as unknown as Database['public']['Tables']['subject_topics']['Update']['resources'];
    }

    const { data: row, error } = await this.client
      .from('subject_topics')
      .update(payload as Database['public']['Tables']['subject_topics']['Update'])
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update topic: ${error.message}`);
    }
    return (row as unknown as SubjectTopicDto) || null;
  }

  async deleteTopic(userId: string, id: string): Promise<boolean> {
    const { error } = await this.client
      .from('subject_topics')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete topic: ${error.message}`);
    }
    return true;
  }

  // --- Assessments ---

  async createAssessment(
    userId: string,
    data: Omit<AssessmentDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>,
    topicIds: string[] = []
  ): Promise<AssessmentDto> {
    const { data: row, error } = await this.client
      .from('assessments')
      .insert({
        user_id: userId,
        term_id: data.term_id,
        subject_id: data.subject_id || null,
        title: data.title,
        assessment_type: data.assessment_type,
        description: data.description || null,
        due_at: data.due_at || null,
        max_marks: data.max_marks != null ? data.max_marks : null,
        obtained_marks: data.obtained_marks != null ? data.obtained_marks : null,
        weight_percent: data.weight_percent != null ? data.weight_percent : null,
        status: data.status,
        notes: data.notes || null,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to create assessment: ${error?.message}`);
    }

    if (topicIds.length > 0) {
      const links = topicIds.map((tId) => ({
        assessment_id: row.id,
        topic_id: tId,
      }));
      await this.client.from('assessment_topics').insert(links);
    }

    return {
      ...(row as AssessmentDto),
      covered_topic_ids: topicIds,
    };
  }

  async getAssessments(userId: string, termId?: string, subjectId?: string): Promise<AssessmentDto[]> {
    let query = this.client
      .from('assessments')
      .select('*')
      .eq('user_id', userId);

    if (termId) query = query.eq('term_id', termId);
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data, error } = await query.order('due_at', { ascending: true, nullsFirst: false });
    if (error) {
      throw new Error(`Failed to get assessments: ${error.message}`);
    }
    return (data || []) as AssessmentDto[];
  }

  async getAssessmentById(userId: string, id: string): Promise<AssessmentDto | null> {
    const { data, error } = await this.client
      .from('assessments')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get assessment: ${error.message}`);
    }
    if (!data) return null;

    const { data: topicLinks } = await this.client
      .from('assessment_topics')
      .select('topic_id')
      .eq('assessment_id', id);

    const topicIds = (topicLinks || []).map((tl) => tl.topic_id);

    return {
      ...(data as AssessmentDto),
      covered_topic_ids: topicIds,
    };
  }

  async updateAssessment(
    userId: string,
    id: string,
    data: Partial<Omit<AssessmentDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>>,
    topicIds?: string[]
  ): Promise<AssessmentDto | null> {
    const { data: row, error } = await this.client
      .from('assessments')
      .update(data)
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update assessment: ${error.message}`);
    }
    if (!row) return null;

    if (topicIds !== undefined) {
      await this.client.from('assessment_topics').delete().eq('assessment_id', id);
      if (topicIds.length > 0) {
        const links = topicIds.map((tId) => ({
          assessment_id: id,
          topic_id: tId,
        }));
        await this.client.from('assessment_topics').insert(links);
      }
    }

    return {
      ...(row as AssessmentDto),
      covered_topic_ids: topicIds,
    };
  }

  async deleteAssessment(userId: string, id: string): Promise<boolean> {
    const { error } = await this.client
      .from('assessments')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete assessment: ${error.message}`);
    }
    return true;
  }

  // --- Exams ---

  async createExam(
    userId: string,
    data: Omit<ExamDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>,
    topicIds: string[] = []
  ): Promise<ExamDto> {
    const { data: row, error } = await this.client
      .from('exams')
      .insert({
        user_id: userId,
        term_id: data.term_id,
        subject_id: data.subject_id || null,
        title: data.title,
        exam_type: data.exam_type,
        exam_date: data.exam_date,
        duration_minutes: data.duration_minutes != null ? data.duration_minutes : null,
        location: data.location || null,
        weight_percent: data.weight_percent != null ? data.weight_percent : null,
        status: data.status,
        notes: data.notes || null,
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new Error(`Failed to create exam: ${error?.message}`);
    }

    if (topicIds.length > 0) {
      const links = topicIds.map((tId) => ({
        exam_id: row.id,
        topic_id: tId,
      }));
      await this.client.from('exam_topics').insert(links);
    }

    return {
      ...(row as ExamDto),
      covered_topic_ids: topicIds,
    };
  }

  async getExams(userId: string, termId?: string, subjectId?: string): Promise<ExamDto[]> {
    let query = this.client
      .from('exams')
      .select('*')
      .eq('user_id', userId);

    if (termId) query = query.eq('term_id', termId);
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data, error } = await query.order('exam_date', { ascending: true });
    if (error) {
      throw new Error(`Failed to get exams: ${error.message}`);
    }
    return (data || []) as ExamDto[];
  }

  async getExamById(userId: string, id: string): Promise<ExamDto | null> {
    const { data, error } = await this.client
      .from('exams')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get exam: ${error.message}`);
    }
    if (!data) return null;

    const { data: topicLinks } = await this.client
      .from('exam_topics')
      .select('topic_id')
      .eq('exam_id', id);

    const topicIds = (topicLinks || []).map((tl) => tl.topic_id);

    return {
      ...(data as ExamDto),
      covered_topic_ids: topicIds,
    };
  }

  async updateExam(
    userId: string,
    id: string,
    data: Partial<Omit<ExamDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>>,
    topicIds?: string[]
  ): Promise<ExamDto | null> {
    const { data: row, error } = await this.client
      .from('exams')
      .update(data)
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update exam: ${error.message}`);
    }
    if (!row) return null;

    if (topicIds !== undefined) {
      await this.client.from('exam_topics').delete().eq('exam_id', id);
      if (topicIds.length > 0) {
        const links = topicIds.map((tId) => ({
          exam_id: id,
          topic_id: tId,
        }));
        await this.client.from('exam_topics').insert(links);
      }
    }

    return {
      ...(row as ExamDto),
      covered_topic_ids: topicIds,
    };
  }

  async deleteExam(userId: string, id: string): Promise<boolean> {
    const { error } = await this.client
      .from('exams')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete exam: ${error.message}`);
    }
    return true;
  }

  // --- Bundles ---

  async getSubjectDetailBundle(
    userId: string,
    subjectId: string
  ): Promise<{
    subject: SubjectDto;
    topics: SubjectTopicDto[];
    assessments: AssessmentDto[];
    exams: ExamDto[];
  } | null> {
    const subject = await this.getSubjectById(userId, subjectId);
    if (!subject) return null;

    const topics = await this.getTopicsBySubjectId(userId, subjectId);
    const assessments = await this.getAssessments(userId, undefined, subjectId);
    const exams = await this.getExams(userId, undefined, subjectId);

    return {
      subject: {
        ...subject,
        coverage: calculateTopicCoverage(topics),
      },
      topics,
      assessments,
      exams,
    };
  }

  async getAcademicsOverview(userId: string): Promise<AcademicsOverviewDto> {
    // 1. Get active term (is_current = true or status = 'active' or most recent)
    const terms = await this.getTerms(userId);
    const activeTerm =
      terms.find((t) => t.is_current) ||
      terms.find((t) => t.status === 'active') ||
      terms[0] ||
      null;

    // 2. Get subjects for active term or user
    const subjects = activeTerm
      ? await this.getSubjects(userId, activeTerm.id)
      : await this.getSubjects(userId);

    // 3. Upcoming exams (exam_date >= now)
    const allExams = await this.getExams(userId, activeTerm?.id);
    const nowIso = new Date().toISOString();
    const upcomingExams = allExams
      .filter((e) => e.exam_date >= nowIso && e.status === 'planned')
      .slice(0, 5);

    // 4. Upcoming assessments (due_at >= now or due_at is null & status planned)
    const allAssessments = await this.getAssessments(userId, activeTerm?.id);
    const upcomingAssessments = allAssessments
      .filter(
        (a) =>
          a.status !== 'completed' &&
          a.status !== 'cancelled' &&
          (!a.due_at || a.due_at >= nowIso)
      )
      .slice(0, 5);

    // 5. Total coverage across these subjects
    const allTopics: SubjectTopicDto[] = [];
    for (const s of subjects) {
      const topics = await this.getTopicsBySubjectId(userId, s.id);
      allTopics.push(...topics);
    }
    const overallCoverage = calculateTopicCoverage(allTopics);

    return {
      active_term: activeTerm,
      subjects,
      upcoming_exams: upcomingExams,
      upcoming_assessments: upcomingAssessments,
      overall_coverage: overallCoverage,
    };
  }
}

// --- In-Memory Repository for Fast Unit Testing ---

export class InMemoryAcademicsRepository implements IAcademicsRepository {
  public academicYears: AcademicYearDto[] = [];
  public terms: TermDto[] = [];
  public subjects: SubjectDto[] = [];
  public topics: SubjectTopicDto[] = [];
  public assessments: AssessmentDto[] = [];
  public assessmentTopics: { assessment_id: string; topic_id: string }[] = [];
  public exams: ExamDto[] = [];
  public examTopics: { exam_id: string; topic_id: string }[] = [];

  // Academic Years
  async createAcademicYear(
    userId: string,
    data: Omit<AcademicYearDto, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<AcademicYearDto> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const item: AcademicYearDto = {
      id,
      user_id: userId,
      ...data,
      created_at: now,
      updated_at: now,
    };
    this.academicYears.push(item);
    return item;
  }

  async getAcademicYears(userId: string): Promise<AcademicYearDto[]> {
    return this.academicYears.filter((y) => y.user_id === userId);
  }

  async getAcademicYearById(userId: string, id: string): Promise<AcademicYearDto | null> {
    return this.academicYears.find((y) => y.user_id === userId && y.id === id) || null;
  }

  async updateAcademicYear(
    userId: string,
    id: string,
    data: Partial<Omit<AcademicYearDto, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<AcademicYearDto | null> {
    const idx = this.academicYears.findIndex((y) => y.user_id === userId && y.id === id);
    if (idx === -1) return null;
    const existing = this.academicYears[idx];
    if (!existing) return null;
    const updated: AcademicYearDto = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.academicYears[idx] = updated;
    return updated;
  }

  async deleteAcademicYear(userId: string, id: string): Promise<boolean> {
    const initialLen = this.academicYears.length;
    this.academicYears = this.academicYears.filter((y) => !(y.user_id === userId && y.id === id));
    return this.academicYears.length < initialLen;
  }

  // Terms
  async createTerm(
    userId: string,
    data: Omit<TermDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'academic_year_name' | 'subject_count'>
  ): Promise<TermDto> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const item: TermDto = {
      id,
      user_id: userId,
      ...data,
      created_at: now,
      updated_at: now,
      subject_count: 0,
    };
    this.terms.push(item);
    return item;
  }

  async getTerms(userId: string): Promise<TermDto[]> {
    return this.terms
      .filter((t) => t.user_id === userId)
      .map((t) => ({
        ...t,
        subject_count: this.subjects.filter((s) => s.term_id === t.id).length,
      }));
  }

  async getTermById(userId: string, id: string): Promise<TermDto | null> {
    const term = this.terms.find((t) => t.user_id === userId && t.id === id);
    if (!term) return null;
    return {
      ...term,
      subject_count: this.subjects.filter((s) => s.term_id === term.id).length,
    };
  }

  async updateTerm(
    userId: string,
    id: string,
    data: Partial<Omit<TermDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'academic_year_name' | 'subject_count'>>
  ): Promise<TermDto | null> {
    const idx = this.terms.findIndex((t) => t.user_id === userId && t.id === id);
    if (idx === -1) return null;
    const existing = this.terms[idx];
    if (!existing) return null;
    const updated: TermDto = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.terms[idx] = updated;
    return updated;
  }

  async deleteTerm(userId: string, id: string): Promise<boolean> {
    const initialLen = this.terms.length;
    this.terms = this.terms.filter((t) => !(t.user_id === userId && t.id === id));
    return this.terms.length < initialLen;
  }

  // Subjects
  async createSubject(
    userId: string,
    data: Omit<SubjectDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'term_name' | 'coverage'>
  ): Promise<SubjectDto> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const item: SubjectDto = {
      id,
      user_id: userId,
      ...data,
      created_at: now,
      updated_at: now,
      coverage: {
        total_topics: 0,
        covered_topics: 0,
        in_progress_topics: 0,
        needs_review_topics: 0,
        not_started_topics: 0,
        coverage_percentage: 0,
      },
    };
    this.subjects.push(item);
    return item;
  }

  async getSubjects(userId: string, termId?: string): Promise<SubjectDto[]> {
    return this.subjects
      .filter((s) => s.user_id === userId && (!termId || s.term_id === termId))
      .map((s) => {
        const topics = this.topics.filter((t) => t.subject_id === s.id);
        return {
          ...s,
          coverage: calculateTopicCoverage(topics),
        };
      });
  }

  async getSubjectById(userId: string, id: string): Promise<SubjectDto | null> {
    const s = this.subjects.find((item) => item.user_id === userId && item.id === id);
    if (!s) return null;
    const topics = this.topics.filter((t) => t.subject_id === s.id);
    return {
      ...s,
      coverage: calculateTopicCoverage(topics),
    };
  }

  async updateSubject(
    userId: string,
    id: string,
    data: Partial<Omit<SubjectDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'term_name' | 'coverage'>>
  ): Promise<SubjectDto | null> {
    const idx = this.subjects.findIndex((s) => s.user_id === userId && s.id === id);
    if (idx === -1) return null;
    const existing = this.subjects[idx];
    if (!existing) return null;
    const updated: SubjectDto = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.subjects[idx] = updated;
    return updated;
  }

  async deleteSubject(userId: string, id: string): Promise<boolean> {
    const initialLen = this.subjects.length;
    this.subjects = this.subjects.filter((s) => !(s.user_id === userId && s.id === id));
    return this.subjects.length < initialLen;
  }

  // Topics
  async createTopic(
    userId: string,
    subjectId: string,
    data: Omit<SubjectTopicDto, 'id' | 'user_id' | 'subject_id' | 'created_at' | 'updated_at'>
  ): Promise<SubjectTopicDto> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const item: SubjectTopicDto = {
      id,
      user_id: userId,
      subject_id: subjectId,
      ...data,
      created_at: now,
      updated_at: now,
    };
    this.topics.push(item);
    return item;
  }

  async getTopicsBySubjectId(userId: string, subjectId: string): Promise<SubjectTopicDto[]> {
    return this.topics
      .filter((t) => t.user_id === userId && t.subject_id === subjectId)
      .sort((a, b) => a.order_index - b.order_index);
  }

  async getTopicById(userId: string, id: string): Promise<SubjectTopicDto | null> {
    return this.topics.find((t) => t.user_id === userId && t.id === id) || null;
  }

  async updateTopic(
    userId: string,
    id: string,
    data: Partial<Omit<SubjectTopicDto, 'id' | 'user_id' | 'subject_id' | 'created_at' | 'updated_at'>>
  ): Promise<SubjectTopicDto | null> {
    const idx = this.topics.findIndex((t) => t.user_id === userId && t.id === id);
    if (idx === -1) return null;
    const existing = this.topics[idx];
    if (!existing) return null;
    const updated: SubjectTopicDto = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.topics[idx] = updated;
    return updated;
  }

  async deleteTopic(userId: string, id: string): Promise<boolean> {
    const initialLen = this.topics.length;
    this.topics = this.topics.filter((t) => !(t.user_id === userId && t.id === id));
    return this.topics.length < initialLen;
  }

  // Assessments
  async createAssessment(
    userId: string,
    data: Omit<AssessmentDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>,
    topicIds: string[] = []
  ): Promise<AssessmentDto> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const item: AssessmentDto = {
      id,
      user_id: userId,
      ...data,
      covered_topic_ids: topicIds,
      created_at: now,
      updated_at: now,
    };
    this.assessments.push(item);
    for (const tid of topicIds) {
      this.assessmentTopics.push({ assessment_id: id, topic_id: tid });
    }
    return item;
  }

  async getAssessments(userId: string, termId?: string, subjectId?: string): Promise<AssessmentDto[]> {
    return this.assessments.filter(
      (a) =>
        a.user_id === userId &&
        (!termId || a.term_id === termId) &&
        (!subjectId || a.subject_id === subjectId)
    );
  }

  async getAssessmentById(userId: string, id: string): Promise<AssessmentDto | null> {
    return this.assessments.find((a) => a.user_id === userId && a.id === id) || null;
  }

  async updateAssessment(
    userId: string,
    id: string,
    data: Partial<Omit<AssessmentDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>>,
    topicIds?: string[]
  ): Promise<AssessmentDto | null> {
    const idx = this.assessments.findIndex((a) => a.user_id === userId && a.id === id);
    if (idx === -1) return null;
    const existing = this.assessments[idx];
    if (!existing) return null;
    const updated: AssessmentDto = {
      ...existing,
      ...data,
      covered_topic_ids: topicIds !== undefined ? topicIds : existing.covered_topic_ids,
      updated_at: new Date().toISOString(),
    };
    this.assessments[idx] = updated;
    return updated;
  }

  async deleteAssessment(userId: string, id: string): Promise<boolean> {
    const initialLen = this.assessments.length;
    this.assessments = this.assessments.filter((a) => !(a.user_id === userId && a.id === id));
    return this.assessments.length < initialLen;
  }

  // Exams
  async createExam(
    userId: string,
    data: Omit<ExamDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>,
    topicIds: string[] = []
  ): Promise<ExamDto> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const item: ExamDto = {
      id,
      user_id: userId,
      ...data,
      covered_topic_ids: topicIds,
      created_at: now,
      updated_at: now,
    };
    this.exams.push(item);
    for (const tid of topicIds) {
      this.examTopics.push({ exam_id: id, topic_id: tid });
    }
    return item;
  }

  async getExams(userId: string, termId?: string, subjectId?: string): Promise<ExamDto[]> {
    return this.exams.filter(
      (e) =>
        e.user_id === userId &&
        (!termId || e.term_id === termId) &&
        (!subjectId || e.subject_id === subjectId)
    );
  }

  async getExamById(userId: string, id: string): Promise<ExamDto | null> {
    return this.exams.find((e) => e.user_id === userId && e.id === id) || null;
  }

  async updateExam(
    userId: string,
    id: string,
    data: Partial<Omit<ExamDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>>,
    topicIds?: string[]
  ): Promise<ExamDto | null> {
    const idx = this.exams.findIndex((e) => e.user_id === userId && e.id === id);
    if (idx === -1) return null;
    const existing = this.exams[idx];
    if (!existing) return null;
    const updated: ExamDto = {
      ...existing,
      ...data,
      covered_topic_ids: topicIds !== undefined ? topicIds : existing.covered_topic_ids,
      updated_at: new Date().toISOString(),
    };
    this.exams[idx] = updated;
    return updated;
  }

  async deleteExam(userId: string, id: string): Promise<boolean> {
    const initialLen = this.exams.length;
    this.exams = this.exams.filter((e) => !(e.user_id === userId && e.id === id));
    return this.exams.length < initialLen;
  }

  // Bundles
  async getSubjectDetailBundle(
    userId: string,
    subjectId: string
  ): Promise<{
    subject: SubjectDto;
    topics: SubjectTopicDto[];
    assessments: AssessmentDto[];
    exams: ExamDto[];
  } | null> {
    const subject = await this.getSubjectById(userId, subjectId);
    if (!subject) return null;
    const topics = await this.getTopicsBySubjectId(userId, subjectId);
    const assessments = await this.getAssessments(userId, undefined, subjectId);
    const exams = await this.getExams(userId, undefined, subjectId);

    return {
      subject: {
        ...subject,
        coverage: calculateTopicCoverage(topics),
      },
      topics,
      assessments,
      exams,
    };
  }

  async getAcademicsOverview(userId: string): Promise<AcademicsOverviewDto> {
    const terms = await this.getTerms(userId);
    const activeTerm =
      terms.find((t) => t.is_current) ||
      terms.find((t) => t.status === 'active') ||
      terms[0] ||
      null;

    const subjects = activeTerm
      ? await this.getSubjects(userId, activeTerm.id)
      : await this.getSubjects(userId);

    const nowIso = new Date().toISOString();
    const upcomingExams = (await this.getExams(userId, activeTerm?.id))
      .filter((e) => e.status === 'planned' && e.exam_date >= nowIso)
      .slice(0, 5);

    const upcomingAssessments = (await this.getAssessments(userId, activeTerm?.id))
      .filter((a) => a.status !== 'completed' && a.status !== 'cancelled')
      .slice(0, 5);

    const allTopics = this.topics.filter((t) => t.user_id === userId);
    const overallCoverage = calculateTopicCoverage(allTopics);

    return {
      active_term: activeTerm,
      subjects,
      upcoming_exams: upcomingExams,
      upcoming_assessments: upcomingAssessments,
      overall_coverage: overallCoverage,
    };
  }
}
