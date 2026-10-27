import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Alert } from '../../../components/ui/Alert';
import { useUpdatePreferences } from '../usePreferences';

interface StudyPreferencesSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after preferences are saved successfully so the caller can retry its action */
  onSaved: () => void;
}

/** Returns true if the string is a valid HH:mm time */
function isValidTime(val: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(val);
}

export const StudyPreferencesSetupModal: React.FC<StudyPreferencesSetupModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [studyStart, setStudyStart] = useState('08:00');
  const [studyEnd, setStudyEnd] = useState('22:00');
  const [dailyMin, setDailyMin] = useState(30);
  const [dailyTarget, setDailyTarget] = useState(120);
  const [formError, setFormError] = useState<string | null>(null);

  const updateMutation = useUpdatePreferences();

  const validate = (): string | null => {
    if (!isValidTime(studyStart)) return 'Study start must be in HH:mm format (e.g. 08:00).';
    if (!isValidTime(studyEnd)) return 'Study end must be in HH:mm format (e.g. 22:00).';
    if (studyStart >= studyEnd) return 'Study start time must be earlier than study end time.';
    if (dailyMin < 0 || dailyTarget < 0) return 'Study minutes cannot be negative.';
    if (dailyTarget < dailyMin)
      return 'Daily target must be greater than or equal to the daily minimum.';
    return null;
  };

  const handleSave = async () => {
    setFormError(null);
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        preferred_study_start: studyStart,
        preferred_study_end: studyEnd,
        daily_minimum_minutes: dailyMin,
        daily_target_minutes: dailyTarget,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save preferences.';
      setFormError(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={updateMutation.isPending ? () => {} : onClose}
      title={
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[var(--color-primary)]" />
          <span>Set Up Your Study Schedule</span>
        </div>
      }
      description="Before generating a plan, tell Avenza when you're available to study each day."
    >
      <div className="space-y-5 text-sm">
        <Alert variant="info">
          These settings help Avenza schedule tasks only within your available study window. You can
          change them at any time in <strong>Settings → Study Schedule</strong>.
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Study Window Start"
            type="time"
            value={studyStart}
            onChange={(e) => setStudyStart(e.target.value)}
            disabled={updateMutation.isPending}
          />
          <Input
            label="Study Window End"
            type="time"
            value={studyEnd}
            onChange={(e) => setStudyEnd(e.target.value)}
            disabled={updateMutation.isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Daily Minimum (minutes)"
            type="number"
            min={0}
            max={1440}
            value={String(dailyMin)}
            onChange={(e) => setDailyMin(Number(e.target.value))}
            disabled={updateMutation.isPending}
            description="Least amount of study per day"
          />
          <Input
            label="Daily Target (minutes)"
            type="number"
            min={0}
            max={1440}
            value={String(dailyTarget)}
            onChange={(e) => setDailyTarget(Number(e.target.value))}
            disabled={updateMutation.isPending}
            description="Ideal study goal per day"
          />
        </div>

        {formError && (
          <Alert variant="danger" title="Cannot Save">
            {formError}
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border-subtle)]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={updateMutation.isPending}
          >
            Save & Generate Plan
          </Button>
        </div>
      </div>
    </Modal>
  );
};
