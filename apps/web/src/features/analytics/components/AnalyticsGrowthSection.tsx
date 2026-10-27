import React from 'react';
import type { AnalyticsGrowthSummary } from '@avenza/shared';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Award, Target, FolderKanban, Sparkles, Info } from 'lucide-react';

export interface AnalyticsGrowthSectionProps {
  growth: AnalyticsGrowthSummary;
}

export const AnalyticsGrowthSection: React.FC<AnalyticsGrowthSectionProps> = ({ growth }) => {
  return (
    <Card className="overflow-hidden border-border/60 bg-surface/80 backdrop-blur-xs flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border-subtle flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Milestones & Verified Evidence
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Progress markers achieved and evidence logged during this period
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Evidence Recorded */}
            <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-2/30 space-y-1.5 transition-all hover:border-indigo-500/30">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">
                  New Evidence
                </span>
                <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-500">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {growth.newEvidenceCount}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Evidence artifacts recorded
              </p>
            </div>

            {/* 2. Goal Milestones */}
            <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-2/30 space-y-1.5 transition-all hover:border-emerald-500/30">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">
                  Goal Milestones
                </span>
                <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500">
                  <Target className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {growth.completedGoalMilestonesCount}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Milestones completed in period
              </p>
            </div>

            {/* 3. Project Milestones */}
            <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-2/30 space-y-1.5 transition-all hover:border-cyan-500/30">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">
                  Project Milestones
                </span>
                <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-500">
                  <FolderKanban className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {growth.completedProjectMilestonesCount}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Deliverables completed in period
              </p>
            </div>

            {/* 4. Active Goals */}
            <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-2/30 space-y-1.5 transition-all hover:border-border">
              <div className="flex items-center justify-between text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">
                    Active Goals
                  </span>
                  <Badge variant="default" className="text-[10px] px-1 py-0 h-4 border-border-subtle text-muted-foreground font-mono">
                    Current
                  </Badge>
                </div>
                <div className="p-1 rounded-md bg-muted/40 text-muted-foreground">
                  <Target className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {growth.currentActiveGoalsCount}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Currently active target goals
              </p>
            </div>
          </div>
        </CardContent>
      </div>

      <div className="px-4 pb-4">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-2 border-t border-border-subtle">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            <strong>Skill Mastery Notice:</strong> Skill mastery is dynamically computed from currently verified evidence. Historical mastery time series are omitted because prior snapshots were not stored.
          </span>
        </p>
      </div>
    </Card>
  );
};
