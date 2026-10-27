import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Briefcase, CalendarClock } from 'lucide-react';
import { useAcademicsOverview } from '../../academics/useAcademics';
import { useCareerInterviews } from '../../career/hooks/useCareer';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';

interface UpcomingItem {
  id: string;
  type: 'exam' | 'interview';
  title: string;
  subtitle?: string;
  dateStr: string;
  link: string;
}

export const OverviewUpcomingWidget: React.FC = () => {
  const {
    data: academicsData,
    isLoading: isAcademicsLoading,
    isError: isAcademicsError,
    error: academicsError,
    refetch: refetchAcademics,
  } = useAcademicsOverview();

  const {
    data: careerData,
    isLoading: isCareerLoading,
    isError: isCareerError,
    error: careerError,
    refetch: refetchCareer,
  } = useCareerInterviews({ status: 'scheduled' });

  const isLoading = isAcademicsLoading || isCareerLoading;
  const isError = isAcademicsError && isCareerError;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-14" />
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <Skeleton className="h-14 w-full rounded" />
          <Skeleton className="h-14 w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold">Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ErrorState
            title="Unable to load upcoming deadlines"
            description={
              (academicsError as Error)?.message ||
              (careerError as Error)?.message ||
              'Failed to fetch deadlines.'
            }
            onRetry={() => {
              refetchAcademics();
              refetchCareer();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  const items: UpcomingItem[] = [];

  // Add academic exams
  if (academicsData?.upcoming_exams) {
    academicsData.upcoming_exams.forEach((exam) => {
      items.push({
        id: `exam-${exam.id}`,
        type: 'exam',
        title: exam.title,
        subtitle: exam.subject_name || undefined,
        dateStr: exam.exam_date,
        link: '/academics',
      });
    });
  }

  // Add scheduled career interviews
  if (careerData?.data) {
    careerData.data.forEach((interview) => {
      if (interview.scheduled_at) {
        items.push({
          id: `interview-${interview.id}`,
          type: 'interview',
          title: `Round ${interview.round_number}: ${interview.round_type.replace('_', ' ')}`,
          subtitle: `Scheduled interview`,
          dateStr: interview.scheduled_at,
          link: '/career',
        });
      }
    });
  }

  // Sort chronologically by date
  items.sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());

  const displayItems = items.slice(0, 4);

  return (
    <Card className="h-full flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Upcoming Deadlines</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/academics">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                  Exams
                </Button>
              </Link>
              <Link to="/career">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                  Interviews
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          {displayItems.length > 0 ? (
            displayItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border-subtle hover:border-border transition-colors text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0 pr-2">
                  <div className="p-1.5 rounded bg-surface-2 border border-border-subtle shrink-0 mt-0.5">
                    {item.type === 'exam' ? (
                      <GraduationCap className="w-3.5 h-3.5 text-sky-500" />
                    ) : (
                      <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <Link
                      to={item.link}
                      className="font-semibold text-foreground hover:text-primary transition-colors block line-clamp-1"
                    >
                      {item.title}
                    </Link>
                    {item.subtitle && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 gap-1">
                  <Badge variant={item.type === 'exam' ? 'info' : 'warning'} size="sm">
                    {item.type === 'exam' ? 'Exam' : 'Interview'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(item.dateStr).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              icon={<CalendarClock className="w-6 h-6 text-muted-foreground" />}
              title="No upcoming deadlines"
              description="No exams or interviews scheduled in the near future."
              action={
                <div className="flex items-center gap-2">
                  <Link to="/academics">
                    <Button variant="outline" size="sm" className="text-xs">
                      Academics
                    </Button>
                  </Link>
                  <Link to="/career">
                    <Button variant="outline" size="sm" className="text-xs">
                      Career
                    </Button>
                  </Link>
                </div>
              }
              className="py-6 border-none bg-transparent"
            />
          )}
        </CardContent>
      </div>
    </Card>
  );
};
