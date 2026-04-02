"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/checklist-defaults";
import OpenAI from "openai";
import {
  buildGroupPrompt,
  buildOriginSummaryPrompt,
  buildHierarchyNodeSummaryPrompt,
  GROUP_JSON_SCHEMA,
  NODE_SUMMARY_JSON_SCHEMA,
  ORIGIN_SUMMARY_JSON_SCHEMA,
  FOOTPRINT_GROUPS,
} from "@/lib/footprint-prompt";
import type {
  GroupResponse,
  FootprintFullResponse,
  FootprintGroup,
  FootprintOriginSummary,
  FootprintNodeAnswer,
  Source,
} from "@/lib/footprint-prompt";
import { buildTreeFromGroups } from "@/lib/footprint-hierarchy";
import type { FootprintTreeNode } from "@/lib/footprint-hierarchy";
import { analyzeSeoAeoUrl } from "@/lib/seo-aeo-analyzer";

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

export async function analyzeSeoAeoPage(projectId: string, rawUrl?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated", result: null };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, prod_url, user_id, is_public")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Project not found", result: null };
  }

  const canAnalyze = project.user_id === user.id || project.is_public;
  if (!canAnalyze) {
    return { error: "Not authorized", result: null };
  }

  const targetUrl = rawUrl?.trim() || project.prod_url?.trim() || "";
  if (!targetUrl) {
    return {
      error: "Production URL is missing. Set one in project settings or enter a URL.",
      result: null,
    };
  }

  try {
    const result = await analyzeSeoAeoUrl(targetUrl);
    revalidatePath(`/projects/${projectId}/seo-aeo`);
    return { error: null, result };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to analyze the page";
    return { error: message, result: null };
  }
}

function sanitizeFootprintGroups(groups: FootprintGroup[] | undefined): FootprintGroup[] {
  if (!groups || groups.length === 0) {
    return FOOTPRINT_GROUPS;
  }

  const cleaned = groups
    .map((group, groupIndex) => {
      const id = group.id?.trim() || `group_${groupIndex + 1}`;
      const title = group.title?.trim() || `Category ${groupIndex + 1}`;
      const emoji = group.emoji?.trim() || "📌";
      const questions = (group.questions ?? [])
        .map((question) => question.trim())
        .filter(Boolean);

      if (questions.length === 0) {
        return null;
      }

      return { id, title, emoji, questions };
    })
    .filter((group): group is FootprintGroup => Boolean(group));

  return cleaned.length > 0 ? cleaned : FOOTPRINT_GROUPS;
}

function inferGroupMetaFromParsed(parsed: FootprintFullResponse): FootprintGroup[] {
  return parsed.groups.map((group, index) => ({
    id: `group_${index + 1}`,
    title: `Category ${index + 1}`,
    emoji: "📌",
    questions: group.questions.map((question) => question.question),
  }));
}

function coerceGroupResponse(raw: GroupResponse, group: FootprintGroup): GroupResponse {
  if (!Array.isArray(raw.questions) || raw.questions.length !== group.questions.length) {
    throw new Error(
      `Invalid question count for ${group.id}. Expected ${group.questions.length}, got ${raw.questions?.length ?? 0}.`,
    );
  }

  return {
    summary:
      typeof raw.summary === "string" && raw.summary.trim()
        ? raw.summary.trim()
        : "No summary provided.",
    questions: group.questions.map((expectedQuestion, index) => {
      const item = raw.questions[index];
      const confidence =
        typeof item.confidence === "number" && Number.isFinite(item.confidence)
          ? Math.max(0, Math.min(1, item.confidence))
          : 0;

      return {
        question: expectedQuestion,
        answer:
          typeof item.answer === "string" && item.answer.trim()
            ? item.answer.trim()
            : "No answer provided.",
        confidence,
        sources: Array.isArray(item.sources) ? item.sources : [],
      };
    }),
  };
}

function coerceOriginSummary(raw: FootprintOriginSummary): FootprintOriginSummary {
  const confidence =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0;

  const sources = Array.isArray(raw.sources)
    ? raw.sources.filter(
        (source): source is FootprintOriginSummary["sources"][number] =>
          Boolean(source?.url && source?.title && source?.type),
      )
    : [];

  return {
    summary:
      typeof raw.summary === "string" && raw.summary.trim()
        ? raw.summary.trim()
        : "No overall summary provided.",
    confidence,
    sources,
  };
}

