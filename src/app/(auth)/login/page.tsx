import { LoginForm } from "@/components/auth/login-form";
import type { SignUpRoleOption, SignUpUnitOption } from "@/types/app";

export const dynamic = "force-dynamic";

const FALLBACK_ROLE_OPTIONS: SignUpRoleOption[] = [
  {
    value: "menko",
    label: "Menko",
    description: "Melihat rekap seluruh kementerian di bawah koordinasi kemenko.",
  },
  {
    value: "menteri",
    label: "Menteri / Kepala Biro",
    description: "Melihat rapor diri dan rapor staff unit.",
  },
  {
    value: "staff",
    label: "Staff",
    description: "Melihat rapor pribadi dan dapat ditugaskan sebagai penilai unit oleh admin.",
  },
];

export default async function LoginPage() {
  let roleOptions: SignUpRoleOption[] = FALLBACK_ROLE_OPTIONS;
  let unitOptions: SignUpUnitOption[] = [];

  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SECRET_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  );

  if (hasSupabaseEnv) {
    const { getSignUpOptions } = await import("@/app/(auth)/login/actions");
    const options = await getSignUpOptions();
    roleOptions = options.roleOptions;
    unitOptions = options.unitOptions;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#dbeafe,transparent_60%)]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
      <LoginForm roleOptions={roleOptions} unitOptions={unitOptions} />
    </main>
  );
}
