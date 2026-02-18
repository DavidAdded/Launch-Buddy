"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const firstName = (formData.get("first_name") as string)?.trim() ?? "";
  const lastName = (formData.get("last_name") as string)?.trim() ?? "";

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      first_name: firstName,
      last_name: lastName,
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { error: null };
}