function normalizeQuestionKey(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function flattenTreePostOrder(nodes: FootprintTreeNode[]): FootprintTreeNode[] {
  const ordered: FootprintTreeNode[] = [];

  function walk(node: FootprintTreeNode) {
    node.children.forEach(walk);
    ordered.push(node);
  }

  nodes.forEach(walk);
  return ordered;
}

function coerceNodeAnswerPayload(raw: {
  answer: string;
  confidence: number;
  sources: FootprintNodeAnswer["sources"];
}) {
  return {
    answer:
      typeof raw.answer === "string" && raw.answer.trim()
        ? raw.answer.trim()
        : "No summary provided.",
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0,
    sources: Array.isArray(raw.sources) ? raw.sources : [],
  };
}

export async function requestFootprint(
  projectId: string,
  customGroups?: FootprintGroup[],
  customTree?: FootprintTreeNode[] | null,
) {
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
  const groupsToUse = sanitizeFootprintGroups(customGroups);
  const treeToUse = customTree && customTree.length > 0 ? customTree : buildTreeFromGroups(groupsToUse);

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
      groupsToUse.map(async (group) => {
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
          const coerced = coerceGroupResponse(parsed, group);
          return { groupId: group.id, error: null, raw: rawContent, parsed: coerced };
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
          error_message: `All ${groupsToUse.length} groups failed. ${errorSummary}`,
        })
        .eq("id", request.id);
      return { error: "All analysis groups failed. Please try again." };
    }

    const resolvedGroups = groupsToUse.map((group) => {
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
    });

    const nodeAnswers: Record<string, FootprintNodeAnswer> = {};
    const questionLookup = new Map<string, GroupResponse["questions"][number]>();

    groupsToUse.forEach((group, groupIndex) => {
      const response = resolvedGroups[groupIndex];
      if (!response) return;

      response.questions.forEach((questionAnswer) => {
        const key = `${group.id}::${normalizeQuestionKey(questionAnswer.question)}`;
        questionLookup.set(key, questionAnswer);
      });
    });

    const orderedNodes = flattenTreePostOrder(treeToUse);

    for (const node of orderedNodes) {
      if (node.kind === "question") {
        const questionText = node.question ?? node.title;
        const key = `${node.groupId ?? ""}::${normalizeQuestionKey(questionText)}`;
        const matched = questionLookup.get(key);

        nodeAnswers[node.id] = {
          nodeId: node.id,
          title: node.title,
          kind: node.kind,
          answer: matched?.answer ?? "No answer provided for this node.",
          confidence: matched?.confidence ?? 0,
          sources: matched?.sources ?? [],
        };
        continue;
      }

      const childAnswers = node.children
        .map((child) => nodeAnswers[child.id])
        .filter((child): child is FootprintNodeAnswer => Boolean(child));

      if (childAnswers.length === 0) {
        nodeAnswers[node.id] = {
          nodeId: node.id,
          title: node.title,
          kind: node.kind,
          answer: "No child answers available for this category.",
          confidence: 0,
          sources: [],
        };
        continue;
      }

      try {
        const summaryPrompt = buildHierarchyNodeSummaryPrompt(
          companyName,
          prodUrl,
          node.title,
          childAnswers.map((child) => ({
            title: child.title,
            answer: child.answer,
            confidence: child.confidence,
            sources: child.sources,
          })),
        );

        const nodeSummaryResponse = await openai.responses.create({
          model: MODEL,
          input: summaryPrompt,
          text: { format: NODE_SUMMARY_JSON_SCHEMA },
        });

        const rawSummary = nodeSummaryResponse.output_text || "";
        const parsedSummary = JSON.parse(rawSummary) as {
          answer: string;
          confidence: number;
          sources: FootprintNodeAnswer["sources"];
        };
        const coercedSummary = coerceNodeAnswerPayload(parsedSummary);

        nodeAnswers[node.id] = {
          nodeId: node.id,
          title: node.title,
          kind: node.kind,
          answer: coercedSummary.answer,
          confidence: coercedSummary.confidence,
          sources: coercedSummary.sources,
        };
      } catch {
        const avgConfidence =
          childAnswers.reduce((sum, child) => sum + child.confidence, 0) / childAnswers.length;

        nodeAnswers[node.id] = {
          nodeId: node.id,
          title: node.title,
          kind: node.kind,
          answer: childAnswers
            .slice(0, 3)
            .map((child) => child.answer)
            .join(" ")
            .trim() || "No summary provided.",
          confidence: avgConfidence,
          sources: childAnswers.flatMap((child) => child.sources).slice(0, 6),
        };
      }
    }

    let originSummaryRaw: string | null = null;
    let originSummary: FootprintOriginSummary | undefined;

    try {
      const rootNodeAnswer = nodeAnswers[treeToUse[0]?.id ?? ""];

      if (rootNodeAnswer && treeToUse.length === 1) {
        originSummary = {
          summary: rootNodeAnswer.answer,
          confidence: rootNodeAnswer.confidence,
          sources: rootNodeAnswer.sources,
        };
      } else {
        const originPrompt = buildOriginSummaryPrompt(
          companyName,
          prodUrl,
          groupsToUse,
          resolvedGroups,
        );

        const originResponse = await openai.responses.create({
          model: MODEL,
          input: originPrompt,
          text: { format: ORIGIN_SUMMARY_JSON_SCHEMA },
        });

        originSummaryRaw = originResponse.output_text || null;
        if (originSummaryRaw) {
          const parsedOrigin = JSON.parse(originSummaryRaw) as FootprintOriginSummary;
          originSummary = coerceOriginSummary(parsedOrigin);
        }
      }
    } catch {
      originSummary = undefined;
    }

    const fullResponse: FootprintFullResponse = {
      groups: resolvedGroups,
      group_meta: groupsToUse,
      hierarchy_tree: treeToUse,
      node_answers: nodeAnswers,
      ...(originSummary ? { origin_summary: originSummary } : {}),
    };

    const rawResponses: Record<string, string> = Object.fromEntries(
      groupResults.filter((r) => r.raw !== null).map((r) => [r.groupId, r.raw]),
    );

    if (originSummaryRaw) {
      rawResponses.origin_summary = originSummaryRaw;
    }

    const status = failed.length > 0 ? "completed" : "completed";
    const errorNote =
      failed.length > 0
        ? `${failed.length} of ${groupsToUse.length} groups failed: ${failed.map((f) => f.groupId).join(", ")}`
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


const FOOTPRINT_V2_HEADERS = [
  "theme",
  "question_id",
  "question",
  "model",
  "run_id",
  "answer",
  "sources",
  "confidence",
  "notes",
] as const;

type FootprintV2TemplateRow = {
  theme: string;
  question_id: string;
  question: string;
  model: string;
  run_id: string;
  answer: string;
  sources: string;
  confidence: string;
  notes: string;
};

function parseCsvRowsForFootprintV2(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (char === '"') {
      const next = input[index + 1];
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function parseFootprintV2Template(csvText: string): {
  rows: FootprintV2TemplateRow[];
  error: string | null;
} {
  const parsedRows = parseCsvRowsForFootprintV2(csvText);
  if (parsedRows.length < 2) {
    return {
      rows: [],
      error:
        "CSV template is empty. Include header and at least one question row.",
    };
  }

  const header = parsedRows[0].map((value) => value.trim().toLowerCase());
  const expectedHeader = [...FOOTPRINT_V2_HEADERS];

  const headerMatches =
    header.length === expectedHeader.length &&
    expectedHeader.every((column, index) => header[index] === column);

  if (!headerMatches) {
    return {
      rows: [],
      error: `Invalid CSV header. Expected exactly: ${expectedHeader.join(",")}`,
    };
  }

  const rows: FootprintV2TemplateRow[] = [];

  for (let rowIndex = 1; rowIndex < parsedRows.length; rowIndex += 1) {
    const rawRow = parsedRows[rowIndex];
    const normalizedRow = expectedHeader.map((_, index) =>
      (rawRow[index] ?? "").trim(),
    );

    if (normalizedRow.every((cell) => cell.length === 0)) {
      continue;
    }

    const row = {
      theme: normalizedRow[0],
      question_id: normalizedRow[1],
      question: normalizedRow[2],
      model: normalizedRow[3],
      run_id: normalizedRow[4],
      answer: normalizedRow[5],
      sources: normalizedRow[6],
      confidence: normalizedRow[7],
      notes: normalizedRow[8],
    };

    if (!row.theme || !row.question_id || !row.question) {
      return {
        rows: [],
        error:
          `Row ${rowIndex + 1} is missing required fields. theme, question_id, and question must be set.`,
      };
    }

    rows.push(row);
  }

  if (rows.length === 0) {
    return {
      rows: [],
      error: "CSV template contains no question rows.",
    };
  }

  return { rows, error: null };
}

function escapeCsvCell(value: string) {
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function serializeFootprintV2Csv(rows: FootprintV2TemplateRow[]) {
  const lines = [FOOTPRINT_V2_HEADERS.join(",")];
  for (const row of rows) {
    const line = [
      row.theme,
      row.question_id,
      row.question,
      row.model,
      row.run_id,
      row.answer,
      row.sources,
      row.confidence,
      row.notes,
    ]
      .map((cell) => escapeCsvCell(cell ?? ""))
      .join(",");
    lines.push(line);
  }

  return `${lines.join("\n")}\n`;
}

function normalizeThemeQuestionKey(theme: string, questionId: string) {
  return `${theme.toLowerCase().trim()}::${questionId.toLowerCase().trim()}`;
}

const FOOTPRINT_V2_THEME_JSON_SCHEMA = {
  type: "json_schema" as const,
  name: "footprint_v2_theme_answers",
  strict: true,
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question_id: { type: "string" },
            answer: { type: "string" },
            confidence: { type: "number" },
            notes: { type: "string" },
            sources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string" },
                  title: { type: "string" },
                  type: {
                    type: "string",
                    enum: [
                      "company_site",
                      "press",
                      "directory",
                      "review",
                      "social",
                      "other",
                    ],
                  },
                },
                required: ["url", "title", "type"],
                additionalProperties: false,
              },
            },
          },
          required: ["question_id", "answer", "confidence", "sources", "notes"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
};

function buildFootprintV2ThemePrompt(params: {
  companyName: string;
  prodUrl: string;
  theme: string;
  rows: FootprintV2TemplateRow[];
}) {
  const numbered = params.rows
    .map(
      (row, index) =>
        `${index + 1}. question_id=${row.question_id}\n   question=${row.question}`,
    )
    .join("\n");

  return `You are filling a Digital Footprint v2 CSV template with evidence-based answers.

Company: ${params.companyName}
Website: ${params.prodUrl}
Theme: ${params.theme}

QUESTIONS
${numbered}

PROCESS
1) Browse ${params.prodUrl} and relevant key pages.
2) Run web searches for the company and theme.
3) Prioritize independent, credible third-party sources.

OUTPUT RULES
- Return ONLY valid JSON that matches the schema.
- Return one item per input question_id.
- Keep answer concise but specific (2-4 sentences).
- confidence must be between 0 and 1.
- Include at least 1 source per question when possible.
- notes should mention important caveats, assumptions, or data gaps.
- Never invent URLs. If uncertain, lower confidence and explain in notes.`;
}

function coerceFootprintV2Item(raw: {
  question_id: string;
  answer: string;
  confidence: number;
  notes: string;
  sources: Source[];
}) {
  return {
    question_id: raw.question_id?.trim() ?? "",
    answer:
      typeof raw.answer === "string" && raw.answer.trim()
        ? raw.answer.trim()
        : "No answer provided.",
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0,
    notes:
      typeof raw.notes === "string" && raw.notes.trim()
        ? raw.notes.trim()
        : "",
    sources: Array.isArray(raw.sources)
      ? raw.sources.filter((source) => Boolean(source?.url && source?.title))
      : [],
  };
}

export async function requestFootprintV2TemplateFill(
  projectId: string,
  csvTemplate: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated", outputCsv: null as string | null };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, prod_url, customers(name)")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Project not found", outputCsv: null as string | null };
  }

  const customer = project.customers as unknown as { name: string } | null;
  const companyName = customer?.name?.trim();
  const prodUrl = project.prod_url?.trim();

  if (!companyName) {
    return {
      error: "Company is required. Set it in project settings.",
      outputCsv: null as string | null,
    };
  }

  if (!prodUrl) {
    return {
      error:
        "Production URL is required for authority analysis. Set it in project settings.",
      outputCsv: null as string | null,
    };
  }

  const parsedTemplate = parseFootprintV2Template(csvTemplate);
  if (parsedTemplate.error) {
    return { error: parsedTemplate.error, outputCsv: null as string | null };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your-openai-api-key-here") {
    return {
      error: "OpenAI API key is not configured.",
      outputCsv: null as string | null,
    };
  }

  const MODEL = "gpt-5.2";
  const runId = `dfv2-${Date.now()}`;
  const groupedByTheme = new Map<string, FootprintV2TemplateRow[]>();

  for (const row of parsedTemplate.rows) {
    const existing = groupedByTheme.get(row.theme) ?? [];
    existing.push(row);
    groupedByTheme.set(row.theme, existing);
  }

  try {
    const openai = new OpenAI({ apiKey });

    const themeResults = await Promise.all(
      Array.from(groupedByTheme.entries()).map(async ([theme, rows]) => {
        try {
          const prompt = buildFootprintV2ThemePrompt({
            companyName,
            prodUrl,
            theme,
            rows,
          });

          const response = await openai.responses.create({
            model: MODEL,
            tools: [{ type: "web_search" }],
            input: prompt,
            text: { format: FOOTPRINT_V2_THEME_JSON_SCHEMA },
          });

          const content = response.output_text;
          if (!content) {
            return {
              theme,
              items: [] as Array<{
                question_id: string;
                answer: string;
                confidence: number;
                notes: string;
                sources: Source[];
              }>,
              error: "Empty response",
            };
          }

          const parsed = JSON.parse(content) as {
            items: Array<{
              question_id: string;
              answer: string;
              confidence: number;
              notes: string;
              sources: Source[];
            }>;
          };

          const coerced = Array.isArray(parsed.items)
            ? parsed.items.map(coerceFootprintV2Item)
            : [];

          return {
            theme,
            items: coerced,
            error: null as string | null,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return {
            theme,
            items: [] as Array<{
              question_id: string;
              answer: string;
              confidence: number;
              notes: string;
              sources: Source[];
            }>,
            error: message,
          };
        }
      }),
    );

    const answersByKey = new Map<
      string,
      {
        answer: string;
        confidence: number;
        notes: string;
        sources: Source[];
      }
    >();

    for (const result of themeResults) {
      for (const item of result.items) {
        if (!item.question_id) continue;
        answersByKey.set(normalizeThemeQuestionKey(result.theme, item.question_id), {
          answer: item.answer,
          confidence: item.confidence,
          notes: item.notes,
          sources: item.sources,
        });
      }
    }

    const failedThemes = themeResults.filter((result) => result.error !== null);

    const filledRows: FootprintV2TemplateRow[] = parsedTemplate.rows.map((row) => {
      const key = normalizeThemeQuestionKey(row.theme, row.question_id);
      const answer = answersByKey.get(key);

      const fallbackNote = failedThemes.find((themeResult) => themeResult.theme === row.theme)
        ? "Theme analysis failed for this row."
        : "No model answer returned for this question_id.";

      const sourcesString = (answer?.sources ?? [])
        .slice(0, 6)
        .map((source) => `${source.title} (${source.url})`)
        .join(" | ");

      return {
        ...row,
        model: MODEL,
        run_id: runId,
        answer: answer?.answer ?? "No answer provided.",
        sources: sourcesString,
        confidence: `${Math.round((answer?.confidence ?? 0) * 100) / 100}`,
        notes: answer?.notes || fallbackNote,
      };
    });

    return {
      error: null,
      outputCsv: serializeFootprintV2Csv(filledRows),
      runId,
      fileName: `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-digital-footprint-v2-${runId}.csv`,
      warnings:
        failedThemes.length > 0
          ? failedThemes.map((result) => `${result.theme}: ${result.error}`)
          : [],
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error calling OpenAI";
    return { error: message, outputCsv: null as string | null };
  }
}


type ExperimentalFlowStage = "base" | "summary" | "final";

type ExperimentalTemplateQuestion = {
  theme: string;
  question_id: string;
  question: string;
};

type ExperimentalModelAnswer = {
  question_id: string;
  answer: string;
  confidence: number;
  notes: string;
  sources: Array<{ title: string; url: string }>;
};

const EXPERIMENTAL_FLOW_ID = "experimental_flow_v1";
const EXPERIMENTAL_OPENAI_MODEL = "gpt-5.2";
const EXPERIMENTAL_CLAUDE_MODEL = "claude-sonnet-4.5";

const EXPERIMENTAL_JSON_SCHEMA = {
  type: "json_schema" as const,
  name: "experimental_flow_answers",
  strict: true,
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question_id: { type: "string" },
            answer: { type: "string" },
            confidence: { type: "number" },
            notes: { type: "string" },
            sources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  url: { type: "string" },
                },
                required: ["title", "url"],
                additionalProperties: false,
              },
            },
          },
          required: ["question_id", "answer", "confidence", "notes", "sources"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
};

