import React from 'react';
import type { ConfidenceLevel, MasteryState, SkillHealth } from '@avenza/shared';

interface MasteryBadgeProps {
  state: MasteryState;
  score?: number;
  className?: string;
}

export const MasteryBadge: React.FC<MasteryBadgeProps> = ({ state, score, className = '' }) => {
  const getStyles = () => {
    switch (state) {
      case 'strong':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'proficient':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'developing':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'learning':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'exploring':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'needs_review':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'inactive':
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
      case 'unknown':
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const label = state.replace('_', ' ').toUpperCase();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border font-mono tracking-wider ${getStyles()} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{label}</span>
      {typeof score === 'number' && score > 0 && (
        <span className="opacity-70 font-mono text-[10px]">({score})</span>
      )}
    </span>
  );
};

export const ConfidenceIndicator: React.FC<{ confidence: ConfidenceLevel; className?: string }> = ({
  confidence,
  className = '',
}) => {
  const getStyles = () => {
    switch (confidence) {
      case 'high':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          dots: [true, true, true],
        };
      case 'medium':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          dots: [true, true, false],
        };
      case 'low':
      default:
        return {
          bg: 'bg-zinc-800/80 text-zinc-400 border-zinc-700',
          dots: [true, false, false],
        };
    }
  };

  const config = getStyles();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border ${config.bg} ${className}`}
      title={`Confidence: ${confidence.toUpperCase()}`}
    >
      <span className="flex gap-0.5">
        {config.dots.map((filled, idx) => (
          <span
            key={idx}
            className={`w-1 h-2 rounded-sm ${filled ? 'bg-current' : 'bg-current opacity-20'}`}
          />
        ))}
      </span>
      <span className="capitalize font-mono text-[11px]">{confidence} Conf</span>
    </span>
  );
};

export const HealthBadge: React.FC<{ health: SkillHealth; className?: string }> = ({
  health,
  className = '',
}) => {
  const getStyles = () => {
    switch (health) {
      case 'healthy':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'developing':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'needs_attention':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'inactive':
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border font-mono uppercase tracking-wider ${getStyles()} ${className}`}
    >
      {health.replace('_', ' ')}
    </span>
  );
};
