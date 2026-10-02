import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { OverviewPage } from './OverviewPage';
import { SettingsPage } from './SettingsPage';
import { DesignSystemShowcase } from './DesignSystemShowcase';
import { PlaceholderPage } from './PlaceholderPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<OverviewPage />} />
      <Route
        path="/today"
        element={
          <PlaceholderPage
            title="Today"
            description="Daily command center and real-time execution workflow."
            plannedPhase="Phase 5"
          />
        }
      />
      <Route
        path="/academics/terms"
        element={
          <PlaceholderPage
            title="Academic Terms"
            description="Semester, term schedules, and academic milestone tracking."
            plannedPhase="Academics Phase"
          />
        }
      />
      <Route
        path="/academics/subjects"
        element={
          <PlaceholderPage
            title="Subjects & Courses"
            description="Course syllabi, lecture tracking, and topic mastery."
            plannedPhase="Academics Phase"
          />
        }
      />
      <Route
        path="/academics/exams"
        element={
          <PlaceholderPage
            title="Exams & Assessments"
            description="Exam countdowns, syllabus preparation, and grading targets."
            plannedPhase="Academics Phase"
          />
        }
      />
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
      <Route
        path="/goals"
        element={
          <PlaceholderPage
            title="Goals"
            description="Hierarchical multi-horizon goal planning (Quarterly, Monthly, Weekly)."
            plannedPhase="Goals Phase"
          />
        }
      />
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