function coerceExperimentalAnswer(raw: ExperimentalModelAnswer): ExperimentalModelAnswer {
  return {
    question_id: typeof raw.question_id === "string" ? raw.question_id.trim() : "",
    answer:
      typeof raw.answer === "string" && raw.answer.trim()
        ? raw.answer.trim()
        : "No answer provided.",
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0,
    notes: typeof raw.notes === "string" ? raw.notes.trim() : "",
    sources: Array.isArray(raw.sources)
      ? raw.sources
          .filter((source) => Boolean(source?.title && source?.url))
          .map((source) => ({
            title: source.title.trim(),
            url: source.url.trim(),
          }))
      : [],
  };
}

function parseExperimentalTemplateQuestions(csvTemplate: string) {
  const parsedTemplate = parseFootprintV2Template(csvTemplate);
  if (parsedTemplate.error) {
    return { error: parsedTemplate.error, questions: [] as ExperimentalTemplateQuestion[] };
  }

  const questions = parsedTemplate.rows.map((row) => ({
    theme: row.theme,
    question_id: row.question_id,
    question: row.question,
  }));

  const hasDuplicates = new Set<string>();
  for (const q of questions) {
    const key = `${q.theme.toLowerCase()}::${q.question_id.toLowerCase()}`;
    if (hasDuplicates.has(key)) {
      return {
        error: `Duplicate question_id detected within theme: ${q.theme} / ${q.question_id}`,
        questions: [] as ExperimentalTemplateQuestion[],
      };
    }
    hasDuplicates.add(key);
  }

  return { error: null, questions };
}

