"use client";

import React, { useMemo, useState } from "react";

type RegistrationRow = Record<string, unknown>;

type LocalUserMatch = {
  id: string;
  name: string;
  email: string | null;
};

type ProjectBudgetMatch = {
  projectId: string;
  projectName: string;
  budgetHours: number | null;
  customerName: string | null;
};

type FortnoxApiPayload = {
  fortnox?: unknown;
  usersByFortnoxId?: Record<string, LocalUserMatch>;
  projectsByCustomerFortnoxId?: Record<string, ProjectBudgetMatch[]>;
};

function extractRows(data: unknown): RegistrationRow[] {
  if (data && typeof data === "object" && "fortnox" in (data as Record<string, unknown>)) {
    return extractRows((data as FortnoxApiPayload).fortnox);
  }

  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    const values = Object.values(data as Record<string, unknown>);
    for (const val of values) {
      if (Array.isArray(val) && val.length > 0) return val;
    }
  }

  return [];
}

function extractApiPayload(data: unknown): FortnoxApiPayload {
  if (data && typeof data === "object") {
    return data as FortnoxApiPayload;
  }
  return {};
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "\u2014";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function extractName(val: unknown): string {
  if (val === null || val === undefined || val === "") return "\u2014";
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    if (typeof obj.name === "string" && obj.name) return obj.name;
    if (typeof obj.Name === "string" && obj.Name) return obj.Name;
    if (typeof obj.id === "string" && obj.id) return obj.id;
    return JSON.stringify(val);
  }
  return String(val);
}

function extractId(val: unknown): string {
  if (val === null || val === undefined || val === "") return "Unknown";
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    if (obj.id != null) return String(obj.id);
    if (obj.number != null) return String(obj.number);
    return JSON.stringify(val);
  }
  return String(val);
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Heuristic key lookups — the registrations-v2 endpoint is sparsely documented */
const CUSTOMER_ID_KEYS = ["customer", "Customer", "customerId", "customerid", "customer_id", "CustomerId", "customerNumber", "customernumber", "customer_number", "CustomerNumber"];
const USER_KEYS = ["employee", "Employee", "user", "User", "employeeId", "employeeid", "employee_id", "EmployeeId", "userId", "userid", "user_id", "UserId"];
const WORKED_HOURS_KEYS = ["workedHours", "workedhours", "worked_hours", "WorkedHours", "hours", "Hours", "quantity", "Quantity", "registeredAmount", "amount", "Amount", "time", "Time"];
const NOTE_KEYS = ["note", "Note", "notes", "Notes", "description", "Description", "text", "Text", "comment", "Comment"];

