"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsAdmin } from "@/lib/admin";
import { getSiteUrl } from "@/lib/site-url";

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
  const siteUrl = getSiteUrl();

  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
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

export async function updateUserFortnoxId(userId: string, fortnoxId: string) {
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

  const { error } = await adminClient
    .from("profiles")
    .update({ fortnox_id: fortnoxId.trim() || null })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function createCustomer(formData: FormData) {
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

  const name = (formData.get("name") as string)?.trim();
  const fortnoxIdRaw = (formData.get("fortnox_id") as string | null) ?? null;
  const fortnoxId = fortnoxIdRaw?.trim() ? fortnoxIdRaw.trim() : null;
  if (!name) {
    return { error: "Company name is required" };
  }

  const { error } = await supabase.from("customers").insert({
    name,
    fortnox_id: fortnoxId,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  revalidatePath("/todos");
  return { success: true };
}

export async function updateCustomer(customerId: string, formData: FormData) {
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

  const name = (formData.get("name") as string)?.trim();
  const fortnoxIdRaw = (formData.get("fortnox_id") as string | null) ?? null;
  const fortnoxId = fortnoxIdRaw?.trim() ? fortnoxIdRaw.trim() : null;
  if (!name) {
    return { error: "Company name is required" };
  }

  const { error } = await supabase
    .from("customers")
    .update({ name, fortnox_id: fortnoxId })
    .eq("id", customerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  revalidatePath("/todos");
  return { success: true };
}

export async function deleteCustomer(customerId: string) {
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

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  revalidatePath("/todos");
  return { success: true };
}
