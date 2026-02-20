const DEFAULT_SITE_URL = "https://launch-buddy.vercel.app";

export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = envUrl && envUrl.length > 0 ? envUrl : DEFAULT_SITE_URL;
  return base.replace(/\/$/, "");
}
