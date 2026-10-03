import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Filter,
  AlertCircle,
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
  useExams,
  useSubjects,
  useTerms,
} from '../features/academics/useAcademics';
import {
  CreateExamModal,
  EditExamModal,
} from '../features/academics/components/ExamModals';
import type { ExamDto, ExamStatus } from '@avenza/shared';

export const ExamsPage: React.FC = () => {
  const { data: terms = [] } = useTerms();
  const { data: subjects = [] } = useSubjects();

  const [termFilter, setTermFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const {
    data: exams = [],
    isLoading,
    error,
    refetch,
  } = useExams(termFilter || undefined, subjectFilter || undefined);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamDto | null>(null);

  const nowIso = new Date().toISOString();

  const filteredExams = exams.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: ExamStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="warning">Planned</Badge>;
    }
  };

  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Exams & Evaluations</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-muted-foreground font-mono">
              Phase 11
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Midterms, endterms, finals, practicals, and academic examinations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Schedule Exam
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
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
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
          title="Failed to load exams"
          description={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredExams.length === 0 && (
        <EmptyState
          icon={<FileText className="w-10 h-10 text-muted-foreground" />}
          title="No exams scheduled"
          description="Record upcoming midterms, finals, and practical assessments to schedule prep."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateOpen(true)}
            >
              Schedule Exam
            </Button>
          }
        />
      )}

      {/* Exams Grid */}
      {!isLoading && !error && filteredExams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map((exam) => {
            const subjectName = exam.subject_id ? subjectMap.get(exam.subject_id) : null;
            const isUpcoming = exam.exam_date >= nowIso && exam.status === 'planned';

            return (
              <Card
                key={exam.id}
                className={`p-5 flex flex-col justify-between transition-colors ${
                  isUpcoming ? 'border-primary/40 bg-surface' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-base text-foreground tracking-tight">
                        {exam.title}
                      </h3>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground">
                          {exam.exam_type}
                        </span>
                        {subjectName && (
                          <span className="text-xs text-muted-foreground font-medium truncate max-w-[150px]">
                            {subjectName}
                          </span>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(exam.status)}
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground font-mono pt-1">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span>{new Date(exam.exam_date).toLocaleString()}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                      {exam.duration_minutes != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {exam.duration_minutes} mins
                        </span>
                      )}
                      {exam.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {exam.location}
                        </span>
                      )}
                      {exam.weight_percent != null && (
                        <span>Weight: {exam.weight_percent}%</span>
                      )}
                    </div>
                  </div>

                  {exam.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic pt-1 border-t border-border-subtle">
                      {exam.notes}
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-between">
                  <div>
                    {isUpcoming && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-primary font-medium">
                        <AlertCircle className="w-3 h-3" /> Upcoming
                      </span>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditingExam(exam)}
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
      <CreateExamModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        defaultTermId={termFilter || undefined}
        defaultSubjectId={subjectFilter || undefined}
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
