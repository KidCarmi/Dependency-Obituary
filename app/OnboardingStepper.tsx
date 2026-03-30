"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface StepperState {
  analyzed: boolean;
  saved: boolean;
  installed: boolean;
  dismissed: boolean;
}

const STORAGE_KEY = "dep-obituary-onboarding";

function loadState(): StepperState {
  if (typeof window === "undefined") return { analyzed: false, saved: false, installed: false, dismissed: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StepperState;
  } catch { /* ignore */ }
  return { analyzed: false, saved: false, installed: false, dismissed: false };
}

function saveState(state: StepperState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function markOnboardingStep(step: "analyzed" | "saved" | "installed"): void {
  const state = loadState();
  state[step] = true;
  saveState(state);
}

const STEPS = [
  { key: "analyzed" as const, label: "Analyze a file", href: "/" },
  { key: "saved" as const, label: "Save to watchlist", href: "/dashboard" },
  { key: "installed" as const, label: "Install GitHub App", href: "/integrations" },
];

export default function OnboardingStepper(): React.ReactElement | null {
  const { status } = useSession();
  const [state, setState] = useState<StepperState | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  if (status !== "authenticated" || !state || state.dismissed) return null;

  const allDone = state.analyzed && state.saved && state.installed;
  if (allDone) return null;

  const currentStep = !state.analyzed ? 0 : !state.saved ? 1 : 2;

  return (
    <div className="bg-gray-900/80 border-b border-gray-800 px-6 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-xs text-gray-500 hidden sm:inline">Get started:</span>
          {STEPS.map((step, i) => {
            const done = state[step.key];
            const active = i === currentStep;
            return (
              <Link
                key={step.key}
                href={step.href}
                className={`flex items-center gap-2 text-xs transition-colors ${
                  done
                    ? "text-green-400"
                    : active
                      ? "text-white"
                      : "text-gray-600"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                    done
                      ? "bg-green-400/20 border-green-400 text-green-400"
                      : active
                        ? "border-blue-400 text-blue-400"
                        : "border-gray-700 text-gray-600"
                  }`}
                >
                  {done ? "\u2713" : i + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </Link>
            );
          })}
        </div>
        <button
          onClick={() => {
            const next = { ...state, dismissed: true };
            saveState(next);
            setState(next);
          }}
          className="text-gray-600 hover:text-gray-400 text-xs"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
