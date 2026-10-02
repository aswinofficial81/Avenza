import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FocusSessionType, TaskDto } from '@avenza/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { FocusSessionTypeSelect } from './FocusSessionTypeSelect';
import { useActiveFocusSession, useStartFocusSession } from '../useFocusSession';
import { useTasks } from '../../tasks/useTasks';
import { Flame, Clock, Target, AlertTriangle, ArrowRight } from 'lucide-react';

export interface StartFocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedTask?: { id: string; title: string } | null;
}

const DURATION_PRESETS = [15, 25, 45, 60, 90];

export const StartFocusModal: React.FC<StartFocusModalProps> = ({
  isOpen,
  onClose,
  preselectedTask = null,
}) => {
  const navigate = useNavigate();
  const { data: activeSession } = useActiveFocusSession();
  const startSessionMutation = useStartFocusSession();

  const [selectedTaskId, setSelectedTaskId] = useState<string>(preselectedTask?.id || '');
  const [sessionType, setSessionType] = useState<FocusSessionType>('focus');
  const [plannedMinutes, setPlannedMinutes] = useState<number>(25);
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize preselected task when modal opens
  React.useEffect(() => {
    if (preselectedTask?.id) {
      setSelectedTaskId(preselectedTask.id);
    }
  }, [preselectedTask]);

  // Load actionable tasks if no preselected task was supplied
  const { data: tasksList, isLoading: isTasksLoading } = useTasks(
    preselectedTask ? {} : { pageSize: 50 }
  );

  const actionableTasks = (tasksList?.data || []).filter(
    (t: TaskDto) =>
      t.status !== 'completed' &&
      t.status !== 'cancelled' &&
      t.status !== 'skipped' &&
      !t.is_blocked
  );

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const taskId = preselectedTask?.id || selectedTaskId;
    if (!taskId) {
      setErrorMsg('Please select a task to focus on.');
      return;
    }

    try {
      await startSessionMutation.mutateAsync({
        taskId,
        sessionType,
        plannedMinutes,
        notes: notes.trim() || null,
      });

      onClose();
      navigate('/focus');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const msg =
        errorObj?.response?.data?.error?.message ||
        errorObj?.message ||
        'Failed to start focus session. Please try again.';
      setErrorMsg(msg);
    }
  };

  const handleOpenActive = () => {
    onClose();
    navigate('/focus');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start Focus Session" size="md">
      {activeSession && activeSession.status === 'active' ? (
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-sm block">Active Session in Progress</span>
              <p>
                You already have an active focus session on{' '}
                <strong>{activeSession.task?.title || 'a task'}</strong>. Complete or cancel it before
                starting a new session.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" size="sm" onClick={handleOpenActive} className="gap-1.5">
              <span>Open Active Session</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleStart} className="space-y-5 py-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {errorMsg}
            </div>
          )}

          {/* Task Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-primary" />
              <span>Target Task</span>
            </label>

            {preselectedTask ? (
              <div className="p-3 rounded-xl border border-border bg-muted/30 font-medium text-sm text-foreground flex items-center justify-between">
                <span className="truncate">{preselectedTask.title}</span>
                <span className="text-xs text-muted-foreground">Preselected</span>
              </div>
            ) : isTasksLoading ? (
              <div className="text-xs text-muted-foreground p-3">Loading available tasks...</div>
            ) : actionableTasks.length === 0 ? (
              <div className="p-3 rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                No actionable tasks available. Please create or unblock a task first.
              </div>
            ) : (
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                required
                className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Select an actionable task...</option>
                {actionableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.priority})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Session Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-primary" />
              <span>Session Type</span>
            </label>
            <FocusSessionTypeSelect value={sessionType} onChange={setSessionType} />
          </div>

          {/* Planned Duration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Planned Duration (Minutes)</span>
              </label>
              <span className="text-xs font-bold text-foreground">{plannedMinutes}m</span>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPlannedMinutes(preset)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                    plannedMinutes === preset
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card border-border hover:bg-muted text-foreground'
                  }`}
                >
                  {preset}m
                </button>
              ))}

              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={plannedMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setPlannedMinutes(Math.max(1, Math.min(480, val)));
                  }}
                  className="w-16 text-xs p-1.5 rounded-lg border border-border bg-background text-foreground text-center"
                />
                <span className="text-xs text-muted-foreground">custom</span>
              </div>
            </div>
          </div>

          {/* Optional Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Session Objective / Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Focus on JWT middleware and fix cookie validation"
              maxLength={2000}
              className="w-full text-xs p-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={startSessionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={startSessionMutation.isPending}
              disabled={!preselectedTask && !selectedTaskId}
              className="gap-1.5 shadow-sm font-semibold"
            >
              <Flame className="w-4 h-4" />
              <span>Start Focus</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
