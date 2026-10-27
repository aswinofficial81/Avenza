import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useProject, useDeleteProject } from '../hooks/useProjects';
import { useNextAction } from '../../intelligence/useNextAction';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Progress } from '../../../components/ui/Progress';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ConfirmationDialog } from '../../../components/ui/ConfirmationDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/Tabs';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { ProjectMilestonesSection } from '../components/ProjectMilestonesSection';
import { ProjectTasksSection } from '../components/ProjectTasksSection';
import { ProjectGoalsSection } from '../components/ProjectGoalsSection';
import { ProjectSkillsSection } from '../components/ProjectSkillsSection';
import { ProjectRepositorySection } from '../components/ProjectRepositorySection';
import { ProjectActivityTimeline } from '../components/ProjectActivityTimeline';
import type { ProjectHealthStatus } from '@avenza/shared';
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  Layers,
  CheckCircle2,
  ListTodo,
  Target,
  Wrench,
  Github,
  AlertTriangle,
  Edit2,
  Trash2,
  Clock,
  Code2,
  FileText,
  Sparkles,
} from 'lucide-react';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: nextAction } = useNextAction();

  const { data: project, isLoading, error, refetch } = useProject(id);
  const deleteMutation = useDeleteProject();

  const currentTab = searchParams.get('tab') || 'overview';

  const handleTabChange = (tabValue: string) => {
    setSearchParams({ tab: tabValue }, { replace: true });
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    await deleteMutation.mutateAsync(project.id);
    navigate('/projects');
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="project-detail-loading">
        <Skeleton className="w-32 h-8 rounded" />
        <Card className="p-6 space-y-5 border-border/80">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <Skeleton className="w-64 h-8 rounded" />
              <div className="flex gap-2">
                <Skeleton className="w-20 h-5 rounded" />
                <Skeleton className="w-20 h-5 rounded" />
                <Skeleton className="w-20 h-5 rounded" />
              </div>
              <Skeleton className="w-full max-w-md h-12 rounded" />
            </div>
            <Skeleton className="w-full md:w-64 h-28 rounded-lg shrink-0" />
          </div>
        </Card>
        <Skeleton className="w-full h-10 rounded" />
        <Skeleton className="w-full h-80 rounded-lg" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6 max-w-7xl mx-auto" data-testid="project-detail-error">
        <ErrorState
          title="Project Not Found"
          description={
            error instanceof Error ? error.message : 'Unable to load project workspace.'
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const metrics = project.metrics;
  const progress = metrics?.progressPercentage ?? 0;
  const healthStatus: ProjectHealthStatus = metrics?.healthStatus ?? 'unknown';

  const getHealthBadge = (status: ProjectHealthStatus) => {
    switch (status) {
      case 'on_track':
        return <Badge variant="success">On Track</Badge>;
      case 'at_risk':
        return (
          <Badge variant="danger" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            At Risk
          </Badge>
        );
      case 'unknown':
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="project-detail-page">
      {/* Top navigation row */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/projects')}
          className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Button>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {project.live_url && (
            <a
              href={project.live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded border border-border/70 hover:bg-surface-2 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Live App</span>
            </a>
          )}

          {project.repository?.html_url && (
            <a
              href={project.repository.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded border border-border/70 hover:bg-surface-2 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            className="gap-1.5 text-xs"
            data-testid="edit-project-btn"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="gap-1.5 text-xs text-danger hover:text-danger hover:bg-danger/10"
            data-testid="delete-project-btn"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Main Header Card */}
      <Card className="p-6 space-y-5 border-border/80">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {project.title}
              </h1>
              <Badge variant="info" className="capitalize text-xs">
                {project.status.replace('_', ' ')}
              </Badge>
              <Badge variant="secondary" className="capitalize text-xs">
                {project.priority} priority
              </Badge>
              {getHealthBadge(healthStatus)}
              <Badge variant="default" className="capitalize text-xs">
                {project.project_type.replace('_', ' ')}
              </Badge>
            </div>

            {project.description ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {project.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/60 italic">
                No description provided.
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
              {project.start_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Started: {new Date(project.start_date).toLocaleDateString()}</span>
                </div>
              )}
              {project.target_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Target: {new Date(project.target_date).toLocaleDateString()}</span>
                </div>
              )}
              {project.completed_at && (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completed: {new Date(project.completed_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Summary Widget */}
          <div className="w-full md:w-64 p-3.5 rounded-lg bg-surface-2/60 border border-border/60 space-y-3 shrink-0">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-foreground">Project Progress</span>
              <span className="font-semibold text-primary font-mono">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />

            <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-muted-foreground border-t border-border/40">
              <div>
                <span className="block text-2xs uppercase tracking-wider text-muted-foreground">
                  Milestones
                </span>
                <span className="font-semibold text-foreground font-mono">
                  {metrics?.completedMilestoneCount ?? 0}/{metrics?.milestoneCount ?? 0}
                </span>
              </div>
              <div>
                <span className="block text-2xs uppercase tracking-wider text-muted-foreground">
                  Tasks
                </span>
                <span className="font-semibold text-foreground font-mono">
                  {metrics?.completedTaskCount ?? 0}/{metrics?.taskCount ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex gap-1 h-auto p-1 bg-surface-2 border border-border/60">
          <TabsTrigger value="overview" className="gap-1.5 py-1.5">
            <Layers className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="milestones" className="gap-1.5 py-1.5" data-testid="tab-milestones">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Milestones ({project.milestones?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 py-1.5" data-testid="tab-tasks">
            <ListTodo className="w-3.5 h-3.5" />
            Tasks ({project.tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-1.5 py-1.5" data-testid="tab-goals">
            <Target className="w-3.5 h-3.5" />
            Goals ({project.goals?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1.5 py-1.5" data-testid="tab-skills">
            <Wrench className="w-3.5 h-3.5" />
            Skills ({project.skills?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="github" className="gap-1.5 py-1.5" data-testid="tab-github">
            <Github className="w-3.5 h-3.5" />
            GitHub / Code
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-4 pt-3">
          {nextAction?.action?.projectId === project.id && (
            <Card className="p-3.5 bg-surface-2/60 border-primary/30 flex items-center justify-between gap-4" data-testid="recommended-project-task">
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-primary">
                    Recommended Next Task
                  </div>
                  <Link
                    to={`/tasks/${nextAction.action.taskId}`}
                    className="text-xs font-semibold text-foreground hover:text-primary transition-colors truncate block"
                  >
                    {nextAction.action.title}
                  </Link>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground shrink-0 font-serif italic hidden sm:block">
                &ldquo;{nextAction.reason?.label || 'Priority'}&rdquo;
              </div>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Tech Stack */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Technology Stack</h3>
              </div>
              {project.tech_stack && project.tech_stack.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {project.tech_stack.map((tech) => (
                    <Badge
                      key={tech}
                      variant="secondary"
                      className="text-xs font-mono px-2 py-0.5"
                    >
                      {tech}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tech stack items specified.</p>
              )}
            </Card>

            {/* Health & Status Details */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Health & Pacing</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pacing Diagnostic:</span>
                  <span className="font-medium text-foreground">
                    {metrics?.healthReason || 'No status pacing issues detected.'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Project Type:</span>
                  <span className="font-medium text-foreground capitalize">
                    {project.project_type.replace('_', ' ')}
                  </span>
                </div>
                {project.target_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Target Delivery:</span>
                    <span className="font-medium text-foreground">
                      {new Date(project.target_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Architecture Notes */}
          {project.architecture_notes && (
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Architecture Notes</h3>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono bg-surface-2/40 p-3 rounded border border-border/50">
                {project.architecture_notes}
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Milestones */}
        <TabsContent value="milestones" className="pt-3">
          <ProjectMilestonesSection
            projectId={project.id}
            milestones={project.milestones}
            tasks={project.tasks}
          />
        </TabsContent>

        {/* Tab 3: Tasks */}
        <TabsContent value="tasks" className="pt-3">
          <ProjectTasksSection
            projectId={project.id}
            tasks={project.tasks}
            milestones={project.milestones}
          />
        </TabsContent>

        {/* Tab 4: Goals */}
        <TabsContent value="goals" className="pt-3">
          <ProjectGoalsSection projectId={project.id} goals={project.goals} />
        </TabsContent>

        {/* Tab 5: Skills */}
        <TabsContent value="skills" className="pt-3">
          <ProjectSkillsSection projectId={project.id} skills={project.skills} />
        </TabsContent>

        {/* Tab 6: GitHub / Code */}
        <TabsContent value="github" className="space-y-6 pt-3">
          <ProjectRepositorySection projectId={project.id} repository={project.repository} />
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              External Activity Timeline
            </h4>
            <ProjectActivityTimeline
              activities={project.activities}
              hasRepository={Boolean(project.repository)}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Project Modal */}
      <ProjectFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        project={project}
      />

      {/* Delete Project Confirmation */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteProject}
        title="Delete Project Workspace"
        message={
          <div>
            <p>
              Are you sure you want to delete <strong>{project.title}</strong>?
            </p>
            <p className="mt-2 text-muted-foreground">
              Deleting the project removes its project milestones and project relationships.
              Existing tasks are preserved in your workspace but become unlinked.
            </p>
          </div>
        }
        confirmLabel="Delete Project"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
