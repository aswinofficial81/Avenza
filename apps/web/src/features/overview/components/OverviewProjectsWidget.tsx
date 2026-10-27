import React from 'react';
import { Link } from 'react-router-dom';
import { FolderGit2, ArrowRight, Layers, CheckCircle2 } from 'lucide-react';
import { useProjects } from '../../projects/hooks/useProjects';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Progress } from '../../../components/ui/Progress';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';

export const OverviewProjectsWidget: React.FC = () => {
  const { data: projectsResponse, isLoading, isError, error, refetch } = useProjects({
    status: 'in_progress',
    pageSize: 3,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-14" />
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <Skeleton className="h-16 w-full rounded" />
          <Skeleton className="h-16 w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold">Active Projects</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ErrorState
            title="Unable to load active projects"
            description={(error as Error)?.message || 'Failed to fetch projects.'}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  const projects = projectsResponse?.data || [];

  return (
    <Card className="h-full flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Active Projects</CardTitle>
            </div>
            <Link to="/projects">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                View all
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          {projects.length > 0 ? (
            projects.map((project) => {
              const metrics = project.metrics;
              const progress = Math.round(metrics?.progressPercentage ?? 0);
              const milestoneCount = metrics?.milestoneCount ?? 0;
              const completedMilestoneCount = metrics?.completedMilestoneCount ?? 0;

              return (
                <div
                  key={project.id}
                  className="p-3 rounded-lg bg-surface border border-border-subtle space-y-2 hover:border-border transition-colors text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <Link
                        to="/projects"
                        className="font-semibold text-foreground hover:text-primary transition-colors block line-clamp-1"
                      >
                        {project.title}
                      </Link>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {project.project_type && (
                          <Badge variant="default" size="sm">
                            {project.project_type.replace('_', ' ')}
                          </Badge>
                        )}
                        {project.priority && (
                          <Badge
                            variant={
                              project.priority === 'critical'
                                ? 'danger'
                                : project.priority === 'high'
                                ? 'warning'
                                : 'secondary'
                            }
                            size="sm"
                          >
                            {project.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-foreground shrink-0">
                      {progress}%
                    </span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <Progress value={progress} className="h-1.5" />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {completedMilestoneCount}/{milestoneCount} milestones
                      </span>
                      {metrics?.taskCount ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {metrics.completedTaskCount}/{metrics.taskCount} tasks
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={<FolderGit2 className="w-6 h-6 text-muted-foreground" />}
              title="No active projects"
              description="Connect your engineering work with portfolio projects and milestone tracking."
              action={
                <Link to="/projects">
                  <Button variant="outline" size="sm" className="text-xs">
                    View Projects
                  </Button>
                </Link>
              }
              className="py-6 border-none bg-transparent"
            />
          )}
        </CardContent>
      </div>
    </Card>
  );
};
