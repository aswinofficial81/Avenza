import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const OverviewPage = lazy(() =>
  import('./OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const SettingsPage = lazy(() =>
  import('./SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const DesignSystemShowcase = lazy(() =>
  import('./DesignSystemShowcase').then((m) => ({
    default: m.DesignSystemShowcase,
  })),
);
const GoalsPage = lazy(() =>
  import('./GoalsPage').then((m) => ({ default: m.GoalsPage })),
);
const GoalDetailPage = lazy(() =>
  import('./GoalDetailPage').then((m) => ({ default: m.GoalDetailPage })),
);
const TasksPage = lazy(() =>
  import('./TasksPage').then((m) => ({ default: m.TasksPage })),
);
const TaskDetailPage = lazy(() =>
  import('./TaskDetailPage').then((m) => ({ default: m.TaskDetailPage })),
);
const TodayPage = lazy(() =>
  import('./TodayPage').then((m) => ({ default: m.TodayPage })),
);
const FocusPage = lazy(() =>
  import('./FocusPage').then((m) => ({ default: m.FocusPage })),
);
const FocusHistoryPage = lazy(() =>
  import('./FocusHistoryPage').then((m) => ({ default: m.FocusHistoryPage })),
);
const EvidencePage = lazy(() =>
  import('./EvidencePage').then((m) => ({ default: m.EvidencePage })),
);
const TermsPage = lazy(() =>
  import('./TermsPage').then((m) => ({ default: m.TermsPage })),
);
const SubjectsPage = lazy(() =>
  import('./SubjectsPage').then((m) => ({ default: m.SubjectsPage })),
);
const SubjectDetailPage = lazy(() =>
  import('./SubjectDetailPage').then((m) => ({ default: m.SubjectDetailPage })),
);
const AssessmentsPage = lazy(() =>
  import('./AssessmentsPage').then((m) => ({ default: m.AssessmentsPage })),
);
const ExamsPage = lazy(() =>
  import('./ExamsPage').then((m) => ({ default: m.ExamsPage })),
);
const AcademicsOverviewPage = lazy(() =>
  import('./AcademicsOverviewPage').then((m) => ({
    default: m.AcademicsOverviewPage,
  })),
);
const SkillsPage = lazy(() =>
  import('./SkillsPage').then((m) => ({ default: m.SkillsPage })),
);
const SkillDetailPage = lazy(() =>
  import('./SkillDetailPage').then((m) => ({ default: m.SkillDetailPage })),
);
const DsaPage = lazy(() =>
  import('./DsaPage').then((m) => ({ default: m.DsaPage })),
);
const DsaAttemptForm = lazy(() =>
  import('../features/dsa/components/DsaAttemptForm').then((m) => ({
    default: m.DsaAttemptForm,
  })),
);
const DsaTopicsPage = lazy(() =>
  import('../features/dsa/pages/DsaTopicsPage').then((m) => ({
    default: m.DsaTopicsPage,
  })),
);
const DsaTopicForm = lazy(() =>
  import('../features/dsa/components/DsaTopicForm').then((m) => ({
    default: m.DsaTopicForm,
  })),
);
const DsaProblemsPage = lazy(() =>
  import('../features/dsa/pages/DsaProblemsPage').then((m) => ({
    default: m.DsaProblemsPage,
  })),
);
const DsaProblemForm = lazy(() =>
  import('../features/dsa/components/DsaProblemForm').then((m) => ({
    default: m.DsaProblemForm,
  })),
);
const DsaProblemDetailPage = lazy(() =>
  import('../features/dsa/pages/DsaProblemDetailPage').then((m) => ({
    default: m.DsaProblemDetailPage,
  })),
);
const ProjectDetailPage = lazy(() =>
  import('../features/projects/pages/ProjectDetailPage').then((m) => ({
    default: m.ProjectDetailPage,
  })),
);
const ProjectsOverviewPage = lazy(() =>
  import('../features/projects/pages/ProjectsOverviewPage').then((m) => ({
    default: m.ProjectsOverviewPage,
  })),
);
const CareerPipelinePage = lazy(() =>
  import('../features/career/pages/CareerPipelinePage').then((m) => ({
    default: m.CareerPipelinePage,
  })),
);
const CareerApplicationDetailPage = lazy(() =>
  import('../features/career/pages/CareerApplicationDetailPage').then((m) => ({
    default: m.CareerApplicationDetailPage,
  })),
);
const CalendarPage = lazy(() =>
  import('./CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
const PlannerPage = lazy(() =>
  import('./PlannerPage').then((m) => ({ default: m.PlannerPage })),
);
const AnalyticsPage = lazy(() =>
  import('./AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const PlaceholderPage = lazy(() =>
  import('./PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })),
);
const WeeklyReviewPage = lazy(() =>
  import('./WeeklyReviewPage').then((m) => ({
    default: m.WeeklyReviewPage,
  })),
);
export const AppRoutes: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-[40vh] items-center justify-center p-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 text-sm text-foreground/70">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
              aria-hidden="true"
            />
            Loading page...
          </div>
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/focus" element={<FocusPage />} />
        <Route path="/focus/history" element={<FocusHistoryPage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="/academics" element={<AcademicsOverviewPage />} />
        <Route path="/academics/overview" element={<AcademicsOverviewPage />} />
        <Route path="/academics/terms" element={<TermsPage />} />
        <Route path="/academics/subjects" element={<SubjectsPage />} />
        <Route path="/academics/subjects/:id" element={<SubjectDetailPage />} />
        <Route path="/academics/assessments" element={<AssessmentsPage />} />
        <Route path="/academics/exams" element={<ExamsPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/skills/:id" element={<SkillDetailPage />} />
        <Route path="/dsa" element={<DsaPage />} />
        <Route path="/dsa/problems" element={<DsaProblemsPage />} />
        <Route path="/dsa/problems/create" element={<DsaProblemForm />} />
        <Route path="/dsa/problems/:problemId" element={<DsaProblemDetailPage />} />
        <Route path="/dsa/problems/:problemId/edit" element={<DsaProblemForm />} />
        <Route path="/dsa/problems/:problemId/attempt" element={<DsaAttemptForm />} />
        <Route path="/dsa/topics" element={<DsaTopicsPage />} />
        <Route path="/dsa/topics/create" element={<DsaTopicForm />} />
        <Route path="/dsa/topics/:topicId" element={<DsaTopicForm />} />
        <Route path="/projects" element={<ProjectsOverviewPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/career" element={<CareerPipelinePage />} />
        <Route path="/career/applications/:id" element={<CareerApplicationDetailPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/goals/:id" element={<GoalDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route
          path="/weekly-review"
          element={<WeeklyReviewPage />}
        />
        <Route
          path="/ai-coach"
          element={
            <PlaceholderPage
              title="AI Coach"
              description="Intelligent feedback, performance coaching, and learning advice."
              plannedPhase="AI Phase"
            />
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/design-system" element={<DesignSystemShowcase />} />
        {/* Wildcard fallback */}
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </Suspense>
  );
};
