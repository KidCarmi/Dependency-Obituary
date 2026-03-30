"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface BotSettings {
  warning_threshold: number;
  critical_threshold: number;
  max_packages: number;
  comment_behavior: "always" | "warnings_only" | "silent";
}

const DEFAULT_SETTINGS: BotSettings = {
  warning_threshold: 60,
  critical_threshold: 40,
  max_packages: 50,
  comment_behavior: "always",
};

export default function BotSettingsPage(): React.ReactElement {
  const { status } = useSession();
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    fetch("/api/bot-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.settings) setSettings(data.settings as BotSettings);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status]);

  const handleSave = useCallback(async () => {
    const res = await fetch("/api/bot-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [settings]);

  if (status === "unauthenticated") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <p className="text-gray-400">Sign in to configure bot settings.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <Link
        href="/integrations"
        className="text-sm text-gray-400 hover:text-white transition-colors"
      >
        &larr; Back to integrations
      </Link>

      <h1 className="text-2xl font-bold mt-6 mb-2">Bot Settings</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configure how the GitHub App behaves on your repos.
      </p>

      {/* Thresholds */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">Score Thresholds</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Warning below</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={settings.warning_threshold}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, warning_threshold: Number(e.target.value) }))
                  }
                  className="flex-1 accent-yellow-400"
                />
                <span className="text-sm font-mono w-8 text-yellow-400">
                  {settings.warning_threshold}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Critical below</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={settings.critical_threshold}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, critical_threshold: Number(e.target.value) }))
                  }
                  className="flex-1 accent-red-400"
                />
                <span className="text-sm font-mono w-8 text-red-400">
                  {settings.critical_threshold}
                </span>
              </div>
            </div>
          </div>
          {/* Preview bar */}
          <div className="mt-3 h-2 rounded-full overflow-hidden flex">
            <div
              className="bg-red-400"
              style={{ width: `${settings.critical_threshold}%` }}
            />
            <div
              className="bg-yellow-400"
              style={{ width: `${settings.warning_threshold - settings.critical_threshold}%` }}
            />
            <div
              className="bg-green-400"
              style={{ width: `${100 - settings.warning_threshold}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-red-400">Critical</span>
            <span className="text-[10px] text-yellow-400">Warning</span>
            <span className="text-[10px] text-green-400">Healthy</span>
          </div>
        </div>

        {/* Max packages */}
        <div>
          <h3 className="text-sm font-medium mb-1">Max packages per PR</h3>
          <p className="text-xs text-gray-600 mb-2">
            Limit how many packages appear in the PR comment.
          </p>
          <input
            type="number"
            min={5}
            max={200}
            value={settings.max_packages}
            onChange={(e) =>
              setSettings((s) => ({ ...s, max_packages: Number(e.target.value) }))
            }
            className="w-24 px-3 py-2 text-sm bg-gray-900 border border-gray-800 rounded-lg text-white"
          />
        </div>

        {/* Comment behavior */}
        <div>
          <h3 className="text-sm font-medium mb-2">Comment behavior</h3>
          {(
            [
              { value: "always" as const, label: "Always comment", desc: "Post on every PR with dependency changes" },
              { value: "warnings_only" as const, label: "Only on warnings", desc: "Skip if all packages are healthy" },
              { value: "silent" as const, label: "Silent mode", desc: "Log activity but don't post comments" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-2 ${
                settings.comment_behavior === opt.value
                  ? "bg-gray-800 border border-gray-700"
                  : "border border-transparent hover:bg-gray-900"
              }`}
            >
              <input
                type="radio"
                name="comment_behavior"
                value={opt.value}
                checked={settings.comment_behavior === opt.value}
                onChange={() =>
                  setSettings((s) => ({ ...s, comment_behavior: opt.value }))
                }
                className="mt-0.5 accent-blue-500"
              />
              <div>
                <div className="text-sm">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? "bg-green-600/20 text-green-400"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {saved ? "Saved!" : "Save settings"}
        </button>
      </div>
    </main>
  );
}
