"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/checklist-defaults";
import OpenAI from "openai";
import {
  buildGroupPrompt,
  GROUP_JSON_SCHEMA,
  FOOTPRINT_GROUPS,
} from "@/lib/footprint-prompt";
import type { GroupResponse, FootprintFullResponse } from "@/lib/footprint-prompt";

function parseOptionalBudgetHours(value: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return { value: null as number | null, error: null as string | null };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      value: null as number | null,
      error: "Project budget (hours) must be a number greater than or equal to 0",
    };
  }

  return { value: parsed, error: null as string | null };
}

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const customerId = formData.get("customer_id") as string;
  const stagingUrl = formData.get("staging_url") as string;
  const prodUrl = formData.get("prod_url") as string;
  const figmaUrl = formData.get("figma_url") as string;
  const webflowUrl = formData.get("webflow_url") as string;
  const projectBudgetHoursInput = formData.get("project_budget_hours") as string;

  if (!name?.trim()) {
    redirect(
      "/projects/new?error=" + encodeURIComponent("Project name is required"),
    );
  }

  const parsedBudget = parseOptionalBudgetHours(projectBudgetHoursInput);
  if (parsedBudget.error) {
    redirect(
      "/projects/new?error=" + encodeURIComponent(parsedBudget.error),
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: name.trim(),
      customer_id: customerId?.trim() || null,
      staging_url: stagingUrl?.trim() || null,
      prod_url: prodUrl?.trim() || null,
      figma_url: figmaUrl?.trim() || null,
      webflow_url: webflowUrl?.trim() || null,
      project_budget_hours: parsedBudget.value,
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
  const customerId = formData.get("customer_id") as string;
  const stagingUrl = formData.get("staging_url") as string;
  const prodUrl = formData.get("prod_url") as string;
  const figmaUrl = formData.get("figma_url") as string;
  const webflowUrl = formData.get("webflow_url") as string;
  const projectBudgetHoursInput = formData.get("project_budget_hours") as string;
  const isPublic = formData.get("is_public") === "true";

  if (!name?.trim()) {
    return { error: "Project name is required" };
  }

  const parsedBudget = parseOptionalBudgetHours(projectBudgetHoursInput);
  if (parsedBudget.error) {
    return { error: parsedBudget.error };
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
    customer_id: customerId?.trim() || null,
    staging_url: stagingUrl?.trim() || null,
    prod_url: prodUrl?.trim() || null,
    figma_url: figmaUrl?.trim() || null,
    webflow_url: webflowUrl?.trim() || null,
    project_budget_hours: parsedBudget.value,
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
    .select("id, customer_id, prod_url, customers(name)")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Project not found" };
  }

  const customer = project.customers as unknown as { name: string } | null;
  const companyName = customer?.name;
  if (!companyName?.trim()) {
    return { error: "Company is required. Set it in project settings." };
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

    const groupResults = await Promise.all(
      FOOTPRINT_GROUPS.map(async (group) => {
        const prompt = buildGroupPrompt(group, companyName, prodUrl);
        try {
          const response = await openai.responses.create({
            model: MODEL,
            tools: [{ type: "web_search" }],
            input: prompt,
            text: { format: GROUP_JSON_SCHEMA },
          });

          const rawContent = response.output_text;
          if (!rawContent) {
            return { groupId: group.id, error: "Empty response", raw: null, parsed: null };
          }

          const parsed = JSON.parse(rawContent) as GroupResponse;
          return { groupId: group.id, error: null, raw: rawContent, parsed };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return { groupId: group.id, error: message, raw: null, parsed: null };
        }
      })
    );

    const failed = groupResults.filter((r) => r.error !== null);
    const succeeded = groupResults.filter((r) => r.parsed !== null);

    if (succeeded.length === 0) {
      const errorSummary = failed
        .map((f) => `${f.groupId}: ${f.error}`)
        .join("; ");
      await supabase
        .from("footprint_requests")
        .update({
          status: "error",
          error_message: `All 10 groups failed. ${errorSummary}`,
        })
        .eq("id", request.id);
      return { error: "All analysis groups failed. Please try again." };
    }

    const fullResponse: FootprintFullResponse = {
      groups: FOOTPRINT_GROUPS.map((group) => {
        const result = groupResults.find((r) => r.groupId === group.id);
        if (result?.parsed) {
          return result.parsed;
        }
        return {
          summary: "This group could not be analyzed. Please re-analyze.",
          questions: group.questions.map((q) => ({
            question: q,
            answer: "Analysis failed for this question.",
            confidence: 0,
            sources: [],
          })),
        };
      }),
    };

    const rawResponses = Object.fromEntries(
      groupResults
        .filter((r) => r.raw !== null)
        .map((r) => [r.groupId, r.raw])
    );

    const status = failed.length > 0 ? "completed" : "completed";
    const errorNote =
      failed.length > 0
        ? `${failed.length} of 10 groups failed: ${failed.map((f) => f.groupId).join(", ")}`
        : null;

    await supabase
      .from("footprint_requests")
      .update({
        status,
        raw_response: JSON.stringify(rawResponses),
        parsed_response: fullResponse,
        error_message: errorNote,
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
