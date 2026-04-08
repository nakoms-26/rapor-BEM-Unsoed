import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { APP_ROLES, type AppRole } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const SESSION_COOKIE_NAME = "rapor_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export type SessionProfile = {
  nim: string;
  nama_lengkap: string;
  jurusan: string | null;
  tahun_angkatan: number | null;
  role: AppRole;
  unit_id: string;
  can_access_kemenko_report: boolean;
  is_pj_kemenkoan: boolean;
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

  const { error: deleteError } = await supabase.from("app_sessions").delete().eq("nim", nim);
  if (deleteError) {
    throw new Error(`Gagal membersihkan session lama: ${deleteError.message}`);
  }

  const { error: insertError } = await supabase.from("app_sessions").insert({
    nim,
    session_token: sessionToken,
    expires_at: expiresAt,
  });
  if (insertError) {
    throw new Error(`Gagal membuat session baru: ${insertError.message}`);
  }

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
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  return getCurrentSessionProfileByToken(sessionToken);
}

const getCurrentSessionProfileByToken = cache(async (sessionToken: string): Promise<SessionProfile | null> => {
  const supabase = createAdminSupabaseClient();

  const now = new Date().toISOString();
  const { data: session } = await supabase
    .from("app_sessions")
    .select("nim, expires_at")
    .eq("session_token", sessionToken)
    .gt("expires_at", now)
    .single();

  if (!session) {
    return null;
  }

  // Use select("*") to avoid hard dependency on recently added columns
  // when local/dev DB migrations are not yet fully applied.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("nim", session.nim)
    .single();

  if (!profile) {
    return null;
  }

  return {
    nim: profile.nim,
    nama_lengkap: profile.nama_lengkap,
    jurusan: null,
    tahun_angkatan: null,
    role: normalizeProfileRole(String(profile.role ?? "staff")),
    unit_id: profile.unit_id,
    can_access_kemenko_report: Boolean(profile.can_access_kemenko_report),
    is_pj_kemenkoan: Boolean(profile.is_pj_kemenkoan),
  };
});

export async function requireSessionProfile() {
  const profile = await getCurrentSessionProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}
