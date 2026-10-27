import React, { useState, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  ProjectPriority,
  ProjectStatus,
  ProjectType,
} from '@avenza/shared';
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
} from '@avenza/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Pagination } from '../../../components/ui/Pagination';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectCardSkeleton } from '../components/ProjectCardSkeleton';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { useProjects } from '../hooks/useProjects';
import {
  FolderGit2,
  Plus,
  Search,
  X,
  SlidersHorizontal,
} from 'lucide-react';

export const ProjectsOverviewPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [, startTransition] = useTransition();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Read URL query state
  const statusParam = (searchParams.get('status') as ProjectStatus) || undefined;
  const priorityParam = (searchParams.get('priority') as ProjectPriority) || undefined;
  const typeParam = (searchParams.get('project_type') as ProjectType) || undefined;
  const searchParam = searchParams.get('search') || '';
  const sortByParam =
    (searchParams.get('sortBy') as
      | 'created_at'
      | 'updated_at'
      | 'target_date'
      | 'title'
      | 'priority') || 'updated_at';
  const sortOrderParam = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Local search text
  const [searchInputValue, setSearchInputValue] = useState(searchParam);

  const queryFilters = {
    status: statusParam,
    priority: priorityParam,
    project_type: typeParam,
    search: searchParam || undefined,
    sortBy: sortByParam,
    sortOrder: sortOrderParam,
    page: pageParam,
    pageSize: 12,
  };

  const { data, isLoading, isError, error, refetch } = useProjects(queryFilters);

  const projects = data?.data || [];
  const pagination = data?.pagination;

  const hasActiveFilters = Boolean(
    statusParam || priorityParam || typeParam || searchParam || sortByParam !== 'updated_at'
  );

  const updateQuery = (updates: Record<string, string | undefined>) => {
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value && value !== 'all') {
          nextParams.set(key, value);
        } else {
          nextParams.delete(key);
        }
      });
      // Reset page to 1 when filters change (unless page is specifically updated)
      if (!('page' in updates)) {
        nextParams.delete('page');
      }
      setSearchParams(nextParams, { replace: true });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({ search: searchInputValue.trim() || undefined });
  };

  const handleClearFilters = () => {
    setSearchInputValue('');
    setSearchParams({}, { replace: true });
  };

  const handleSortChange = (combinedValue: string) => {
    switch (combinedValue) {
      case 'updated_at_desc':
        updateQuery({ sortBy: 'updated_at', sortOrder: 'desc' });
        break;
      case 'created_at_desc':
        updateQuery({ sortBy: 'created_at', sortOrder: 'desc' });
        break;
      case 'target_date_asc':
        updateQuery({ sortBy: 'target_date', sortOrder: 'asc' });
        break;
      case 'priority_desc':
        updateQuery({ sortBy: 'priority', sortOrder: 'desc' });
        break;
      case 'title_asc':
        updateQuery({ sortBy: 'title', sortOrder: 'asc' });
        break;
      default:
        updateQuery({ sortBy: 'updated_at', sortOrder: 'desc' });
        break;
    }
  };

  const currentSortKey = `${sortByParam}_${sortOrderParam}`;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="projects-overview-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Technical project workspaces, feature roadmaps, and dev milestones.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 shrink-0 self-start sm:self-auto"
          data-testid="create-project-btn"
        >
          <Plus className="w-4 h-4" />
          Create Project
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 bg-surface rounded-lg border border-border/80 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search form */}
          <form
            onSubmit={handleSearchSubmit}
            className="md:col-span-4 relative flex items-center"
          >
            <Search className="w-4 h-4 absolute left-3 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 pr-8 h-9 text-xs"
              data-testid="project-search-input"
            />
            {searchInputValue && (
              <button
                type="button"
                onClick={() => {
                  setSearchInputValue('');
                  updateQuery({ search: undefined });
                }}
                className="absolute right-2.5 text-muted-foreground hover:text-foreground p-0.5"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Status Dropdown */}
          <div className="md:col-span-2">
            <Select
              value={statusParam || 'all'}
              onChange={(e) => updateQuery({ status: e.target.value })}
              className="h-9 text-xs"
              aria-label="Filter by status"
              data-testid="project-status-filter"
            >
              <option value="all">All Statuses</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
          </div>

          {/* Priority Dropdown */}
          <div className="md:col-span-2">
            <Select
              value={priorityParam || 'all'}
              onChange={(e) => updateQuery({ priority: e.target.value })}
              className="h-9 text-xs"
              aria-label="Filter by priority"
              data-testid="project-priority-filter"
            >
              <option value="all">All Priorities</option>
              {PROJECT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)} Priority
                </option>
              ))}
            </Select>
          </div>

          {/* Project Type Dropdown */}
          <div className="md:col-span-2">
            <Select
              value={typeParam || 'all'}
              onChange={(e) => updateQuery({ project_type: e.target.value })}
              className="h-9 text-xs"
              aria-label="Filter by project type"
              data-testid="project-type-filter"
            >
              <option value="all">All Types</option>
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
          </div>

          {/* Sort Dropdown */}
          <div className="md:col-span-2">
            <Select
              value={currentSortKey}
              onChange={(e) => handleSortChange(e.target.value)}
              className="h-9 text-xs font-medium"
              aria-label="Sort projects"
              data-testid="project-sort-select"
            >
              <option value="updated_at_desc">Recently Updated</option>
              <option value="created_at_desc">Recently Created</option>
              <option value="target_date_asc">Target Date</option>
              <option value="priority_desc">Priority</option>
              <option value="title_asc">Title (A-Z)</option>
            </Select>
          </div>
        </div>

        {/* Clear Filters bar if active */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              Active filters applied
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
              data-testid="clear-filters-btn"
            >
              Reset All Filters
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="projects-loading-grid"
        >
          {Array.from({ length: 6 }).map((_, idx) => (
            <ProjectCardSkeleton key={idx} />
          ))}
        </div>
      ) : isError ? (
        <div data-testid="projects-error-state">
          <ErrorState
            title="Failed to load projects"
            description={
              error instanceof Error
                ? error.message
                : 'Unable to connect to the project service. Please check your network or try again.'
            }
            onRetry={() => refetch()}
          />
        </div>
      ) : projects.length === 0 ? (
        <div data-testid="projects-empty-state">
          {hasActiveFilters ? (
            <EmptyState
              icon={<Search className="w-6 h-6 stroke-[1.5]" />}
              title="No matching projects"
              description="No projects match your current search and filter criteria."
              action={
                <Button variant="outline" size="sm" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FolderGit2 className="w-6 h-6 stroke-[1.5]" />}
              title="No projects yet"
              description="Create your first project to start tracking what you're building."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Project
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            data-testid="projects-grid"
          >
            {projects.map((proj) => (
              <ProjectCard key={proj.id} project={proj} />
            ))}
          </div>

          {/* Pagination if multiple pages */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(p) => updateQuery({ page: String(p) })}
              />
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      <ProjectFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
