import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Plus,
  Calendar,
  BookOpen,
  Edit2,
  Archive,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import {
  useTerms,
  useUpdateTerm,
} from '../features/academics/useAcademics';
import {
  CreateTermModal,
  EditTermModal,
} from '../features/academics/components/TermModals';
import type { TermDto } from '@avenza/shared';

export const TermsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: terms = [], isLoading, error, refetch } = useTerms();
  const updateTerm = useUpdateTerm();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TermDto | null>(null);

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

  const handleArchive = async (term: TermDto) => {
    const nextStatus = term.status === 'archived' ? 'active' : 'archived';
    await updateTerm.mutateAsync({
      id: term.id,
      data: { status: nextStatus },
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Academic Terms</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-muted-foreground font-mono">
              Phase 11
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Source-of-truth academic containers, semesters, and course cycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/academics')}
          >
            Overview
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            New Term
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
          title="Failed to load academic terms"
          description={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && terms.length === 0 && (
        <EmptyState
          icon={<GraduationCap className="w-10 h-10 text-muted-foreground" />}
          title="No academic terms defined yet"
          description="Create your first semester, term, or academic quarter to begin organizing subjects, topics, and exams."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateOpen(true)}
            >
              Create Academic Term
            </Button>
          }
        />
      )}

      {/* Terms Grid */}
      {!isLoading && !error && terms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {terms.map((term) => (
            <Card
              key={term.id}
              className={`p-5 flex flex-col justify-between transition-colors ${
                term.is_current ? 'border-primary/50 bg-primary/5' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-base tracking-tight">
                        {term.name}
                      </h3>
                      {term.code && (
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground">
                          {term.code}
                        </span>
                      )}
                    </div>
                    {term.is_current && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Current Term
                      </span>
                    )}
                  </div>
                  <div>{getStatusBadge(term.status)}</div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>
                    {term.start_date} &rarr; {term.end_date}
                  </span>
                </div>

                {term.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2 italic">
                    {term.notes}
                  </p>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{term.subject_count || 0} subjects</span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setEditingTerm(term)}
                    title="Edit Term"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleArchive(term)}
                    title={term.status === 'archived' ? 'Unarchive' : 'Archive'}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => navigate(`/academics/subjects?termId=${term.id}`)}
                  >
                    Subjects
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateTermModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      {editingTerm && (
        <EditTermModal
          isOpen={Boolean(editingTerm)}
          onClose={() => setEditingTerm(null)}
          term={editingTerm}
        />
      )}
    </div>
  );
};
