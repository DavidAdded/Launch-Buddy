"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/checklist-defaults";
import OpenAI from "openai";
import {
  buildGroupPrompt,
  buildOriginSummaryPrompt,
  GROUP_JSON_SCHEMA,
  ORIGIN_SUMMARY_JSON_SCHEMA,
  FOOTPRINT_GROUPS,
} from "@/lib/footprint-prompt";
import type {
  GroupResponse,
  FootprintFullResponse,
  FootprintGroup,
  FootprintOriginSummary,
} from "@/lib/footprint-prompt";
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

export async function requestFootprint(
  projectId: string,
  customGroups?: FootprintGroup[],
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

    let originSummaryRaw: string | null = null;
    let originSummary: FootprintOriginSummary | undefined;

    try {
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
    } catch {
      originSummary = undefined;
    }

    const fullResponse: FootprintFullResponse = {
      groups: resolvedGroups,
      group_meta: groupsToUse,
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
