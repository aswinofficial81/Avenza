import React from 'react';
import { Layers, Terminal, CheckCircle2 } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@avenza/shared';

export const App: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-slate-100">
      <main className="w-full max-w-xl text-center space-y-8">
        {/* Brand Icon & Name */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
          <Layers className="w-8 h-8" />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-white">
            {APP_NAME}
          </h1>
          <p className="text-xl font-medium text-emerald-400 tracking-wide uppercase text-sm">
            {APP_TAGLINE}
          </p>
          <p className="text-slate-400 text-base max-w-md mx-auto">
            A personal operating system for growth.
          </p>
        </div>

        {/* Foundation Status */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-left space-y-3 shadow-lg">
          <div className="flex items-center space-x-2.5 text-slate-200 font-semibold text-sm">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Phase 1 — Repository & Development Foundation</span>
          </div>
          <ul className="text-xs text-slate-400 space-y-1.5 pl-6 list-disc">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Workspace monorepo initialized</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Fastify API & React/Vite web application bootstrapped</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>TypeScript strict mode & automated test suites configured</span>
            </li>
          </ul>
        </div>
      </main>

      <footer className="mt-12 text-xs text-slate-600">
        &copy; {new Date().getFullYear()} Avenza. Built from scratch.
      </footer>
    </div>
  );
};

export default App;
