import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useDsaProblems } from '@/features/dsa/hooks/use-dsa-problems';
import { Link } from 'react-router-dom';

export const DsaProblemsList: React.FC = () => {
  const { data, isLoading, error } = useDsaProblems();

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>DSA Problems</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="animate-pulse">Loading problems...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>DSA Problems</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-destructive">
          <div>Error loading problems: {error.message}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center">
        <CardTitle>DSA Problems</CardTitle>
        <Link to="/dsa/problems/create" className="btn btn-primary">
          Add Problem
        </Link>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No problems found. Create your first DSA problem to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((problem) => (
              <div key={problem.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{problem.title}</h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="badge bg-secondary">{problem.difficulty}</span>
                      {/* Topics display would require API enhancement to include related data */}
                    </div>
                  </div>
                  <div className="text-right text-sm space-y-1">
                    <div>Solved: {problem.solved_count}/{problem.attempt_count}</div>
                    {problem.next_review_at && (
                      <div className="text-xs">
                        Revision due: {new Date(problem.next_review_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex justify-between">
                  <Link to={`/dsa/problems/${problem.id}`} className="btn btn-sm btn-outline">
                    View Details
                  </Link>
                  <Link to={`/dsa/problems/${problem.id}/attempt`} className="btn btn-sm btn-outline">
                    Record Attempt
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};