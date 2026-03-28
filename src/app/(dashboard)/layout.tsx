import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ClipboardList, Home, LogOut, UserRoundCheck } from "lucide-react";
import { requireSessionProfile } from "@/lib/auth/session";
import { signOutTableAccount } from "@/app/(auth)/login/actions";

export const dynamic = "force-dynamic";

async function signOutAction() {
  "use server";

  await signOutTableAccount();
  redirect("/login");
}

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireSessionProfile();
  const navItems: Array<{ href: string; label: string; icon: typeof ClipboardList }> = [];

  navItems.push({ href: "/dashboard", label: "Dashboard", icon: Home });

  if (profile.role === "admin") {
    navItems.push({ href: "/admin", label: "Admin", icon: ClipboardList });
  }

  if (profile.role === "pres_wapres") {
    navItems.push({ href: "/admin", label: "Pres & Wapres", icon: ClipboardList });
  }

  if (profile.role === "menko") {
    navItems.push({ href: "/menko", label: "Menko", icon: BarChart3 });
    navItems.push({ href: "/menko/menteri", label: "Rapor Menteri", icon: BarChart3 });
  }

  if (profile.role === "menteri") {
    navItems.push({ href: "/menteri", label: "Rapor Diri", icon: UserRoundCheck });
    navItems.push({ href: "/menteri/staff", label: "Rapor Staff", icon: BarChart3 });
  }

  if (profile.role === "staff") {
    navItems.push({ href: "/staff", label: "Staff", icon: UserRoundCheck });
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Rapor BEM Bulanan</h1>
            <p className="text-xs text-slate-600">{profile.nama_lengkap} - {profile.role}</p>
          </div>
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link key={item.href} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" href={item.href}>
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            ))}
            <form action={signOutAction}>
              <button className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50" type="submit">
                <LogOut className="h-4 w-4" /> Keluar
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  );
}
