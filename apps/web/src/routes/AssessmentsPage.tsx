import React, { useState } from 'react';
import {
  ClipboardList,
  Plus,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Edit2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Select } from '../components/ui/Select';
import {
  useAssessments,
  useSubjects,
  useTerms,
  useUpdateAssessment,
} from '../features/academics/useAcademics';
import {
  CreateAssessmentModal,
  EditAssessmentModal,
} from '../features/academics/components/AssessmentModals';
import type { AssessmentDto, AssessmentStatus } from '@avenza/shared';

export const AssessmentsPage: React.FC = () => {
  const { data: terms = [] } = useTerms();
  const { data: subjects = [] } = useSubjects();

  const [termFilter, setTermFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const {
    data: assessments = [],
    isLoading,
    error,
    refetch,
  } = useAssessments(termFilter || undefined, subjectFilter || undefined);

  const updateAssessment = useUpdateAssessment();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<AssessmentDto | null>(null);

  const filteredAssessments = assessments.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: AssessmentStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'submitted':
        return <Badge variant="info">Submitted</Badge>;
      case 'in_progress':
        return <Badge variant="warning">In Progress</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="default">Planned</Badge>;
    }
  };

  const handleStatusChange = async (assessment: AssessmentDto, nextStatus: AssessmentStatus) => {
    await updateAssessment.mutateAsync({
      id: assessment.id,
      data: { status: nextStatus },
    });
  };

  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Assessments</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-muted-foreground font-mono">
              Phase 11
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Assignments, quizzes, lab submissions, and academic deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            New Assessment
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-surface-2/60 rounded-lg border border-border-subtle">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-semibold">Filters:</span>
        </div>

        {terms.length > 0 && (
          <div className="w-44">
            <Select
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
              options={[{ value: '', label: 'All Terms' }, ...terms.map((t) => ({ value: t.id, label: t.name }))]}
            />
          </div>
        )}

        {subjects.length > 0 && (
          <div className="w-48">
            <Select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              options={[
                { value: '', label: 'All Subjects' },
                ...subjects.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        )}

        <div className="w-36">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'planned', label: 'Planned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
        </div>
      </div>

      {/* Loading & Error */}
      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <ErrorState
          title="Failed to load assessments"
          description={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredAssessments.length === 0 && (
        <EmptyState
          icon={<ClipboardList className="w-10 h-10 text-muted-foreground" />}
          title="No assessments found"
          description="Track your course deliverables, quizzes, and project milestones."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateOpen(true)}
            >
              Add Assessment
            </Button>
          }
        />
      )}

      {/* Assessments Grid */}
      {!isLoading && !error && filteredAssessments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssessments.map((asmt) => {
            const subjectName = asmt.subject_id ? subjectMap.get(asmt.subject_id) : null;

            return (
              <Card key={asmt.id} className="p-5 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-base text-foreground tracking-tight">
                        {asmt.title}
                      </h3>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground">
                          {asmt.assessment_type}
                        </span>
                        {subjectName && (
                          <span className="text-xs text-muted-foreground font-medium truncate max-w-[150px]">
                            {subjectName}
                          </span>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(asmt.status)}
                  </div>

                  {asmt.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {asmt.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono pt-1">
                    {asmt.due_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(asmt.due_at).toLocaleDateString()}
                      </span>
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

                <div className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {asmt.status !== 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-emerald-600 dark:text-emerald-400"
                        onClick={() => handleStatusChange(asmt, 'completed')}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Complete
                      </Button>
                    )}
                    {asmt.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => handleStatusChange(asmt, 'in_progress')}
                      >
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        Reopen
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditingAssessment(asmt)}
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateAssessmentModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        defaultTermId={termFilter || undefined}
        defaultSubjectId={subjectFilter || undefined}
      />
      {editingAssessment && (
        <EditAssessmentModal
          isOpen={Boolean(editingAssessment)}
          onClose={() => setEditingAssessment(null)}
          assessment={editingAssessment}
        />
      )}
    </div>
  );
};
