import { redirect } from "next/navigation";
import { requireSessionProfile } from "@/lib/auth/session";
import { canAccessKemenkoReports } from "@/lib/auth/permissions";
import { signOutTableAccount } from "@/app/(auth)/login/actions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { DashboardHeader, type HeaderNavItem } from "@/components/dashboard/dashboard-header";

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
  const navItems: HeaderNavItem[] = [];

  const pushNav = (item: HeaderNavItem) => {
    if (!navItems.some((n) => n.href === item.href)) {
      navItems.push(item);
    }
  };

  navItems.push({ href: "/dashboard", label: "Dashboard", iconKey: "home", category: "main" });

  // PJ Kemenkoan (Staf)
  if (profile.is_pj_kemenkoan && profile.role !== "pj_ppm_intern") {
    pushNav({ href: "/pj-kemenkoan", label: "Kelola Sub-Indikator", iconKey: "clipboard", category: "kementerian" });
    pushNav({ href: "/admin", label: "Input Kementerian", iconKey: "clipboard", category: "kementerian" });
    pushNav({ href: "/menko", label: "Recap Kementerian", iconKey: "chart", category: "kementerian" });
  }

  if (profile.role === "admin") {
    pushNav({ href: "/admin", label: "Admin", iconKey: "clipboard", category: "kementerian" });
    pushNav({ href: "/admin/staff-recap", label: "Recap Staff Kabinet", iconKey: "chart", category: "kementerian" });
    pushNav({ href: "/admin/menteri-detail", label: "Rapor Menteri", iconKey: "userCheck", category: "kementerian" });
  }

  if (profile.role === "pj_kementerian") {
    pushNav({ href: "/admin", label: "Input Kementerian", iconKey: "clipboard", category: "kementerian" });
    pushNav({
      href: profile.is_pj_kemenkoan ? "/pj-kemenkoan/rapor-diri" : "/pj-kementerian",
      label: "Rapor Diri",
      iconKey: "userCheck",
      category: "personal",
    });
  }

  // PJ PPM Intern (PJ Kementerian Intern & PJ Kemenkoan Intern)
  if (profile.role === "pj_ppm_intern") {
    if (profile.is_pj_kemenkoan) {
      pushNav({ href: "/pj-ppm-intern/kelola-indikator", label: "Kelola Indikator Intern", iconKey: "clipboard", category: "internship" });
    }
    pushNav({ href: "/pj-ppm-intern/input", label: "Input Internship", iconKey: "clipboard", category: "internship" });
    pushNav({ href: "/pj-ppm-intern", label: "Monitoring Internship", iconKey: "chart", category: "internship" });
    pushNav({
      href: profile.is_pj_kemenkoan ? "/pj-kemenkoan/rapor-diri" : "/staff",
      label: "Rapor Diri",
      iconKey: "userCheck",
      category: "personal",
    });
  }

  if (profile.role === "pres_wapres") {
    pushNav({ href: "/pres_wapres", label: "Presiden & Wakil Presiden", iconKey: "clipboard", category: "other" });
  }

  // Keep "Rapor Menteri" navigation for role menko only.
  if (profile.role === "menko" && canAccessKemenkoReports(profile)) {
    const kemenkoLabel = profile.role === "menko" ? "Menko" : "PJ Kemenkoan";
    pushNav({ href: "/menko", label: kemenkoLabel, iconKey: "chart", category: "kementerian" });
    pushNav({ href: "/menko/menteri", label: `${kemenkoLabel} - Rapor Menteri`, iconKey: "chart", category: "kementerian" });
  }

  if (profile.role === "menteri") {
    pushNav({ href: "/menteri", label: "Rapor Diri", iconKey: "userCheck", category: "personal" });
    pushNav({ href: "/menteri/staff", label: "Rapor Staff & Intern", iconKey: "chart", category: "kementerian" });
  }

  if (profile.role === "staff") {
    pushNav({ href: "/staff", label: "Rapor Diri", iconKey: "userCheck", category: "personal" });
    const { data: assignment } = await supabase
      .from("evaluator_unit_assignments")
      .select("id")
      .eq("evaluator_nim", profile.nim)
      .eq("is_active", true)
      .maybeSingle();

    if (assignment) {
      pushNav({ href: "/penilai", label: "Input Unit Pegangan", iconKey: "clipboard", category: "kementerian" });
    }
  }

  if (profile.role === "internship") {
    pushNav({ href: "/staff", label: "Rapor Cakrawala", iconKey: "userCheck", category: "personal" });
  }

  if (profile.role === "the_meridian") {
    const { data: pjAssignments } = await supabase
      .from("pj_assignments")
      .select("id, scope")
      .eq("nim", profile.nim)
      .eq("is_active", true);

    const hasAnyAssignment = (pjAssignments ?? []).length > 0;
    const hasUnitAssignment = (pjAssignments ?? []).some((a) => a.scope === "unit");

    if (hasAnyAssignment) {
      pushNav({ href: "/pj-ppm-intern/input", label: "Input Internship", iconKey: "clipboard", category: "internship" });
      pushNav({ href: "/pj-ppm-intern", label: "Monitoring Internship", iconKey: "chart", category: "internship" });
    }

    if (hasUnitAssignment) {
      pushNav({ href: "/admin", label: "Input Rapor Staf", iconKey: "clipboard", category: "kementerian" });
    }

    pushNav({ href: "/staff", label: "Rapor Diri", iconKey: "userCheck", category: "personal" });
    pushNav({ href: "/the-meridian", label: "Rapor Internship Unit", iconKey: "chart", category: "internship" });
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <DashboardHeader
        profile={{
          nama_lengkap: profile.nama_lengkap,
          nim: profile.nim,
          role: profile.role,
          is_pj_kemenkoan: profile.is_pj_kemenkoan,
        }}
        navItems={navItems}
        signOutAction={signOutAction}
      />

      <main className="mx-auto max-w-7xl w-full px-3 sm:px-6 py-4 sm:py-6 md:py-8 flex-1">
        {children}
      </main>
    </div>
  );
}

