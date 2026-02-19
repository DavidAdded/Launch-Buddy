import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fortnoxApiFetch,
  refreshAccessToken,
} from "@/lib/fortnox/client";

export async function GET() {
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
      { status: 404 }
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
        Date.now() + refreshed.expires_in * 1000
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
      await supabase
        .from("fortnox_tokens")
        .delete()
        .eq("user_id", user.id);

      return NextResponse.json(
        { error: "Session expired — please reconnect to Fortnox" },
        { status: 401 }
      );
    }
  }

  try {
    const response = await fortnoxApiFetch(
      accessToken,
      "/attendancetransactions"
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Fortnox API error:", response.status, text);
      return NextResponse.json(
        { error: `Fortnox API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Fortnox API fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch time reports" },
      { status: 500 }
    );
  }
}