function buildExperimentalBasePrompt(params: {
  companyName: string;
  prodUrl: string;
  modelLabel: string;
  questions: ExperimentalTemplateQuestion[];
}) {
  const rows = params.questions
    .map(
      (q, index) =>
        `${index + 1}. theme=${q.theme} | question_id=${q.question_id}\n   question=${q.question}`,
    )
    .join("\n");

  return `You are filling an experimental brand footprint questionnaire for ${params.companyName}.

Company: ${params.companyName}
Website: ${params.prodUrl}
Target model label: ${params.modelLabel}

You must answer all questions and return JSON only.

QUESTIONS
${rows}

RULES
- Provide one output item per question_id.
- Keep answers specific and evidence-oriented.
- confidence must be 0..1.
- notes should capture caveats and uncertainty.
- sources should contain 1-5 real sources when possible (title + url).
- Never fabricate URLs. Lower confidence when evidence is weak.`;
}

function buildExperimentalSummaryPrompt(params: {
  companyName: string;
  prodUrl: string;
  modelLabel: string;
  questions: ExperimentalTemplateQuestion[];
  runs: Array<{ runLabel: string; items: ExperimentalModelAnswer[] }>;
}) {
  const runDigest = params.runs
    .map((run) => {
      const compact = run.items.map((item) => ({
        question_id: item.question_id,
        answer: item.answer,
        confidence: item.confidence,
        notes: item.notes,
      }));
      return `${run.runLabel}: ${JSON.stringify(compact)}`;
    })
    .join("\n\n");

  const questionList = params.questions
    .map((q) => `${q.theme} | ${q.question_id} | ${q.question}`)
    .join("\n");

  return `You are creating one stable synthesis run from multiple runs produced by the same model.

Company: ${params.companyName}
Website: ${params.prodUrl}
Model label: ${params.modelLabel}

TARGET QUESTIONS
${questionList}

INPUT RUNS
${runDigest}

TASK
Produce one consolidated answer set that reflects the most stable cross-run signal.
Return JSON only matching schema with exactly one item per question_id.
Use notes to explain conflicts across runs.`;
}

