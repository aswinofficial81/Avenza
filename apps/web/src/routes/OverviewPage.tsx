import React from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Compass,
  CheckCircle2,
  Clock,
  Flame,
  Target,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToday } from '../features/today/useToday';
import {
  OverviewFocusBanner,
  OverviewNextActionWidget,
  OverviewTodayWidget,
  OverviewGoalsWidget,
  OverviewDsaWidget,
  OverviewUpcomingWidget,
  OverviewProjectsWidget,
} from '../features/overview/components';

export const OverviewPage: React.FC = () => {
  const { user } = useUser();
  const { data: todayData } = useToday();

  const formattedDate = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return new Date().toDateString();
    }
  }, []);

  const greeting = user?.firstName
    ? `Welcome back, ${user.firstName}`
    : user?.fullName
      ? `Welcome back, ${user.fullName}`
      : 'Welcome to your workspace';

  const summary = todayData?.summary;
  const productivityStreak = todayData?.productivityStreak;

  const completedCount =
    summary?.completedTaskCount ??
    (todayData?.completedToday?.length ?? 0);

  const activeCount =
    (todayData?.dueToday?.length ?? 0) +
    (todayData?.scheduledToday?.length ?? 0);

  const totalTasks = completedCount + activeCount;

  // Meaningful study time recorded for today.
  const totalMins = summary?.meaningfulMinutes ?? 0;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  const studyTimeFormatted =
    totalMins > 0
      ? `${hours > 0 ? `${hours}h ` : ''}${mins}m`
      : '0m';

  // Completed focus-session time for today.
  const focusMinutes = summary?.focusMinutes ?? 0;
  const focusHours = Math.floor(focusMinutes / 60);
  const remainingFocusMinutes = focusMinutes % 60;

  const focusTimeFormatted =
    focusMinutes > 0
      ? `${focusHours > 0 ? `${focusHours}h ` : ''}${remainingFocusMinutes}m`
      : '0m';

  const currentStreak = productivityStreak?.currentDays;
  const bestStreak = productivityStreak?.bestDays;

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Overview
            </h1>

            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/20 font-medium">
              Good evening! 👋
            </span>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground/80">
              {greeting}
            </span>
            <span>•</span>
            <span>{formattedDate}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/planner">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 rounded-xl"
            >
              <Compass className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
              Planner
            </Button>
          </Link>

          <Link to="/today">
            <Button
              variant="primary"
              size="sm"
              className="text-xs h-8 rounded-xl gap-1"
            >
              <Calendar className="w-3.5 h-3.5" />
              Open Today
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tasks Done */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs hover:border-emerald-500/30 transition-all flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium leading-none">
              Tasks done
            </p>

            <p className="font-mono font-bold text-lg sm:text-xl text-foreground mt-1">
              {completedCount}{' '}
              <span className="text-xs text-muted-foreground font-normal">
                / {totalTasks}
              </span>
            </p>
          </div>
        </div>

        {/* Card 2: Study Time */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs hover:border-blue-500/30 transition-all flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium leading-none">
              Study time
            </p>

            <p className="font-mono font-bold text-lg sm:text-xl text-foreground mt-1">
              {studyTimeFormatted}
            </p>
          </div>
        </div>

        {/* Card 3: Productivity Streak */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs hover:border-amber-500/30 transition-all flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium leading-none">
              Productivity Streak
            </p>

            <p className="font-mono font-bold text-lg sm:text-xl text-foreground mt-1">
              {currentStreak !== undefined
                ? `${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}`
                : '—'}
            </p>

            <p className="text-[10px] leading-tight text-muted-foreground mt-1">
              {bestStreak !== undefined
                ? `Best: ${bestStreak} ${bestStreak === 1 ? 'day' : 'days'}`
                : 'Streak data unavailable'}
            </p>
          </div>
        </div>

        {/* Card 4: Focus Time */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs hover:border-teal-500/30 transition-all flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-600 dark:text-[#2DE2C5] flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium leading-none">
              Focus Time
            </p>

            <p className="font-mono font-bold text-lg sm:text-xl text-foreground mt-1">
              {focusTimeFormatted}
            </p>

            <p className="text-[10px] leading-tight text-muted-foreground mt-1">
              Recorded focus sessions today
            </p>
          </div>
        </div>
      </div>

      {/* Active Focus Session */}
      <OverviewFocusBanner />

      {/* Row 1: Primary Execution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <OverviewNextActionWidget />
        <OverviewTodayWidget />
      </div>

      {/* Row 2: Tactical Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <OverviewGoalsWidget />
        <OverviewDsaWidget />
      </div>

      {/* Row 3: Horizon & Artifacts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <OverviewUpcomingWidget />
        <OverviewProjectsWidget />
      </div>
    </div>
  );
};