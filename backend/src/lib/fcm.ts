import { createSign } from "crypto";
import { prisma } from "./prisma";

/**
 * Firebase Cloud Messaging (HTTP v1) sender for the customer mobile app.
 *
 * Staff/browser notifications go through webPush.ts (VAPID) and sseManager.ts.
 * This module is the mobile leg: it looks up a user's registered device tokens
 * and delivers a data+notification message to each one.
 *
 * Auth uses a service-account JWT signed locally, so no firebase-admin
 * dependency is needed. Set FCM_SERVICE_ACCOUNT to the JSON key (either the
 * raw JSON string or a base64 encoding of it). When unset, sends are logged
 * and skipped so local dev works without Firebase credentials.
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

let cachedAccount: ServiceAccount | null | undefined;

function serviceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;

  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) {
    cachedAccount = null;
    return null;
  }

  try {
    // Accept either raw JSON or base64-wrapped JSON (easier in most env hosts).
    const json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as ServiceAccount;
    // Env vars flatten newlines in the PEM body; restore them.
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    cachedAccount = parsed;
  } catch (err) {
    console.error("[fcm] FCM_SERVICE_ACCOUNT is not valid JSON", err);
    cachedAccount = null;
  }

  return cachedAccount;
}

function base64url(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// OAuth tokens last an hour; reuse until shortly before expiry.
let accessToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (accessToken && accessToken.expiresAt > now + 60) return accessToken.value;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer
    .sign(sa.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${payload}.${signature}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`[fcm] token exchange failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  accessToken = { value: json.access_token, expiresAt: now + json.expires_in };
  return json.access_token;
}

type SendResult = "ok" | "invalid_token" | "error";

async function sendToToken(
  sa: ServiceAccount,
  bearer: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<SendResult> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          android: {
            priority: "HIGH",
            // Must match the channel the Flutter app creates on startup.
            notification: { channel_id: "order_updates" },
          },
        },
      }),
    }
  );

  if (res.ok) return "ok";

  const err = (await res.json().catch(() => ({}))) as {
    error?: { details?: { errorCode?: string }[] };
  };
  const code = err?.error?.details?.[0]?.errorCode;
  if (code === "UNREGISTERED" || code === "INVALID_ARGUMENT") return "invalid_token";

  console.error("[fcm] send failed", JSON.stringify(err));
  return "error";
}

/**
 * Delivers to an already-resolved token list. Concurrency here is HTTP only —
 * the database is touched once up front by the caller and at most once after,
 * to prune. Fanning out DB queries per device would put concurrent statements
 * on a single pg connection.
 */
async function deliver(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  label: string
): Promise<void> {
  if (tokens.length === 0) return;

  const sa = serviceAccount();
  if (!sa) {
    console.log(
      `[fcm] [dev] would push to ${label} (${tokens.length} device(s)): ${title} — ${body}`
    );
    return;
  }

  const bearer = await getAccessToken(sa);
  const stale: string[] = [];

  await Promise.all(
    tokens.map(async (token) => {
      const result = await sendToToken(sa, bearer, token, title, body, data);
      if (result === "invalid_token") stale.push(token);
    })
  );

  if (stale.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: stale } } });
    console.log(`[fcm] pruned ${stale.length} dead token(s)`);
  }
}

/**
 * Push to every device registered by a user. Fire-and-forget: never throws,
 * so callers can drop it after the HTTP response without risking an
 * unhandled rejection. Tokens FCM reports as dead are pruned.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  try {
    const devices = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    await deliver(
      devices.map((d) => d.token),
      title,
      body,
      data,
      `user=${userId}`
    );
  } catch (err) {
    console.error("[fcm] sendPushToUser error", err);
  }
}

/**
 * Push to every device belonging to any user holding one of `roles`.
 * Used for staff alerts (new order placed) on the mobile app; the browser
 * equivalent is sendPushToRoles in webPush.ts.
 */
export async function sendPushToRolesMobile(
  roles: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  try {
    // Single query across the relation — not one lookup per staff user.
    const devices = await prisma.deviceToken.findMany({
      where: { user: { role: { in: roles as any }, isActive: true } },
      select: { token: true },
    });
    await deliver(
      devices.map((d) => d.token),
      title,
      body,
      data,
      `roles=${roles.join(",")}`
    );
  } catch (err) {
    console.error("[fcm] sendPushToRolesMobile error", err);
  }
}
