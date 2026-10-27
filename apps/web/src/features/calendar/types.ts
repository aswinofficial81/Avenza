export type EventCategory = 'external' | 'task' | 'academics' | 'career';

export type EventSource =
  | 'google_calendar'
  | 'task_deadline'
  | 'task_scheduled'
  | 'academic_exam'
  | 'academic_assessment'
  | 'career_interview';

export type CalendarViewMode = 'month' | 'week' | 'agenda';

export interface EventColorConfig {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export interface UnifiedCalendarEvent {
  id: string;
  title: string;
  category: EventCategory;
  source: EventSource;
  startDate: Date;
  endDate?: Date;
  isAllDay: boolean;
  isBusy?: boolean;
  priority?: string;
  status?: string;
  subtitle?: string;
  link?: string;
  externalUrl?: string;
  metadata?: Record<string, unknown>;
  color: EventColorConfig;
}

export const CATEGORY_COLORS: Record<EventCategory, EventColorConfig> = {
  external: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/20',
    border: 'border-sky-500/30',
    text: 'text-sky-800 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  task: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  academics: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    border: 'border-purple-500/30',
    text: 'text-purple-800 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  career: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    border: 'border-emerald-500/30',
    text: 'text-emerald-800 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
};
