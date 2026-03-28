import { LoginForm } from "@/components/auth/login-form";
import { getSignUpOptions } from "@/app/(auth)/login/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const { roleOptions, unitOptions } = await getSignUpOptions();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#dbeafe,transparent_60%)]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
      <LoginForm roleOptions={roleOptions} unitOptions={unitOptions} />
    </main>
  );
}
