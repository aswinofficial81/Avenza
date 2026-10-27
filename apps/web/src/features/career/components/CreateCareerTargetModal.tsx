import React, { useState } from 'react';
import type { CareerEmploymentType, CreateCareerTargetInput } from '@avenza/shared';
import { CAREER_EMPLOYMENT_TYPES } from '@avenza/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Label } from '../../../components/ui/Label';
import { useCreateCareerTarget } from '../hooks/useCareer';
import { useGoals } from '../../goals/useGoals';
import { Plus } from 'lucide-react';

export interface CreateCareerTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateCareerTargetModal: React.FC<CreateCareerTargetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [locationsStr, setLocationsStr] = useState('');
  const [employmentType, setEmploymentType] = useState<CareerEmploymentType | ''>('full_time');
  const [minCompStr, setMinCompStr] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [targetDate, setTargetDate] = useState('');
  const [goalId, setGoalId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createTargetMutation = useCreateCareerTarget();
  const { data: goalsData } = useGoals({ pageSize: 50 });
  const goals = goalsData?.data || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Target profile title is required.');
      return;
    }
    if (!targetRole.trim()) {
      setErrorMsg('Target role title is required.');
      return;
    }

    const locations = locationsStr
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedComp = minCompStr ? parseFloat(minCompStr) : undefined;
    if (minCompStr && (isNaN(parsedComp!) || parsedComp! < 0)) {
      setErrorMsg('Minimum compensation must be a non-negative number.');
      return;
    }

    const payload: CreateCareerTargetInput = {
      title: title.trim(),
      target_role: targetRole.trim(),
      target_locations: locations,
      employment_type: employmentType ? employmentType : null,
      min_compensation: parsedComp != null ? parsedComp : null,
      currency: currency.trim() || 'USD',
      target_date: targetDate ? new Date(targetDate).toISOString() : null,
      goal_id: goalId || null,
      is_primary: isPrimary,
      notes: notes.trim() || null,
    };

    try {
      await createTargetMutation.mutateAsync(payload);
      resetForm();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create target profile.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setTargetRole('');
    setLocationsStr('');
    setEmploymentType('full_time');
    setMinCompStr('');
    setCurrency('USD');
    setTargetDate('');
    setGoalId('');
    setIsPrimary(false);
    setNotes('');
    setErrorMsg(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Career Target"
      description="Define a target role profile, compensation criteria, and preferred locations."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMsg && (
          <div className="p-3 text-xs rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="target-title-input" required>
              Target Profile Title
            </Label>
            <Input
              id="target-title-input"
              placeholder="e.g. Senior Backend / Distributed Systems Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={createTargetMutation.isPending}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="target-role-input" required>
              Target Role Name
            </Label>
            <Input
              id="target-role-input"
              placeholder="e.g. Software Engineer, Backend"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              disabled={createTargetMutation.isPending}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="target-locations-input">Preferred Locations (Comma-separated)</Label>
            <Input
              id="target-locations-input"
              placeholder="e.g. San Francisco, CA, Remote, New York, NY"
              value={locationsStr}
              onChange={(e) => setLocationsStr(e.target.value)}
              disabled={createTargetMutation.isPending}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target-employment-type-select">Employment Type</Label>
            <Select
              id="target-employment-type-select"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as CareerEmploymentType)}
              disabled={createTargetMutation.isPending}
              className="text-xs capitalize"
            >
              <option value="">Any Employment Type</option>
              {CAREER_EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type} className="capitalize">
                  {type.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target-date-input">Target Achievement Date</Label>
            <Input
              id="target-date-input"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={createTargetMutation.isPending}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target-min-comp-input">Min Annual Compensation</Label>
            <Input
              id="target-min-comp-input"
              type="number"
              placeholder="e.g. 150000"
              value={minCompStr}
              onChange={(e) => setMinCompStr(e.target.value)}
              disabled={createTargetMutation.isPending}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target-currency-input">Currency Code</Label>
            <Input
              id="target-currency-input"
              placeholder="USD"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              disabled={createTargetMutation.isPending}
              className="text-xs font-mono uppercase"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="target-goal-select">Linked Goal (Optional)</Label>
            <Select
              id="target-goal-select"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              disabled={createTargetMutation.isPending}
              className="text-xs"
            >
              <option value="">No linked goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="target-is-primary-check"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            disabled={createTargetMutation.isPending}
            className="rounded border-border text-primary focus:ring-focus-ring h-4 w-4"
          />
          <Label htmlFor="target-is-primary-check" className="cursor-pointer text-xs font-medium">
            Mark as Primary Career Target
          </Label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="target-notes-input">Notes & Aspirations</Label>
          <Textarea
            id="target-notes-input"
            placeholder="Key role requirements, team profiles, culture targets..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={createTargetMutation.isPending}
            rows={2}
            className="text-xs resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={createTargetMutation.isPending}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={createTargetMutation.isPending}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            id="submit-create-target-btn"
          >
            Create Target
          </Button>
        </div>
      </form>
    </Modal>
  );
};
