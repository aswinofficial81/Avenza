import React from 'react';
import { Target, Zap, TrendingUp, CheckCircle2, Clock, Flame } from 'lucide-react';

export const LandingLaptopMockup: React.FC = () => {
  return (
    <div className="relative w-full max-w-2xl mx-auto py-6 select-none">
      {/* Background Teal Radial Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[500px] h-[340px] sm:h-[420px] bg-gradient-to-tr from-teal-500/25 via-[#2DE2C5]/20 to-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      {/* Floating Callout 1: Set Goals (Top Left) */}
      <div className="hidden sm:flex absolute -top-1 -left-4 z-20 items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-surface/95 backdrop-blur-md border border-border shadow-lg transition-transform hover:-translate-y-1 duration-200">
        <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
          <Target className="w-4 h-4" />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-foreground leading-tight">Set Goals</p>
          <p className="text-[10px] text-muted-foreground leading-tight">Define what you want to achieve</p>
        </div>
      </div>

      {/* Floating Callout 2: Next Best Action (Top Right) */}
      <div className="hidden sm:flex absolute -top-3 -right-2 z-20 items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-surface/95 backdrop-blur-md border border-border shadow-lg transition-transform hover:-translate-y-1 duration-200">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4" />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-foreground leading-tight">Next Best Action</p>
          <p className="text-[10px] text-muted-foreground leading-tight">Get personalized actions</p>
        </div>
      </div>

      {/* Floating Callout 3: Track Progress (Bottom Right) */}
      <div className="hidden sm:flex absolute -bottom-3 -right-4 z-20 items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-surface/95 backdrop-blur-md border border-border shadow-lg transition-transform hover:-translate-y-1 duration-200">
        <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4" />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-foreground leading-tight">Track Progress</p>
          <p className="text-[10px] text-muted-foreground leading-tight">See real growth</p>
        </div>
      </div>

      {/* Laptop Device Frame */}
      <div className="relative mx-auto rounded-t-2xl bg-neutral-900 dark:bg-black p-2.5 sm:p-3 pb-2 shadow-2xl border border-neutral-700/60 dark:border-neutral-800">
        {/* Screen Bezel Top Bar (Webcam dot) */}
        <div className="flex items-center justify-center pb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 dark:bg-neutral-800" />
        </div>

        {/* Inner Screen Display (Interactive Dashboard Mockup) */}
        <div className="w-full rounded-lg overflow-hidden bg-[#0B1515] text-[#F5FAFA] border border-[#203634] p-3 sm:p-4 text-xs font-sans shadow-inner">
          {/* Mock Dashboard Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#203634]/70">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#14B8A6] to-[#064E4A] flex items-center justify-center text-white text-[10px] font-bold">
                A
              </div>
              <span className="font-bold text-xs tracking-tight text-white">Avenza</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#A2B7B5] hidden sm:inline">Mon, 20 Oct 2026</span>
              <div className="w-5 h-5 rounded-full bg-teal-500/20 text-[#2DE2C5] flex items-center justify-center text-[10px] font-bold border border-teal-500/30">
                A
              </div>
            </div>
          </div>

          {/* Mock Dashboard Greeting */}
          <div className="py-2.5">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              Good evening, Aswin! <span className="inline-block animate-wave">👋</span>
            </h4>
            <p className="text-[10px] text-[#A2B7B5]">Here's your progress for today.</p>
          </div>

          {/* Mock 4 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2">
            <div className="p-2 rounded-xl bg-[#102020] border border-[#203634] flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-[#A2B7B5] leading-none">Tasks done</p>
                <p className="font-mono font-bold text-xs sm:text-sm text-white mt-0.5">4 / 6</p>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#102020] border border-[#203634] flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-[#A2B7B5] leading-none">Study time</p>
                <p className="font-mono font-bold text-xs sm:text-sm text-white mt-0.5">3h 45m</p>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#102020] border border-[#203634] flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <Flame className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-[#A2B7B5] leading-none">Streak</p>
                <p className="font-mono font-bold text-xs sm:text-sm text-white mt-0.5">7 days</p>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#102020] border border-[#203634] flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-[#2DE2C5] flex items-center justify-center shrink-0">
                <Target className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-[#A2B7B5] leading-none">Focus Rank</p>
                <p className="font-mono font-bold text-xs sm:text-sm text-white mt-0.5">A</p>
              </div>
            </div>
          </div>

          {/* Mock Today Progress Donut + Next Best Action */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {/* Donut Chart Card */}
            <div className="p-2.5 rounded-xl bg-[#102020] border border-[#203634] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-white">Today's Progress</p>
                <div className="mt-2 space-y-1 text-[9px] text-[#A2B7B5]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>4 completed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>2 in progress</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span>1 pending</span>
                  </div>
                </div>
              </div>

              {/* Mini SVG Donut Ring */}
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[#142827]"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#2DE2C5]"
                    strokeDasharray="67, 100"
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute font-mono font-bold text-[11px] text-white">67%</span>
              </div>
            </div>

            {/* Next Best Action Card */}
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#102020] to-[#142827] border border-[#203634] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Next Best Action
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-[#2DE2C5] border border-teal-500/30 font-mono">
                    25 min
                  </span>
                </div>
                <p className="text-[11px] font-bold text-white mt-1 line-clamp-1">
                  Continue React Module 4
                </p>
                <p className="text-[9px] text-[#A2B7B5] line-clamp-1 mt-0.5">
                  You're 70% done. Finish the next 2 lessons.
                </p>
              </div>

              <div className="mt-2 flex items-center justify-between pt-1 border-t border-[#203634]/50">
                <span className="text-[9px] text-[#A2B7B5]">Daily Target</span>
                <span className="px-2 py-0.5 rounded-full bg-[#2DE2C5] text-[#050B0B] font-bold text-[9px]">
                  Start Now
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Laptop Keyboard Base */}
      <div className="relative mx-auto w-[104%] -left-[2%] h-3 sm:h-4 bg-gradient-to-b from-neutral-700 via-neutral-800 to-neutral-900 rounded-b-xl shadow-2xl border-t border-neutral-600/40">
        <div className="mx-auto w-16 sm:w-24 h-1 bg-neutral-600 rounded-b" />
      </div>
    </div>
  );
};
