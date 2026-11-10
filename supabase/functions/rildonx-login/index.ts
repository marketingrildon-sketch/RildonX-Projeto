type LoginBody = {
  email?: unknown;
  login?: unknown;
  password?: unknown;
};

const LOCK_MESSAGE = "Login temporariamente bloqueado. Tente novamente em 15 minutos.";
const INVALID_MESSAGE = "Login ou senha inválidos.";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": origin || "null",
      "Content-Type": "application/json",
      "Vary": "Origin",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(value: string): string {
  const escaped: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => escaped[character] || character);
}

async function identifierHash(identifier: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requiredEnv("LOGIN_HASH_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(identifier));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function callRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const url = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Login security RPC failed: ${name}`);
  const responseBody = await response.text();
  return responseBody ? JSON.parse(responseBody) as T : undefined as T;
}

async function sendLockoutAlert(identifier: string, lockedUntil: string, hash: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const sender = Deno.env.get("LOGIN_ALERT_FROM");
  if (!apiKey || !sender) {
    console.error("Login alert delivery is not configured.");
    return;
  }

  const claimed = await callRpc<boolean>("rildonx_claim_login_alert", {
    p_identifier_hash: hash,
  });
  if (!claimed) return;

  const escapedIdentifier = escapeHtml(identifier);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: ["rhrildon5@gmail.com"],
        subject: "Alerta: bloqueio temporário de login no RildonX",
        text: `O login "${identifier}" atingiu cinco tentativas inválidas. O acesso foi bloqueado até ${lockedUntil}. Se não reconhecer a atividade, redefina a senha pela página oficial de login.`,
        html: `<p>O login <strong>${escapedIdentifier}</strong> atingiu cinco tentativas inválidas.</p><p>O acesso foi bloqueado até ${escapeHtml(lockedUntil)}.</p><p>Se não reconhecer a atividade, solicite a redefinição da senha pela página oficial de login. Não responda a esta mensagem com credenciais.</p>`,
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Email provider rejected the alert.");
    await callRpc("rildonx_mark_login_alert_sent", {
      p_identifier_hash: hash,
      p_sent: true,
    });
  } catch (error) {
    try {
      await callRpc("rildonx_mark_login_alert_sent", {
        p_identifier_hash: hash,
        p_sent: false,
      });
    } catch (markError) {
      console.error("Could not release the login alert claim.");
    }
    console.error("Login alert delivery failed.", error instanceof Error ? error.message : "Unknown email error.");
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  let allowedOrigins = new Set<string>();
  try {
    allowedOrigins = new Set([
      requiredEnv("LOGIN_APP_URL"),
      ...(Deno.env.get("LOGIN_ALLOWED_ORIGINS") || "").split(","),
    ].map((value) => new URL(value.trim()).origin));
  } catch (error) {
    console.error("Login app origins are not configured.");
  }
  const originAllowed = origin !== null && allowedOrigins.has(origin);

  if (request.method === "OPTIONS") {
    return jsonResponse({}, originAllowed ? 200 : 403, originAllowed ? origin : null);
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, originAllowed ? origin : null);
  }
  if (!originAllowed) {
    return jsonResponse({ error: "Origin not allowed." }, 403, null);
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 4096) {
      return jsonResponse({ error: INVALID_MESSAGE }, 400, origin);
    }
    const body = JSON.parse(rawBody) as LoginBody;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const login = typeof body.login === "string" ? body.login.trim().slice(0, 254) : email;
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1 || password.length > 1024) {
      return jsonResponse({ error: INVALID_MESSAGE }, 400, origin);
    }

    const hash = await identifierHash(email);
    const lockRows = await callRpc<Array<{ locked_until: string | null; locked: boolean }>>(
      "rildonx_check_login_lock",
      { p_identifier_hash: hash },
    );
    const lock = lockRows[0];
    if (lock && lock.locked) {
      await sendLockoutAlert(login, lock.locked_until || new Date().toISOString(), hash);
      return jsonResponse({ error: LOCK_MESSAGE }, 429, origin);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "apikey": requiredEnv("SUPABASE_ANON_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    if (authResponse.status === 400 || authResponse.status === 401 || authResponse.status === 422) {
      const attempts = await callRpc<Array<{
        failure_count: number;
        locked_until: string | null;
        locked: boolean;
      }>>("rildonx_record_login_failure", { p_identifier_hash: hash });
      const attempt = attempts[0];
      if (attempt && attempt.locked) {
        await sendLockoutAlert(login, attempt.locked_until || new Date().toISOString(), hash);
        return jsonResponse({ error: LOCK_MESSAGE }, 429, origin);
      }
      return jsonResponse({ error: INVALID_MESSAGE }, 401, origin);
    }
    if (!authResponse.ok) {
      return jsonResponse({ error: "Serviço de autenticação indisponível. Tente novamente." }, 503, origin);
    }

    const session = await authResponse.json();
    if (!session.access_token || !session.refresh_token) {
      return jsonResponse({ error: "Serviço de autenticação indisponível. Tente novamente." }, 503, origin);
    }
    await callRpc("rildonx_reset_login_attempts", { p_identifier_hash: hash });
    return jsonResponse(session, 200, origin);
  } catch (error) {
    console.error("RildonX login request failed.", error instanceof Error ? error.message : "Unknown error.");
    return jsonResponse({ error: "Serviço de autenticação indisponível. Tente novamente." }, 503, origin);
  }
});
