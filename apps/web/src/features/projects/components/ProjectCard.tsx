import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectDto, ProjectHealthStatus, ProjectPriority, ProjectStatus } from '@avenza/shared';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Progress } from '../../../components/ui/Progress';
import {
  Calendar,
  CheckCircle2,
  ListTodo,
  AlertTriangle,
  Github,
  Layers,
} from 'lucide-react';

export interface ProjectCardProps {
  project: ProjectDto;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const navigate = useNavigate();

  const metrics = project.metrics;
  const progress = metrics?.progressPercentage ?? 0;
  const milestoneCount = metrics?.milestoneCount ?? 0;
  const completedMilestoneCount = metrics?.completedMilestoneCount ?? 0;
  const taskCount = metrics?.taskCount ?? 0;
  const completedTaskCount = metrics?.completedTaskCount ?? 0;
  const healthStatus: ProjectHealthStatus = metrics?.healthStatus ?? 'unknown';

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'in_progress':
        return <Badge variant="info" className="text-2xs capitalize">In Progress</Badge>;
      case 'completed':
        return <Badge variant="success" className="text-2xs capitalize">Completed</Badge>;
      case 'paused':
        return <Badge variant="warning" className="text-2xs capitalize">Paused</Badge>;
      case 'planning':
        return <Badge variant="secondary" className="text-2xs capitalize">Planning</Badge>;
      case 'archived':
        return <Badge variant="default" className="text-2xs capitalize">Archived</Badge>;
      case 'backlog':
      default:
        return <Badge variant="secondary" className="text-2xs capitalize">Backlog</Badge>;
    }
  };

  const getPriorityBadge = (priority: ProjectPriority) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="danger" className="text-2xs capitalize">Critical</Badge>;
      case 'high':
        return <Badge variant="warning" className="text-2xs capitalize">High</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="text-2xs capitalize">Medium</Badge>;
      case 'low':
      default:
        return <Badge variant="default" className="text-2xs capitalize">Low</Badge>;
    }
  };

  const getHealthBadge = (health: ProjectHealthStatus) => {
    switch (health) {
      case 'on_track':
        return <Badge variant="success" className="text-2xs">On Track</Badge>;
      case 'at_risk':
        return (
          <Badge variant="danger" className="text-2xs flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            At Risk
          </Badge>
        );
      case 'unknown':
      default:
        return null;
    }
  };

  const formatTargetDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const targetDateFormatted = formatTargetDate(project.target_date);

  const handleClick = () => {
    navigate(`/projects/${project.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <Card
      tabIndex={0}
      role="link"
      aria-label={`View project ${project.title}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid="project-card"
      className="group relative p-5 flex flex-col justify-between cursor-pointer border-border/70 hover:border-primary/50 hover:bg-surface-2/40 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background"
    >
      {/* Top Header Section */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors truncate">
              {project.title}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {getStatusBadge(project.status)}
              {getPriorityBadge(project.priority)}
              {getHealthBadge(healthStatus)}
              <Badge variant="default" className="text-2xs capitalize">
                {project.project_type.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          {/* GitHub / Repo Indicator */}
          {project.repository_id && (
            <span
              title="GitHub repository linked"
              aria-label="GitHub repository linked"
              className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground border border-border/60 shrink-0"
            >
              <Github className="w-3 h-3 text-foreground" />
              <span className="hidden sm:inline">Linked</span>
            </span>
          )}
        </div>

        {/* Short Description */}
        {project.description ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">
            No description provided.
          </p>
        )}
      </div>

      {/* Progress & Milestone/Task Metrics */}
      <div className="mt-5 pt-4 border-t border-border/50 space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              Progress
            </span>
            <span className="font-semibold text-foreground font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Counts & Target Date */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1"
              title="Milestones completed"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>
                {completedMilestoneCount}/{milestoneCount} milestones
              </span>
            </span>
            <span
              className="inline-flex items-center gap-1"
              title="Tasks completed"
            >
              <ListTodo className="w-3.5 h-3.5 text-muted-foreground" />
              <span>
                {completedTaskCount}/{taskCount} tasks
              </span>
            </span>
          </div>

          {targetDateFormatted && (
            <span
              className="inline-flex items-center gap-1 text-foreground/80 font-medium ml-auto"
              title="Target Date"
            >
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Target: {targetDateFormatted}</span>
            </span>
          )}
        </div>

        {/* Tech Stack Chips */}
        {project.tech_stack && project.tech_stack.length > 0 && (
          <div className="pt-2 flex flex-wrap gap-1.5 items-center">
            {project.tech_stack.slice(0, 4).map((tech) => (
              <span
                key={tech}
                className="text-2xs font-mono px-2 py-0.5 rounded bg-surface-2 text-muted-foreground border border-border/60"
              >
                {tech}
              </span>
            ))}
            {project.tech_stack.length > 4 && (
              <span className="text-2xs text-muted-foreground font-mono px-1">
                +{project.tech_stack.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
