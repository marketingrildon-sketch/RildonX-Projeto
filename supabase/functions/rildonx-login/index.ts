import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "http://localhost:4173",
  "http://192.168.0.11:4173",
  "http://192.168.0.13:4173",
  "https://marketingrildon-sketch.github.io",
]);

const allowedHeaders =
  "authorization, apikey, content-type, x-client-info, x-supabase-api-version";

const aliases: Record<string, string> = {
  "adson.ri": "adson.ri@rildonx.local",
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";

  if (origin && !allowedOrigins.has(origin)) {
    console.warn("Rejected Edge Function origin:", origin);
    return new Response("Origin not allowed", { status: 403 });
  }

  const corsHeaders: Record<string, string> = {
    ...(origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Vary": "Origin",
        }
      : {}),
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };

  const respond = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid request body" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return respond({ error: "Invalid request body" }, 400);
  }

  const payload = body as Record<string, unknown>;
  const login =
    typeof payload.login === "string" ? payload.login.trim().toLowerCase() : "";
  const suppliedEmail =
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";
  const email = aliases[login] ?? suppliedEmail;
  const password =
    typeof payload.password === "string" ? payload.password : "";

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length === 0 ||
    password.length > 1024
  ) {
    return respond({ error: "Invalid login or password" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return respond({ error: "Authentication service is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.status === 429) {
        return respond({ error: "Too many login attempts" }, 429);
      }

      if ([400, 401, 422].includes(error.status ?? 0)) {
        return respond({ error: "Invalid login or password" }, 401);
      }

      console.error("Supabase sign-in failed:", error.message);
      return respond({ error: "Authentication service unavailable" }, 502);
    }

    if (!data.session) {
      console.error("Supabase sign-in returned no session");
      return respond({ error: "Authentication service unavailable" }, 502);
    }

    return respond(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      200,
    );
  } catch (error) {
    console.error("Login request failed:", error);
    return respond({ error: "Authentication service unavailable" }, 502);
  }
});
