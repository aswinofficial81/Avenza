import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { GitCommit, GitPullRequest, ExternalLink, ShieldAlert } from 'lucide-react';
import type { ExternalActivityDto } from '@avenza/shared';

export interface ProjectActivityTimelineProps {
  activities?: ExternalActivityDto[];
  hasRepository: boolean;
}

export const ProjectActivityTimeline: React.FC<ProjectActivityTimelineProps> = ({
  activities = [],
  hasRepository,
}) => {
  if (!hasRepository) {
    return (
      <EmptyState
        title="No Repository Linked"
        description="Link a GitHub repository to stream external commit and pull request signals."
      />
    );
  }

  if (activities.length === 0) {
    return (
      <EmptyState
        title="No External Activity"
        description="No recent commits or pull requests found for this linked repository. Run a manual sync to check for updates."
      />
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pull_request':
        return <GitPullRequest className="w-4 h-4 text-warning" />;
      case 'commit':
      case 'push':
      default:
        return <GitCommit className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Contextual signal boundary notice */}
      <div className="p-3 rounded border border-border/60 bg-surface-2/40 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary/80 shrink-0" />
          <span>
            <strong>Contextual Signals:</strong> External GitHub activities reflect synced provider events. They do not alter project progress, milestone completion, or task states.
          </span>
        </div>
        <Badge variant="secondary" className="text-2xs shrink-0 uppercase tracking-wider">
          Read Only
        </Badge>
      </div>

      <div className="relative pl-6 space-y-4 border-l border-border/60 ml-3">
        {activities.map((act) => (
          <div key={act.id} className="relative group">
            {/* Timeline node */}
            <div className="absolute -left-[31px] top-1 p-1 rounded-full bg-surface border border-border/80 group-hover:border-primary transition-colors">
              {getActivityIcon(act.activity_type)}
            </div>

            <Card className="p-3.5 space-y-1.5 border-border/80 hover:border-border transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-2xs uppercase">
                    {act.activity_type.replace('_', ' ')}
                  </Badge>
                  <h4 className="text-sm font-medium text-foreground">
                    {act.title}
                  </h4>
                </div>
                {act.external_url && (
                  <a
                    href={act.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    title="View on GitHub"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {act.summary && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {act.summary}
                </p>
              )}

              <div className="flex items-center gap-2 text-2xs text-muted-foreground pt-1">
                <span>{new Date(act.occurred_at).toLocaleString()}</span>
                {typeof act.metadata?.branch === 'string' && (
                  <>
                    <span>&bull;</span>
                    <span>branch: {act.metadata.branch}</span>
                  </>
                )}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
