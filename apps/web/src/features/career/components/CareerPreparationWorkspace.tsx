import React, { useState } from 'react';
import type {
  CareerApplicationDetailDto,
  CareerInterviewDto,
  CareerProjectReadinessItem,
  CareerSkillReadinessItem,
  CareerTaskReadinessItem,
} from '@avenza/shared';
import { CreateTaskModal } from '../../tasks/components/CreateTaskModal';
import { AttachProjectModal } from './AttachProjectModal';
import { CreateInterviewModal } from './CreateInterviewModal';
import { CareerStageHistoryTimeline } from './CareerStageHistoryTimeline';
import {
  useCareerApplicationPreparation,
  useRemoveCareerApplicationProject,
} from '../hooks/useCareer';

interface CareerPreparationWorkspaceProps {
  applicationId: string;
  applicationDetail?: CareerApplicationDetailDto;
}

type TabType = 'skills' | 'projects' | 'tasks' | 'interviews' | 'history';

export const CareerPreparationWorkspace: React.FC<CareerPreparationWorkspaceProps> = ({
  applicationId,
  applicationDetail,
}) => {
  const { data: prepData, isLoading: prepLoading } = useCareerApplicationPreparation(applicationId);
  const removeProjectMutation = useRemoveCareerApplicationProject(applicationId);

  const [activeTab, setActiveTab] = useState<TabType>('skills');
  const [isAttachProjectOpen, setIsAttachProjectOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateInterviewOpen, setIsCreateInterviewOpen] = useState(false);

  if (prepLoading && !prepData) {
    return (
      <div className="p-8 text-center text-foreground-muted animate-pulse">
        Loading application preparation workspace...
      </div>
    );
  }

  const skills = prepData?.skills;
  const summary = skills?.summary;
  const projects = prepData?.projects;
  const tasks = prepData?.tasks;
  const interviews = prepData?.interviews || [];

  const requiredPct =
    summary && summary.required_total > 0
      ? Math.round((summary.required_acquired / summary.required_total) * 100)
      : 0;

  const totalTasks = (tasks?.open_count || 0) + (tasks?.completed_count || 0);
  const taskPct = totalTasks > 0 ? Math.round(((tasks?.completed_count || 0) / totalTasks) * 100) : 0;

  const alreadyAttachedIds = [
    ...(projects?.featured.map((p) => p.project_id) || []),
    ...(projects?.supporting.map((p) => p.project_id) || []),
  ];

  return (
    <div className="space-y-6">
      {/* 1. Readiness Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Skills Card */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
            <span>Skills Readiness</span>
            <span className="text-primary font-mono">{requiredPct}%</span>
          </div>
          <div className="text-xl font-bold mb-1">
            {summary?.required_acquired ?? 0} / {summary?.required_total ?? 0}
            <span className="text-xs font-normal text-foreground-muted ml-2">Required Skills</span>
          </div>
          <div className="w-full bg-surface-hover rounded-full h-1.5 overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all ${
                requiredPct === 100
                  ? 'bg-emerald-500'
                  : requiredPct >= 50
                  ? 'bg-primary'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${requiredPct}%` }}
            />
          </div>
        </div>

        {/* Projects Card */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
            <span>Attached Projects</span>
            <span className="text-indigo-400 font-mono">
              {(projects?.featured.length || 0) + (projects?.supporting.length || 0)} Total
            </span>
          </div>
          <div className="text-xl font-bold mb-1">
            {projects?.featured.length || 0}
            <span className="text-xs font-normal text-foreground-muted ml-2">Featured</span>
            <span className="text-xs font-normal text-foreground-muted ml-2">
              • {projects?.supporting.length || 0} Supporting
            </span>
          </div>
          <p className="text-xs text-foreground-muted mt-2">Prepared with interview talking points</p>
        </div>

        {/* Tasks Card */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
            <span>Preparation Tasks</span>
            <span className="text-cyan-400 font-mono">{taskPct}%</span>
          </div>
          <div className="text-xl font-bold mb-1">
            {tasks?.completed_count || 0} / {totalTasks}
            <span className="text-xs font-normal text-foreground-muted ml-2">Completed</span>
          </div>
          <div className="w-full bg-surface-hover rounded-full h-1.5 overflow-hidden mt-2">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all"
              style={{ width: `${taskPct}%` }}
            />
          </div>
        </div>

        {/* Interviews Card */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
            <span>Interview Rounds</span>
            <span className="text-purple-400 font-mono">{interviews.length}</span>
          </div>
          <div className="text-xl font-bold mb-1">
            {interviews.filter((i) => i.status === 'scheduled').length}
            <span className="text-xs font-normal text-foreground-muted ml-2">Upcoming Scheduled</span>
          </div>
          <p className="text-xs text-foreground-muted mt-2">
            {interviews.filter((i) => i.status === 'completed').length} rounds completed
          </p>
        </div>
      </div>

      {/* 2. Workspace Navigation Tabs */}
      <div className="border-b border-border flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex gap-2">
          {(
            [
              { id: 'skills', label: 'Skills Readiness' },
              { id: 'projects', label: 'Talking Points & Projects' },
              { id: 'tasks', label: 'Preparation Tasks' },
              { id: 'interviews', label: 'Interview Rounds' },
              { id: 'history', label: 'Stage Audit History' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab-specific action button */}
        <div className="pb-2">
          {activeTab === 'projects' && (
            <button
              type="button"
              onClick={() => setIsAttachProjectOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              + Attach Project
            </button>
          )}
          {activeTab === 'tasks' && (
            <button
              type="button"
              onClick={() => setIsCreateTaskOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              + Add Preparation Task
            </button>
          )}
          {activeTab === 'interviews' && (
            <button
              type="button"
              onClick={() => setIsCreateInterviewOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              + Schedule Interview Round
            </button>
          )}
        </div>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: Skills Readiness */}
      {activeTab === 'skills' && (
        <div className="space-y-6">
          <SkillSection
            title="Required Skills"
            description="Core technical & behavioral proficiencies required for this role"
            items={skills?.required || []}
            badgeColor="bg-red-500/10 text-red-400 border-red-500/30"
          />

          <SkillSection
            title="Preferred Skills"
            description="Competitive advantages and strong differentiators"
            items={skills?.preferred || []}
            badgeColor="bg-blue-500/10 text-blue-400 border-blue-500/30"
          />

          <SkillSection
            title="Bonus Skills"
            description="Nice-to-have capabilities"
            items={skills?.bonus || []}
            badgeColor="bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
          />
        </div>
      )}

      {/* TAB 2: Talking Points & Projects */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          {(!projects || (projects.featured.length === 0 && projects.supporting.length === 0)) ? (
            <div className="p-8 text-center border border-dashed border-border rounded-xl">
              <h4 className="text-base font-semibold mb-1">No Projects Attached Yet</h4>
              <p className="text-sm text-foreground-muted mb-4 max-w-md mx-auto">
                Attach projects from your portfolio with tailored talking points and interview stories to present during interviews.
              </p>
              <button
                type="button"
                onClick={() => setIsAttachProjectOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Attach Project
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {projects.featured.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-primary mb-3">
                    Featured Projects ({projects.featured.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects.featured.map((item) => (
                      <ProjectItemCard
                        key={item.project_id}
                        item={item}
                        onRemove={() => removeProjectMutation.mutate(item.project_id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {projects.supporting.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground-muted mb-3">
                    Supporting Projects ({projects.supporting.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects.supporting.map((item) => (
                      <ProjectItemCard
                        key={item.project_id}
                        item={item}
                        onRemove={() => removeProjectMutation.mutate(item.project_id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Preparation Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {(!tasks || (tasks.open.length === 0 && tasks.completed.length === 0)) ? (
            <div className="p-8 text-center border border-dashed border-border rounded-xl">
              <h4 className="text-base font-semibold mb-1">No Preparation Tasks</h4>
              <p className="text-sm text-foreground-muted mb-4 max-w-md mx-auto">
                Create concrete preparation tasks linked to this application — mock interviews, reviewing system designs, or practicing talking points.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateTaskOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Add Preparation Task
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {tasks.open.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 mb-3">
                    Open Tasks ({tasks.open.length})
                  </h3>
                  <div className="space-y-2">
                    {tasks.open.map((t) => (
                      <TaskItemRow key={t.id} task={t} />
                    ))}
                  </div>
                </div>
              )}

              {tasks.completed.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground-muted mb-3">
                    Completed Tasks ({tasks.completed.length})
                  </h3>
                  <div className="space-y-2 opacity-80">
                    {tasks.completed.map((t) => (
                      <TaskItemRow key={t.id} task={t} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Interview Schedule */}
      {activeTab === 'interviews' && (
        <div className="space-y-6">
          {interviews.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border rounded-xl">
              <h4 className="text-base font-semibold mb-1">No Interview Rounds Scheduled</h4>
              <p className="text-sm text-foreground-muted mb-4 max-w-md mx-auto">
                Track each interview round from recruiter screen to system design and executive interviews.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateInterviewOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Schedule First Round
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {interviews.map((interview) => (
                <InterviewCard key={interview.id} interview={interview} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Stage History */}
      {activeTab === 'history' && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-base font-bold mb-4">Stage Transition Audit Log</h3>
          <CareerStageHistoryTimeline
            applicationId={applicationId}
            initialHistory={applicationDetail?.history}
          />
        </div>
      )}

      {/* Modals */}
      <AttachProjectModal
        isOpen={isAttachProjectOpen}
        onClose={() => setIsAttachProjectOpen(false)}
        applicationId={applicationId}
        alreadyAttachedProjectIds={alreadyAttachedIds}
      />

      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        initialApplicationId={applicationId}
      />

      <CreateInterviewModal
        isOpen={isCreateInterviewOpen}
        onClose={() => setIsCreateInterviewOpen(false)}
        applicationId={applicationId}
        nextRoundNumber={interviews.length + 1}
      />
    </div>
  );
};

// ==============================================================================
// Sub-components
// ==============================================================================

function SkillSection({
  title,
  description,
  items,
  badgeColor,
}: {
  title: string;
  description: string;
  items: CareerSkillReadinessItem[];
  badgeColor: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded border font-mono font-medium ${badgeColor}`}>
            {items.length}
          </span>
        </div>
        <p className="text-xs text-foreground-muted">{description}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((skill) => (
          <div
            key={skill.skill_id}
            className="p-3 bg-surface-hover/60 border border-border rounded-lg flex flex-col justify-between hover:border-border transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="font-semibold text-sm text-foreground">{skill.skill_name}</span>
              {skill.is_acquired ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Acquired
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Missing
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-foreground-muted">
              <span>{skill.skill_category || 'General'}</span>
              <span className="font-mono text-[11px] capitalize">
                {skill.current_level ? `Level: ${skill.current_level}` : 'Not started'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectItemCard({
  item,
  onRemove,
}: {
  item: CareerProjectReadinessItem;
  onRemove: () => void;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="font-bold text-base text-foreground">{item.title}</h4>
          <div className="flex items-center gap-1.5">
            {item.is_featured && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                Featured
              </span>
            )}
            <span className="text-[10px] uppercase font-medium px-1.5 py-0.5 rounded bg-surface-hover border border-border text-foreground-muted">
              {item.status}
            </span>
          </div>
        </div>

        {item.talking_points ? (
          <div className="mt-3 p-3 bg-surface-hover/50 border border-border/80 rounded-lg text-sm text-foreground/90 whitespace-pre-wrap">
            <span className="text-xs font-semibold text-primary block mb-1">
              Interview Talking Points
            </span>
            {item.talking_points}
          </div>
        ) : (
          <p className="text-xs text-foreground-muted mt-2 italic">
            No specific talking points recorded yet.
          </p>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t border-border/60">
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-error hover:text-error/80 font-medium transition-colors"
        >
          Detach Project
        </button>
      </div>
    </div>
  );
}

function TaskItemRow({ task }: { task: CareerTaskReadinessItem }) {
  const isCompleted = task.status === 'completed';

  return (
    <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg hover:border-border transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            isCompleted
              ? 'bg-emerald-500'
              : task.is_blocked
              ? 'bg-red-500'
              : 'bg-cyan-500'
          }`}
        />
        <span
          className={`text-sm font-medium ${
            isCompleted ? 'line-through text-foreground-muted' : 'text-foreground'
          }`}
        >
          {task.title}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-foreground-muted">
        <span className="uppercase font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-hover border border-border">
          {task.priority}
        </span>
        {task.due_at && (
          <time className="font-mono">
            {new Date(task.due_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </time>
        )}
      </div>
    </div>
  );
}

function InterviewCard({ interview }: { interview: CareerInterviewDto }) {
  const dateFormatted = interview.scheduled_at
    ? new Date(interview.scheduled_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Date not set';

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    rescheduled: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs uppercase tracking-wider font-mono text-foreground-muted block mb-0.5">
            Round {interview.round_number}
          </span>
          <h4 className="font-bold text-base text-foreground capitalize">
            {interview.round_type.replace(/_/g, ' ')}
          </h4>
        </div>
        <span
          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
            statusColors[interview.status] || 'bg-surface-hover text-foreground-muted'
          }`}
        >
          {interview.status}
        </span>
      </div>

      <div className="text-xs space-y-1 text-foreground-muted">
        <div className="flex items-center gap-2">
          <span>📅</span>
          <time className="font-mono">{dateFormatted}</time>
          <span>({interview.duration_minutes}m)</span>
        </div>

        {interview.meeting_link && (
          <div className="flex items-center gap-2">
            <span>🔗</span>
            <a
              href={interview.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline truncate max-w-xs"
            >
              {interview.meeting_link}
            </a>
          </div>
        )}

        {interview.interviewer_names && interview.interviewer_names.length > 0 && (
          <div className="flex items-center gap-2">
            <span>👥</span>
            <span>{interview.interviewer_names.join(', ')}</span>
          </div>
        )}
      </div>

      {interview.notes && (
        <p className="text-xs text-foreground/80 bg-surface-hover/50 p-2.5 rounded border border-border/60">
          {interview.notes}
        </p>
      )}
    </div>
  );
}
