import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;

type WeightedMetric = {
  key: string;
  label: string;
  category: "seo" | "aeo";
  weight: number;
  score: number;
  maxScore: number;
  details: string;
  passed: boolean;
};

export type SeoAeoAnalysisResult = {
  url: string;
  fetchedAt: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  seoScore: number;
  aeoScore: number;
  totalScore: number;
  metrics: WeightedMetric[];
  recommendations: string[];
  facts: {
    h1Count: number;
    headingCount: number;
    internalLinks: number;
    externalLinks: number;
    wordCount: number;
    sentenceCount: number;
    hasFaqSchema: boolean;
    hasHowToSchema: boolean;
    hasAnySchema: boolean;
    hasCanonical: boolean;
    robots: string | null;
  };
};

export async function analyzeSeoAeoUrl(rawUrl: string): Promise<SeoAeoAnalysisResult> {
  const url = normalizeUrl(rawUrl);
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  let currentUrl = url;
  try {
    await validateTargetUrl(currentUrl);

    let redirects = 0;
    while (true) {
      response = await fetch(currentUrl, {
        headers: {
          "user-agent":
            "LaunchBuddySEOAEOAnalyzer/1.0 (+https://launchbuddy.local)",
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: timeoutController.signal,
        redirect: "manual",
        cache: "no-store",
      });

      if (response.status < 300 || response.status >= 400) {
        break;
      }

      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect (${response.status}) without location header`);
      }

      redirects += 1;
      if (redirects > MAX_REDIRECTS) {
        throw new Error("Too many redirects");
      }

      const nextUrl = new URL(location, currentUrl);
      currentUrl = normalizeUrl(nextUrl.toString());
      await validateTargetUrl(currentUrl);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status})`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    throw new Error("Page is too large to analyze");
  }

  const finalUrl = response.url || currentUrl;
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    throw new Error("Page is too large to analyze");
  }

  const title = getFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = getMetaContent(html, "description");
  const canonical = getCanonicalHref(html);
  const robots = getMetaContent(html, "robots");
  const bodyHtml = getFirstMatch(html, /<body[^>]*>([\s\S]*?)<\/body>/i) ?? html;

  const headings = getHeadings(html);
  const h1Count = headings.filter((h) => h.level === 1).length;
  const links = getLinks(html);
  const { internalLinks, externalLinks } = splitLinks(links, finalUrl);
  const { jsonLdObjects, hasFaqSchema, hasHowToSchema } = getStructuredDataSignals(
    html,
  );
  const text = extractVisibleText(bodyHtml);
  const sentenceCount = countSentences(text);
  const wordCount = countWords(text);
  const readability = calculateFleschReadingEase(text);

  const metrics: WeightedMetric[] = [
    scoreTitle(title),
    scoreMetaDescription(metaDescription),
    scoreHeadingStructure(headings),
    scoreCanonical(canonical, finalUrl),
    scoreRobots(robots),
    scoreStructuredData(jsonLdObjects),
    scoreContentQuality(wordCount, sentenceCount, readability),
    scoreLinkHygiene(internalLinks.length, externalLinks.length),
    scorePerformanceProxy(html),
    scoreDirectAnswerFormat(bodyHtml, text),
    scoreFaqHowTo(hasFaqSchema, hasHowToSchema),
    scoreEntitySignals(html),
    scoreScannability(bodyHtml, text),
  ];

  const { seoScore, aeoScore, totalScore } = aggregateScores(metrics);

  const recommendations = metrics
    .filter((metric) => metric.score / metric.maxScore < 0.65)
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)
    .slice(0, 6)
    .map((metric) => `${metric.label}: ${metric.details}`);

  return {
    url: finalUrl,
    fetchedAt: new Date().toISOString(),
    statusCode: response.status,
    title,
    metaDescription,
    seoScore,
    aeoScore,
    totalScore,
    metrics,
    recommendations,
    facts: {
      h1Count,
      headingCount: headings.length,
      internalLinks: internalLinks.length,
      externalLinks: externalLinks.length,
      wordCount,
      sentenceCount,
      hasFaqSchema,
      hasHowToSchema,
      hasAnySchema: jsonLdObjects.length > 0,
      hasCanonical: Boolean(canonical),
      robots,
    },
  };
}

function normalizeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("A URL is required");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported");
  }

  if (!isPublicHostname(parsed.hostname)) {
    throw new Error("This host is not allowed for analysis");
  }

  return parsed.toString();
}

function isPublicHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "0.0.0.0" ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("::ffff:127.") ||
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:172.") ||
    lower.startsWith("::ffff:192.168.") ||
    lower.startsWith("::ffff:169.254.") ||
    lower.endsWith(".local")
  ) {
    return false;
  }

  const ipVersion = isIP(lower);
  if (ipVersion === 4) {
    const [a, b] = lower.split(".").map(Number);
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a >= 224) return false;
  }

  if (ipVersion === 6) {
    if (
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80") ||
      lower.startsWith("ff")
    ) {
      return false;
    }
  }

  return true;
}

async function validateTargetUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);
  if (!isPublicHostname(parsed.hostname)) {
    throw new Error("This host is not allowed for analysis");
  }

  const lookupResults = await lookup(parsed.hostname, {
    all: true,
    verbatim: true,
  });

  if (lookupResults.length === 0) {
    throw new Error("Could not resolve target host");
  }

  if (lookupResults.some((entry) => !isPublicHostname(entry.address))) {
    throw new Error("Resolved host points to a private or blocked network");
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/");
}

function cleanText(value: string | null) {
  if (!value) return null;
  return decodeHtmlEntities(value.replace(/\s+/g, " ").trim()) || null;
}

function getFirstMatch(html: string, regex: RegExp) {
  const match = html.match(regex);
  return cleanText(match?.[1] ?? null);
}

