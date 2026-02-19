import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fortnoxApiFetch, refreshAccessToken } from "@/lib/fortnox/client";

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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tokenRow, error: fetchError } = await supabase
    .from("fortnox_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (fetchError || !tokenRow) {
    return NextResponse.json(
      { error: "Not connected to Fortnox" },
      { status: 404 },
    );
  }

  let accessToken = tokenRow.access_token;

  const expiresAt = new Date(tokenRow.expires_at).getTime();
  const isExpired = Date.now() >= expiresAt - 60_000;

  if (isExpired) {
    try {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      accessToken = refreshed.access_token;

      const newExpiresAt = new Date(
        Date.now() + refreshed.expires_in * 1000,
      ).toISOString();

      await supabase
        .from("fortnox_tokens")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } catch (err) {
      console.error("Token refresh failed:", err);
      await supabase.from("fortnox_tokens").delete().eq("user_id", user.id);

      return NextResponse.json(
        { error: "Session expired — please reconnect to Fortnox" },
        { status: 401 },
      );
    }
  }

  try {
    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    const queryString = params.toString();
    const endpoint = `/api/time/registrations-v2${queryString ? `?${queryString}` : ""}`;

    const response = await fortnoxApiFetch(accessToken, endpoint);

    if (!response.ok) {
      const text = await response.text();
      console.error("Fortnox API error:", response.status, text);
      return NextResponse.json(
        { error: `Fortnox API error: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();

    const [{ data: profiles }, { data: projects }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, email, fortnox_id")
        .not("fortnox_id", "is", null),
      supabase
        .from("projects")
        .select("id, name, project_budget_hours, customers(name, fortnox_id)"),
    ]);

    const usersByFortnoxId: Record<string, LocalUserMatch> = {};
    for (const profile of profiles ?? []) {
      const fortnoxId = String(profile.fortnox_id ?? "").trim();
      if (!fortnoxId) {
        continue;
      }

      const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
      usersByFortnoxId[fortnoxId] = {
        id: profile.id,
        name: fullName || profile.email || "Unknown user",
        email: profile.email,
      };
    }

    const projectsByCustomerFortnoxId: Record<string, ProjectBudgetMatch[]> = {};
    for (const project of projects ?? []) {
      const customerRaw = project.customers as
        | { name: string | null; fortnox_id: string | null }
        | Array<{ name: string | null; fortnox_id: string | null }>
        | null;
      const customer = Array.isArray(customerRaw)
        ? (customerRaw[0] ?? null)
        : customerRaw;
      const customerFortnoxId = String(customer?.fortnox_id ?? "").trim();
      if (!customerFortnoxId) {
        continue;
      }

      const list = projectsByCustomerFortnoxId[customerFortnoxId] ?? [];
      list.push({
        projectId: project.id,
        projectName: project.name,
        budgetHours:
          typeof project.project_budget_hours === "number"
            ? project.project_budget_hours
            : project.project_budget_hours === null
              ? null
              : Number(project.project_budget_hours),
        customerName: customer?.name ?? null,
      });
      projectsByCustomerFortnoxId[customerFortnoxId] = list;
    }

    return NextResponse.json({
      fortnox: data,
      usersByFortnoxId,
      projectsByCustomerFortnoxId,
    });
  } catch (err) {
    console.error("Fortnox API fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch time reports" },
      { status: 500 },
    );
  }
}
