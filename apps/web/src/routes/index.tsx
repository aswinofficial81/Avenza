import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { OverviewPage } from './OverviewPage';
import { SettingsPage } from './SettingsPage';
import { DesignSystemShowcase } from './DesignSystemShowcase';
import { GoalsPage } from './GoalsPage';
import { GoalDetailPage } from './GoalDetailPage';
import { TasksPage } from './TasksPage';
import { TaskDetailPage } from './TaskDetailPage';
import { TodayPage } from './TodayPage';
import { FocusPage } from './FocusPage';
import { FocusHistoryPage } from './FocusHistoryPage';
import { EvidencePage } from './EvidencePage';
import { TermsPage } from './TermsPage';
import { SubjectsPage } from './SubjectsPage';
import { SubjectDetailPage } from './SubjectDetailPage';
import { AssessmentsPage } from './AssessmentsPage';
import { ExamsPage } from './ExamsPage';
import { AcademicsOverviewPage } from './AcademicsOverviewPage';
import { SkillsPage } from './SkillsPage';
import { SkillDetailPage } from './SkillDetailPage';
import { PlaceholderPage } from './PlaceholderPage';

export const AppRoutes: React.FC = () => {
  return (
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
      <Route
        path="/dsa"
        element={
          <PlaceholderPage
            title="Data Structures & Algorithms"
            description="Algorithmic problem tracking, pattern mastery, and revision intervals."
            plannedPhase="DSA Phase"
          />
        }
      />
      <Route
        path="/projects"
        element={
          <PlaceholderPage
            title="Projects"
            description="Technical project workspaces, feature roadmaps, and dev milestones."
            plannedPhase="Projects Phase"
          />
        }
      />
      <Route
        path="/career"
        element={
          <PlaceholderPage
            title="Career"
            description="Target roles, job applications, portfolio assets, and interview prep."
            plannedPhase="Career Phase"
          />
        }
      />
      <Route path="/goals" element={<GoalsPage />} />
      <Route path="/goals/:id" element={<GoalDetailPage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/tasks/:id" element={<TaskDetailPage />} />
      <Route
        path="/calendar"
        element={
          <PlaceholderPage
            title="Calendar"
            description="Unified schedule view with external calendar synchronization."
            plannedPhase="Calendar Phase"
          />
        }
      />
      <Route
        path="/planner"
        element={
          <PlaceholderPage
            title="Adaptive Planner"
            description="Dynamic schedule optimization and work session orchestration."
            plannedPhase="Planner Phase"
          />
        }
      />
      <Route
        path="/analytics"
        element={
          <PlaceholderPage
            title="Analytics"
            description="Personal velocity, focus metrics, and productivity diagnostics."
            plannedPhase="Analytics Phase"
          />
        }
      />
      <Route
        path="/weekly-review"
        element={
          <PlaceholderPage
            title="Weekly Review"
            description="Structured retrospective, habit audits, and plan recalibration."
            plannedPhase="Review Phase"
          />
        }
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
  );
};