function getMetaContent(html: string, name: string) {
  const escapedName = escapeRegex(name);
  const patterns = [
    new RegExp(
      `<meta[^>]+name=["']${escapedName}["'][^>]*content=["']([\\s\\S]*?)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]*name=["']${escapedName}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const hit = getFirstMatch(html, pattern);
    if (hit) {
      return hit;
    }
  }

  return null;
}

function getCanonicalHref(html: string) {
  const patterns = [
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([\s\S]*?)["'][^>]*>/i,
    /<link[^>]+href=["']([\s\S]*?)["'][^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const hit = getFirstMatch(html, pattern);
    if (hit) {
      return hit;
    }
  }

  return null;
}

function getHeadings(html: string) {
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: Array<{ level: number; text: string }> = [];
  let match = headingRegex.exec(html);
  while (match) {
    const level = Number(match[1]);
    const text = cleanText(stripTags(match[2]));
    if (text) {
      headings.push({ level, text });
    }
    match = headingRegex.exec(html);
  }
  return headings;
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function getLinks(html: string) {
  const linkRegex = /<a[^>]+href=["']([\s\S]*?)["'][^>]*>/gi;
  const links: string[] = [];
  let match = linkRegex.exec(html);
  while (match) {
    const href = cleanText(match[1]);
    if (href) {
      links.push(href);
    }
    match = linkRegex.exec(html);
  }
  return links;
}

function splitLinks(links: string[], pageUrl: string) {
  const page = new URL(pageUrl);
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];

  for (const href of links) {
    if (href.startsWith("#") || href.startsWith("javascript:")) {
      continue;
    }
    try {
      const resolved = new URL(href, page);
      if (resolved.hostname === page.hostname) {
        internalLinks.push(resolved.toString());
      } else {
        externalLinks.push(resolved.toString());
      }
    } catch {
      continue;
    }
  }

  return { internalLinks, externalLinks };
}

function getStructuredDataSignals(html: string) {
  const scriptRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const jsonLdObjects: Array<Record<string, unknown>> = [];
  let hasFaqSchema = false;
  let hasHowToSchema = false;

  let match = scriptRegex.exec(html);
  while (match) {
    const raw = (match[1] ?? "").trim();
    if (!raw) {
      match = scriptRegex.exec(html);
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];

      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") {
          continue;
        }

        const obj = candidate as Record<string, unknown>;
        jsonLdObjects.push(obj);

        const typeValue = obj["@type"];
        const types = Array.isArray(typeValue)
          ? typeValue
          : typeValue
            ? [typeValue]
            : [];
        const normalized = types
          .map((type) => String(type).toLowerCase())
          .join(" ");

        if (normalized.includes("faqpage")) {
          hasFaqSchema = true;
        }
        if (normalized.includes("howto")) {
          hasHowToSchema = true;
        }
      }
    } catch {
      match = scriptRegex.exec(html);
      continue;
    }

    match = scriptRegex.exec(html);
  }

  return { jsonLdObjects, hasFaqSchema, hasHowToSchema };
}

function extractVisibleText(html: string) {
  const withoutScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  return decodeHtmlEntities(
    stripTags(withoutScript)
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function countWords(text: string) {
  const words = text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g);
  return words?.length ?? 0;
}

function countSentences(text: string) {
  const sentences = text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.length;
}

function countSyllablesInWord(word: string) {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return 0;
  if (normalized.length <= 3) return 1;
  const vowelGroups = normalized.match(/[aeiouy]+/g);
  let count = vowelGroups?.length ?? 1;
  if (normalized.endsWith("e")) {
    count -= 1;
  }
  return Math.max(1, count);
}

function calculateFleschReadingEase(text: string) {
  const words = text.match(/[A-Za-z]+/g) ?? [];
  const sentenceCount = Math.max(1, countSentences(text));
  if (words.length === 0) return 0;

  const syllableCount = words.reduce(
    (total, word) => total + countSyllablesInWord(word),
    0,
  );
  const wordsPerSentence = words.length / sentenceCount;
  const syllablesPerWord = syllableCount / words.length;

  return 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
}

function createMetric(input: Omit<WeightedMetric, "maxScore" | "passed">) {
  const score = clamp(input.score, 0, input.weight);
  return {
    ...input,
    score,
    maxScore: input.weight,
    passed: score / input.weight >= 0.7,
  } as WeightedMetric;
}

function scoreTitle(title: string | null) {
  if (!title) {
    return createMetric({
      key: "title",
      label: "Title Tag",
      category: "seo",
      weight: 10,
      score: 0,
      details: "Add a unique <title> between 50 and 60 characters.",
    });
  }

  const length = title.length;
  let score = 0;
  if (length >= 50 && length <= 60) score = 10;
  else if (length >= 40 && length <= 70) score = 7;
  else if (length >= 30 && length <= 80) score = 4;

  return createMetric({
    key: "title",
    label: "Title Tag",
    category: "seo",
    weight: 10,
    score,
    details: `Current title length is ${length}. Target 50-60 characters.`,
  });
}

function scoreMetaDescription(metaDescription: string | null) {
  if (!metaDescription) {
    return createMetric({
      key: "meta_description",
      label: "Meta Description",
      category: "seo",
      weight: 8,
      score: 0,
      details: "Add a meta description around 120-160 characters.",
    });
  }

  const length = metaDescription.length;
  let score = 0;
  if (length >= 120 && length <= 160) score = 8;
  else if (length >= 100 && length <= 180) score = 6;
  else if (length >= 70 && length <= 200) score = 3;

  return createMetric({
    key: "meta_description",
    label: "Meta Description",
    category: "seo",
    weight: 8,
    score,
    details: `Current description length is ${length}. Target 120-160 characters.`,
  });
}

function scoreHeadingStructure(headings: Array<{ level: number; text: string }>) {
  let score = 0;
  const h1Count = headings.filter((heading) => heading.level === 1).length;
  if (h1Count === 1) {
    score += 4;
  } else if (h1Count > 1) {
    score += 1;
  }

  const hierarchyBreak = headings.some((heading, index) => {
    if (index === 0) return false;
    return heading.level > headings[index - 1].level + 1;
  });
  if (!hierarchyBreak && headings.length > 0) {
    score += 4;
  }

  const descriptiveCount = headings.filter((heading) => heading.text.length >= 15).length;
  if (descriptiveCount >= 2) {
    score += 2;
  }

  return createMetric({
    key: "heading_structure",
    label: "Heading Structure",
    category: "seo",
    weight: 10,
    score,
    details: `Found ${h1Count} H1 and ${headings.length} total headings. Use one H1 and logical hierarchy.`,
  });
}

function scoreCanonical(canonical: string | null, pageUrl: string) {
  if (!canonical) {
    return createMetric({
      key: "canonical",
      label: "Canonical Tag",
      category: "seo",
      weight: 5,
      score: 0,
      details: "Add a canonical URL to avoid duplicate-indexing ambiguity.",
    });
  }

  let score = 2;
  try {
    const resolved = new URL(canonical, pageUrl);
    score += 2;
    if (resolved.toString().startsWith("http")) {
      score += 1;
    }
  } catch {
    score = 1;
  }

  return createMetric({
    key: "canonical",
    label: "Canonical Tag",
    category: "seo",
    weight: 5,
    score,
    details: `Canonical is set to ${canonical}. Ensure it points to the preferred URL.`,
  });
}

function scoreRobots(robots: string | null) {
  if (!robots) {
    return createMetric({
      key: "robots",
      label: "Robots Meta",
      category: "seo",
      weight: 4,
      score: 4,
      details: "No robots meta found. This is fine if page should be indexable.",
    });
  }

  const lower = robots.toLowerCase();
  let score = 4;
  if (lower.includes("noindex")) {
    score -= 2;
  }
  if (lower.includes("nofollow")) {
    score -= 2;
  }

  return createMetric({
    key: "robots",
    label: "Robots Meta",
    category: "seo",
    weight: 4,
    score,
    details: `Robots directive is "${robots}". Avoid noindex/nofollow on key pages.`,
  });
}

function scoreStructuredData(jsonLdObjects: Array<Record<string, unknown>>) {
  if (jsonLdObjects.length === 0) {
    return createMetric({
      key: "structured_data",
      label: "Structured Data",
      category: "seo",
      weight: 10,
      score: 0,
      details: "Add JSON-LD schema (Organization, FAQPage, Article, Product, etc.).",
    });
  }

  let score = 4;
  const hasContext = jsonLdObjects.some((obj) => obj["@context"]);
  const hasType = jsonLdObjects.some((obj) => obj["@type"]);
  if (hasContext) score += 2;
  if (hasType) score += 2;
  if (jsonLdObjects.length >= 2) score += 2;

  return createMetric({
    key: "structured_data",
    label: "Structured Data",
    category: "seo",
    weight: 10,
    score,
    details: `Detected ${jsonLdObjects.length} JSON-LD block(s). Ensure required fields validate.`,
  });
}

function scoreContentQuality(wordCount: number, sentenceCount: number, readability: number) {
  let score = 0;
  if (wordCount >= 300) score += 4;
  else if (wordCount >= 180) score += 2;

  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : wordCount;
  if (avgSentenceLength <= 24) score += 2;
  else if (avgSentenceLength <= 32) score += 1;

  if (readability >= 55) score += 2;
  else if (readability >= 45) score += 1;

  return createMetric({
    key: "content_quality",
    label: "Content Quality",
    category: "seo",
    weight: 8,
    score,
    details: `Word count ${wordCount}, avg sentence length ${avgSentenceLength.toFixed(1)}, readability ${readability.toFixed(1)}.`,
  });
}

function scoreLinkHygiene(internalLinks: number, externalLinks: number) {
  let score = 0;
  if (internalLinks >= 3) score += 5;
  else if (internalLinks >= 1) score += 3;

  if (externalLinks >= 1 && externalLinks <= 6) score += 3;
  else if (externalLinks > 0) score += 1;

  return createMetric({
    key: "link_hygiene",
    label: "Link Hygiene",
    category: "seo",
    weight: 8,
    score,
    details: `${internalLinks} internal and ${externalLinks} external links detected.`,
  });
}

function scorePerformanceProxy(html: string) {
  const scripts = (html.match(/<script\b/gi) ?? []).length;
  const images = (html.match(/<img\b/gi) ?? []).length;
  const lazyImages = (html.match(/<img[^>]+loading=["']lazy["']/gi) ?? []).length;
  let score = 0;

  if (scripts <= 20) score += 3;
  else if (scripts <= 35) score += 1;

  if (images === 0) {
    score += 2;
  } else {
    const lazyRatio = lazyImages / images;
    if (lazyRatio >= 0.6) score += 2;
    else if (lazyRatio >= 0.3) score += 1;
  }

  if ((html.match(/<meta[^>]+name=["']viewport["']/i) ?? []).length > 0) {
    score += 2;
  }

  return createMetric({
    key: "performance_proxy",
    label: "Performance Proxies",
    category: "seo",
    weight: 7,
    score,
    details: `Detected ${scripts} scripts and ${images} images (${lazyImages} lazy-loaded).`,
  });
}

function scoreDirectAnswerFormat(bodyHtml: string, text: string) {
  const questionHeadings = (
    bodyHtml.match(/<h[2-4][^>]*>[\s\S]*?\?<\/h[2-4]>/gi) ?? []
  ).length;
  const firstChunk = text.slice(0, 350);
  let score = 0;

  if (questionHeadings >= 2) score += 4;
  else if (questionHeadings >= 1) score += 2;

  if (/\b(what|why|how|when|where|who)\b/i.test(firstChunk)) {
    score += 3;
  }

  if (countSentences(firstChunk) >= 2) {
    score += 3;
  }

  return createMetric({
    key: "answer_format",
    label: "Direct Answer Format",
    category: "aeo",
    weight: 10,
    score,
    details:
      "Use question-led headings and answer key questions in the first paragraphs.",
  });
}

function scoreFaqHowTo(hasFaqSchema: boolean, hasHowToSchema: boolean) {
  let score = 0;
  if (hasFaqSchema) score += 4;
  if (hasHowToSchema) score += 4;

  return createMetric({
    key: "faq_howto",
    label: "FAQ/HowTo Schema",
    category: "aeo",
    weight: 8,
    score,
    details:
      "Add FAQPage or HowTo JSON-LD for answer engines and assistant-ready extraction.",
  });
}

function scoreEntitySignals(html: string) {
  let score = 0;
  if (/rel=["']author["']/i.test(html) || /itemprop=["']author["']/i.test(html)) {
    score += 2;
  }
  if (
    /<meta[^>]+property=["']article:published_time["']/i.test(html) ||
    /datetime=["'][^"']+["']/i.test(html)
  ) {
    score += 2;
  }
  if (
    /<meta[^>]+property=["']og:site_name["']/i.test(html) ||
    /"@type"\s*:\s*"Organization"/i.test(html)
  ) {
    score += 2;
  }

  return createMetric({
    key: "entity_signals",
    label: "Entity Signals (E-E-A-T)",
    category: "aeo",
    weight: 6,
    score,
    details:
      "Surface author, date, and organization signals so AI systems can ground answers.",
  });
}

function scoreScannability(bodyHtml: string, text: string) {
  let score = 0;
  const hasLists = /<(ul|ol)\b/i.test(bodyHtml);
  const hasTable = /<table\b/i.test(bodyHtml);
  const paragraphCount = (bodyHtml.match(/<p\b/gi) ?? []).length;
  const wordCount = countWords(text);
  const avgParagraphWords = paragraphCount > 0 ? wordCount / paragraphCount : wordCount;

  if (hasLists) score += 2;
  if (hasTable) score += 1;
  if (avgParagraphWords <= 90) score += 2;
  else if (avgParagraphWords <= 130) score += 1;
  if ((bodyHtml.match(/<(strong|b)\b/gi) ?? []).length >= 3) score += 1;

  return createMetric({
    key: "scannability",
    label: "Scannability",
    category: "aeo",
    weight: 6,
    score,
    details:
      "Use lists, bold key points, and shorter paragraphs to improve extractability.",
  });
}

function aggregateScores(metrics: WeightedMetric[]) {
  const seo = metrics.filter((metric) => metric.category === "seo");
  const aeo = metrics.filter((metric) => metric.category === "aeo");

  const seoScore = Math.round(100 * ratio(seo));
  const aeoScore = Math.round(100 * ratio(aeo));
  const totalScore = Math.round(100 * ratio(metrics));

  return { seoScore, aeoScore, totalScore };
}

function ratio(metrics: WeightedMetric[]) {
  const max = metrics.reduce((sum, metric) => sum + metric.maxScore, 0);
  if (max === 0) return 0;
  const earned = metrics.reduce((sum, metric) => sum + metric.score, 0);
  return earned / max;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
