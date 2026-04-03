import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ClipboardList, UserRoundCheck } from "lucide-react";
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

  const featuresByRole: Record<string, FeatureCard[]> = {
    admin: [
      {
        href: "/admin",
        title: "Input Rapor",
        description: "Input dan perbarui rapor bulanan untuk anggota.",
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
        title: "Rapor Diri Sendiri",
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
    menteri: [
      {
        href: "/menteri",
        title: "Rapor Diri Sendiri",
        description: "Lihat seluruh periode rapor pribadi menteri/kepala biro.",
        icon: UserRoundCheck,
      },
      {
        href: "/menteri/staff",
        title: "Rapor Staff Unit",
        description: "Lihat seluruh rapor staff pada kementerian/biro Anda.",
        icon: BarChart3,
      },
    ],
    menko: [
      {
        href: "/menko",
        title: "Recap Kementerian",
        description: "Lihat recap rapor kementerian/biro di bawah koordinasi Anda.",
        icon: BarChart3,
      },
      {
        href: "/menko/menteri",
        title: "Rapor Para Menteri",
        description: "Lihat rapor menteri/kepala biro yang berada di bawah koordinasi Anda.",
        icon: UserRoundCheck,
      },
    ],
  };

  const cards = featuresByRole[profile.role] ?? [];

  if (profile.role === "staff") {
    const { data: assignment } = await supabase
      .from("evaluator_unit_assignments")
      .select("id")
      .eq("evaluator_nim", profile.nim)
      .eq("is_active", true)
      .maybeSingle();

    if (!assignment) {
      const withoutEvaluatorCard = cards.filter((card) => card.href !== "/penilai");
      return renderCards(withoutEvaluatorCard, profile.role);
    }
  }

  return renderCards(cards, profile.role);
}

function renderCards(cards: FeatureCard[], role: string) {

  if (!cards.length) {
    redirect("/login");
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Pilih Fitur Dashboard</h2>
        <p className="text-sm text-slate-600">Akses fitur berdasarkan role Anda: {role}.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="block">
            <Card className="h-full transition-colors hover:border-slate-400">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <card.icon className="h-5 w-5" /> {card.title}
                </CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-slate-700">Buka fitur</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
