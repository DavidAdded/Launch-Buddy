import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/fortnox/client";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const description = searchParams.get("error_description") ?? "Unknown error";
    return NextResponse.redirect(
      `${origin}/fortnox?error=${encodeURIComponent(description)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${origin}/fortnox?error=${encodeURIComponent("Missing code or state parameter")}`
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("fortnox_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${origin}/fortnox?error=${encodeURIComponent("Invalid state — possible CSRF attack")}`
    );
  }

  cookieStore.delete("fortnox_oauth_state");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    const { error: dbError } = await supabase.from("fortnox_tokens").upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (dbError) {
      console.error("Failed to store Fortnox tokens:", dbError);
      return NextResponse.redirect(
        `${origin}/fortnox?error=${encodeURIComponent("Failed to store tokens")}`
      );
    }

    return NextResponse.redirect(`${origin}/fortnox?connected=true`);
  } catch (err) {
    console.error("Fortnox token exchange error:", err);
    const message =
      err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      `${origin}/fortnox?error=${encodeURIComponent(message)}`
    );
  }
}
