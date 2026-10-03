import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Layers,
  Link2,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui';
import { EditSkillModal } from '../features/skills/components/EditSkillModal';
import {
  LinkEvidenceModal,
  LinkGoalModal,
  LinkTaskModal,
} from '../features/skills/components/LinkEntityModals';
import {
  ConfidenceIndicator,
  HealthBadge,
  MasteryBadge,
} from '../features/skills/components/MasteryBadge';
import {
  useArchiveSkill,
  useSkillDetail,
  useSkills,
  useUnlinkEvidenceFromSkill,
  useUnlinkGoalFromSkill,
  useUnlinkTaskFromSkill,
} from '../features/skills/useSkills';

export const SkillDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'evidence' | 'goals' | 'tasks' | 'topics' | 'children'>(
    'evidence'
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLinkEvidenceOpen, setIsLinkEvidenceOpen] = useState(false);
  const [isLinkGoalOpen, setIsLinkGoalOpen] = useState(false);
  const [isLinkTaskOpen, setIsLinkTaskOpen] = useState(false);

  const { data: detail, isLoading, isError, refetch } = useSkillDetail(id);
  const { data: allSkills } = useSkills();

  const archiveSkill = useArchiveSkill();
  const unlinkEvidence = useUnlinkEvidenceFromSkill();
  const unlinkGoal = useUnlinkGoalFromSkill();
  const unlinkTask = useUnlinkTaskFromSkill();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <ErrorState
          title="Skill Not Found"
          description="Could not load the requested skill details."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const { skill, mastery, evidence, goals, tasks, topics, children } = detail;

  const handleArchive = async () => {
    if (window.confirm(`Are you sure you want to archive "${skill.name}"?`)) {
      await archiveSkill.mutateAsync(skill.id);
      navigate('/skills');
    }
  };



  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/skills"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Skills Directory
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
            Edit Skill
          </Button>
          {skill.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              className="text-rose-400 hover:text-rose-300"
            >
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Header Info */}
      <div className="border-b border-zinc-800 pb-5">
        {skill.parent_skill && (
          <div className="text-xs font-mono text-zinc-500 flex items-center gap-1.5 mb-1.5">
            <Link
              to={`/skills/${skill.parent_skill.id}`}
              className="hover:text-indigo-400 transition-colors"
            >
              {skill.parent_skill.name}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            <span className="text-zinc-300 font-medium">Child Capability</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
              <Award className="w-7 h-7 text-indigo-400" />
              {skill.name}
            </h1>
            <div className="flex items-center gap-2.5 mt-2">
              <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                slug: {skill.slug}
              </span>
              {skill.category && (
                <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {skill.category}
                </span>
              )}
              <span
                className={`text-xs font-mono uppercase px-2 py-0.5 rounded border ${
                  skill.status === 'active'
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-zinc-400 bg-zinc-800 border-zinc-700'
                }`}
              >
                {skill.status}
              </span>
            </div>
          </div>
        </div>

        {skill.description && (
          <p className="text-sm text-zinc-300 mt-4 leading-relaxed max-w-3xl">
            {skill.description}
          </p>
        )}
      </div>

      {/* Derived Mastery Analysis Card */}
      <Card className="p-5 bg-gradient-to-br from-zinc-900/90 to-zinc-950 border-zinc-800 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold">
              Demonstrated Mastery Assessment
            </span>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
            DERIVED ENGINE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-950/60 border border-zinc-800/80 p-3 rounded">
            <span className="block text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
              Current Mastery State
            </span>
            <div className="flex items-center gap-2">
              <MasteryBadge state={mastery.state} score={mastery.score} />
            </div>
            <span className="block text-[11px] font-mono text-zinc-500 mt-1">
              Score: {mastery.score} / 100
            </span>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 p-3 rounded">
            <span className="block text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
              Assessment Reliability
            </span>
            <ConfidenceIndicator confidence={mastery.confidence} />
            <span className="block text-[11px] font-mono text-zinc-500 mt-1">
              {mastery.verified_evidence_count} of {mastery.evidence_count} verified
            </span>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 p-3 rounded">
            <span className="block text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
              Skill Health
            </span>
            <HealthBadge health={mastery.health} />
            <span className="block text-[11px] font-mono text-zinc-500 mt-1">
              {mastery.recent_activity_at
                ? `Last seen: ${new Date(mastery.recent_activity_at).toLocaleDateString()}`
                : 'No recorded activity'}
            </span>
          </div>
        </div>

        {/* Deterministic Explanation */}
        <div className="bg-zinc-950/40 border border-zinc-800/60 p-3 rounded text-xs text-zinc-300 font-mono leading-relaxed">
          <span className="text-zinc-500 mr-2">LOGIC:</span>
          {mastery.explanation}
        </div>
      </Card>

      {/* Tabs for Connected Relations */}
      <Tabs
        defaultValue="evidence"
        value={activeTab}
        onValueChange={(val) =>
          setActiveTab(val as 'evidence' | 'goals' | 'tasks' | 'topics' | 'children')
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="evidence">Evidence ({evidence.length})</TabsTrigger>
          <TabsTrigger value="goals">Goals ({goals.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="topics">Academic Topics ({topics.length})</TabsTrigger>
          <TabsTrigger value="children">Sub-skills ({children.length})</TabsTrigger>
        </TabsList>

        {/* 1. Evidence Tab */}
        <TabsContent value="evidence" className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">
                Evidence records provide the direct inputs for calculating demonstrated mastery.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsLinkEvidenceOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Link Evidence
              </Button>
            </div>

            {evidence.length === 0 ? (
              <EmptyState
                icon={<Link2 className="w-8 h-8 text-zinc-600" />}
                title="No evidence attached"
                description="Link completed focus sessions, tasks, assessments, or manual work records."
                action={
                  <Button size="sm" variant="outline" onClick={() => setIsLinkEvidenceOpen(true)}>
                    Attach First Evidence
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-zinc-800/60 border border-zinc-800/80 rounded bg-zinc-900/40">
                {evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 flex items-center justify-between hover:bg-zinc-900/80 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {ev.evidence_type}
                        </span>
                        <span
                          className={`text-xs font-mono uppercase px-1.5 py-0.5 rounded border ${
                            ev.verification_status === 'verified'
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-zinc-400 bg-zinc-800 border-zinc-700'
                          }`}
                        >
                          {ev.verification_status}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">
                          {new Date(ev.occurred_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-zinc-200">{ev.title}</h4>
                      {ev.description && (
                        <p className="text-xs text-zinc-400 mt-0.5">{ev.description}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        unlinkEvidence.mutate({ skillId: skill.id, evidenceId: ev.id })
                      }
                      title="Unlink Evidence"
                      className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
        </TabsContent>

        {/* 2. Goals Tab */}
        <TabsContent value="goals" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Goals requiring this capability to achieve target outcomes.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsLinkGoalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect Goal
            </Button>
          </div>

          {goals.length === 0 ? (
            <EmptyState
              icon={<Target className="w-8 h-8 text-zinc-600" />}
              title="No goals connected"
              description="Connect this skill to target goals to track capability alignment."
            />
          ) : (
            <div className="divide-y divide-zinc-800/60 border border-zinc-800/80 rounded bg-zinc-900/40">
              {goals.map((g) => (
                <div
                  key={g.id}
                  className="p-3.5 flex items-center justify-between hover:bg-zinc-900/80 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {g.status}
                      </span>
                      {g.target_mastery_state && (
                        <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                          Target: {g.target_mastery_state}
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/goals/${g.id}`}
                      className="text-sm font-medium text-zinc-200 hover:text-indigo-400 transition-colors"
                    >
                      {g.title}
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => unlinkGoal.mutate({ skillId: skill.id, goalId: g.id })}
                    title="Disconnect Goal"
                    className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 3. Tasks Tab */}
        <TabsContent value="tasks" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Execution tasks that practice or apply this capability.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsLinkTaskOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect Task
            </Button>
          </div>

          {tasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-8 h-8 text-zinc-600" />}
              title="No tasks connected"
              description="Associate tasks that directly exercise this skill."
            />
          ) : (
            <div className="divide-y divide-zinc-800/60 border border-zinc-800/80 rounded bg-zinc-900/40">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 flex items-center justify-between hover:bg-zinc-900/80 transition-colors"
                >
                  <div>
                    <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 mr-2">
                      {t.status}
                    </span>
                    <Link
                      to={`/tasks/${t.id}`}
                      className="text-sm font-medium text-zinc-200 hover:text-indigo-400 transition-colors"
                    >
                      {t.title}
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => unlinkTask.mutate({ skillId: skill.id, taskId: t.id })}
                    title="Disconnect Task"
                    className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 4. Academic Topics Tab */}
        <TabsContent value="topics" className="space-y-3">
          <p className="text-xs text-zinc-400">
            Curriculum topics from Academics that correspond to this capability.
          </p>

          {topics.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-8 h-8 text-zinc-600" />}
              title="No academic topics connected"
              description="Link syllabus topics from your courses to reflect coursework alignment."
            />
          ) : (
            <div className="divide-y divide-zinc-800/60 border border-zinc-800/80 rounded bg-zinc-900/40">
              {topics.map((top) => (
                <div
                  key={top.id}
                  className="p-3.5 flex items-center justify-between hover:bg-zinc-900/80 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {top.subject_name && (
                        <span className="text-xs font-mono text-zinc-400">
                          Course: {top.subject_name}
                        </span>
                      )}
                      <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {top.status}
                      </span>
                    </div>
                    <Link
                      to={`/academics/subjects/${top.subject_id}`}
                      className="text-sm font-medium text-zinc-200 hover:text-indigo-400 transition-colors"
                    >
                      {top.name}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 5. Sub-skills Tab */}
        <TabsContent value="children" className="space-y-3">
          <p className="text-xs text-zinc-400">
            More specialized sub-capabilities nested under this skill.
          </p>

          {children.length === 0 ? (
            <EmptyState
              icon={<Layers className="w-8 h-8 text-zinc-600" />}
              title="No sub-skills nested"
              description="When creating child skills, select this skill as the parent to build a clear hierarchy."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {children.map((child) => (
                <Link
                  key={child.id}
                  to={`/skills/${child.id}`}
                  className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded hover:border-zinc-700 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-sm font-medium text-zinc-200">{child.name}</h4>
                    {child.category && (
                      <span className="text-[11px] font-mono text-zinc-500">
                        {child.category}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {isEditOpen && (
        <EditSkillModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          skill={skill}
          availableSkills={allSkills}
        />
      )}

      {isLinkEvidenceOpen && (
        <LinkEvidenceModal
          isOpen={isLinkEvidenceOpen}
          onClose={() => setIsLinkEvidenceOpen(false)}
          skillId={skill.id}
          alreadyLinkedEvidenceIds={evidence.map((e) => e.id)}
        />
      )}

      {isLinkGoalOpen && (
        <LinkGoalModal
          isOpen={isLinkGoalOpen}
          onClose={() => setIsLinkGoalOpen(false)}
          skillId={skill.id}
          alreadyLinkedGoalIds={goals.map((g) => g.id)}
        />
      )}

      {isLinkTaskOpen && (
        <LinkTaskModal
          isOpen={isLinkTaskOpen}
          onClose={() => setIsLinkTaskOpen(false)}
          skillId={skill.id}
          alreadyLinkedTaskIds={tasks.map((t) => t.id)}
        />
      )}
    </div>
  );
};
