import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { isTerminalStage } from '@avenza/shared';
import { useCareerApplication, useDeleteCareerApplication } from '../hooks/useCareer';
import { StageTransitionModal } from '../components/StageTransitionModal';
import { CareerPreparationWorkspace } from '../components/CareerPreparationWorkspace';

const STAGE_BADGE_STYLES: Record<string, string> = {
  saved: 'border-slate-500 bg-slate-500/10 text-slate-300',
  applied: 'border-blue-500 bg-blue-500/10 text-blue-300',
  screening: 'border-cyan-500 bg-cyan-500/10 text-cyan-300',
  assessment: 'border-purple-500 bg-purple-500/10 text-purple-300',
  interview: 'border-indigo-500 bg-indigo-500/10 text-indigo-300',
  offer: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
  accepted: 'border-green-600 bg-green-600/10 text-green-300',
  declined: 'border-zinc-500 bg-zinc-500/10 text-zinc-300',
  rejected: 'border-red-500 bg-red-500/10 text-red-300',
  withdrawn: 'border-amber-500 bg-amber-500/10 text-amber-300',
  closed: 'border-zinc-600 bg-zinc-600/10 text-zinc-400',
};

export const CareerApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: application, isLoading, error } = useCareerApplication(id);
  const deleteMutation = useDeleteCareerApplication();

  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="p-12 text-center text-foreground-muted animate-pulse">
          Loading application workspace...
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="p-8 bg-error/10 border border-error/30 text-error rounded-xl text-center space-y-4">
          <h2 className="text-xl font-bold">Application Not Found</h2>
          <p className="text-sm text-foreground-muted">
            The requested career application does not exist or you do not have permission to view it.
          </p>
          <Link
            to="/career"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            ← Back to Pipeline
          </Link>
        </div>
      </div>
    );
  }

  const isTerminal = isTerminalStage(application.stage);
  const badgeStyle = STAGE_BADGE_STYLES[application.stage] || 'border-border text-foreground';
  const company = application.opportunity?.company_name || 'Opportunity';
  const role = application.opportunity?.role_title || 'Role';

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete this application for ${company}?`)) {
      await deleteMutation.mutateAsync(application.id);
      navigate('/career');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* 1. Breadcrumb navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Link to="/career" className="hover:text-foreground transition-colors">
            Career Pipeline
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-xs sm:max-w-md">
            {company} — {role}
          </span>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="text-xs text-error hover:text-error/80 font-medium transition-colors"
        >
          {deleteMutation.isPending ? 'Deleting...' : 'Delete Application'}
        </button>
      </div>

      {/* 2. Top Application Summary Banner */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {role}
              </h1>
              <span
                className={`text-xs uppercase tracking-wider font-bold px-3 py-1 rounded-full border ${badgeStyle}`}
              >
                {application.stage}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-foreground-muted">
              <span className="font-semibold text-foreground text-base">
                {company}
              </span>
              {application.opportunity?.location && (
                <span>📍 {application.opportunity.location}</span>
              )}
              {application.opportunity?.employment_type && (
                <span className="capitalize">💼 {application.opportunity.employment_type}</span>
              )}
              {(application.opportunity?.salary_min || application.opportunity?.salary_max) && (
                <span className="font-mono">
                  💰 {application.opportunity.salary_currency || '$'}
                  {application.opportunity.salary_min?.toLocaleString()}
                  {application.opportunity.salary_max
                    ? ` - ${application.opportunity.salary_max.toLocaleString()}`
                    : '+'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-foreground-muted pt-1">
              {application.applied_at && (
                <span>
                  Applied:{' '}
                  <time className="font-mono text-foreground">
                    {new Date(application.applied_at).toLocaleDateString()}
                  </time>
                </span>
              )}
              {application.deadline && (
                <span>
                  Deadline:{' '}
                  <time className="font-mono text-foreground">
                    {new Date(application.deadline).toLocaleDateString()}
                  </time>
                </span>
              )}
              {application.opportunity?.job_url && (
                <a
                  href={application.opportunity.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  View Job Posting ↗
                </a>
              )}
            </div>
          </div>

          {/* Advance Stage Action Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => setIsTransitionModalOpen(true)}
              disabled={isTerminal}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold shadow transition-colors flex items-center justify-center gap-2 ${
                isTerminal
                  ? 'bg-surface-hover text-foreground-muted cursor-not-allowed border border-border'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              <span>{isTerminal ? 'Stage Terminal' : 'Advance / Update Stage'}</span>
              {!isTerminal && <span>→</span>}
            </button>
          </div>
        </div>

        {application.notes && (
          <div className="mt-4 pt-4 border-t border-border/60">
            <h4 className="text-xs uppercase font-bold tracking-wider text-foreground-muted mb-1">
              Application Notes
            </h4>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{application.notes}</p>
          </div>
        )}
      </div>

      {/* 3. Preparation Workspace */}
      <CareerPreparationWorkspace
        applicationId={application.id}
        applicationDetail={application}
      />

      {/* Stage Transition Modal */}
      <StageTransitionModal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        application={application}
        opportunity={application.opportunity}
      />
    </div>
  );
};