function buildExperimentalFinalPrompt(params: {
  companyName: string;
  prodUrl: string;
  modelLabel: string;
  questions: ExperimentalTemplateQuestion[];
  openAiSummary: ExperimentalModelAnswer[];
  claudeSummary: ExperimentalModelAnswer[];
}) {
  const compactQuestions = params.questions
    .map((q) => `${q.theme} | ${q.question_id} | ${q.question}`)
    .join("\n");

  return `You are creating the final consensus run from two model summaries.

Company: ${params.companyName}
Website: ${params.prodUrl}
Current model: ${params.modelLabel}

QUESTIONS (must return all)
${compactQuestions}

SUMMARY RUN FROM GPT-5.2
${JSON.stringify(params.openAiSummary)}

SUMMARY RUN FROM CLAUDE SONNET 4.5
${JSON.stringify(params.claudeSummary)}

TASK
Create one final set of answers with one item per question_id.
Balance both model summaries, preserve stable overlap, and explicitly note disagreements in notes.
Return JSON only matching schema.`;
}

async function callOpenAiExperimentalAnswers(params: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  const openai = new OpenAI({ apiKey: params.apiKey });
  const response = await openai.responses.create({
    model: params.model,
    tools: [{ type: "web_search" }],
    input: params.prompt,
    text: { format: EXPERIMENTAL_JSON_SCHEMA },
  });

  const raw = response.output_text || "";
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  const parsed = JSON.parse(raw) as { items: ExperimentalModelAnswer[] };
  const items = Array.isArray(parsed.items)
    ? parsed.items.map(coerceExperimentalAnswer)
    : [];

  return { raw, items };
}

async function callClaudeExperimentalAnswers(params: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 4096,
      temperature: 0.2,
      system:
        "Return JSON only. No markdown. No explanations. Follow the requested schema exactly.",
      messages: [{ role: "user", content: params.prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const raw =
    data.content
      ?.filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim() ?? "";

  if (!raw) {
    throw new Error("Claude returned an empty response.");
  }

  const jsonTextMatch = raw.match(/\{[\s\S]*\}/);
  const jsonText = jsonTextMatch ? jsonTextMatch[0] : raw;

  const parsed = JSON.parse(jsonText) as { items: ExperimentalModelAnswer[] };
  const items = Array.isArray(parsed.items)
    ? parsed.items.map(coerceExperimentalAnswer)
    : [];

  return { raw, items };
}

function mergeAnswersByQuestion(
  questions: ExperimentalTemplateQuestion[],
  answers: ExperimentalModelAnswer[],
) {
  const byId = new Map<string, ExperimentalModelAnswer>();
  for (const item of answers) {
    byId.set(item.question_id, item);
  }

  return questions.map((q) => {
    const item = byId.get(q.question_id);
    return {
      theme: q.theme,
      question_id: q.question_id,
      question: q.question,
      answer: item?.answer ?? "No answer provided.",
      confidence: item?.confidence ?? 0,
      notes: item?.notes ?? "No notes provided.",
      sources: item?.sources ?? [],
    };
  });
}

async function createExperimentalRequest(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: string;
  userId: string;
  companyName: string;
  modelName: string;
}) {
  const { data: request, error } = await params.supabase
    .from("footprint_requests")
    .insert({
      project_id: params.projectId,
      requested_by: params.userId,
      model_name: params.modelName,
      company_name: params.companyName,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !request) {
    throw new Error(error?.message ?? "Failed to create experimental request");
  }

  return request.id;
}

async function completeExperimentalRequest(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  requestId: string;
  stage: ExperimentalFlowStage;
  modelName: string;
  runLabel: string;
  sourceRequestIds?: string[];
  raw: string;
  rows: ReturnType<typeof mergeAnswersByQuestion>;
  errorMessage?: string | null;
}) {
  await params.supabase
    .from("footprint_requests")
    .update({
      status: params.errorMessage ? "error" : "completed",
      raw_response: JSON.stringify({
        experimental_flow: {
          flow_id: EXPERIMENTAL_FLOW_ID,
          stage: params.stage,
          model: params.modelName,
          run_label: params.runLabel,
          source_request_ids: params.sourceRequestIds ?? [],
        },
        raw_model_output: params.raw,
      }),
      parsed_response: {
        experimental_flow: {
          flow_id: EXPERIMENTAL_FLOW_ID,
          stage: params.stage,
          model: params.modelName,
          run_label: params.runLabel,
          source_request_ids: params.sourceRequestIds ?? [],
        },
        rows: params.rows,
      },
      error_message: params.errorMessage ?? null,
    })
    .eq("id", params.requestId);
}

async function failExperimentalRequest(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  requestId: string;
  message: string;
}) {
  await params.supabase
    .from("footprint_requests")
    .update({
      status: "error",
      error_message: params.message,
    })
    .eq("id", params.requestId);
}

