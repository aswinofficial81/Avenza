import React, { useState } from 'react';
import { useEvidence, useCreateEvidence, useDeleteEvidence } from '../features/evidence/useEvidence';
import { Button } from '../components/ui/Button';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import {
  ShieldCheck,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Link2,
  FlaskConical,
  X,
} from 'lucide-react';
import type {
  EvidenceType,
  EvidenceVerificationStatus,
  CreateEvidenceInput,
  EvidenceDto,
  EvidenceQueryInput,
} from '@avenza/shared';
import { useToast } from '../components/ui/Toast';

// ─── Add Evidence Modal ───────────────────────────────────────────────────────

interface AddEvidenceModalProps {
  onClose: () => void;
  onCreated: (ev: EvidenceDto) => void;
}

const EVIDENCE_TYPE_OPTIONS: { value: EvidenceType; label: string }[] = [
  { value: 'manual', label: 'Manual Note' },
  { value: 'task_completion', label: 'Task Completion' },
  { value: 'artifact', label: 'Artifact / Deliverable' },
  { value: 'assessment', label: 'Assessment / Result' },
  { value: 'external_activity', label: 'External Activity' },
  { value: 'external_result', label: 'External Result' },
  { value: 'project_activity', label: 'Project Activity' },
  { value: 'custom', label: 'Custom' },
];

