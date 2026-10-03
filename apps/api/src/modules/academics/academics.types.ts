import type {
  AcademicYearDto,
  AcademicsOverviewDto,
  AssessmentDto,
  ExamDto,
  SubjectDto,
  SubjectTopicDto,
  TermDto,
} from '@avenza/shared';

export interface IAcademicsRepository {
  // Academic Years
  createAcademicYear(
    userId: string,
    data: Omit<AcademicYearDto, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<AcademicYearDto>;
  getAcademicYears(userId: string): Promise<AcademicYearDto[]>;
  getAcademicYearById(userId: string, id: string): Promise<AcademicYearDto | null>;
  updateAcademicYear(
    userId: string,
    id: string,
    data: Partial<Omit<AcademicYearDto, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<AcademicYearDto | null>;
  deleteAcademicYear(userId: string, id: string): Promise<boolean>;

  // Terms
  createTerm(
    userId: string,
    data: Omit<TermDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'academic_year_name' | 'subject_count'>
  ): Promise<TermDto>;
  getTerms(userId: string): Promise<TermDto[]>;
  getTermById(userId: string, id: string): Promise<TermDto | null>;
  updateTerm(
    userId: string,
    id: string,
    data: Partial<Omit<TermDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'academic_year_name' | 'subject_count'>>
  ): Promise<TermDto | null>;
  deleteTerm(userId: string, id: string): Promise<boolean>;

  // Subjects
  createSubject(
    userId: string,
    data: Omit<SubjectDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'term_name' | 'coverage'>
  ): Promise<SubjectDto>;
  getSubjects(userId: string, termId?: string): Promise<SubjectDto[]>;
  getSubjectById(userId: string, id: string): Promise<SubjectDto | null>;
  updateSubject(
    userId: string,
    id: string,
    data: Partial<Omit<SubjectDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'term_name' | 'coverage'>>
  ): Promise<SubjectDto | null>;
  deleteSubject(userId: string, id: string): Promise<boolean>;

  // Topics
  createTopic(
    userId: string,
    subjectId: string,
    data: Omit<SubjectTopicDto, 'id' | 'user_id' | 'subject_id' | 'created_at' | 'updated_at'>
  ): Promise<SubjectTopicDto>;
  getTopicsBySubjectId(userId: string, subjectId: string): Promise<SubjectTopicDto[]>;
  getTopicById(userId: string, id: string): Promise<SubjectTopicDto | null>;
  updateTopic(
    userId: string,
    id: string,
    data: Partial<Omit<SubjectTopicDto, 'id' | 'user_id' | 'subject_id' | 'created_at' | 'updated_at'>>
  ): Promise<SubjectTopicDto | null>;
  deleteTopic(userId: string, id: string): Promise<boolean>;

  // Assessments
  createAssessment(
    userId: string,
    data: Omit<AssessmentDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>,
    topicIds?: string[]
  ): Promise<AssessmentDto>;
  getAssessments(userId: string, termId?: string, subjectId?: string): Promise<AssessmentDto[]>;
  getAssessmentById(userId: string, id: string): Promise<AssessmentDto | null>;
  updateAssessment(
    userId: string,
    id: string,
    data: Partial<Omit<AssessmentDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>>,
    topicIds?: string[]
  ): Promise<AssessmentDto | null>;
  deleteAssessment(userId: string, id: string): Promise<boolean>;

  // Exams
  createExam(
    userId: string,
    data: Omit<ExamDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>,
    topicIds?: string[]
  ): Promise<ExamDto>;
  getExams(userId: string, termId?: string, subjectId?: string): Promise<ExamDto[]>;
  getExamById(userId: string, id: string): Promise<ExamDto | null>;
  updateExam(
    userId: string,
    id: string,
    data: Partial<Omit<ExamDto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'subject_name' | 'covered_topic_ids' | 'covered_topics'>>,
    topicIds?: string[]
  ): Promise<ExamDto | null>;
  deleteExam(userId: string, id: string): Promise<boolean>;

  // Subject full bundle (subject + topics + assessments + exams)
  getSubjectDetailBundle(
    userId: string,
    subjectId: string
  ): Promise<{
    subject: SubjectDto;
    topics: SubjectTopicDto[];
    assessments: AssessmentDto[];
    exams: ExamDto[];
  } | null>;

  // Academics Overview bundle
  getAcademicsOverview(userId: string): Promise<AcademicsOverviewDto>;
}