async function verifyExperimentalProjectAccess(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated", supabase, user: null, project: null };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, prod_url, customers(name)")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Project not found", supabase, user, project: null };
  }

  const customer = project.customers as unknown as { name: string } | null;
  const companyName = customer?.name?.trim();
  const prodUrl = project.prod_url?.trim();

  if (!companyName) {
    return {
      error: "Company is required. Set it in project settings.",
      supabase,
      user,
      project: null,
    };
  }

  if (!prodUrl) {
    return {
      error:
        "Production URL is required for authority analysis. Set it in project settings.",
      supabase,
      user,
      project: null,
    };
  }

  return {
    error: null,
    supabase,
    user,
    project: { companyName, prodUrl },
  };
}

async function runExperimentalModelCall(params: {
  modelName: string;
  prompt: string;
  openAiApiKey: string;
  anthropicApiKey: string;
}) {
  if (params.modelName === EXPERIMENTAL_OPENAI_MODEL) {
    return callOpenAiExperimentalAnswers({
      apiKey: params.openAiApiKey,
      model: EXPERIMENTAL_OPENAI_MODEL,
      prompt: params.prompt,
    });
  }

  return callClaudeExperimentalAnswers({
    apiKey: params.anthropicApiKey,
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    prompt: params.prompt,
  });
}

type ExperimentalBaseTask = {
  modelName: typeof EXPERIMENTAL_OPENAI_MODEL | typeof EXPERIMENTAL_CLAUDE_MODEL;
  runIndex: number;
};

async function runInBatches<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  if (items.length === 0) {
    return;
  }

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: safeConcurrency }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(items[currentIndex]);
      }
    }),
  );
}

export async function requestExperimentalFlowBaseRuns(
  projectId: string,
  csvTemplate: string,
  iterations = 10,
) {
  const access = await verifyExperimentalProjectAccess(projectId);
  if (access.error || !access.user || !access.project) {
    return { error: access.error ?? "Access error", created: 0, failed: 0 };
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey || openAiApiKey === "your-openai-api-key-here") {
    return { error: "OpenAI API key is not configured.", created: 0, failed: 0 };
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return { error: "ANTHROPIC_API_KEY is not configured.", created: 0, failed: 0 };
  }

  const parsed = parseExperimentalTemplateQuestions(csvTemplate);
  if (parsed.error) {
    return { error: parsed.error, created: 0, failed: 0 };
  }

  const safeIterations = Math.max(1, Math.min(10, Math.floor(iterations)));
  const models = [EXPERIMENTAL_OPENAI_MODEL, EXPERIMENTAL_CLAUDE_MODEL] as const;
  const tasks: ExperimentalBaseTask[] = [];

  for (const modelName of models) {
    for (let runIndex = 1; runIndex <= safeIterations; runIndex += 1) {
      tasks.push({ modelName, runIndex });
    }
  }

  const configuredConcurrency = Number(process.env.EXPERIMENTAL_FLOW_BASE_CONCURRENCY ?? "4");
  const concurrency = Number.isFinite(configuredConcurrency)
    ? Math.max(1, Math.min(8, Math.floor(configuredConcurrency)))
    : 4;

  let created = 0;
  let failed = 0;

  await runInBatches(tasks, concurrency, async ({ modelName, runIndex }) => {
    const runLabel = `base_${modelName}_run_${runIndex}`;
    const requestId = await createExperimentalRequest({
      supabase: access.supabase,
      projectId,
      userId: access.user.id,
      companyName: access.project.companyName,
      modelName,
    });

    try {
      const prompt = buildExperimentalBasePrompt({
        companyName: access.project.companyName,
        prodUrl: access.project.prodUrl,
        modelLabel: modelName,
        questions: parsed.questions,
      });

      const result = await runExperimentalModelCall({
        modelName,
        prompt,
        openAiApiKey,
        anthropicApiKey,
      });

      const mergedRows = mergeAnswersByQuestion(parsed.questions, result.items);

      await completeExperimentalRequest({
        supabase: access.supabase,
        requestId,
        stage: "base",
        modelName,
        runLabel,
        raw: result.raw,
        rows: mergedRows,
      });
      created += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown model error";
      await failExperimentalRequest({
        supabase: access.supabase,
        requestId,
        message,
      });
      failed += 1;
    }
  });

  revalidatePath(`/projects/${projectId}/experimental-flow`);
  return { error: null, created, failed, concurrency };
}