const AddEvidenceModal: React.FC<AddEvidenceModalProps> = ({ onClose, onCreated }) => {
  const { showToast } = useToast();
  const createEvidence = useCreateEvidence();

  const [title, setTitle] = useState('');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('manual');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload: CreateEvidenceInput = {
      title: title.trim(),
      evidence_type: evidenceType,
      description: description.trim() || null,
      notes: notes.trim() || null,
      external_url: externalUrl.trim() || null,
    };

    try {
      const created = await createEvidence.mutateAsync(payload);
      showToast({ type: 'success', title: 'Evidence recorded.' });
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create evidence.';
      showToast({ type: 'error', title: msg });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground">Record Evidence</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Evidence must be verifiable and real — something that proves work actually happened.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="ev-title" className="text-xs font-semibold text-foreground">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              id="ev-title"
              type="text"
              required
              maxLength={255}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Completed Chapter 3 notes"
              className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label htmlFor="ev-type" className="text-xs font-semibold text-foreground">
              Evidence Type
            </label>
            <select
              id="ev-type"
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              {EVIDENCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="ev-desc" className="text-xs font-semibold text-foreground">
              Description
            </label>
            <textarea
              id="ev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What did you produce or complete?"
              className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          </div>

          {/* External URL */}
          <div className="space-y-1.5">
            <label htmlFor="ev-url" className="text-xs font-semibold text-foreground">
              External Link <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="ev-url"
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="ev-notes" className="text-xs font-semibold text-foreground">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="ev-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Any additional context..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createEvidence.isPending}
              disabled={!title.trim() || createEvidence.isPending}
            >
              Record Evidence
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Verification Badge ──────────────────────────────────────────────────────

const VerificationBadge: React.FC<{ status: EvidenceVerificationStatus }> = ({ status }) => {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" />
        Verified
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
        <XCircle className="w-3 h-3" />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
      <Clock className="w-3 h-3" />
      Unverified
    </span>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export const EvidencePage: React.FC = () => {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<EvidenceType | ''>('');
  const [statusFilter, setStatusFilter] = useState<EvidenceVerificationStatus | ''>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const deleteEvidence = useDeleteEvidence();

  const filters: EvidenceQueryInput = {
    page,
    limit: 15,
    ...(typeFilter ? { evidence_type: typeFilter } : {}),
    ...(statusFilter ? { verification_status: statusFilter } : {}),
  };

  const { data, isLoading, isError, refetch } = useEvidence(filters);

  const evidenceList = data?.data || [];
  const pagination = data?.pagination;
  const summary = data?.summary;

  const handleDelete = async (ev: EvidenceDto) => {
    if (!window.confirm(`Delete evidence "${ev.title}"? This cannot be undone.`)) return;
    try {
      await deleteEvidence.mutateAsync(ev.id);
      showToast({ type: 'success', title: 'Evidence deleted.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete evidence.';
      showToast({ type: 'error', title: msg });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/overview' },
              { label: 'Evidence', isCurrent: true },
            ]}
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Execution Evidence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verifiable proof that real work happened. Focus sessions automatically generate evidence.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setIsAddModalOpen(true)}
          className="shrink-0"
        >
          Add Evidence
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: summary.total, color: 'text-foreground' },
            {
              label: 'Verified',
              value: summary.verified,
              color: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              label: 'Unverified',
              value: summary.unverified,
              color: 'text-amber-600 dark:text-amber-400',
            },
            {
              label: 'Rejected',
              value: summary.rejected,
              color: 'text-destructive',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-xs"
            >
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-semibold text-muted-foreground">Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as EvidenceType | '');
              setPage(1);
            }}
            className="p-1.5 text-xs rounded-lg border border-border bg-background text-foreground"
          >
            <option value="">All Types</option>
            <option value="focus_session">Focus Session</option>
            <option value="task_completion">Task Completion</option>
            <option value="manual">Manual</option>
            <option value="artifact">Artifact</option>
            <option value="assessment">Assessment</option>
            <option value="external_activity">External Activity</option>
            <option value="external_result">External Result</option>
            <option value="project_activity">Project Activity</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-muted-foreground">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as EvidenceVerificationStatus | '');
              setPage(1);
            }}
            className="p-1.5 text-xs rounded-lg border border-border bg-background text-foreground"
          >
            <option value="">All Statuses</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {pagination && (
          <div className="ml-auto text-xs text-muted-foreground">
            Showing {evidenceList.length} of {pagination.total}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-8 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load evidence records.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : evidenceList.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border text-center">
          <EmptyState
            title="No evidence recorded"
            description="Complete focus sessions or add manual evidence to build your execution record."
            icon={<ShieldCheck className="h-6 w-6 stroke-[1.5] text-primary" />}
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsAddModalOpen(true)}
              >
                Add Evidence
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 min-w-[200px]">Evidence</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Strength</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Links</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {evidenceList.map((ev) => (
                <tr key={ev.id} className="hover:bg-muted/30 transition-colors group">
                  {/* Date */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-medium text-foreground">
                      {new Date(ev.occurred_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(ev.occurred_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>

                  {/* Evidence title + description */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-foreground line-clamp-1">{ev.title}</div>
                    {ev.description && (
                      <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {ev.description}
                      </div>
                    )}
                    {ev.external_url && (
                      <a
                        href={ev.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        View Link
                      </a>
                    )}
                  </td>

                  {/* Type */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="capitalize px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/60 font-medium">
                      {ev.evidence_type === 'focus_session'
                        ? 'Focus'
                        : ev.evidence_type.replace(/_/g, ' ')}
                    </span>
                  </td>

                  {/* Strength */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`capitalize font-semibold ${
                        ev.evidence_strength === 'high'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : ev.evidence_strength === 'medium'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {ev.evidence_strength}
                    </span>
                  </td>

                  {/* Verification */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <VerificationBadge status={ev.verification_status} />
                  </td>

                  {/* Links */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {ev.links && ev.links.length > 0 ? (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Link2 className="w-3 h-3" />
                        <span>{ev.links.length}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Delete */}
                  <td className="py-3.5 px-4">
                    {ev.source_type !== 'focus_session' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(ev)}
                        disabled={deleteEvidence.isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded"
                        aria-label="Delete evidence"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </Button>

          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="gap-1 text-xs"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Info Notice */}
      <div className="rounded-xl border border-border bg-card p-4 flex gap-3 text-xs text-muted-foreground">
        <FlaskConical className="w-4 h-4 shrink-0 text-primary mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">What counts as evidence?</p>
          <p className="leading-relaxed">
            Evidence is verifiable proof of execution — not intent. Focus sessions automatically
            produce <strong className="text-foreground">verified</strong> evidence when completed.
            Manual entries are marked <strong className="text-foreground">unverified</strong> until
            reviewed. AI-generated content is never treated as evidence.
          </p>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <AddEvidenceModal
          onClose={() => setIsAddModalOpen(false)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
};
