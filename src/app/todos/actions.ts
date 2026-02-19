"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addTodoItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const label = formData.get("label") as string;
  const customerIdRaw = (formData.get("customer_id") as string | null) ?? null;
  const customerId = customerIdRaw?.trim() ? customerIdRaw.trim() : null;
  if (!label?.trim()) {
    return { error: "Label is required" };
  }

  const { data: maxRow } = await supabase
    .from("todo_items")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (maxRow?.position ?? -1) + 1;

  const { error } = await supabase.from("todo_items").insert({
    user_id: user.id,
    label: label.trim(),
    customer_id: customerId,
    position: nextPosition,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/todos");
  return { error: null };
}

export async function toggleTodoItem(itemId: string, checked: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("todo_items")
    .update({ checked })
    .eq("id", itemId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/todos");
  return { error: null };
}

export async function deleteTodoItem(itemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("todo_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/todos");
  return { error: null };
}

export async function assignTodoItem(itemId: string, assignedTo: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("todo_items")
    .update({ assigned_to: assignedTo })
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/todos");
  return { error: null };
}

export async function assignTodoCustomer(
  itemId: string,
  customerId: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("todo_items")
    .update({ customer_id: customerId })
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/todos");
  return { error: null };
}
