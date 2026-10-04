import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useDsaOverview } from '@/features/dsa/hooks/use-dsa-overview';

export const DsaOverview: React.FC = () => {
  const { data, isLoading, error } = useDsaOverview();

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>DSA Overview</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="animate-pulse">Loading overview...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>DSA Overview</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-destructive">
          <div>Error loading overview: {error.message}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>DSA Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-muted p-4 rounded-lg">
            <div className="text-sm font-medium text-muted-foreground">Total Problems</div>
            <div className="text-2xl font-semibold">{data?.total_problems ?? 0}</div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="text-sm font-medium text-muted-foreground">Solved Problems</div>
            <div className="text-2xl font-semibold">{data?.solved_problems ?? 0}</div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="text-sm font-medium text-muted-foreground">Attempted Problems</div>
            <div className="text-2xl font-semibold">{data?.attempted_problems ?? 0}</div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="text-sm font-medium text-muted-foreground">Revision Due</div>
            <div className="text-2xl font-semibold">{data?.revision_due_count ?? 0}</div>
          </div>
        </div>

        {data?.weak_areas && data.weak_areas.length > 0 && (
          <>
            <div className="text-sm font-medium text-muted-foreground mb-2">Weak Areas</div>
            <div className="space-y-2">
              {data.weak_areas.map((area, index) => (
                <div key={index} className="text-sm">
                  <div className="flex justify-between">
                    <span>{area.topic_name}</span>
                    <span className="text-muted-foreground">{area.problem_count} problems</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{area.reason}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {data?.recommended_problem && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm font-medium text-muted-foreground mb-2">Recommended Next Problem</div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="font-medium">{data.recommended_problem.title}</div>
              <div className="text-xs text-muted-foreground">{data.recommended_problem.reason}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};