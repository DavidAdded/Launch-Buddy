"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/checklist-defaults";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const stagingUrl = formData.get("staging_url") as string;
  const prodUrl = formData.get("prod_url") as string;
  const figmaUrl = formData.get("figma_url") as string;
  const webflowUrl = formData.get("webflow_url") as string;

  if (!name?.trim()) {
    redirect("/projects/new?error=" + encodeURIComponent("Project name is required"));
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: name.trim(),
      staging_url: stagingUrl?.trim() || null,
      prod_url: prodUrl?.trim() || null,
      figma_url: figmaUrl?.trim() || null,
      webflow_url: webflowUrl?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    redirect(
      "/projects/new?error=" + encodeURIComponent(error.message)
    );
  }

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const name = formData.get("name") as string;
  const stagingUrl = formData.get("staging_url") as string;
  const prodUrl = formData.get("prod_url") as string;
  const figmaUrl = formData.get("figma_url") as string;
  const webflowUrl = formData.get("webflow_url") as string;
  const isPublic = formData.get("is_public") === "true";

  if (!name?.trim()) {
    return { error: "Project name is required" };
  }

  const { data: existing } = await supabase
    .from("projects")
    .select("user_id, is_public")
    .eq("id", projectId)
    .single();

  if (!existing) {
    return { error: "Project not found" };
  }

  const isOwner = existing.user_id === user.id;

  const updatePayload: Record<string, unknown> = {
    name: name.trim(),
    staging_url: stagingUrl?.trim() || null,
    prod_url: prodUrl?.trim() || null,
    figma_url: figmaUrl?.trim() || null,
    webflow_url: webflowUrl?.trim() || null,
  };

  if (isOwner) {
    updatePayload.is_public = isPublic;
  }

  const { error } = await supabase
    .from("projects")
    .update(updatePayload)
    .eq("id", projectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { error: null };
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: files } = await supabase
    .from("project_files")
    .select("file_path")
    .eq("project_id", projectId);

  if (files && files.length > 0) {
    const paths = files.map((f) => f.file_path);
    await supabase.storage.from("project-files").remove(paths);
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    redirect(
      `/projects/${projectId}?error=` + encodeURIComponent(error.message)
    );
  }

  revalidatePath("/projects");
  redirect("/projects");
}

export async function insertFileRecord(data: {
  projectId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  contentType: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase.from("project_files").insert({
    project_id: data.projectId,
    user_id: user.id,
    file_name: data.fileName,
    file_path: data.filePath,
    file_size: data.fileSize,
    content_type: data.contentType,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);
  return { error: null };
}

export async function deleteFile(fileId: string, filePath: string, projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error: storageError } = await supabase.storage
    .from("project-files")
    .remove([filePath]);

  if (storageError) {
    return { error: storageError.message };
  }

  const { error: dbError } = await supabase
    .from("project_files")
    .delete()
    .eq("id", fileId);

  if (dbError) {
    return { error: dbError.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function initializeChecklist(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { count } = await supabase
    .from("checklist_items")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (count && count > 0) {
    return { error: null };
  }

  const rows = DEFAULT_CHECKLIST_ITEMS.map((item) => ({
    project_id: projectId,
    user_id: user.id,
    group_name: item.group_name,
    label: item.label,
    position: item.position,
    irrelevant: item.irrelevant,
  }));

  const { error } = await supabase.from("checklist_items").insert(rows);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function toggleCheckItem(
  itemId: string,
  checked: boolean,
  projectId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("checklist_items")
    .update({ checked })
    .eq("id", itemId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function toggleIrrelevantItem(
  itemId: string,
  irrelevant: boolean,
  projectId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("checklist_items")
    .update({ irrelevant })
    .eq("id", itemId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function assignItem(
  itemId: string,
  assignee: string | null,
  projectId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("checklist_items")
    .update({ assignee })
    .eq("id", itemId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function deleteChecklistItem(itemId: string, projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function addChecklistItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const projectId = formData.get("project_id") as string;
  const groupName = formData.get("group_name") as string;
  const label = formData.get("label") as string;

  if (!label?.trim()) {
    return { error: "Label is required" };
  }

  const { data: maxRow } = await supabase
    .from("checklist_items")
    .select("position")
    .eq("project_id", projectId)
    .eq("group_name", groupName)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (maxRow?.position ?? -1) + 1;

  const { error } = await supabase.from("checklist_items").insert({
    project_id: projectId,
    user_id: user.id,
    group_name: groupName,
    label: label.trim(),
    position: nextPosition,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}