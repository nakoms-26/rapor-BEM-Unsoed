"use server";

import { createAppSession, clearAppSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { APP_ROLES, ROLE_HOME, type AppRole } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { SignUpRoleOption, SignUpUnitOption } from "@/types/app";

const ADMIN_ALLOWED_UNITS = new Set(["Biro PPM", "Biro Pengendali & Penjamin Mutu"]);
const PRES_WAPRES_ALLOWED_UNITS = new Set(["Lingkar Presiden"]);

const SIGN_UP_ROLE_OPTIONS: SignUpRoleOption[] = [
  {
    value: "admin",
    label: "Admin",
    description: "Akses input rapor lintas unit (unit: Biro PPM / Biro Pengendali & Penjamin Mutu).",
  },
  {
    value: "menko",
    label: "Menko",
    description: "Melihat rekap seluruh kementerian di bawah koordinasi kemenko.",
  },
  {
    value: "menteri",
    label: "Menteri / Kepala Biro",
    description: "Melihat rekap untuk 1 kementerian atau biro miliknya.",
  },
  {
    value: "staff",
    label: "Staff",
    description: "Melihat rapor pribadi.",
  },
];

function normalizeNim(nim: string) {
  return nim.replace(/\s+/g, "").toUpperCase();
}

function isAppRole(value: string): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

function isUnitAllowedForRole(
  role: AppRole,
  unit: { nama_unit: string; kategori: "kemenko" | "kementerian" | "biro" },
) {
  if (role === "menko") {
    return unit.kategori === "kemenko";
  }

  if (role === "menteri" || role === "staff") {
    return unit.kategori === "kementerian" || unit.kategori === "biro";
  }

  if (role === "pres_wapres") {
    return PRES_WAPRES_ALLOWED_UNITS.has(unit.nama_unit);
  }

  if (role === "admin") {
    return ADMIN_ALLOWED_UNITS.has(unit.nama_unit);
  }

  return false;
}

export async function getSignUpOptions() {
  const supabase = createAdminSupabaseClient();
  const { data: units } = await supabase
    .from("ref_units")
    .select("id, nama_unit, kategori")
    .order("kategori")
    .order("nama_unit");

  return {
    roleOptions: SIGN_UP_ROLE_OPTIONS,
    unitOptions: (units ?? []) as SignUpUnitOption[],
  };
}

export async function signInWithTableAccount(payload: { nim: string; password: string }) {
  const nim = normalizeNim(payload.nim);
  const password = payload.password;

  if (!nim || !password) {
    return { ok: false, message: "NIM dan password wajib diisi." };
  }

  const supabase = createAdminSupabaseClient();
  const { data: account } = await supabase
    .from("app_accounts")
    .select("nim, password_hash")
    .eq("nim", nim)
    .single();

  if (!account || !verifyPassword(password, account.password_hash)) {
    return { ok: false, message: "NIM atau password salah." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("nim", nim)
    .single();

  if (!profile) {
    return { ok: false, message: "Profil pengguna tidak ditemukan." };
  }

  await createAppSession(nim);

  return {
    ok: true,
    redirectTo: ROLE_HOME[profile.role] ?? "/dashboard",
  };
}

export async function signUpWithTableAccount(payload: {
  nim: string;
  namaLengkap: string;
  role: string;
  unitId: string;
  password: string;
  confirmPassword: string;
}) {
  const nim = normalizeNim(payload.nim);
  const namaLengkap = payload.namaLengkap.trim();
  const requestedRole = payload.role.trim();
  const unitId = payload.unitId.trim();
  const password = payload.password;
  const confirmPassword = payload.confirmPassword;

  if (!nim || !namaLengkap || !requestedRole || !unitId || !password || !confirmPassword) {
    return { ok: false, message: "Semua field wajib diisi." };
  }

  if (!isAppRole(requestedRole)) {
    return { ok: false, message: "Role akun tidak valid." };
  }

  if (password.length < 6) {
    return { ok: false, message: "Password minimal 6 karakter." };
  }

  if (password !== confirmPassword) {
    return { ok: false, message: "Konfirmasi password tidak sama." };
  }

  const supabase = createAdminSupabaseClient();
  const { data: existingAccount } = await supabase
    .from("app_accounts")
    .select("nim")
    .eq("nim", nim)
    .single();

  if (existingAccount) {
    return { ok: false, message: "Akun dengan NIM tersebut sudah terdaftar." };
  }

  const { data: selectedUnit } = await supabase
    .from("ref_units")
    .select("id, nama_unit, kategori")
    .eq("id", unitId)
    .single();

  if (!selectedUnit) {
    return { ok: false, message: "Unit yang dipilih tidak ditemukan." };
  }

  if (!isUnitAllowedForRole(requestedRole, selectedUnit)) {
    return {
      ok: false,
      message:
        requestedRole === "admin"
          ? "Akun Admin hanya boleh menggunakan unit Biro PPM (Biro Pengendali & Penjamin Mutu)."
          : requestedRole === "pres_wapres"
            ? "Akun Pres & Wapres hanya boleh menggunakan unit Lingkar Presiden."
            : requestedRole === "menko"
              ? "Akun Menko wajib menggunakan unit kategori kemenko."
              : "Akun Menteri/Staff wajib menggunakan unit kategori kementerian atau biro.",
    };
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("nim, role, unit_id")
    .eq("nim", nim)
    .single();

  if (!profile) {
    const { data: createdProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        nim,
        nama_lengkap: namaLengkap,
        unit_id: selectedUnit.id,
        role: requestedRole,
      })
      .select("nim, role, unit_id")
      .single();

    if (profileError || !createdProfile) {
      return { ok: false, message: profileError?.message ?? "Gagal membuat profil pengguna." };
    }

    profile = createdProfile;
  } else {
    await supabase
      .from("profiles")
      .update({ nama_lengkap: namaLengkap, role: requestedRole, unit_id: selectedUnit.id })
      .eq("nim", nim);

    profile = {
      ...profile,
      role: requestedRole,
      unit_id: selectedUnit.id,
    };
  }

  const { error: accountError } = await supabase.from("app_accounts").insert({
    nim,
    password_hash: hashPassword(password),
  });

  if (accountError) {
    return { ok: false, message: accountError.message };
  }

  await createAppSession(nim);

  return {
    ok: true,
    redirectTo: ROLE_HOME[profile.role] ?? "/dashboard",
  };
}

export async function signOutTableAccount() {
  await clearAppSession();
}
