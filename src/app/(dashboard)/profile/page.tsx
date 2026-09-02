import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import Link from "next/link";
import {
  User,
  CreditCard,
  GraduationCap,
  Calendar,
  Briefcase,
  Building2,
  Layers,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

function formatRoleLabel(role: string): { label: string; badgeClass: string; icon: typeof User } {
  switch (role) {
    case "admin":
      return {
        label: "Admin Sistem",
        badgeClass: "bg-red-50 text-red-700 border-red-200",
        icon: ShieldCheck,
      };
    case "pres_wapres":
      return {
        label: "Presiden & Wakil Presiden",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        icon: Sparkles,
      };
    case "menko":
      return {
        label: "Menteri Koordinator (Menko)",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
        icon: Layers,
      };
    case "menteri":
      return {
        label: "Menteri / Kepala Biro",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
        icon: Briefcase,
      };
    case "pj_kementerian":
      return {
        label: "PJ Kementerian (Biro PPM)",
        badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
        icon: ShieldCheck,
      };
    case "the_meridian":
      return {
        label: "The Meridian (Koordinator Internship)",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
        icon: Sparkles,
      };
    case "pj_ppm_intern":
      return {
        label: "PJ PPM Internship",
        badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
        icon: ShieldCheck,
      };
    case "internship":
      return {
        label: "Staf Magang (Cakrawala)",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: User,
      };
    case "staff":
      return {
        label: "Staf BEM",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        icon: User,
      };
    default:
      return {
        label: role,
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        icon: User,
      };
  }
}

export default async function ProfilePage() {
  const sessionProfile = await requireSessionProfile();
  const supabase = createAdminSupabaseClient();

  if (!sessionProfile) {
    redirect("/login");
  }

  // 1. Fetch fresh profile and unit data
  const [{ data: dbProfile }, { data: userUnit }] = await Promise.all([
    supabase.from("profiles").select("*").eq("nim", sessionProfile.nim).single(),
    supabase.from("ref_units").select("id, nama_unit, kategori, parent_id").eq("id", sessionProfile.unit_id).single(),
  ]);

  const profile = {
    ...sessionProfile,
    nama_lengkap: dbProfile?.nama_lengkap || sessionProfile.nama_lengkap,
    jurusan: dbProfile?.jurusan || sessionProfile.jurusan,
    tahun_angkatan: dbProfile?.tahun_angkatan ?? sessionProfile.tahun_angkatan,
    role: dbProfile?.role || sessionProfile.role,
  };

  let kemenkoUnitName = "Tidak Terkait Kemenko";
  if (userUnit) {
    if (userUnit.kategori === "kemenko") {
      kemenkoUnitName = userUnit.nama_unit;
    } else if (userUnit.parent_id) {
      const { data: parentKemenko } = await supabase
        .from("ref_units")
        .select("nama_unit")
        .eq("id", userUnit.parent_id)
        .single();

      if (parentKemenko) {
        kemenkoUnitName = parentKemenko.nama_unit;
      }
    }
  }

  const roleInfo = formatRoleLabel(profile.role);
  const RoleIcon = roleInfo.icon;

  const profileFields = [
    {
      label: "Nama Lengkap",
      value: profile.nama_lengkap || "-",
      icon: User,
      description: "Nama resmi yang terdaftar pada sistem rapor",
    },
    {
      label: "NIM",
      value: profile.nim || "-",
      icon: CreditCard,
      description: "Nomor Induk Mahasiswa Universitas Jenderal Soedirman",
    },
    {
      label: "Jurusan / Program Studi",
      value: profile.jurusan || "-",
      icon: GraduationCap,
      description: "Program studi mahasiswa",
    },
    {
      label: "Tahun Angkatan",
      value: profile.tahun_angkatan ? String(profile.tahun_angkatan) : "-",
      icon: Calendar,
      description: "Tahun masuk perkuliahan",
    },
    {
      label: "Jabatan / Role",
      value: roleInfo.label,
      icon: Briefcase,
      isBadge: true,
      badgeClass: roleInfo.badgeClass,
      description: "Tingkat hak akses dan kewenangan pada sistem",
    },
    {
      label: "Kementerian / Biro",
      value: userUnit?.nama_unit || "-",
      icon: Building2,
      description: `Unit internal BEM (${userUnit?.kategori ? userUnit.kategori.toUpperCase() : "UNIT"})`,
    },
    {
      label: "Kemenkoan",
      value: kemenkoUnitName,
      icon: Layers,
      description: "Kementerian Koordinator yang menaungi unit",
    },
  ];

  return (
    <section className="space-y-5 max-w-4xl mx-auto pb-8">
      {/* Header Breadcrumb */}
      <div>
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Dashboard</span>
        </Link>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Profil Anggota</h2>
        <p className="text-xs sm:text-sm text-slate-600">
          Informasi identitas akun, jabatan organisasi, dan unit kerja BEM Unsoed.
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card className="border-slate-200/80 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 shadow-xs overflow-hidden">
        <div className="h-1.5 sm:h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500" />
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 pb-4">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md text-xl sm:text-2xl font-bold flex-shrink-0">
              {profile.nama_lengkap ? profile.nama_lengkap.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl text-slate-900 truncate">{profile.nama_lengkap}</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-500 font-mono truncate">
                {profile.nim} · {userUnit?.nama_unit ?? "BEM Unsoed"}
              </CardDescription>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${roleInfo.badgeClass} self-start sm:self-center shadow-2xs whitespace-nowrap`}
          >
            <RoleIcon className="h-3.5 w-3.5" />
            {roleInfo.label}
          </span>
        </CardHeader>
      </Card>

      {/* Detailed Fields Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        {profileFields.map((field) => (
          <Card key={field.label} className="border-slate-200/80 bg-white hover:border-slate-300 transition-colors shadow-2xs">
            <CardContent className="p-3.5 sm:p-4.5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 flex-shrink-0 mt-0.5">
                  <field.icon className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{field.label}</p>
                  {field.isBadge ? (
                    <div className="pt-0.5">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold border ${field.badgeClass}`}>
                        {field.value}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base font-bold text-slate-900 break-words">{field.value}</p>
                  )}
                  <p className="text-[10.5px] text-slate-400 leading-snug">{field.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
