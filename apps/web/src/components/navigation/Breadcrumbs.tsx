import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

// Route mapping for automatic breadcrumb derivation if items not explicitly passed
const ROUTE_LABELS: Record<string, string> = {
  overview: 'Overview',
  today: 'Today',
  academics: 'Academics',
  terms: 'Terms',
  subjects: 'Subjects',
  exams: 'Exams',
  dsa: 'DSA',
  build: 'Build',
  projects: 'Projects',
  career: 'Career',
  plan: 'Plan',
  goals: 'Goals',
  tasks: 'Tasks',
  calendar: 'Calendar',
  planner: 'Planner',
  insights: 'Insights',
  analytics: 'Analytics',
  'weekly-review': 'Weekly Review',
  ai: 'AI',
  'ai-coach': 'AI Coach',
  settings: 'Settings',
  'design-system': 'Design System',
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className }) => {
  const location = useLocation();

  // If items not provided, parse from pathname
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => {
    if (items && items.length > 0) return items;

    const pathSegments = location.pathname.split('/').filter(Boolean);
    if (pathSegments.length === 0) {
      return [{ label: 'Overview', href: '/overview', isCurrent: true }];
    }

    const generated: BreadcrumbItem[] = [
      { label: 'Home', href: '/overview', isCurrent: false },
    ];

    let accumulatedPath = '';
    pathSegments.forEach((segment, index) => {
      accumulatedPath += `/${segment}`;
      const isCurrent = index === pathSegments.length - 1;
      const label = ROUTE_LABELS[segment.toLowerCase()] || segment.charAt(0).toUpperCase() + segment.slice(1);

      generated.push({
        label,
        href: isCurrent ? undefined : accumulatedPath,
        isCurrent,
      });
    });

    return generated;
  }, [items, location.pathname]);

  return (
    <nav aria-label="Breadcrumbs" className={cn('flex items-center text-xs select-none', className)}>
      <ol className="flex items-center space-x-1.5 overflow-hidden">
        {breadcrumbItems.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === breadcrumbItems.length - 1;

          return (
            <li
              key={item.label + index}
              className={cn(
                'flex items-center min-w-0',
                // On very small screens, hide intermediate breadcrumbs if there are > 2
                !isFirst && !isLast && breadcrumbItems.length > 2 ? 'hidden sm:flex' : 'flex'
              )}
            >
              {index > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mx-1" aria-hidden="true" />
              )}
              {item.isCurrent || !item.href ? (
                <span
                  aria-current="page"
                  className="font-medium text-foreground truncate max-w-[140px] sm:max-w-none"
                >
                  {isFirst && item.label === 'Home' ? (
                    <span className="flex items-center gap-1">
                      <Home className="w-3.5 h-3.5" />
                      <span className="sr-only">Home</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px] sm:max-w-none flex items-center gap-1"
                >
                  {isFirst && item.label === 'Home' ? (
                    <>
                      <Home className="w-3.5 h-3.5" />
                      <span className="sr-only">Home</span>
                    </>
                  ) : (
                    item.label
                  )}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
