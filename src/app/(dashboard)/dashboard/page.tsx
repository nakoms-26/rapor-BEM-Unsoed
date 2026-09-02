import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ClipboardList, UserRoundCheck, Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type FeatureCard = {
  href: string;
  title: string;
  description: string;
  icon: typeof ClipboardList;
};

export default async function DashboardLandingPage() {
  const profile = await requireSessionProfile();
  const supabase = createAdminSupabaseClient();
  const isPjKemenkoan =
    profile.is_pj_kemenkoan === true &&
    (profile.role === "pj_kementerian" || profile.role === "admin");

  const featuresByRole: Record<string, FeatureCard[]> = {
    admin: [
      {
        href: "/admin",
        title: "Input Rapor & Backup Data",
        description: "Input rapor bulanan, kelola periode, serta download backup seluruh database (CSV/Excel).",
        icon: Database,
      },
      {
        href: "/admin/staff-recap",
        title: "Recap Staff Kabinet",
        description: "Lihat recap seluruh staff kabinet yang dikelompokkan berdasar kementerian.",
        icon: BarChart3,
      },
      {
        href: "/admin/menteri-detail",
        title: "Rapor Menteri",
        description: "Lihat detail rapor menteri/kepala biro se-kabinet.",
        icon: UserRoundCheck,
      },
    ],
    pj_kementerian: [
      {
        href: "/pj-kementerian",
        title: "Rapor Diri",
        description: "Lihat seluruh periode rapor pribadi PJ Kementerian.",
        icon: UserRoundCheck,
      },
      {
        href: "/admin",
        title: "Input Kementerian Diampu",
        description: "Input rapor untuk kementerian yang diampu sesuai batasan role.",
        icon: ClipboardList,
      },
    ],
    pres_wapres: [
      {
        href: "/pres_wapres",
        title: "Pantau Seluruh Rapor",
        description: "Lihat seluruh rapor lintas role dan unit tanpa akses input.",
        icon: BarChart3,
      },
    ],
    staff: [
      {
        href: "/staff",
        title: "Rapor Diri",
        description: "Lihat seluruh periode rapor pribadi.",
        icon: UserRoundCheck,
      },
      {
        href: "/penilai",
        title: "Input Unit Pegangan",
        description: "Khusus staf Biro PPM/Pengendali Mutu yang mendapat assignment unit.",
        icon: ClipboardList,
      },
    ],
    internship: [
      {
        href: "/staff",
        title: "Rapor Cakrawala",
        description: "Lihat seluruh periode rapor pribadi internship Cakrawala.",
        icon: UserRoundCheck,
      },
    ],
    the_meridian: [
      {
        href: "/the-meridian",
        title: "Rapor Internship Unit",
        description: "Lihat dan pantau rapor staf internship di kementerian/biro Kamu.",
        icon: BarChart3,
      },
    ],
    pj_ppm_intern: [
      {
        href: "/staff",
        title: "Rapor Diri",
        description: "Lihat seluruh periode rapor pribadi Kamu sebagai staf magang Biro PPM.",
        icon: UserRoundCheck,
      },
      {
        href: "/pj-ppm-intern",
        title: "Rapor Internship [Kementerian/Biro]",
        description: "Lihat dan pantau seluruh rapor anak intern kementerian/biro yang diampu.",
        icon: BarChart3,
      },
    ],
    menteri: [
      {
        href: "/menteri",
        title: "Rapor Diri",
        description: "Lihat seluruh periode rapor pribadi menteri/kepala biro.",
        icon: UserRoundCheck,
      },
      {
        href: "/menteri/staff",
        title: "Rapor Staff & Intern",
        description: "Lihat seluruh rapor staff dan internship pada kementerian/biro Kamu.",
        icon: BarChart3,
      },
    ],
    menko: [
      {
        href: "/menko",
        title: "Recap Kementerian",
        description: "Lihat recap rapor kementerian/biro di bawah koordinasi Kamu.",
        icon: BarChart3,
      },
      {
        href: "/menko/menteri",
        title: "Rapor Para Menteri",
        description: "Lihat rapor menteri/kepala biro yang berada di bawah koordinasi Kamu.",
        icon: UserRoundCheck,
      },
    ],
  };

  const cards = [...(featuresByRole[profile.role] ?? [])];

  if (profile.role === "admin") {
    cards.push({
      href: "/admin/menteri-detail#input-rapor-menteri-form",
      title: "Input Rapor Menteri",
      description: "Input penilaian rapor untuk menteri/kepala biro se-kabinet.",
      icon: ClipboardList,
    });
  }

  if (profile.role === "menko") {
    cards.push({
      href: "/menko/menteri#input-rapor-menteri-form",
      title: "Input Rapor Menteri",
      description: "Input penilaian rapor untuk menteri/kepala biro di bawah koordinasi Kamu.",
      icon: ClipboardList,
    });
  }

  if (isPjKemenkoan) {
    cards.length = 0;
    cards.push({
      href: "/pj-kemenkoan",
      title: "Kelola Sub-Indikator",
      description: "Atur sub-indikator untuk kemenko yang Kamu pegang.",
      icon: ClipboardList,
    });
    cards.push({
      href: "/pj-kemenkoan/rapor-diri",
      title: "Rapor Diri",
      description: "Lihat seluruh periode rapor pribadi PJ Kemenkoan.",
      icon: UserRoundCheck,
    });
    cards.push({
      href: "/admin",
      title: "Input Kementerian Diampu",
      description: "Input rapor kementerian/biro yang berada di bawah kemenko Kamu.",
      icon: ClipboardList,
    });
    cards.push({
      href: "/menko",
      title: "Recap Kementerian",
      description: "Lihat recap kementerian/biro yang berada di bawah kemenko Kamu.",
      icon: BarChart3,
    });
  }

  if (profile.role === "staff") {
    const { data: assignment } = await supabase
      .from("evaluator_unit_assignments")
      .select("id")
      .eq("evaluator_nim", profile.nim)
      .eq("is_active", true)
      .maybeSingle();

    if (!assignment) {
      const withoutEvaluator = cards.filter((card) => card.href !== "/penilai");
      return renderCards(withoutEvaluator, profile.role);
    }
  }

  return renderCards(cards, profile.role);
}

function renderCards(cards: FeatureCard[], role: string) {
  if (!cards.length) {
    redirect("/login");
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Pilih Fitur Dashboard</h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">Akses fitur berdasarkan role Kamu: <span className="font-semibold text-slate-800">{role}</span>.</p>
      </div>

      <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group block focus:outline-hidden">
            <Card className="h-full border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:border-blue-400 hover:shadow-md active:scale-[0.99] flex flex-col justify-between">
              <CardHeader className="p-4 sm:p-5">
                <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors flex-shrink-0">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <span>{card.title}</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                  {card.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0 flex items-center justify-end">
                <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                  Buka fitur &rarr;
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
