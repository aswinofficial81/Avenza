import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  ChevronRight,
  Filter,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type { SkillWithMasteryDto } from '@avenza/shared';
import { Button, Card, EmptyState, ErrorState, Input, Select, Spinner, Stat } from '../components/ui';
import { CreateSkillModal } from '../features/skills/components/CreateSkillModal';
import { EditSkillModal } from '../features/skills/components/EditSkillModal';
import {
  ConfidenceIndicator,
  HealthBadge,
  MasteryBadge,
} from '../features/skills/components/MasteryBadge';
import { useArchiveSkill, useSkills } from '../features/skills/useSkills';

export const SkillsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillWithMasteryDto | null>(null);

  const { data: skills, isLoading, isError, refetch } = useSkills({
    status: statusFilter,
  });

  const archiveSkill = useArchiveSkill();

  // Extract unique categories
  const categories = useMemo(() => {
    if (!skills) return [];
    const set = new Set<string>();
    skills.forEach((s) => {
      if (s.skill.category) set.add(s.skill.category);
    });
    return Array.from(set).sort();
  }, [skills]);

  // Filter skills
  const filteredSkills = useMemo(() => {
    if (!skills) return [];
    return skills.filter((item) => {
      const matchesSearch =
        searchTerm.trim() === '' ||
        item.skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.skill.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.skill.category && item.skill.category.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat =
        selectedCategory === 'all' || item.skill.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [skills, searchTerm, selectedCategory]);

  // Stats calculation
  const stats = useMemo(() => {
    if (!skills) return { total: 0, developing: 0, proficient: 0, needsAttention: 0 };
    return {
      total: skills.length,
      developing: skills.filter((s) => ['learning', 'developing'].includes(s.mastery.state)).length,
      proficient: skills.filter((s) => ['proficient', 'strong'].includes(s.mastery.state)).length,
      needsAttention: skills.filter((s) => s.mastery.health === 'needs_attention').length,
    };
  }, [skills]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Award className="w-6 h-6 text-indigo-400" />
            Skills & Capabilities
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Unified capability model connecting goals, tasks, academics, and verified evidence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Skill
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat
          label="Total Capabilities"
          value={stats.total}
          icon={<Award className="w-4 h-4 text-zinc-400" />}
        />
        <Stat
          label="Developing / Learning"
          value={stats.developing}
          icon={<TrendingUp className="w-4 h-4 text-cyan-400" />}
        />
        <Stat
          label="Proficient / Strong"
          value={stats.proficient}
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
        />
        <Stat
          label="Needs Attention"
          value={stats.needsAttention}
          icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-zinc-900/60 border border-zinc-800/80 p-3 rounded-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search skills by name, slug, or category..."
            className="pl-9 bg-zinc-950/50 border-zinc-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={[
              { value: 'all', label: 'All Categories' },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
            className="w-40 bg-zinc-950/50"
          />

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'active' | 'archived')}
            options={[
              { value: 'active', label: 'Active Skills' },
              { value: 'archived', label: 'Archived Skills' },
            ]}
            className="w-36 bg-zinc-950/50"
          />
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load skills"
          description="Could not retrieve skills and mastery data from the server."
          onRetry={() => refetch()}
        />
      ) : filteredSkills.length === 0 ? (
        <EmptyState
          icon={<Award className="w-10 h-10 text-zinc-600" />}
          title="No skills found"
          description={
            searchTerm || selectedCategory !== 'all'
              ? 'No capabilities match the selected search or filter criteria.'
              : 'Start defining your capabilities to track demonstrated growth.'
          }
          action={
            <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
              Create First Skill
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((item) => (
            <Card
              key={item.skill.id}
              className="p-4 bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700/80 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    {item.skill.parent_skill && (
                      <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-1 mb-1">
                        <span>{item.skill.parent_skill.name}</span>
                        <ChevronRight className="w-3 h-3 opacity-60" />
                      </div>
                    )}
                    <Link
                      to={`/skills/${item.skill.id}`}
                      className="text-base font-semibold text-zinc-100 hover:text-indigo-400 transition-colors"
                    >
                      {item.skill.name}
                    </Link>
                  </div>
                  {item.skill.category && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      {item.skill.category}
                    </span>
                  )}
                </div>

                {item.skill.description && (
                  <p className="text-xs text-zinc-400 line-clamp-2 mb-3">
                    {item.skill.description}
                  </p>
                )}

                {/* Derived Mastery & Confidence Section */}
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded p-2.5 space-y-2 mb-3">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                    <span className="uppercase tracking-wider">DEMONSTRATED MASTERY</span>
                    <span className="text-[10px] text-zinc-600 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                      DERIVED
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <MasteryBadge state={item.mastery.state} score={item.mastery.score} />
                    <ConfidenceIndicator confidence={item.mastery.confidence} />
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-xs text-zinc-400">
                    <span className="font-mono text-[11px]">
                      {item.mastery.evidence_count} evidence record
                      {item.mastery.evidence_count === 1 ? '' : 's'}
                    </span>
                    <HealthBadge health={item.mastery.health} />
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                <Link
                  to={`/skills/${item.skill.id}`}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                >
                  View Details & Evidence
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSkill(item)}
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Edit
                  </button>
                  {item.skill.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => archiveSkill.mutate(item.skill.id)}
                      disabled={archiveSkill.isPending}
                      className="text-xs text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateSkillModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        availableSkills={skills}
      />

      {editingSkill && (
        <EditSkillModal
          isOpen={Boolean(editingSkill)}
          onClose={() => setEditingSkill(null)}
          skill={editingSkill.skill}
          availableSkills={skills}
        />
      )}
    </div>
  );
};
