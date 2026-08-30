import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isDuplicateAuthError(error: { code?: string; message: string; status?: number }): boolean {
  const code = error.code?.toLowerCase();
  const message = error.message.toLowerCase();
  return code === "email_exists" || code === "user_already_exists" ||
    (error.status === 422 && (message.includes("already") || message.includes("registered")));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method tidak didukung" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Autentikasi diperlukan" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !anonKey || !adminKey) return json({ error: "Konfigurasi server tidak lengkap" }, 500);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const admin = createClient(url, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sesi tidak valid" }, 401);

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("identity_type,status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: "Gagal memverifikasi Admin" }, 500);
  if (!profile || profile.identity_type !== "ADMIN" || profile.status !== "Aktif") {
    return json({ error: "Hanya Admin aktif yang dapat membuat user" }, 403);
  }

  let payload: { email?: string; display_name?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Payload tidak valid" }, 400);
  }

  const email = payload.email?.trim().toLowerCase();
  const displayName = payload.display_name?.trim();
  const validEmail = !!email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!validEmail) return json({ error: "Format email tidak valid" }, 400);
  if (!displayName || displayName.length > 200) return json({ error: "Nama wajib diisi dan maksimal 200 karakter" }, 400);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) {
    if (isDuplicateAuthError(error)) {
      return json({ error: "Email sudah terdaftar di Auth. Cari dan edit user tersebut dari Manage User." }, 409);
    }
    return json({ error: "Gagal membuat identitas Auth" }, 400);
  }
  if (!data.user) return json({ error: "User Auth hasil provisioning tidak tersedia" }, 500);

  return json({ user: { id: data.user.id, email: data.user.email ?? email } }, 201);
});
