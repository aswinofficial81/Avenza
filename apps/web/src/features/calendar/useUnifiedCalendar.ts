import React from 'react';
import {
  useIntegrationStatus,
  useIntegrationCalendarEvents,
  useSyncIntegration,
} from '../integrations/hooks/useIntegrations';
import { useTasks } from '../tasks/useTasks';
import { useExams, useAssessments } from '../academics/useAcademics';
import { useCareerInterviews } from '../career/hooks/useCareer';
import {
  type UnifiedCalendarEvent,
  type EventCategory,
  CATEGORY_COLORS,
} from './types';

export function useUnifiedCalendar() {
  // 1. Google Calendar Integration Status & Events
  const {
    data: googleStatus,
    isLoading: isGoogleStatusLoading,
  } = useIntegrationStatus('google_calendar');

  const isGoogleConnected = Boolean(
    googleStatus?.connected &&
    googleStatus?.connection &&
    googleStatus.connection.status !== 'DISCONNECTED'
  );

  const {
    data: googleEvents,
    isLoading: isGoogleEventsLoading,
    isError: isGoogleEventsError,
    error: googleEventsError,
    refetch: refetchGoogleEvents,
  } = useIntegrationCalendarEvents('google_calendar', isGoogleConnected);

  const syncMutation = useSyncIntegration();

  // 2. Avenza Tasks
  const {
    data: tasksData,
    isLoading: isTasksLoading,
    isError: isTasksError,
    error: tasksError,
    refetch: refetchTasks,
  } = useTasks({ pageSize: 100 });

  // 3. Academic Exams & Assessments
  const {
    data: examsData,
    isLoading: isExamsLoading,
    isError: isExamsError,
    error: examsError,
    refetch: refetchExams,
  } = useExams();

  const {
    data: assessmentsData,
    isLoading: isAssessmentsLoading,
    isError: isAssessmentsError,
    error: assessmentsError,
    refetch: refetchAssessments,
  } = useAssessments();

  // 4. Career Interviews
  const {
    data: careerInterviewsData,
    isLoading: isCareerLoading,
    isError: isCareerError,
    error: careerError,
    refetch: refetchCareer,
  } = useCareerInterviews();

  // Normalize and combine all event sources
  const events: UnifiedCalendarEvent[] = React.useMemo(() => {
    const list: UnifiedCalendarEvent[] = [];

    // A. Google Calendar Events (External, Read-Only)
    if (googleEvents && Array.isArray(googleEvents)) {
      googleEvents.forEach((item) => {
        if (!item.start_time) return;
        const startDate = new Date(item.start_time);
        const endDate = item.end_time ? new Date(item.end_time) : undefined;

        list.push({
          id: `gcal-${item.id}`,
          title: item.title,
          category: 'external' as EventCategory,
          source: 'google_calendar',
          startDate,
          endDate,
          isAllDay: item.is_all_day,
          isBusy: item.is_busy,
          status: item.status,
          externalUrl: item.html_link || undefined,
          subtitle: item.is_busy ? 'Busy block' : 'Google Calendar',
          color: CATEGORY_COLORS.external,
        });
      });
    }

    // B. Tasks: Deadlines & Scheduled Blocks
    if (tasksData?.data && Array.isArray(tasksData.data)) {
      tasksData.data.forEach((task) => {
        // Scheduled work block
        if (task.scheduled_start) {
          const startDate = new Date(task.scheduled_start);
          const endDate = task.scheduled_end ? new Date(task.scheduled_end) : undefined;
          list.push({
            id: `task-sched-${task.id}`,
            title: task.title,
            category: 'task' as EventCategory,
            source: 'task_scheduled',
            startDate,
            endDate,
            isAllDay: false,
            priority: task.priority,
            status: task.status,
            subtitle: task.goal_title ? `Goal: ${task.goal_title}` : 'Scheduled Task',
            link: `/tasks/${task.id}`,
            color: CATEGORY_COLORS.task,
          });
        }

        // Due date deadline (if distinct from scheduled start)
        if (task.due_at) {
          const startDate = new Date(task.due_at);
          list.push({
            id: `task-due-${task.id}`,
            title: `Deadline: ${task.title}`,
            category: 'task' as EventCategory,
            source: 'task_deadline',
            startDate,
            isAllDay: false,
            priority: task.priority,
            status: task.status,
            subtitle: task.status === 'completed' ? 'Completed' : 'Due date',
            link: `/tasks/${task.id}`,
            color: CATEGORY_COLORS.task,
          });
        }
      });
    }

    // C. Academic Exams
    if (examsData && Array.isArray(examsData)) {
      examsData.forEach((exam) => {
        if (!exam.exam_date) return;
        // Parse date (YYYY-MM-DD or ISO)
        const dateStr = exam.exam_date.includes('T')
          ? exam.exam_date
          : `${exam.exam_date}T09:00:00Z`;
        const startDate = new Date(dateStr);
        const endDate = exam.duration_minutes
          ? new Date(startDate.getTime() + exam.duration_minutes * 60000)
          : undefined;

        list.push({
          id: `exam-${exam.id}`,
          title: `Exam: ${exam.title}`,
          category: 'academics' as EventCategory,
          source: 'academic_exam',
          startDate,
          endDate,
          isAllDay: !exam.duration_minutes,
          status: exam.status,
          subtitle: exam.subject_name ? `Subject: ${exam.subject_name}` : 'Academic Exam',
          link: '/academics',
          color: CATEGORY_COLORS.academics,
        });
      });
    }

    // D. Academic Assessments
    if (assessmentsData && Array.isArray(assessmentsData)) {
      assessmentsData.forEach((assessment) => {
        if (!assessment.due_at) return;
        const startDate = new Date(assessment.due_at);

        list.push({
          id: `asmt-${assessment.id}`,
          title: `Assessment: ${assessment.title}`,
          category: 'academics' as EventCategory,
          source: 'academic_assessment',
          startDate,
          isAllDay: false,
          status: assessment.status,
          subtitle: assessment.subject_name ? `Subject: ${assessment.subject_name}` : 'Assessment Due',
          link: '/academics',
          color: CATEGORY_COLORS.academics,
        });
      });
    }

    // E. Career Interviews
    if (careerInterviewsData?.data && Array.isArray(careerInterviewsData.data)) {
      careerInterviewsData.data.forEach((interview) => {
        if (!interview.scheduled_at) return;
        const startDate = new Date(interview.scheduled_at);
        const endDate = interview.duration_minutes
          ? new Date(startDate.getTime() + interview.duration_minutes * 60000)
          : undefined;

        const roundLabel = interview.round_type
          ? interview.round_type.replace('_', ' ')
          : 'Interview';

        list.push({
          id: `interview-${interview.id}`,
          title: `Round ${interview.round_number}: ${roundLabel}`,
          category: 'career' as EventCategory,
          source: 'career_interview',
          startDate,
          endDate,
          isAllDay: false,
          status: interview.status,
          subtitle: interview.meeting_link ? 'Video meeting scheduled' : 'Career Interview',
          link: '/career',
          externalUrl: interview.meeting_link || undefined,
          color: CATEGORY_COLORS.career,
        });
      });
    }

    // Sort chronologically
    return list.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [
    googleEvents,
    tasksData,
    examsData,
    assessmentsData,
    careerInterviewsData,
  ]);

  const isLoading =
    isGoogleStatusLoading ||
    (isGoogleConnected && isGoogleEventsLoading) ||
    isTasksLoading ||
    isExamsLoading ||
    isAssessmentsLoading ||
    isCareerLoading;

  const isError =
    (isGoogleConnected && isGoogleEventsError) ||
    isTasksError ||
    isExamsError ||
    isAssessmentsError ||
    isCareerError;

  const refetchAll = React.useCallback(() => {
    if (isGoogleConnected) refetchGoogleEvents();
    refetchTasks();
    refetchExams();
    refetchAssessments();
    refetchCareer();
  }, [
    isGoogleConnected,
    refetchGoogleEvents,
    refetchTasks,
    refetchExams,
    refetchAssessments,
    refetchCareer,
  ]);

  const handleSyncGoogle = async () => {
    await syncMutation.mutateAsync('google_calendar');
  };

  return {
    events,
    isLoading,
    isError,
    googleStatus,
    isGoogleConnected,
    isSyncing: syncMutation.isPending,
    handleSyncGoogle,
    refetchAll,
    errors: {
      google: googleEventsError,
      tasks: tasksError,
      exams: examsError,
      assessments: assessmentsError,
      career: careerError,
    },
  };
}
