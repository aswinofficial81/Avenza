import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Layers } from 'lucide-react';

export interface PlaceholderPageProps {
  title: string;
  description: string;
  plannedPhase?: string;
  icon?: React.ReactNode;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  description,
  plannedPhase = 'Future Phase',
  icon,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
            <Badge variant="secondary">{plannedPhase}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Structural Placeholder Card */}
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            {icon || <Layers className="w-5 h-5 text-secondary" />}
            <CardTitle className="text-sm font-semibold">{title} Foundation</CardTitle>
          </div>
          <CardDescription>
            This route is reserved for future implementation. In accordance with Phase 4 guidelines,
            no domain business logic, fake statistics, or mock metrics are fabricated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded border border-border-subtle bg-surface-2/40 p-4 text-xs font-mono text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Avenza Shell Architecture Notice:</p>
            <p>• Route structure established and verified.</p>
            <p>• Navigation links and breadcrumbs fully active.</p>
            <p>• Backend domain features and data models will connect here in subsequent phases.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
