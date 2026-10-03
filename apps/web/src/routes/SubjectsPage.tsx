import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  User,
  GraduationCap,
  ArrowRight,
  Edit2,
  Archive,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Select } from '../components/ui/Select';
import { Progress } from '../components/ui/Progress';
import {
  useSubjects,
  useTerms,
  useUpdateSubject,
} from '../features/academics/useAcademics';
import {
  CreateSubjectModal,
  EditSubjectModal,
} from '../features/academics/components/SubjectModals';
import type { SubjectDto } from '@avenza/shared';

export const SubjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const termFilter = searchParams.get('termId') || '';

  const { data: terms = [] } = useTerms();
  const { data: subjects = [], isLoading, error, refetch } = useSubjects(termFilter || undefined);
  const updateSubject = useUpdateSubject();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectDto | null>(null);

  const handleTermChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) {
      setSearchParams({ termId: val });
    } else {
      setSearchParams({});
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'completed':
        return <Badge variant="info">Completed</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="default">Planned</Badge>;
    }
  };

  const handleArchive = async (subject: SubjectDto) => {
    const nextStatus = subject.status === 'archived' ? 'active' : 'archived';
    await updateSubject.mutateAsync({
      id: subject.id,
      data: { status: nextStatus },
    });
  };

  const termOptions = [
    { value: '', label: 'All Terms' },
    ...terms.map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Academic Subjects</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-muted-foreground font-mono">
              Phase 11
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Courses, curricula, syllabus structures, and academic topics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {terms.length > 0 && (
            <div className="w-48">
              <Select
                value={termFilter}
                onChange={handleTermChange}
                options={termOptions}
              />
            </div>
          )}
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            New Subject
          </Button>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <ErrorState
          title="Failed to load subjects"
          description={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && subjects.length === 0 && (
        <EmptyState
          icon={<BookOpen className="w-10 h-10 text-muted-foreground" />}
          title="No subjects found"
          description={
            termFilter
              ? 'No subjects are registered in this academic term yet.'
              : 'Add your subjects to organize syllabus topics, assessments, and exam preparations.'
          }
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateOpen(true)}
            >
              Add Subject
            </Button>
          }
        />
      )}

      {/* Subjects Grid */}
      {!isLoading && !error && subjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((subject) => {
            const coverage = subject.coverage || {
              total_topics: 0,
              covered_topics: 0,
              coverage_percentage: 0,
            };

            return (
              <Card
                key={subject.id}
                className="p-5 flex flex-col justify-between hover:border-border transition-colors cursor-pointer group"
                onClick={() => navigate(`/academics/subjects/${subject.id}`)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-base tracking-tight group-hover:text-primary transition-colors">
                          {subject.name}
                        </h3>
                      </div>
                      {subject.code && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {subject.code}
                        </span>
                      )}
                    </div>
                    <div>{getStatusBadge(subject.status)}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-muted-foreground">
                    {subject.instructor && (
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{subject.instructor}</span>
                      </div>
                    )}
                    {subject.credits != null && (
                      <div className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>{subject.credits} Credits</span>
                      </div>
                    )}
                  </div>

                  {subject.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {subject.description}
                    </p>
                  )}

                  {/* Syllabus Coverage Bar */}
                  <div className="pt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                      <span>Syllabus Coverage</span>
                      <span className="font-medium text-foreground">
                        {coverage.covered_topics}/{coverage.total_topics} topics ({coverage.coverage_percentage}%)
                      </span>
                    </div>
                    <Progress value={coverage.coverage_percentage} compact />
                  </div>
                </div>

                <div
                  className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setEditingSubject(subject)}
                      title="Edit Subject"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => handleArchive(subject)}
                      title={subject.status === 'archived' ? 'Unarchive' : 'Archive'}
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => navigate(`/academics/subjects/${subject.id}`)}
                  >
                    <span>Open Syllabus</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateSubjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        defaultTermId={termFilter || undefined}
      />
      {editingSubject && (
        <EditSubjectModal
          isOpen={Boolean(editingSubject)}
          onClose={() => setEditingSubject(null)}
          subject={editingSubject}
        />
      )}
    </div>
  );
};
