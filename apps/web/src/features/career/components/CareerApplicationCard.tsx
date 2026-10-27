import React from 'react';
import { Link } from 'react-router-dom';
import type { CareerApplicationDto, CareerApplicationStage, CareerOpportunityDto } from '@avenza/shared';
import { isTerminalStage } from '@avenza/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import {
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export interface CareerApplicationCardProps {
  application: CareerApplicationDto;
  opportunity?: CareerOpportunityDto;
  onQuickTransition?: (application: CareerApplicationDto) => void;
}

export function getStageBadgeVariant(stage: CareerApplicationStage): 'default' | 'secondary' | 'success' | 'warning' | 'danger' {
  switch (stage) {
    case 'saved':
      return 'secondary';
    case 'applied':
      return 'default';
    case 'screening':
    case 'assessment':
    case 'interview':
      return 'warning';
    case 'offer':
    case 'accepted':
      return 'success';
    case 'declined':
    case 'rejected':
    case 'withdrawn':
    case 'closed':
      return 'danger';
    default:
      return 'secondary';
  }
}

export const CareerApplicationCard: React.FC<CareerApplicationCardProps> = ({
  application,
  opportunity,
  onQuickTransition,
}) => {
  const isTerminal = isTerminalStage(application.stage);
  const company = opportunity?.company_name || 'Opportunity';
  const role = opportunity?.role_title || 'Role';

  return (
    <div
      className="group relative flex flex-col justify-between p-3.5 rounded-lg border border-border bg-surface hover:border-border-subtle hover:shadow-sm transition-all text-xs"
      data-testid={`application-card-${application.id}`}
    >
      <div className="space-y-2">
        {/* Top header: Role & Stage badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/career/applications/${application.id}`}
              className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1 group-hover:underline text-sm"
              title={`${role} at ${company}`}
            >
              {role}
            </Link>
            <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-medium">{company}</span>
            </div>
          </div>

          <Badge variant={getStageBadgeVariant(application.stage)} className="capitalize shrink-0">
            {application.stage}
          </Badge>
        </div>

        {/* Opportunity details (Location, Salary) */}
        {opportunity && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-1">
            {opportunity.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {opportunity.location} {opportunity.location_type ? `(${opportunity.location_type})` : ''}
                </span>
              </div>
            )}

            {(opportunity.salary_min != null || opportunity.salary_max != null) && (
              <div className="flex items-center gap-1 font-mono text-foreground font-medium">
                <DollarSign className="w-3 h-3 shrink-0 text-muted-foreground" />
                <span>
                  {opportunity.salary_currency || '$'}
                  {opportunity.salary_min != null ? opportunity.salary_min.toLocaleString() : ''}
                  {opportunity.salary_min != null && opportunity.salary_max != null ? ' - ' : ''}
                  {opportunity.salary_max != null ? opportunity.salary_max.toLocaleString() : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Dates */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground border-t border-border-subtle pt-2">
          {application.applied_at && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
              <span>Applied: {new Date(application.applied_at).toLocaleDateString()}</span>
            </div>
          )}

          {application.deadline && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>Deadline: {new Date(application.deadline).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-border-subtle">
        {!isTerminal && onQuickTransition && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            leftIcon={<RefreshCw className="w-3 h-3" />}
            onClick={() => onQuickTransition(application)}
            title="Update Stage"
          >
            Advance Stage
          </Button>
        )}

        <Link
          to={`/career/applications/${application.id}`}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          <span>Workspace</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};
