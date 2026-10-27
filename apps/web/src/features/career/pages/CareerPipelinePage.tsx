import React, { useState } from 'react';
import { isTerminalStage, type CareerApplicationDto } from '@avenza/shared';
import { CareerPipelineHeader } from '../components/CareerPipelineHeader';
import { CareerPipelineKanban } from '../components/CareerPipelineKanban';
import { CareerOpportunitiesList } from '../components/CareerOpportunitiesList';
import { CareerTargetsList } from '../components/CareerTargetsList';
import { CreateCareerApplicationModal } from '../components/CreateCareerApplicationModal';
import { CreateCareerOpportunityModal } from '../components/CreateCareerOpportunityModal';
import { CreateCareerTargetModal } from '../components/CreateCareerTargetModal';
import { StageTransitionModal } from '../components/StageTransitionModal';
import {
  useCareerApplications,
  useCareerOpportunities,
  useCareerTargets,
} from '../hooks/useCareer';

type PipelineViewTab = 'pipeline' | 'opportunities' | 'targets';

export const CareerPipelinePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PipelineViewTab>('pipeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState('');

  // Modals state
  const [isNewApplicationOpen, setIsNewApplicationOpen] = useState(false);
  const [isNewOpportunityOpen, setIsNewOpportunityOpen] = useState(false);
  const [isNewTargetOpen, setIsNewTargetOpen] = useState(false);
  const [preselectedOpportunityId, setPreselectedOpportunityId] = useState<string | undefined>();

  // Stage transition modal state
  const [transitionTargetApp, setTransitionTargetApp] = useState<CareerApplicationDto | null>(null);

  // Queries
  const { data: applicationsData, isLoading: appsLoading } = useCareerApplications({
    pageSize: 100,
  });
  const { data: opportunitiesData, isLoading: oppsLoading } = useCareerOpportunities({
    pageSize: 100,
  });
  const { data: targetsData, isLoading: targetsLoading } = useCareerTargets({
    pageSize: 100,
  });

  const applications = applicationsData?.data || [];
  const opportunities = opportunitiesData?.data || [];
  const targets = targetsData?.data || [];

  // Statistics calculation
  const totalApplications = applications.length;
  const activeCount = applications.filter((a) => !isTerminalStage(a.stage)).length;
  const interviewCount = applications.filter(
    (a) => a.stage === 'interview' || a.stage === 'assessment'
  ).length;
  const offerCount = applications.filter(
    (a) => a.stage === 'offer' || a.stage === 'accepted'
  ).length;
  const targetCount = targets.length;

  const currentOpportunity = transitionTargetApp
    ? opportunities.find((o) => o.id === transitionTargetApp.opportunity_id)
    : undefined;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* 1. Header with Stats & Actions */}
      <CareerPipelineHeader
        totalApplications={totalApplications}
        activeCount={activeCount}
        interviewCount={interviewCount}
        offerCount={offerCount}
        targetCount={targetCount}
        onNewApplication={() => {
          setPreselectedOpportunityId(undefined);
          setIsNewApplicationOpen(true);
        }}
        onNewOpportunity={() => setIsNewOpportunityOpen(true)}
        onNewTarget={() => setIsNewTargetOpen(true)}
      />

      {/* 2. Page Navigation Tabs & Global Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex gap-2">
          {(
            [
              { id: 'pipeline', label: 'Pipeline Kanban' },
              { id: 'opportunities', label: 'Opportunities' },
              { id: 'targets', label: 'Career Targets' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'bg-surface text-foreground-muted hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'pipeline' && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {targets.length > 0 && (
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Targets</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by company or role..."
                className="w-full px-3 py-1.5 pl-8 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="absolute left-2.5 top-2 text-foreground-muted text-xs">🔍</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'pipeline' && (
        <div>
          {appsLoading || oppsLoading || targetsLoading ? (
            <div className="p-12 text-center text-foreground-muted animate-pulse">
              Loading pipeline applications...
            </div>
          ) : (
            <CareerPipelineKanban
              applications={applications}
              opportunities={opportunities}
              targets={targets}
              searchQuery={searchQuery}
              selectedTargetId={selectedTargetId}
              onQuickTransition={(app) => setTransitionTargetApp(app)}
              onNewApplication={() => {
                setPreselectedOpportunityId(undefined);
                setIsNewApplicationOpen(true);
              }}
            />
          )}
        </div>
      )}

      {activeTab === 'opportunities' && (
        <CareerOpportunitiesList
          opportunities={opportunities}
          targets={targets}
          onNewOpportunity={() => setIsNewOpportunityOpen(true)}
          onApply={(opp) => {
            setPreselectedOpportunityId(opp.id);
            setIsNewApplicationOpen(true);
          }}
        />
      )}

      {activeTab === 'targets' && (
        <CareerTargetsList
          targets={targets}
          onNewTarget={() => setIsNewTargetOpen(true)}
        />
      )}

      {/* 4. Creation & Transition Modals */}
      <CreateCareerApplicationModal
        isOpen={isNewApplicationOpen}
        onClose={() => setIsNewApplicationOpen(false)}
        opportunities={opportunities}
        initialOpportunityId={preselectedOpportunityId}
      />

      <CreateCareerOpportunityModal
        isOpen={isNewOpportunityOpen}
        onClose={() => setIsNewOpportunityOpen(false)}
        targets={targets}
      />

      <CreateCareerTargetModal
        isOpen={isNewTargetOpen}
        onClose={() => setIsNewTargetOpen(false)}
      />

      <StageTransitionModal
        isOpen={Boolean(transitionTargetApp)}
        onClose={() => setTransitionTargetApp(null)}
        application={transitionTargetApp}
        opportunity={currentOpportunity}
      />
    </div>
  );
};
