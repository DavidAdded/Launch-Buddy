"use client";

import { useState } from "react";

interface AttendanceTransaction {
  EmployeeId: string;
  CauseCode: string;
  Date: string;
  Hours: number;
  Project: string;
  CostCenter: string;
}

interface TimeReportsResponse {
  AttendanceTransactions?: AttendanceTransaction[];
}

export function FortnoxClient({
  isConnected,
  error: initialError,
  justConnected,
}: {
  isConnected: boolean;
  error: string | null;
  justConnected: boolean;
}) {
  const [connected, setConnected] = useState(isConnected);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reports, setReports] = useState<AttendanceTransaction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/fortnox/disconnect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to disconnect");
      }
      setConnected(false);
      setReports(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleFetchReports() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/fortnox/time-reports");
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setConnected(false);
        }
        throw new Error(data.error ?? "Failed to fetch time reports");
      }
      const data: TimeReportsResponse = await res.json();
      setReports(data.AttendanceTransactions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch time reports");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {justConnected && !error && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Successfully connected to Fortnox!
        </div>
      )}

      {!connected ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 dark:text-zinc-400">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Connect to Fortnox
          </h2>
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            Authorize with your Fortnox account to view time reports.
          </p>
          <a
            href="/api/fortnox/auth"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" x2="3" y1="12" y2="12" />
            </svg>
            Connect to Fortnox
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">Connected to Fortnox</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Your account is linked and ready to use.</p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="cursor-pointer rounded-full border border-red-200 px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Time Reports</h3>
              <button
                onClick={handleFetchReports}
                disabled={loading}
                className="cursor-pointer rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading ? "Loading..." : reports ? "Refresh" : "Fetch Time Reports"}
              </button>
            </div>

            <div className="p-6">
              {reports === null && !loading && (
                <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Click &quot;Fetch Time Reports&quot; to load your attendance data from Fortnox.
                </p>
              )}

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
                </div>
              )}

              {reports !== null && !loading && reports.length === 0 && (
                <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No time reports found.
                </p>
              )}

              {reports !== null && !loading && reports.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Date</th>
                        <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Employee</th>
                        <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Project</th>
                        <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Cause Code</th>
                        <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Cost Center</th>
                        <th className="pb-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {reports.map((row, i) => (
                        <tr key={i}>
                          <td className="py-3 pr-4 text-zinc-900 dark:text-zinc-100">{row.Date}</td>
                          <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">{row.EmployeeId}</td>
                          <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">{row.Project || "—"}</td>
                          <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">{row.CauseCode || "—"}</td>
                          <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">{row.CostCenter || "—"}</td>
                          <td className="py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">{row.Hours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