export async function requestExperimentalFlowSummaryRuns(

  projectId: string,
  csvTemplate: string,
) {
  const access = await verifyExperimentalProjectAccess(projectId);
  if (access.error || !access.user || !access.project) {
    return { error: access.error ?? "Access error", created: 0 };
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey || openAiApiKey === "your-openai-api-key-here") {
    return { error: "OpenAI API key is not configured.", created: 0 };
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return { error: "ANTHROPIC_API_KEY is not configured.", created: 0 };
  }

  const parsed = parseExperimentalTemplateQuestions(csvTemplate);
  if (parsed.error) {
    return { error: parsed.error, created: 0 };
  }

  const { data: existingRuns } = await access.supabase
    .from("footprint_requests")
    .select("id, model_name, parsed_response, status")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const baseRuns = (existingRuns ?? []).filter((run) => {
    const parsedResponse = run.parsed_response as {
      experimental_flow?: { flow_id?: string; stage?: string; model?: string };
      rows?: Array<{
        question_id: string;
        answer: string;
        confidence: number;
        notes: string;
        sources: Array<{ title: string; url: string }>;
      }>;
    } | null;

    return (
      parsedResponse?.experimental_flow?.flow_id === EXPERIMENTAL_FLOW_ID &&
      parsedResponse.experimental_flow.stage === "base" &&
      Array.isArray(parsedResponse.rows)
    );
  });

  const models = [EXPERIMENTAL_OPENAI_MODEL, EXPERIMENTAL_CLAUDE_MODEL] as const;
  let created = 0;

  for (const modelName of models) {
    const modelRuns = baseRuns
      .filter((run) => run.model_name === modelName)
      .slice(0, 10)
      .map((run, index) => {
        const parsedResponse = run.parsed_response as {
          rows: Array<{
            question_id: string;
            answer: string;
            confidence: number;
            notes: string;
            sources: Array<{ title: string; url: string }>;
          }>;
        };

        return {
          requestId: run.id,
          runLabel: `input_run_${index + 1}`,
          items: parsedResponse.rows.map((row) => ({
            question_id: row.question_id,
            answer: row.answer,
            confidence: row.confidence,
            notes: row.notes,
            sources: row.sources,
          })),
        };
      });

    if (modelRuns.length === 0) {
      continue;
    }

    const requestId = await createExperimentalRequest({
      supabase: access.supabase,
      projectId,
      userId: access.user.id,
      companyName: access.project.companyName,
      modelName,
    });

    try {
      const prompt = buildExperimentalSummaryPrompt({
        companyName: access.project.companyName,
        prodUrl: access.project.prodUrl,
        modelLabel: modelName,
        questions: parsed.questions,
        runs: modelRuns.map((run) => ({
          runLabel: run.runLabel,
          items: run.items,
        })),
      });

      const result = await runExperimentalModelCall({
        modelName,
        prompt,
        openAiApiKey,
        anthropicApiKey,
      });

      const mergedRows = mergeAnswersByQuestion(parsed.questions, result.items);
      await completeExperimentalRequest({
        supabase: access.supabase,
        requestId,
        stage: "summary",
        modelName,
        runLabel: `summary_${modelName}`,
        sourceRequestIds: modelRuns.map((run) => run.requestId),
        raw: result.raw,
        rows: mergedRows,
      });
      created += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown model error";
      await failExperimentalRequest({
        supabase: access.supabase,
        requestId,
        message,
      });
    }
  }

  revalidatePath(`/projects/${projectId}/experimental-flow`);
  return { error: null, created };
}

export async function requestExperimentalFlowFinalRuns(
  projectId: string,
  csvTemplate: string,
) {
  const access = await verifyExperimentalProjectAccess(projectId);
  if (access.error || !access.user || !access.project) {
    return { error: access.error ?? "Access error", created: 0 };
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey || openAiApiKey === "your-openai-api-key-here") {
    return { error: "OpenAI API key is not configured.", created: 0 };
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return { error: "ANTHROPIC_API_KEY is not configured.", created: 0 };
  }

  const parsed = parseExperimentalTemplateQuestions(csvTemplate);
  if (parsed.error) {
    return { error: parsed.error, created: 0 };
  }

  const { data: existingRuns } = await access.supabase
    .from("footprint_requests")
    .select("id, model_name, parsed_response, status, created_at")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const summaries = (existingRuns ?? []).filter((run) => {
    const parsedResponse = run.parsed_response as {
      experimental_flow?: { flow_id?: string; stage?: string; model?: string };
      rows?: Array<{
        question_id: string;
        answer: string;
        confidence: number;
        notes: string;
        sources: Array<{ title: string; url: string }>;
      }>;
    } | null;

    return (
      parsedResponse?.experimental_flow?.flow_id === EXPERIMENTAL_FLOW_ID &&
      parsedResponse.experimental_flow.stage === "summary" &&
      Array.isArray(parsedResponse.rows)
    );
  });

  const latestOpenAi = summaries.find((run) => run.model_name === EXPERIMENTAL_OPENAI_MODEL);
  const latestClaude = summaries.find((run) => run.model_name === EXPERIMENTAL_CLAUDE_MODEL);

  if (!latestOpenAi || !latestClaude) {
    return {
      error: "Missing summary runs. Run summary stage first for both models.",
      created: 0,
    };
  }

  const openAiSummaryRows = ((latestOpenAi.parsed_response as { rows: ReturnType<typeof mergeAnswersByQuestion> }).rows ?? []).map((row) => ({
    question_id: row.question_id,
    answer: row.answer,
    confidence: row.confidence,
    notes: row.notes,
    sources: row.sources,
  }));
  const claudeSummaryRows = ((latestClaude.parsed_response as { rows: ReturnType<typeof mergeAnswersByQuestion> }).rows ?? []).map((row) => ({
    question_id: row.question_id,
    answer: row.answer,
    confidence: row.confidence,
    notes: row.notes,
    sources: row.sources,
  }));

  const models = [EXPERIMENTAL_OPENAI_MODEL, EXPERIMENTAL_CLAUDE_MODEL] as const;
  let created = 0;

  for (const modelName of models) {
    const requestId = await createExperimentalRequest({
      supabase: access.supabase,
      projectId,
      userId: access.user.id,
      companyName: access.project.companyName,
      modelName,
    });

    try {
      const prompt = buildExperimentalFinalPrompt({
        companyName: access.project.companyName,
        prodUrl: access.project.prodUrl,
        modelLabel: modelName,
        questions: parsed.questions,
        openAiSummary: openAiSummaryRows,
        claudeSummary: claudeSummaryRows,
      });

      const result = await runExperimentalModelCall({
        modelName,
        prompt,
        openAiApiKey,
        anthropicApiKey,
      });

      const mergedRows = mergeAnswersByQuestion(parsed.questions, result.items);
      await completeExperimentalRequest({
        supabase: access.supabase,
        requestId,
        stage: "final",
        modelName,
        runLabel: `final_${modelName}`,
        sourceRequestIds: [latestOpenAi.id, latestClaude.id],
        raw: result.raw,
        rows: mergedRows,
      });
      created += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown model error";
      await failExperimentalRequest({
        supabase: access.supabase,
        requestId,
        message,
      });
    }
  }

  revalidatePath(`/projects/${projectId}/experimental-flow`);
  return { error: null, created };
}


