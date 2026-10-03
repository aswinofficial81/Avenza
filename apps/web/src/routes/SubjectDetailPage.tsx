import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  Edit2,
  Trash2,
  ExternalLink,
  GraduationCap,
  Calendar,
  ClipboardList,
  FileText,
  User,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Progress } from '../components/ui/Progress';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import {
  useSubjectDetailBundle,
  useUpdateTopic,
  useDeleteTopic,
} from '../features/academics/useAcademics';
import { EditSubjectModal } from '../features/academics/components/SubjectModals';
import {
  CreateTopicModal,
  EditTopicModal,
} from '../features/academics/components/TopicModals';
import {
  CreateAssessmentModal,
  EditAssessmentModal,
} from '../features/academics/components/AssessmentModals';
import {
  CreateExamModal,
  EditExamModal,
} from '../features/academics/components/ExamModals';
import type {
  AssessmentDto,
  ExamDto,
  SubjectTopicDto,
  TopicImportance,
  TopicStatus,
} from '@avenza/shared';

export const SubjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: bundle, isLoading, error, refetch } = useSubjectDetailBundle(id);
  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();

  const [activeTab, setActiveTab] = useState<'topics' | 'assessments' | 'exams'>('topics');

  // Modals state
  const [isEditSubjectOpen, setIsEditSubjectOpen] = useState(false);
  const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<SubjectTopicDto | null>(null);

  const [isCreateAssessmentOpen, setIsCreateAssessmentOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<AssessmentDto | null>(null);

  const [isCreateExamOpen, setIsCreateExamOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamDto | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <ErrorState
        title="Subject Not Found"
        description={error instanceof Error ? error.message : 'Could not load subject details.'}
        onRetry={() => refetch()}
      />
    );
  }

  const { subject, topics, assessments, exams } = bundle;
  const coverage = subject.coverage || {
    total_topics: topics.length,
    covered_topics: 0,
    in_progress_topics: 0,
    needs_review_topics: 0,
    not_started_topics: 0,
    coverage_percentage: 0,
  };

  const handleQuickStatus = async (topic: SubjectTopicDto, nextStatus: TopicStatus) => {
    if (topic.status === nextStatus) return;
    await updateTopic.mutateAsync({
      id: topic.id,
      data: { status: nextStatus },
    });
  };

  const handleDeleteTopic = async (topic: SubjectTopicDto) => {
    if (window.confirm(`Delete topic "${topic.name}"?`)) {
      await deleteTopic.mutateAsync({ id: topic.id, subjectId: subject.id });
    }
  };

  const getImportanceBadge = (importance: TopicImportance) => {
    switch (importance) {
      case 'critical':
        return <Badge variant="danger">Critical</Badge>;
      case 'high':
        return <Badge variant="warning">High</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="default">Medium</Badge>;
    }
  };

  const getTopicStatusBadge = (status: TopicStatus) => {
    switch (status) {
      case 'covered':
        return <Badge variant="success">Covered</Badge>;
      case 'in_progress':
        return <Badge variant="info">In Progress</Badge>;
      case 'needs_review':
        return <Badge variant="warning">Needs Review</Badge>;
      default:
        return <Badge variant="secondary">Not Started</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          onClick={() => navigate('/academics/subjects')}
          className="hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Subjects</span>
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">{subject.name}</span>
      </div>

      {/* Subject Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{subject.name}</h1>
            {subject.code && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-2 text-foreground font-semibold">
                {subject.code}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {subject.instructor && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Instructor: {subject.instructor}</span>
              </div>
            )}
            {subject.credits != null && (
              <div className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{subject.credits} Credits</span>
              </div>
            )}
          </div>

          {subject.description && (
            <p className="text-xs text-muted-foreground max-w-3xl pt-1">
              {subject.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
            onClick={() => setIsEditSubjectOpen(true)}
          >
            Edit Subject
          </Button>
        </div>
      </div>

      {/* Syllabus Coverage Dashboard Card */}
      <Card className="p-5 bg-surface-2/60 border-border">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Syllabus Coverage</h3>
                <span className="text-[11px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-surface">
                  Source Data
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tracks syllabus topics covered. Does not equate to academic mastery.
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold font-mono text-foreground">
                {coverage.coverage_percentage}%
              </span>
              <span className="text-xs text-muted-foreground ml-1.5">
                ({coverage.covered_topics} of {coverage.total_topics} covered)
              </span>
            </div>
          </div>

          <Progress value={coverage.coverage_percentage} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border-subtle text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Covered: <strong className="text-foreground">{coverage.covered_topics}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>In Progress: <strong className="text-foreground">{coverage.in_progress_topics}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Needs Review: <strong className="text-foreground">{coverage.needs_review_topics}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Circle className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Not Started: <strong className="text-foreground">{coverage.not_started_topics}</strong></span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-border pb-px">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('topics')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'topics'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Topics ({topics.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('assessments')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'assessments'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Assessments ({assessments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('exams')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'exams'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Exams ({exams.length})</span>
          </button>
        </div>

        <div>
          {activeTab === 'topics' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsCreateTopicOpen(true)}
            >
              Add Topic
            </Button>
          )}
          {activeTab === 'assessments' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsCreateAssessmentOpen(true)}
            >
              Add Assessment
            </Button>
          )}
          {activeTab === 'exams' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsCreateExamOpen(true)}
            >
              Schedule Exam
            </Button>
          )}
        </div>
      </div>

      {/* Tab: Topics */}
      {activeTab === 'topics' && (
        <div className="space-y-3">
          {topics.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-8 h-8 text-muted-foreground" />}
              title="No topics added yet"
              description="Define your syllabus modules and key topics to monitor preparation and syllabus coverage."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsCreateTopicOpen(true)}
                >
                  Add Topic
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border-subtle border border-border rounded-lg bg-surface overflow-hidden">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/40 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-semibold text-muted-foreground bg-surface-2 px-1.5 py-0.5 rounded">
                        #{topic.order_index}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground tracking-tight">
                        {topic.name}
                      </h4>
                      {getImportanceBadge(topic.importance)}
                      {getTopicStatusBadge(topic.status)}
                    </div>

                    {topic.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {topic.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                      {topic.estimated_minutes != null && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {topic.estimated_minutes} mins
                        </span>
                      )}

                      {topic.resources && topic.resources.length > 0 && (
                        <div className="flex items-center gap-2">
                          {topic.resources.map((res, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 text-primary">
                              {res.url ? (
                                <a
                                  href={res.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline flex items-center gap-1"
                                >
                                  <span>{res.title}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span>{res.title}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Topic Quick Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                    <div className="inline-flex rounded-md border border-border p-0.5 bg-surface-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(topic, 'not_started')}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                          topic.status === 'not_started'
                            ? 'bg-surface text-foreground font-semibold shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title="Mark Not Started"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(topic, 'in_progress')}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                          topic.status === 'in_progress'
                            ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title="Mark In Progress"
                      >
                        In Progress
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(topic, 'covered')}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                          topic.status === 'covered'
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title="Mark Covered"
                      >
                        Covered
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(topic, 'needs_review')}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                          topic.status === 'needs_review'
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title="Mark Needs Review"
                      >
                        Review
                      </button>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setEditingTopic(topic)}
                      title="Edit Topic"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                      onClick={() => handleDeleteTopic(topic)}
                      title="Delete Topic"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Assessments */}
      {activeTab === 'assessments' && (
        <div className="space-y-3">
          {assessments.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="w-8 h-8 text-muted-foreground" />}
              title="No assessments recorded"
              description="Record lab reports, assignments, and presentations for this subject."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsCreateAssessmentOpen(true)}
                >
                  Add Assessment
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assessments.map((asmt) => (
                <Card key={asmt.id} className="p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{asmt.title}</h4>
                        <span className="text-[11px] font-mono uppercase text-muted-foreground">
                          {asmt.assessment_type}
                        </span>
                      </div>
                      <Badge variant={asmt.status === 'completed' ? 'success' : 'default'}>
                        {asmt.status}
                      </Badge>
                    </div>

                    {asmt.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {asmt.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono pt-1">
                      {asmt.due_at && (
                        <span>Due: {new Date(asmt.due_at).toLocaleDateString()}</span>
                      )}
                      {asmt.max_marks != null && (
                        <span>
                          Marks: {asmt.obtained_marks != null ? asmt.obtained_marks : '—'}/{asmt.max_marks}
                        </span>
                      )}
                      {asmt.weight_percent != null && (
                        <span>Weight: {asmt.weight_percent}%</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border-subtle flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setEditingAssessment(asmt)}
                    >
                      Edit
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Exams */}
      {activeTab === 'exams' && (
        <div className="space-y-3">
          {exams.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-8 h-8 text-muted-foreground" />}
              title="No exams scheduled"
              description="Schedule midterms, finals, vivas, or practical exams for this course."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsCreateExamOpen(true)}
                >
                  Schedule Exam
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {exams.map((exam) => (
                <Card key={exam.id} className="p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{exam.title}</h4>
                        <span className="text-[11px] font-mono uppercase text-muted-foreground">
                          {exam.exam_type}
                        </span>
                      </div>
                      <Badge variant={exam.status === 'completed' ? 'success' : 'warning'}>
                        {exam.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(exam.exam_date).toLocaleString()}
                      </span>
                      {exam.duration_minutes != null && (
                        <span>{exam.duration_minutes} mins</span>
                      )}
                      {exam.location && <span>Loc: {exam.location}</span>}
                    </div>

                    {exam.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic pt-1">
                        {exam.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-border-subtle flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setEditingExam(exam)}
                    >
                      Edit
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isEditSubjectOpen && (
        <EditSubjectModal
          isOpen={isEditSubjectOpen}
          onClose={() => setIsEditSubjectOpen(false)}
          subject={subject}
        />
      )}

      <CreateTopicModal
        isOpen={isCreateTopicOpen}
        onClose={() => setIsCreateTopicOpen(false)}
        subjectId={subject.id}
        nextOrderIndex={topics.length + 1}
      />

      {editingTopic && (
        <EditTopicModal
          isOpen={Boolean(editingTopic)}
          onClose={() => setEditingTopic(null)}
          topic={editingTopic}
        />
      )}

      <CreateAssessmentModal
        isOpen={isCreateAssessmentOpen}
        onClose={() => setIsCreateAssessmentOpen(false)}
        defaultTermId={subject.term_id}
        defaultSubjectId={subject.id}
      />

      {editingAssessment && (
        <EditAssessmentModal
          isOpen={Boolean(editingAssessment)}
          onClose={() => setEditingAssessment(null)}
          assessment={editingAssessment}
        />
      )}

      <CreateExamModal
        isOpen={isCreateExamOpen}
        onClose={() => setIsCreateExamOpen(false)}
        defaultTermId={subject.term_id}
        defaultSubjectId={subject.id}
      />

      {editingExam && (
        <EditExamModal
          isOpen={Boolean(editingExam)}
          onClose={() => setEditingExam(null)}
          exam={editingExam}
        />
      )}
    </div>
  );
};