function findKey(row: RegistrationRow, candidates: string[]): string | null {
  for (const k of candidates) {
    if (k in row) return k;
  }
  return null;
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

type CustomerSummary = {
  customerId: string;
  customerName: string;
  totalWorkedHours: number;
  registrations: number;
};

type DetectedKeys = {
  customerKey: string | null;
  userKey: string | null;
  workedHoursKey: string | null;
  noteKey: string | null;
};

function detectKeys(rows: RegistrationRow[]): DetectedKeys {
  if (rows.length === 0) return { customerKey: null, userKey: null, workedHoursKey: null, noteKey: null };
  const sample = rows[0];
  return {
    customerKey: findKey(sample, CUSTOMER_ID_KEYS),
    userKey: findKey(sample, USER_KEYS),
    workedHoursKey: findKey(sample, WORKED_HOURS_KEYS),
    noteKey: findKey(sample, NOTE_KEYS),
  };
}

function groupByCustomer(
  rows: RegistrationRow[],
  keys: DetectedKeys,
): CustomerSummary[] {
  if (rows.length === 0) return [];

  const map = new Map<string, { name: string; workedHours: number; registrations: number }>();

  for (const row of rows) {
    const id = keys.customerKey ? extractId(row[keys.customerKey]) : "Unknown";
    const name = keys.customerKey ? extractName(row[keys.customerKey]) : id;
    const worked = keys.workedHoursKey ? toNumber(row[keys.workedHoursKey]) : 0;
    const existing = map.get(id);
    if (existing) {
      existing.workedHours += worked;
      existing.registrations += 1;
      if (existing.name === id && name !== id) existing.name = name;
    } else {
      map.set(id, { name, workedHours: worked, registrations: 1 });
    }
  }

  return [...map.entries()]
    .map(([customerId, data]) => ({
      customerId,
      customerName: data.name,
      totalWorkedHours: Math.round(data.workedHours * 100) / 100,
      registrations: data.registrations,
    }))
    .sort((a, b) => b.totalWorkedHours - a.totalWorkedHours);
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
  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [connected, setConnected] = useState(isConnected);
  const [disconnecting, setDisconnecting] = useState(false);
  const [rows, setRows] = useState<RegistrationRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [fromDate, setFromDate] = useState(toDateString(oneWeekAgo));
  const [toDate, setToDate] = useState(toDateString(today));
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [usersByFortnoxId, setUsersByFortnoxId] = useState<
    Record<string, LocalUserMatch>
  >({});
  const [projectsByCustomerFortnoxId, setProjectsByCustomerFortnoxId] = useState<
    Record<string, ProjectBudgetMatch[]>
  >({});

  const keys = useMemo(() => detectKeys(rows ?? []), [rows]);

  const summaries = useMemo(
    () => groupByCustomer(rows ?? [], keys),
    [rows, keys],
  );

  const totalWorkedAll = useMemo(
    () => Math.round(summaries.reduce((sum, s) => sum + s.totalWorkedHours, 0) * 100) / 100,
    [summaries],
  );

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
      setRows(null);
      setRawResponse(null);
      setUsersByFortnoxId({});
      setProjectsByCustomerFortnoxId({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleFetchReports() {
    setLoading(true);
    setError(null);
    setExpandedCustomer(null);

    try {
      const params = new URLSearchParams({ fromDate, toDate });
      const res = await fetch(`/api/fortnox/time-reports?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setConnected(false);
        }
        throw new Error(data.error ?? "Failed to fetch time reports");
      }
      const data: unknown = await res.json();
      setRawResponse(data);
      const extracted = extractRows(data);
      setRows(extracted);

      const payload = extractApiPayload(data);
      setUsersByFortnoxId(payload.usersByFortnoxId ?? {});
      setProjectsByCustomerFortnoxId(payload.projectsByCustomerFortnoxId ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch time reports");
    } finally {
      setLoading(false);
    }
  }

  function getCustomerRows(customerId: string): RegistrationRow[] {
    if (!rows || !keys.customerKey) return [];
    return rows.filter((r) => extractId(r[keys.customerKey!]) === customerId);
  }

  function renderUserCell(row: RegistrationRow): string {
    if (!keys.userKey) return "\u2014";
    const rawUser = row[keys.userKey];
    const fortnoxUserId = extractId(rawUser);
    const localUser = usersByFortnoxId[fortnoxUserId];
    if (localUser) {
      return `${localUser.name}`;
    }
    return extractName(rawUser);
  }

  function renderNoteCell(row: RegistrationRow): string {
    if (!keys.noteKey) return "\u2014";
    return formatCell(row[keys.noteKey]);
  }

  const inputClassName =
    "rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500";

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
          {/* Connection status */}
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

          {/* Time registrations card */}
          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">Time Registrations</h3>

              {/* Date pickers + fetch button */}
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fromDate" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    From
                  </label>
                  <input
                    id="fromDate"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="toDate" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    To
                  </label>
                  <input
                    id="toDate"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <button
                  onClick={handleFetchReports}
                  disabled={loading}
                  className="cursor-pointer rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {loading ? "Loading..." : rows ? "Refresh" : "Fetch"}
                </button>
              </div>
            </div>

            <div className="p-6">
              {rows === null && !loading && (
                <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Select a date range and click &quot;Fetch&quot; to load time registrations.
                </p>
              )}

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
                </div>
              )}

              {rows !== null && !loading && rows.length === 0 && (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No time registrations found for this period.
                  </p>
                  {rawResponse != null && (
                    <details className="text-left">
                      <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                        Raw API response
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-100 p-4 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {JSON.stringify(rawResponse, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {rows !== null && !loading && rows.length > 0 && (
                <div className="space-y-4">
                  {/* Summary bar */}
                  <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {summaries.length} customer{summaries.length !== 1 ? "s" : ""}
                      {" \u00b7 "}
                      {rows.length} registration{rows.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex gap-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      <span>{totalWorkedAll}h worked</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800">
                          <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Customer</th>
                          <th className="pb-3 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">Worked Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {summaries.map((summary) => {
                          const isExpanded = expandedCustomer === summary.customerId;
                          const customerRows = isExpanded ? getCustomerRows(summary.customerId) : [];

                          return (
                            <React.Fragment key={summary.customerId}>
                              <tr
                                onClick={() => setExpandedCustomer(isExpanded ? null : summary.customerId)}
                                className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                              >
                                <td className="py-3 pr-4">
                                  <div className="flex items-center gap-3">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className={`text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    >
                                      <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                    <div>
                                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {summary.customerName !== summary.customerId ? summary.customerName : `Customer ${summary.customerId}`}
                                      </p>
                                       <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                         Fortnox ID: {summary.customerId} - {summary.registrations} registration{summary.registrations !== 1 ? "s" : ""}
                                       </p>
                                     </div>
                                   </div>
                                </td>
                                <td className="py-3 pr-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                                  {summary.totalWorkedHours}h
                                </td>
                              </tr>

                              {isExpanded && customerRows.length > 0 && (
                                <tr>
                                  <td colSpan={2} className="p-0">
                                    <div className="space-y-4 border-y border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/30">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-zinc-200/50 dark:border-zinc-700/50">
                                            <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">User</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">Worked Hours</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Note</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-800/50">
                                          {customerRows.map((row, idx) => (
                                            <tr key={idx}>
                                              <td className="whitespace-nowrap px-4 py-2 text-zinc-700 dark:text-zinc-300">
                                                {renderUserCell(row)}
                                              </td>
                                              <td className="whitespace-nowrap px-4 py-2 text-right text-zinc-700 dark:text-zinc-300">
                                                {keys.workedHoursKey ? formatCell(row[keys.workedHoursKey]) : "\u2014"}
                                              </td>
                                              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                                                {renderNoteCell(row)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>

                                      {(projectsByCustomerFortnoxId[summary.customerId] ?? []).length > 0 && (
                                        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                                          <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            Project Budget Comparison
                                          </p>
                                          <div className="space-y-2">
                                            {(projectsByCustomerFortnoxId[summary.customerId] ?? []).map((project) => {
                                              const budgetHours = project.budgetHours;
                                              const difference =
                                                typeof budgetHours === "number"
                                                  ? Math.round((summary.totalWorkedHours - budgetHours) * 100) / 100
                                                  : null;

                                              return (
                                                <div
                                                  key={project.projectId}
                                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                                                >
                                                  <div>
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                      {project.projectName}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                      Worked: {summary.totalWorkedHours}h
                                                      {typeof budgetHours === "number"
                                                        ? ` · Budget: ${budgetHours}h`
                                                        : " · Budget: not set"}
                                                    </p>
                                                  </div>
                                                  {difference !== null && (
                                                    <p
                                                      className={`text-xs font-medium ${
                                                        difference > 0
                                                          ? "text-red-600 dark:text-red-400"
                                                          : "text-green-600 dark:text-green-400"
                                                      }`}
                                                    >
                                                      {difference > 0 ? "+" : ""}
                                                      {difference}h vs budget
                                                    </p>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {rawResponse != null && (
                    <details className="text-left">
                      <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                        Raw API response
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-100 p-4 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {JSON.stringify(rawResponse, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
