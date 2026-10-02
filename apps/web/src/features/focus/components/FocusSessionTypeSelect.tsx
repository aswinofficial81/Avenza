import React from 'react';
import { FOCUS_SESSION_TYPES, type FocusSessionType } from '@avenza/shared';
import { Flame, Brain, Clock, RotateCcw, Wrench, Sparkles } from 'lucide-react';

export interface FocusSessionTypeSelectProps {
  value: FocusSessionType;
  onChange: (type: FocusSessionType) => void;
  disabled?: boolean;
}

const TYPE_CONFIG: Record<
  FocusSessionType,
  { label: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
  focus: {
    label: 'Focus',
    description: 'General intentional execution block',
    icon: Flame,
  },
  pomodoro: {
    label: 'Pomodoro',
    description: 'Interval-based structured sprint',
    icon: Clock,
  },
  deep_work: {
    label: 'Deep Work',
    description: 'High-cognitive-load, distraction-free work',
    icon: Brain,
  },
  revision: {
    label: 'Revision',
    description: 'Reviewing past materials, concepts, or logs',
    icon: RotateCcw,
  },
  practice: {
    label: 'Practice',
    description: 'Skill drills, algorithmic problems, or typing',
    icon: Wrench,
  },
  custom: {
    label: 'Custom',
    description: 'Tailored session structure',
    icon: Sparkles,
  },
};

export const FocusSessionTypeSelect: React.FC<FocusSessionTypeSelectProps> = ({
  value,
  onChange,
  disabled,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {FOCUS_SESSION_TYPES.map((type) => {
        const config = TYPE_CONFIG[type];
        const Icon = config.icon;
        const isSelected = value === type;

        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
              isSelected
                ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary'
                : 'bg-card border-border hover:bg-muted/50 text-foreground'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon
                className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <span className="text-xs font-semibold">{config.label}</span>
            </div>
            <span className="text-[11px] text-muted-foreground line-clamp-1">
              {config.description}
            </span>
          </button>
        );
      })}
    </div>
  );
};
