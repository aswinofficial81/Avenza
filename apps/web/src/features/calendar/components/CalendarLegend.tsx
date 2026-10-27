import React from 'react';
import { Calendar, CheckCircle2, GraduationCap, Briefcase } from 'lucide-react';
import { CATEGORY_COLORS, type EventCategory } from '../types';
import { cn } from '../../../lib/utils';

interface LegendItem {
  category: EventCategory;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const ITEMS: LegendItem[] = [
  {
    category: 'external',
    label: 'Google Calendar',
    description: 'External events & busy time (Read-only)',
    icon: <Calendar className="w-3.5 h-3.5" />,
  },
  {
    category: 'task',
    label: 'Tasks',
    description: 'Scheduled work blocks & deadlines',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  {
    category: 'academics',
    label: 'Academics',
    description: 'Exams & course assessments',
    icon: <GraduationCap className="w-3.5 h-3.5" />,
  },
  {
    category: 'career',
    label: 'Career',
    description: 'Scheduled interview rounds',
    icon: <Briefcase className="w-3.5 h-3.5" />,
  },
];

export const CalendarLegend: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      role="region"
      aria-label="Calendar event types legend"
      className={cn('flex flex-wrap items-center gap-4 text-xs select-none', className)}
    >
      {ITEMS.map((item) => {
        const colors = CATEGORY_COLORS[item.category];
        return (
          <div
            key={item.category}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface-2 border border-border-subtle"
            title={item.description}
          >
            <span className={cn('w-2 h-2 rounded-full shrink-0', colors.dot)} />
            <span className={cn('text-muted-foreground shrink-0')}>{item.icon}</span>
            <span className="font-medium text-foreground">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};
