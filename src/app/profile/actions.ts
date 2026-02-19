"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsAdmin } from "@/lib/admin";

export async function updateProfile(formData: FormData, targetUserId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileUserId = targetUserId ?? user.id;
  const isAdmin = await getIsAdmin();
  const canEdit = profileUserId === user.id || isAdmin;

  if (!canEdit) {
    return { error: "Forbidden" };
  }

  const firstName = (formData.get("first_name") as string)?.trim() ?? "";
  const lastName = (formData.get("last_name") as string)?.trim() ?? "";

  let error: { message: string } | null = null;

  if (profileUserId === user.id) {
    const result = await supabase.from("profiles").upsert({
      id: profileUserId,
      first_name: firstName,
      last_name: lastName,
    });
    error = result.error;
  } else {
    const adminClient = createAdminClient();
    const result = await adminClient
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
      })
      .eq("id", profileUserId);
    error = result.error;
  }

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  if (profileUserId !== user.id) {
    revalidatePath(`/admin/users/${profileUserId}/profile`);
    revalidatePath("/admin/users");
  }
  return { error: null };
}
