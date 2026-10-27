import React, { useState } from 'react';
import {
  SignInButton,
  SignUpButton,
} from '@clerk/clerk-react';
import {
  Layers,
  KeyRound,
  LogIn,
  ArrowRight,
  ShieldCheck,
  Target,
  Zap,
  TrendingUp,
  Award,
  Play,
  Sun,
  Moon,
  Laptop,
  Check,
  Sparkles,
} from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@avenza/shared';
import { Button } from '../ui/Button';
import { LandingLaptopMockup } from './LandingLaptopMockup';
import { useTheme } from '../../lib/theme';
import { Modal } from '../ui/Modal';

export interface LandingPageProps {
  isMissingKey?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ isMissingKey = false }) => {
  const { theme, setTheme } = useTheme();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const handleCycleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const themeIcon =
    theme === 'system' ? (
      <Laptop className="w-4 h-4 text-muted-foreground" />
    ) : theme === 'light' ? (
      <Sun className="w-4 h-4 text-amber-500" />
    ) : (
      <Moon className="w-4 h-4 text-teal-400" />
    );

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-teal-500/20 selection:text-teal-700 dark:selection:text-teal-300">
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-surface/80 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#14B8A6] to-[#064E4A] dark:from-[#2DE2C5] dark:to-[#0F766E] text-white font-bold shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              {APP_NAME}
            </span>
          </div>

          {/* Center Navigation Links (Anchor references) */}
          <nav aria-label="Landing Navigation" className="hidden md:flex items-center gap-7 text-xs font-medium text-muted-foreground">
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              How it works
            </button>
            <button
              onClick={() => scrollToSection('for-students')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              For Students
            </button>
            <button
              onClick={() => scrollToSection('security')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Architecture
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={handleCycleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              {themeIcon}
            </button>

            {!isMissingKey && (
              <>
                <SignInButton mode="modal">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-medium px-3.5 h-8.5 rounded-xl"
                  >
                    Sign In
                  </Button>
                </SignInButton>

                <SignUpButton mode="modal">
                  <Button
                    variant="primary"
                    size="sm"
                    aria-label="Sign up for free"
                    className="text-xs font-semibold px-4 h-8.5 rounded-full shadow-xs gap-1.5"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* Missing Clerk Key Notice (if applicable) */}
        {isMissingKey && (
          <div className="max-w-2xl mx-auto mt-6 px-4">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-left text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                <KeyRound className="w-4 h-4" />
                <span>Clerk Configuration Notice</span>
              </div>
              <p>
                To connect live Clerk authentication, add your Publishable Key to{' '}
                <code className="bg-surface px-1 py-0.5 rounded text-foreground font-mono">
                  apps/web/.env
                </code>
                :
              </p>
              <pre className="bg-surface-2 p-2.5 rounded text-foreground font-mono text-[11px] overflow-x-auto border border-border-subtle">
                VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
              </pre>
            </div>
          </div>
        )}

        {/* 2. Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Headlines & CTA */}
              <div className="lg:col-span-5 text-center lg:text-left space-y-6">
                {/* Micro Tagline */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 text-xs font-semibold tracking-wide">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Plan. Execute. Evolve.</span>
                </div>

                {/* Primary Hero Heading */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                  <span className="sr-only">{APP_NAME} — {APP_TAGLINE}</span>
                  Plan. Execute. <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-400 dark:from-teal-300 dark:via-[#2DE2C5] dark:to-emerald-400">
                    Evolve.
                  </span>
                </h1>

                {/* Supporting Body Copy */}
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                  Avenza is your all-in-one developer learning and execution OS. Turn your goals into daily actions and real progress.
                </p>

                {/* Primary & Secondary Action CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                  {!isMissingKey ? (
                    <>
                      <SignUpButton mode="modal">
                        <Button
                          variant="primary"
                          size="lg"
                          className="w-full sm:w-auto rounded-full font-semibold px-6 shadow-sm gap-2"
                        >
                          <span>Get Started</span>
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </SignUpButton>

                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setIsDemoModalOpen(true)}
                        leftIcon={<Play className="w-4 h-4 text-teal-600 dark:text-teal-400 fill-teal-600/20" />}
                        className="w-full sm:w-auto rounded-full border-border/80 px-5 text-foreground hover:bg-surface-2"
                      >
                        Watch Demo
                      </Button>
                    </>
                  ) : (
                    <SignInButton mode="modal">
                      <Button
                        variant="primary"
                        size="lg"
                        leftIcon={<LogIn className="w-4 h-4" />}
                        className="w-full sm:w-auto rounded-full"
                      >
                        Sign In
                      </Button>
                    </SignInButton>
                  )}
                </div>

                {/* Social Proof / Trusted By Students */}
                <div className="pt-4 flex items-center justify-center lg:justify-start gap-3 text-xs text-muted-foreground">
                  <div className="flex -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 border-2 border-surface flex items-center justify-center text-white text-[10px] font-bold">
                      AK
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 border-2 border-surface flex items-center justify-center text-white text-[10px] font-bold">
                      SM
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 border-2 border-surface flex items-center justify-center text-white text-[10px] font-bold">
                      RD
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 border-2 border-surface flex items-center justify-center text-white text-[10px] font-bold">
                      JL
                    </div>
                  </div>
                  <span className="font-medium text-foreground/90">
                    Trusted by ambitious developers & students
                  </span>
                </div>
              </div>

              {/* Right Column: 3D Perspective Laptop Preview & Badges */}
              <div className="lg:col-span-7 relative">
                <LandingLaptopMockup />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Four Feature Cards Grid */}
        <section id="features" className="py-12 border-t border-border/60 bg-surface/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400">
                Core Capabilities
              </h2>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Engineered for Consistent Execution
              </p>
              <p className="text-xs text-muted-foreground">
                Everything you need to master concepts, pass placements, and build real-world software.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Feature 1: Goal Planning */}
              <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs hover:border-purple-500/40 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Goal Planning</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Set high-level career objectives and break them into actionable weekly milestones.
                </p>
              </div>

              {/* Feature 2: Smart Actions */}
              <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs hover:border-amber-500/40 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Smart Actions</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Receive personalized, ranked next best actions dynamically scored from deadlines and energy.
                </p>
              </div>

              {/* Feature 3: Track Progress */}
              <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs hover:border-teal-500/40 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Track Progress</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Real-time analytics for DSA problems, project commits, study hours, and academic terms.
                </p>
              </div>

              {/* Feature 4: Stay Consistent */}
              <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Stay Consistent</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Gamified streak tracking and focus sessions structured to prevent burnout.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. How it Works / For Students Section */}
        <section id="for-students" className="py-14 border-t border-border/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-surface border border-border space-y-3">
                <div className="text-teal-600 dark:text-[#2DE2C5] font-mono text-xs font-semibold">01 / DISCIPLINE</div>
                <h3 className="text-base font-bold text-foreground">Zero-Decision Fatigue</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Open the dashboard and immediately know the exact task to work on without spending 30 minutes deciding what to study.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface border border-border space-y-3">
                <div className="text-teal-600 dark:text-[#2DE2C5] font-mono text-xs font-semibold">02 / UNIFIED</div>
                <h3 className="text-base font-bold text-foreground">All In One Place</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Integrates your DSA trackers (LeetCode, Codeforces), GitHub repositories, Google Calendar, and academic syllabus in a single hub.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface border border-border space-y-3">
                <div className="text-teal-600 dark:text-[#2DE2C5] font-mono text-xs font-semibold">03 / PROVEN</div>
                <h3 className="text-base font-bold text-foreground">Verified Evidence</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Log project milestones, code PRs, and exam scores with immutable audit trails to showcase directly to employers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Security & Architecture Foundation Card */}
        <section id="security" className="py-10 border-t border-border/60 bg-surface-2/40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-border bg-surface p-6 text-left space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5 text-foreground font-semibold">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-sm">Architecture & Security Foundation</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Clerk manages identity credentials securely with OAuth and Passkeys. Fastify verifies cryptographic tokens server-side, enforcing strict PostgreSQL Row-Level Security (RLS) policies with zero data leakage.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground font-mono">
                <span className="px-2 py-0.5 rounded-md bg-surface-2 border border-border-subtle flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-500" /> Clerk Auth
                </span>
                <span className="px-2 py-0.5 rounded-md bg-surface-2 border border-border-subtle flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-500" /> Fastify API
                </span>
                <span className="px-2 py-0.5 rounded-md bg-surface-2 border border-border-subtle flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-500" /> PostgreSQL RLS
                </span>
                <span className="px-2 py-0.5 rounded-md bg-surface-2 border border-border-subtle flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-500" /> End-to-End Encrypted
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 6. Footer */}
      <footer className="border-t border-border/60 bg-surface/50 py-8 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold">
              A
            </div>
            <span>&copy; {new Date().getFullYear()} {APP_NAME}. {APP_TAGLINE}</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Built for developers & students</span>
            <span>•</span>
            <span className="font-mono text-[11px] text-teal-600 dark:text-teal-400">v0.1.0</span>
          </div>
        </div>
      </footer>

      {/* Demo Video / Tour Modal */}
      <Modal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title="Avenza Product Walkthrough"
      >
        <div className="space-y-4 text-xs text-muted-foreground">
          <p>
            Experience how Avenza transforms ambitious long-term goals into structured daily execution blocks with intelligent task scoring.
          </p>
          <div className="rounded-xl overflow-hidden border border-border bg-neutral-950 p-4 text-center">
            <LandingLaptopMockup />
          </div>
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsDemoModalOpen(false)}
              className="rounded-xl"
            >
              Close Preview
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
