"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/checklist-defaults";
import OpenAI from "openai";
import {
  buildFootprintPrompt,
  FOOTPRINT_JSON_SCHEMA,
} from "@/lib/footprint-prompt";
import type { FootprintResponse } from "@/lib/footprint-prompt";

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
    redirect(
      "/projects/new?error=" + encodeURIComponent("Project name is required"),
    );
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
    redirect("/projects/new?error=" + encodeURIComponent(error.message));
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
  const companyName = formData.get("company_name") as string;
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
    company_name: companyName?.trim() || null,
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
      `/projects/${projectId}?error=` + encodeURIComponent(error.message),
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

export async function deleteFile(
  fileId: string,
  filePath: string,
  projectId: string,
) {
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
  projectId: string,
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
  projectId: string,
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
  projectId: string,
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

export async function requestFootprint(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, company_name, prod_url")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Project not found" };
  }

  const companyName = project.company_name;
  if (!companyName?.trim()) {
    return { error: "Company name is required. Set it in project settings." };
  }

  const prodUrl = project.prod_url;
  if (!prodUrl?.trim()) {
    return {
      error:
        "Production URL is required for authority analysis. Set it in project settings.",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your-openai-api-key-here") {
    return { error: "OpenAI API key is not configured." };
  }

  const MODEL = "gpt-5.2";
  const prompt = buildFootprintPrompt(companyName, prodUrl);

  const { data: request, error: insertError } = await supabase
    .from("footprint_requests")
    .insert({
      project_id: projectId,
      requested_by: user.id,
      model_name: MODEL,
      company_name: companyName,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !request) {
    return { error: insertError?.message ?? "Failed to create request" };
  }

  try {
    const openai = new OpenAI({ apiKey });

    const response = await openai.responses.create({
      model: MODEL,
      tools: [{ type: "web_search" }],
      input: prompt,
      text: {
        format: FOOTPRINT_JSON_SCHEMA,
      },
    });

    const rawContent = response.output_text;
    if (!rawContent) {
      await supabase
        .from("footprint_requests")
        .update({
          status: "error",
          error_message: "Empty response from model",
        })
        .eq("id", request.id);
      return { error: "Empty response from model" };
    }

    let parsed: FootprintResponse;
    try {
      parsed = JSON.parse(rawContent) as FootprintResponse;
    } catch {
      await supabase
        .from("footprint_requests")
        .update({
          status: "error",
          raw_response: rawContent,
          error_message: "Invalid JSON in model response",
        })
        .eq("id", request.id);
      return { error: "Model returned invalid JSON" };
    }

    await supabase
      .from("footprint_requests")
      .update({
        status: "completed",
        raw_response: rawContent,
        parsed_response: parsed,
      })
      .eq("id", request.id);

    revalidatePath(`/projects/${projectId}/digital-footprint`);
    revalidatePath(`/projects/${projectId}`);
    return { error: null, requestId: request.id };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error calling OpenAI";
    await supabase
      .from("footprint_requests")
      .update({ status: "error", error_message: message })
      .eq("id", request.id);
    return { error: message };
  }
}
