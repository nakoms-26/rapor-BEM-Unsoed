import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ClipboardList, Home, LogOut, UserRoundCheck, User } from "lucide-react";
import { requireSessionProfile } from "@/lib/auth/session";
import { canAccessKemenkoReports } from "@/lib/auth/permissions";
import { signOutTableAccount } from "@/app/(auth)/login/actions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
  const supabase = createAdminSupabaseClient();
  const navItems: Array<{ href: string; label: string; icon: typeof ClipboardList }> = [];

  navItems.push({ href: "/dashboard", label: "Dashboard", icon: Home });

  if (profile.role === "admin" || profile.role === "pj_kementerian") {
    // PJ Kemenkoan can manage sub-indicators and still access input/recap pages.
    if (profile.is_pj_kemenkoan) {
      navItems.push({ href: "/pj-kemenkoan", label: "Kelola Sub-Indikator", icon: ClipboardList });
      navItems.push({ href: "/admin", label: "Input Kementerian", icon: ClipboardList });
      navItems.push({ href: "/menko", label: "Recap Kementerian", icon: BarChart3 });
    } else {
      navItems.push({ href: "/admin", label: profile.role === "pj_kementerian" ? "Input Kementerian" : "Admin", icon: ClipboardList });
    }
  }

  if (profile.role === "pj_kementerian" && !profile.is_pj_kemenkoan) {
    navItems.push({ href: "/pj-kementerian", label: "Rapor Diri", icon: UserRoundCheck });
  }

  if (profile.role === "pres_wapres") {
    navItems.push({ href: "/pres_wapres", label: "Presiden & Wakil Presiden", icon: ClipboardList });
  }

  // Keep "Rapor Menteri" navigation for role menko only.
  if (profile.role === "menko" && canAccessKemenkoReports(profile)) {
    const kemenkoLabel = profile.role === "menko" ? "Menko" : "PJ Kemenkoan";
    navItems.push({ href: "/menko", label: kemenkoLabel, icon: BarChart3 });
    navItems.push({ href: "/menko/menteri", label: `${kemenkoLabel} - Rapor Menteri`, icon: BarChart3 });
  }

  if (profile.role === "menteri") {
    navItems.push({ href: "/menteri", label: "Rapor Diri", icon: UserRoundCheck });
    navItems.push({ href: "/menteri/staff", label: "Rapor Staff & Intern", icon: BarChart3 });
  }

  if (profile.role === "staff") {
    navItems.push({ href: "/staff", label: "Staff", icon: UserRoundCheck });
    const { data: assignment } = await supabase
      .from("evaluator_unit_assignments")
      .select("id")
      .eq("evaluator_nim", profile.nim)
      .eq("is_active", true)
      .maybeSingle();

    if (assignment) {
      navItems.push({ href: "/penilai", label: "Input Unit Pegangan", icon: ClipboardList });
    }
  }

  if (profile.role === "internship") {
    navItems.push({ href: "/staff", label: "Rapor Cakrawala", icon: UserRoundCheck });
  }

  if (profile.role === "the_meridian") {
    navItems.push({ href: "/the-meridian", label: "Rapor Internship Unit", icon: BarChart3 });
  }

  if (profile.role === "pj_ppm_intern") {
    navItems.push({ href: "/staff", label: "Rapor Diri", icon: UserRoundCheck });
    navItems.push({ href: "/pj-ppm-intern", label: "Rapor Internship [Kementerian/Biro]", icon: BarChart3 });
  }

  if (profile.role === "admin") {
    navItems.push({ href: "/admin/staff-recap", label: "Recap Staff Kabinet", icon: BarChart3 });
    navItems.push({ href: "/admin/menteri-detail", label: "Rapor Menteri", icon: UserRoundCheck });
  }

  // Profil item for all logged-in users
  navItems.push({ href: "/profile", label: "Profil", icon: User });

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/profile" className="group min-w-0 mr-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
              {profile.nama_lengkap ? profile.nama_lengkap.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
                {profile.nama_lengkap}
              </h1>
              <p className="text-xs text-slate-500 truncate max-w-[180px] sm:max-w-xs">{profile.nim} · {profile.role}</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 whitespace-nowrap transition-colors"
                href={item.href}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
            <form action={signOutAction}>
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 whitespace-nowrap transition-colors"
                type="submit"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span>Keluar</span>
              </button>
            </form>
          </nav>

          {/* Mobile/Tablet hamburger toggle */}
          <label
            htmlFor="mobile-nav-toggle"
            className="lg:hidden flex-shrink-0 cursor-pointer rounded-md p-2 text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Buka navigasi"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
        </div>

        {/* Mobile nav drawer — pure CSS checkbox trick with smooth transition */}
        <input type="checkbox" id="mobile-nav-toggle" className="peer sr-only" />
        <nav
          className="hidden peer-checked:block lg:hidden border-t border-slate-100 bg-white/95 backdrop-blur shadow-lg transition-all"
          aria-label="Navigasi mobile"
        >
          <div className="mx-auto max-w-7xl px-3 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className="flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-colors"
                href={item.href}
              >
                <item.icon className="h-4.5 w-4.5 flex-shrink-0 text-slate-500" />
                <span>{item.label}</span>
              </Link>
            ))}
            <form action={signOutAction} className="pt-1 border-t border-slate-100">
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                type="submit"
              >
                <LogOut className="h-4.5 w-4.5 flex-shrink-0" />
                <span>Keluar</span>
              </button>
            </form>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6 md:py-8">{children}</main>
    </div>
  );
}
