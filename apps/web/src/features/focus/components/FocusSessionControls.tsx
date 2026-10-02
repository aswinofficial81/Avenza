import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { CheckCircle2, XCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export interface FocusSessionControlsProps {
  onComplete: (notes?: string) => void;
  onCancel: (notes?: string) => void;
  isCompleting?: boolean;
  isCancelling?: boolean;
  disabled?: boolean;
}

export const FocusSessionControls: React.FC<FocusSessionControlsProps> = ({
  onComplete,
  onCancel,
  isCompleting = false,
  isCancelling = false,
  disabled = false,
}) => {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const handleComplete = () => {
    onComplete(notes.trim() || undefined);
  };

  const handleCancel = () => {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    onCancel(notes.trim() || undefined);
    setConfirmCancel(false);
  };

  return (
    <div className="space-y-4 w-full max-w-md mx-auto">
      {/* Optional Session Notes Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowNotes(!showNotes)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span>{showNotes ? 'Hide session notes' : 'Add session notes (optional)'}</span>
          {showNotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showNotes && (
          <div className="mt-2 space-y-1">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you execute or discover during this session?"
              maxLength={2000}
              rows={3}
              disabled={disabled || isCompleting || isCancelling}
              className="w-full text-xs p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none text-foreground placeholder:text-muted-foreground"
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {notes.length}/2000
            </div>
          </div>
        )}
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {/* Complete Focus Session */}
        <Button
          variant="primary"
          size="lg"
          onClick={handleComplete}
          isLoading={isCompleting}
          disabled={disabled || isCancelling}
          className="w-full sm:w-auto min-w-[180px] gap-2 shadow-sm font-semibold"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>Complete Session</span>
        </Button>

        {/* Cancel Focus Session with inline confirmation */}
        <Button
          variant={confirmCancel ? 'danger' : 'outline'}
          size="lg"
          onClick={handleCancel}
          isLoading={isCancelling}
          disabled={disabled || isCompleting}
          className="w-full sm:w-auto min-w-[140px] gap-2 text-xs sm:text-sm"
        >
          <XCircle className="w-4 h-4" />
          <span>{confirmCancel ? 'Confirm Cancel?' : 'Cancel Session'}</span>
        </Button>
      </div>

      {confirmCancel && (
        <p className="text-xs text-center text-muted-foreground animate-fadeIn">
          Cancelled sessions do not contribute to recorded execution minutes. Click again to confirm.
        </p>
      )}
    </div>
  );
};
