const FORTNOX_AUTH_URL = "https://apps.fortnox.se/oauth-v1/auth";
const FORTNOX_TOKEN_URL = "https://apps.fortnox.se/oauth-v1/token";
const FORTNOX_API_BASE = "https://api.fortnox.se";

function getConfig() {
  const clientId = process.env.FORTNOX_CLIENT_ID;
  const clientSecret = process.env.FORTNOX_CLIENT_SECRET;
  const callbackUrl = process.env.FORTNOX_CALLBACK_URL;

  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error(
      "Missing FORTNOX_CLIENT_ID, FORTNOX_CLIENT_SECRET, or FORTNOX_CALLBACK_URL"
    );
  }

  return { clientId, clientSecret, callbackUrl };
}

export function buildAuthUrl(state: string): string {
  const { clientId, callbackUrl } = getConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "timereporting companyinformation",
    state,
    response_type: "code",
    access_type: "offline",
  });

  return `${FORTNOX_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const { clientId, clientSecret, callbackUrl } = getConfig();

  const response = await fetch(FORTNOX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fortnox token exchange failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const { clientId, clientSecret } = getConfig();

  const response = await fetch(FORTNOX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fortnox token refresh failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function fortnoxApiFetch(
  accessToken: string,
  path: string
): Promise<Response> {
  return fetch(`${FORTNOX_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}
