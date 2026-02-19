"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsAdmin } from "@/lib/admin";

export async function inviteUser(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const isAdmin = await getIsAdmin();
  if (!isAdmin) {
    return { error: "Not authorized" };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) {
    return { error: "Email is required" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/auth/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const isAdmin = await getIsAdmin();
  if (!isAdmin) {
    return { error: "Not authorized" };
  }

  if (userId === user.id) {
    return { error: "You cannot delete yourself" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserScope(userId: string, scope: string, enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const isAdmin = await getIsAdmin();
  if (!isAdmin) {
    return { error: "Not authorized" };
  }

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("scopes")
    .eq("id", userId)
    .single();

  if (!profile) {
    return { error: "User not found" };
  }

  const currentScopes: string[] = Array.isArray(profile.scopes) ? profile.scopes : [];

  const newScopes = enabled
    ? [...new Set([...currentScopes, scope])]
    : currentScopes.filter((s) => s !== scope);

  const { error } = await adminClient
    .from("profiles")
    .update({ scopes: newScopes })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}