export async function generateFootprintNarrative(
  projectId: string,
  requestId?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated", report: null as string | null };
  }

  const baseQuery = supabase
    .from("footprint_requests")
    .select("id, company_name, model_name, parsed_response, created_at, status")
    .eq("project_id", projectId);

  const { data: request, error: requestError } = requestId
    ? await baseQuery.eq("id", requestId).single()
    : await baseQuery
        .in("status", ["completed", "error"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

  if (requestError || !request) {
    return {
      error:
        requestError?.message ??
        "No footprint analysis found. Run a footprint analysis first.",
      report: null as string | null,
    };
  }

  const parsed = request.parsed_response as FootprintFullResponse | null;
  if (!parsed?.groups || parsed.groups.length === 0) {
    return {
      error:
        "Latest footprint report has no parsed group data. Run re-analyze first.",
      report: null as string | null,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your-openai-api-key-here") {
    return {
      error: "OpenAI API key is not configured.",
      report: null as string | null,
    };
  }

  const MODEL = "gpt-5.2";

  const groupMetaForRequest = parsed.group_meta ?? inferGroupMetaFromParsed(parsed);

  const compactGroups = parsed.groups.map((group, i) => ({
    groupId: groupMetaForRequest[i]?.id ?? `group_${i + 1}`,
    title: groupMetaForRequest[i]?.title ?? `Category ${i + 1}`,
    summary: group.summary,
    questions: group.questions.map((q) => ({
      question: q.question,
      answer: q.answer,
      confidence: q.confidence,
      sourceCount: q.sources.length,
      sourceTypes: Array.from(new Set(q.sources.map((s) => s.type))),
      sources: q.sources.slice(0, 3),
    })),
  }));

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: MODEL,
      input: [
        {
          role: "system",
          content:
            "You are a senior brand intelligence analyst. Produce a rigorous, balanced, evidence-weighted report describing AI's current picture of the brand based only on provided analysis data. Do not invent facts.",
        },
        {
          role: "user",
          content: `Create a detailed report in Markdown.

Goal:
- Explain what AI's overall picture of ${request.company_name} currently is.
- Surface strengths, vulnerabilities, contradictions, confidence gaps, and likely misconception risks.
- Make it decision-useful for brand/marketing leadership.

Required Markdown structure:
1. Executive Summary (5-8 bullets)
2. Current AI Picture of the Brand (narrative synthesis)
3. Perception by Theme (one subsection per category)
4. Confidence & Evidence Quality (high/medium/low confidence map)
5. Contradictions and Tensions in the Narrative
6. Misconceptions / Hallucination Risks (top 10)
7. Competitive Position in AI Framing
8. Health + Sustainability Risk Framing
9. Strategic Implications (what this means for ${request.company_name} now)
10. Recommended Next Actions (prioritized, concrete)

Formatting rules:
- Use concise headings, bullet lists, and short paragraphs.
- Add an evidence-strength note in each section.
- Avoid generic advice; tie conclusions to the provided data.
- If evidence is weak, explicitly say so.

Input metadata:
- Company: ${request.company_name}
- Source analysis model: ${request.model_name}
- Source request id: ${request.id}
- Categories expected: ${groupMetaForRequest.length}

Input analysis JSON:
${JSON.stringify(compactGroups)}`,
        },
      ],
    });

    const report = response.output_text?.trim();
    if (!report) {
      return {
        error: "OpenAI returned an empty report.",
        report: null as string | null,
      };
    }

    const generatedAt = new Date().toISOString();
    await supabase
      .from("footprint_requests")
      .update({
        parsed_response: {
          ...parsed,
          narrative_report: {
            content: report,
            model: MODEL,
            generated_at: generatedAt,
            source_request_id: request.id,
          },
        },
      })
      .eq("id", request.id);

    revalidatePath(`/projects/${projectId}/digital-footprint`);

    return {
      error: null,
      report,
      sourceRequestId: request.id,
      model: MODEL,
      generatedAt,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error generating report";
    return { error: message, report: null as string | null };
  }
}
