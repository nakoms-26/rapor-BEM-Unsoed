import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { APP_ROLES, type AppRole } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const SESSION_COOKIE_NAME = "rapor_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export type SessionProfile = {
  nim: string;
  nama_lengkap: string;
  role: AppRole;
  unit_id: string;
};

function getSessionExpiryDate() {
  return new Date(Date.now() + SESSION_DURATION_MS);
}

function normalizeProfileRole(role: string): AppRole {
  if (role === "user") {
    return "staff";
  }

  if (APP_ROLES.includes(role as AppRole)) {
    return role as AppRole;
  }

  return "staff";
}

export async function createAppSession(nim: string) {
  const supabase = createAdminSupabaseClient();
  const cookieStore = await cookies();
  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = getSessionExpiryDate().toISOString();

  await supabase.from("app_sessions").delete().eq("nim", nim);
  await supabase.from("app_sessions").insert({
    nim,
    session_token: sessionToken,
    expires_at: expiresAt,
  });

  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearAppSession() {
  const supabase = createAdminSupabaseClient();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await supabase.from("app_sessions").delete().eq("session_token", sessionToken);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentSessionProfile(): Promise<SessionProfile | null> {
  const supabase = createAdminSupabaseClient();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const now = new Date().toISOString();
  const { data: session } = await supabase
    .from("app_sessions")
    .select("nim, expires_at")
    .eq("session_token", sessionToken)
    .gt("expires_at", now)
    .single();

  if (!session) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nim, nama_lengkap, role, unit_id")
    .eq("nim", session.nim)
    .single();

  if (!profile) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return {
    nim: profile.nim,
    nama_lengkap: profile.nama_lengkap,
    role: normalizeProfileRole(String(profile.role ?? "staff")),
    unit_id: profile.unit_id,
  };
}

export async function requireSessionProfile() {
  const profile = await getCurrentSessionProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}
