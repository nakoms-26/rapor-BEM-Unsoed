import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSessionProfile } from "@/lib/auth/session";
import { MAIN_INDICATORS, PRESTASI_RESPONSIBILITY_OPTIONS, PRESTASI_SCALE_OPTIONS, ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  clearEvaluatorAssignmentByAdmin,
  deleteRaporByAdmin,
  updatePeriodStatusByAdmin,
  upsertEvaluatorAssignmentByAdmin,
} from "@/app/(dashboard)/admin/actions";
import { AdminDynamicForm } from "@/components/dashboard/admin-dynamic-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function reportTypeLabel(type: "staf_unit" | "menteri_kepala_biro") {
  return type === "menteri_kepala_biro" ? "Menteri/Kepala Biro" : "Staf Unit";
}

function scoreTone(score: number) {
  if (score >= 85) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 70) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

type PrestasiResponsibilityValue = (typeof PRESTASI_RESPONSIBILITY_OPTIONS)[number]["value"];
type PrestasiScaleValue = (typeof PRESTASI_SCALE_OPTIONS)[number]["value"];

function isPrestasiResponsibilityValue(value: string | null | undefined): value is PrestasiResponsibilityValue {
  return PRESTASI_RESPONSIBILITY_OPTIONS.some((option) => option.value === value);
}

function isPrestasiScaleValue(value: string | null | undefined): value is PrestasiScaleValue {
  return PRESTASI_SCALE_OPTIONS.some((option) => option.value === value);
}

function canonicalizeIndicatorName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/^[a-z0-9]+[\.)\-:\s]+/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMainIndicatorName(name: string) {
  const normalized = canonicalizeIndicatorName(name);
  if (normalized.includes("partisipasi") && (normalized.includes("ekstern") || normalized.includes("external"))) {
    return "Partisipasi External";
  }
  if (normalized.includes("keaktifan")) return "Keaktifan";
  if (normalized.includes("tanggung") && normalized.includes("jawab")) return "Tanggung Jawab";
  if (normalized.includes("partisipasi") && normalized.includes("internal")) return "Partisipasi Internal";
  if (normalized.includes("nilai") && normalized.includes("prestasi")) return "Nilai Prestasi";
  return name.trim();
}

function normalizePrestasiResponsibilityValue(value: string | null | undefined): PrestasiResponsibilityValue | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return PRESTASI_RESPONSIBILITY_OPTIONS.find((option) => option.value.toLowerCase() === normalized)?.value;
}

function normalizePrestasiScaleValue(value: string | null | undefined): PrestasiScaleValue | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return PRESTASI_SCALE_OPTIONS.find((option) => option.value.toLowerCase() === normalized)?.value;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = (await searchParams) ?? {};
  const editRaporIdParam = resolvedParams.edit_rapor_id;
  const editRaporId = typeof editRaporIdParam === "string"
    ? editRaporIdParam
    : Array.isArray(editRaporIdParam)
      ? (editRaporIdParam[0] ?? "")
      : "";

  const profile = await requireSessionProfile();
  const supabase = createAdminSupabaseClient();

  async function deleteRaporAction(formData: FormData) {
    "use server";

    const raporId = String(formData.get("rapor_id") ?? "").trim();
    if (!raporId) {
      return;
    }

    await deleteRaporByAdmin(raporId);
    revalidatePath("/admin");
  }

  async function upsertAssignmentAction(formData: FormData) {
    "use server";

    await upsertEvaluatorAssignmentByAdmin({
      evaluator_nim: String(formData.get("evaluator_nim") ?? ""),
      target_unit_id: String(formData.get("target_unit_id") ?? ""),
    });
    revalidatePath("/admin");
  }

  async function clearAssignmentAction(formData: FormData) {
    "use server";

    const evaluatorNim = String(formData.get("evaluator_nim") ?? "").trim();
    if (!evaluatorNim) {
      return;
    }

    await clearEvaluatorAssignmentByAdmin(evaluatorNim);
    revalidatePath("/admin");
  }

  if (profile?.role !== "admin" && profile?.role !== "pj_kementerian") {
    redirect(ROLE_HOME[profile.role] ?? "/login");
  }

  const isPjKemenkoan = profile.is_pj_kemenkoan === true;

  const [{ data: units }, { data: periods }, { data: staffs }, { data: reportRows }, { data: allProfiles }, { data: assignments }, { data: pjAssignment }, { data: pjKemenkoAssignments }, { data: pjUnitAssignments }, { data: kemenkoTemplates }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit, kategori, parent_id").order("nama_unit"),
    supabase.from("rapor_periods").select("id, bulan, tahun, status").order("tahun", { ascending: false }).order("bulan", { ascending: false }),
    supabase
      .from("profiles")
      .select("nim, nama_lengkap, unit_id")
      .in("role", ["staff", "pj_kementerian"])
      .order("nama_lengkap"),
    supabase
      .from("rapor_scores")
      .select("id, user_nim, penilai_nim, periode_id, report_type, total_avg, catatan, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("nim, nama_lengkap, role, unit_id"),
    supabase.from("evaluator_unit_assignments").select("evaluator_nim, target_unit_id, is_active"),
    profile.role === "pj_kementerian"
      ? supabase
          .from("evaluator_unit_assignments")
          .select("target_unit_id, is_active")
          .eq("evaluator_nim", profile.nim)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isPjKemenkoan
      ? supabase
          .from("pj_assignments")
          .select("target_unit_id")
          .eq("nim", profile.nim)
          .eq("scope", "kemenko")
          .eq("is_active", true)
      : Promise.resolve({ data: [] as { target_unit_id: string }[] }),
    profile.role === "pj_kementerian" || isPjKemenkoan
      ? supabase
          .from("pj_assignments")
          .select("target_unit_id")
          .eq("nim", profile.nim)
          .eq("scope", "unit")
          .eq("is_active", true)
      : Promise.resolve({ data: [] as { target_unit_id: string }[] }),
    supabase
      .from("kemenko_sub_indicator_templates")
      .select("kemenko_unit_id, periode_id, main_indicator_name, sub_indicator_name"),
  ]);

  const unitById = new Map((units ?? []).map((unit) => [unit.id, unit]));
  const periodById = new Map((periods ?? []).map((item) => [item.id, item]));
  const profileByNim = new Map((allProfiles ?? []).map((item) => [item.nim, item.nama_lengkap]));
  const profileRecordByNim = new Map((allProfiles ?? []).map((item) => [item.nim, item]));

  const formattedRows = (reportRows ?? []).map((row) => {
    const period = periodById.get(row.periode_id);
    const targetProfile = profileRecordByNim.get(row.user_nim);
    const targetUnit = unitById.get(targetProfile?.unit_id ?? "");
    const parentKemenko = targetUnit?.kategori === "kemenko"
      ? targetUnit
      : unitById.get(targetUnit?.parent_id ?? "");

    const targetName = profileByNim.get(row.user_nim) ?? row.user_nim;
    const evaluatorName = profileByNim.get(row.penilai_nim) ?? row.penilai_nim;

    return {
      id: row.id,
      user_nim: row.user_nim,
      periode_id: row.periode_id,
      targetName,
      evaluatorName,
      unitId: targetProfile?.unit_id ?? "",
      unitName: targetUnit?.nama_unit ?? "-",
      kemenkoName: parentKemenko?.nama_unit ?? "Tanpa Kemenko",
      totalAvg: Number(row.total_avg),
      reportType: row.report_type,
      catatan: row.catatan,
      periodeLabel: period ? `${period.bulan}/${period.tahun} (${period.status})` : "Periode tidak ditemukan",
    };
  });

  const groupedReports = new Map<string, Map<string, typeof formattedRows>>();
  for (const row of formattedRows) {
    if (!groupedReports.has(row.kemenkoName)) {
      groupedReports.set(row.kemenkoName, new Map());
    }
    const unitGroup = groupedReports.get(row.kemenkoName)!;
    if (!unitGroup.has(row.unitName)) {
      unitGroup.set(row.unitName, []);
    }
    unitGroup.get(row.unitName)!.push(row);
  }

  const totalReports = formattedRows.length;
  const totalUnitsWithReports = new Set(formattedRows.map((row) => row.unitName)).size;
  const totalEvaluators = new Set(formattedRows.map((row) => row.evaluatorName)).size;

  const evaluatorUnitIds = new Set(
    (units ?? [])
      .filter((unit) => unit.nama_unit === "Biro PPM" || unit.nama_unit === "Biro Pengendali & Penjamin Mutu")
      .map((unit) => unit.id),
  );

  const evaluatorCandidates = (allProfiles ?? []).filter(
    (staff) => staff.role === "staff" && evaluatorUnitIds.has(staff.unit_id),
  );
  const targetUnits = (units ?? []).filter((unit) => unit.kategori === "kementerian" || unit.kategori === "biro");

  const assignmentRows = (assignments ?? []).map((item) => ({
    evaluator_nim: item.evaluator_nim,
    evaluator_name: profileByNim.get(item.evaluator_nim) ?? item.evaluator_nim,
    target_unit_name: units?.find((unit) => unit.id === item.target_unit_id)?.nama_unit ?? "-",
    is_active: item.is_active,
  }));

  const legacyPjUnitIds = new Set(
    (assignments ?? [])
      .filter((item) => item.evaluator_nim === profile.nim && item.is_active)
      .map((item) => item.target_unit_id),
  );

  const pjUnitIds = new Set([
    ...legacyPjUnitIds,
    ...((pjUnitAssignments ?? []).map((item) => item.target_unit_id)),
    ...(pjAssignment?.target_unit_id ? [pjAssignment.target_unit_id] : []),
  ]);

  const pjKemenkoUnitIds = new Set((pjKemenkoAssignments ?? []).map((item) => item.target_unit_id));

  const pjScopeRootUnitIds = new Set([
    ...pjUnitIds,
    ...pjKemenkoUnitIds,
  ]);

  const isWithinPjScope = (unitId: string) => {
    let currentUnitId: string | null | undefined = unitId;

    while (currentUnitId) {
      if (pjScopeRootUnitIds.has(currentUnitId)) {
        return true;
      }

      currentUnitId = unitById.get(currentUnitId)?.parent_id ?? null;
    }

    return false;
  };
  
  // Scoped units: PJ Kemenkoan and PJ Kementerian both use direct unit assignments (scope='unit')
  const scopedUnits = profile.role === "pj_kementerian"
    ? (units ?? []).filter((unit) => isWithinPjScope(unit.id))
    : (units ?? []);

  const scopedUnitIds = new Set(scopedUnits.map((unit) => unit.id));

  const scopedStaffs = profile.role === "pj_kementerian"
    ? (staffs ?? []).filter((staff) => scopedUnitIds.has(staff.unit_id))
    : (staffs ?? []);

  const noReferenceData = !scopedUnits.length || !(periods ?? []).length;
  const missingPjAssignment = profile.role === "pj_kementerian" && pjScopeRootUnitIds.size === 0;

  const raporIds = (reportRows ?? []).map((row) => row.id);
  const { data: reportDetailRows } = raporIds.length
    ? await supabase
        .from("rapor_details")
        .select("rapor_id, main_indicator_name, sub_indicator_name, catatan, score, bentuk_tanggung_jawab, nilai_kuantitatif_tanggung_jawab, skala, nilai_kuantitatif_skala, nilai_kualitatif, nilai_akhir")
        .in("rapor_id", raporIds)
    : { data: [] as { rapor_id: string; main_indicator_name: string; sub_indicator_name: string; catatan: string | null; score: number; bentuk_tanggung_jawab: string | null; nilai_kuantitatif_tanggung_jawab: number | null; skala: string | null; nilai_kuantitatif_skala: number | null; nilai_kualitatif: number | null; nilai_akhir: number | null }[] };

  const detailsByRaporId = new Map<string, { main_indicator_name: string; sub_indicator_name: string; catatan: string | null; score: number; bentuk_tanggung_jawab: string | null; nilai_kuantitatif_tanggung_jawab: number | null; skala: string | null; nilai_kuantitatif_skala: number | null; nilai_kualitatif: number | null; nilai_akhir: number | null }[]>();
  for (const detail of reportDetailRows ?? []) {
    if (!detailsByRaporId.has(detail.rapor_id)) {
      detailsByRaporId.set(detail.rapor_id, []);
    }
    detailsByRaporId.get(detail.rapor_id)!.push(detail);
  }

  const rowById = new Map((reportRows ?? []).map((row) => [row.id, row]));
  const selectedEditRow = rowById.get(editRaporId);
  const normalizeIndicatorName = (name: string) => normalizeMainIndicatorName(name);

  let initialEditRapor:
    | {
        rapor_id: string;
        periode_id: string;
        unit_id: string;
        user_nim: string;
        catatan: string;
        indicators: {
          main_indicator_name: string;
          items: {
            sub_indicator_name: string;
            catatan: string;
            score: number;
            bentuk_tanggung_jawab?: PrestasiResponsibilityValue;
            nilai_kuantitatif_tanggung_jawab?: number;
            skala?: PrestasiScaleValue;
            nilai_kuantitatif_skala?: number;
            nilai_kualitatif?: number;
            nilai_akhir?: number;
          }[];
        }[];
      }
    | undefined;

  if (selectedEditRow && !(profile.role === "pj_kementerian" && selectedEditRow.user_nim === profile.nim)) {
    const selectedProfile = profileRecordByNim.get(selectedEditRow.user_nim);
    if (selectedProfile && !(profile.role === "pj_kementerian" && !scopedUnitIds.has(selectedProfile.unit_id))) {
      const { data: directDetailRows } = await supabase
        .from("rapor_details")
        .select("main_indicator_name, sub_indicator_name, catatan, score, bentuk_tanggung_jawab, nilai_kuantitatif_tanggung_jawab, skala, nilai_kuantitatif_skala, nilai_kualitatif, nilai_akhir")
        .eq("rapor_id", selectedEditRow.id);

      let detailRows = (directDetailRows ?? []).map((row) => ({
        rapor_id: selectedEditRow.id,
        main_indicator_name: row.main_indicator_name,
        sub_indicator_name: row.sub_indicator_name,
        catatan: row.catatan,
        score: Number(row.score),
        bentuk_tanggung_jawab: row.bentuk_tanggung_jawab,
        nilai_kuantitatif_tanggung_jawab: row.nilai_kuantitatif_tanggung_jawab,
        skala: row.skala,
        nilai_kuantitatif_skala: row.nilai_kuantitatif_skala,
        nilai_kualitatif: row.nilai_kualitatif,
        nilai_akhir: row.nilai_akhir,
      }));

      if (detailRows.length === 0) {
        detailRows = (detailsByRaporId.get(selectedEditRow.id) ?? []).map((row) => ({
          rapor_id: selectedEditRow.id,
          main_indicator_name: row.main_indicator_name,
          sub_indicator_name: row.sub_indicator_name,
          catatan: row.catatan,
          score: Number(row.score),
          bentuk_tanggung_jawab: row.bentuk_tanggung_jawab,
          nilai_kuantitatif_tanggung_jawab: row.nilai_kuantitatif_tanggung_jawab,
          skala: row.skala,
          nilai_kuantitatif_skala: row.nilai_kuantitatif_skala,
          nilai_kualitatif: row.nilai_kualitatif,
          nilai_akhir: row.nilai_akhir,
        }));
      }

      const detailByIndicator = new Map<string, { sub_indicator_name: string; catatan: string; score: number; bentuk_tanggung_jawab: string | null; nilai_kuantitatif_tanggung_jawab: number | null; skala: string | null; nilai_kuantitatif_skala: number | null; nilai_kualitatif: number | null; nilai_akhir: number | null }[]>();
      for (const detail of detailRows) {
        const indicatorName = normalizeIndicatorName(detail.main_indicator_name);
        if (!detailByIndicator.has(indicatorName)) {
          detailByIndicator.set(indicatorName, []);
        }
        detailByIndicator.get(indicatorName)!.push({
          sub_indicator_name: detail.sub_indicator_name?.trim() ?? "",
          catatan: detail.catatan ?? "",
          score: Number(detail.score),
          bentuk_tanggung_jawab: detail.bentuk_tanggung_jawab ?? null,
          nilai_kuantitatif_tanggung_jawab: detail.nilai_kuantitatif_tanggung_jawab ?? null,
          skala: detail.skala ?? null,
          nilai_kuantitatif_skala: detail.nilai_kuantitatif_skala ?? null,
          nilai_kualitatif: detail.nilai_kualitatif ?? null,
          nilai_akhir: detail.nilai_akhir ?? null,
        });
      }

      const getItemsByIndicator = (indicator: string) => {
        const normalizedIndicator = normalizeIndicatorName(indicator);
        const direct = detailByIndicator.get(normalizedIndicator);
        if (direct) return direct;

        for (const [key, values] of detailByIndicator.entries()) {
          if (normalizeIndicatorName(key) === normalizedIndicator) {
            return values;
          }
        }

        return [] as { sub_indicator_name: string; catatan: string; score: number; bentuk_tanggung_jawab: string | null; nilai_kuantitatif_tanggung_jawab: number | null; skala: string | null; nilai_kuantitatif_skala: number | null; nilai_kualitatif: number | null; nilai_akhir: number | null }[];
      };

      initialEditRapor = {
        rapor_id: selectedEditRow.id,
        periode_id: selectedEditRow.periode_id,
        unit_id: selectedProfile.unit_id,
        user_nim: selectedEditRow.user_nim,
        catatan: selectedEditRow.catatan ?? "",
        indicators: MAIN_INDICATORS.map((indicator) => ({
          main_indicator_name: indicator,
          items: getItemsByIndicator(indicator).map((item) => ({
            sub_indicator_name: item.sub_indicator_name,
            catatan: item.catatan,
            score: item.score,
            bentuk_tanggung_jawab:
              normalizePrestasiResponsibilityValue(item.bentuk_tanggung_jawab) ??
              (isPrestasiResponsibilityValue(item.bentuk_tanggung_jawab) ? item.bentuk_tanggung_jawab : undefined),
            nilai_kuantitatif_tanggung_jawab: item.nilai_kuantitatif_tanggung_jawab ?? undefined,
            skala:
              normalizePrestasiScaleValue(item.skala) ??
              (isPrestasiScaleValue(item.skala) ? item.skala : undefined),
            nilai_kuantitatif_skala: item.nilai_kuantitatif_skala ?? undefined,
            nilai_kualitatif: item.nilai_kualitatif ?? undefined,
            nilai_akhir: item.nilai_akhir ?? undefined,
          })),
        })),
      };
    }
  }

  const visibleRows = profile.role === "pj_kementerian"
    ? formattedRows.filter((row) => isWithinPjScope(row.unitId) && row.user_nim !== profile.nim)
    : formattedRows;

  const visibleGroupedReports = new Map<string, Map<string, typeof visibleRows>>();
  for (const row of visibleRows) {
    if (!visibleGroupedReports.has(row.kemenkoName)) {
      visibleGroupedReports.set(row.kemenkoName, new Map());
    }
    const unitGroup = visibleGroupedReports.get(row.kemenkoName)!;
    if (!unitGroup.has(row.unitName)) {
      unitGroup.set(row.unitName, []);
    }
    unitGroup.get(row.unitName)!.push(row);
  }

  const visibleTotalReports = visibleRows.length;
  const visibleTotalUnitsWithReports = new Set(visibleRows.map((row) => row.unitName)).size;
  const visibleTotalEvaluators = new Set(visibleRows.map((row) => row.evaluatorName)).size;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Admin</h2>
        <p className="text-sm text-slate-600">Input rapor bulanan staf berdasarkan unit.</p>
      </div>
      {missingPjAssignment ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Assignment PJ Kementerian belum ditetapkan. Hubungi admin untuk menetapkan 1 kementerian pegangan Anda.
        </p>
      ) : null}
      {profile.role === "pj_kementerian" && isPjKemenkoan && scopedUnits.length === 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Assignment PJ Kemenkoan belum ditetapkan. Hubungi admin untuk menetapkan kemenko ampuan Anda.
        </p>
      ) : null}
      {noReferenceData ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Dropdown tidak akan terisi jika data unit atau bulan/periode belum ada di database.
        </p>
      ) : null}
      <AdminDynamicForm
        key={initialEditRapor?.rapor_id ?? "new-rapor"}
        units={scopedUnits}
        periods={periods ?? []}
        staffs={scopedStaffs}
        adminType={isPjKemenkoan ? "pj_kemenkoan" : "pj_kementerian"}
        isAdmin={profile.role === "admin"}
        kemenkoTemplates={kemenkoTemplates ?? []}
        initialEditRapor={initialEditRapor}
      />

      {profile.role === "admin" ? (
      <Card>
        <CardHeader>
          <CardTitle>Assignment Penilai Unit</CardTitle>
          <CardDescription>
            Staf Biro PPM/Pengendali Mutu hanya boleh memegang 1 unit kementerian/biro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={upsertAssignmentAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <select
              name="evaluator_nim"
              required
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">Pilih staf penilai</option>
              {evaluatorCandidates.map((item) => (
                <option key={item.nim} value={item.nim}>
                  {item.nama_lengkap} ({item.nim})
                </option>
              ))}
            </select>

            <select
              name="target_unit_id"
              required
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">Pilih unit target</option>
              {targetUnits.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama_unit}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-700 hover:bg-slate-100"
            >
              Simpan
            </button>
          </form>

          <div className="space-y-2">
            {assignmentRows.length ? (
              assignmentRows.map((row) => (
                <div key={row.evaluator_nim} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{row.evaluator_name}</p>
                    <p className="text-xs text-slate-500">Target unit: {row.target_unit_name}</p>
                  </div>
                  <form action={clearAssignmentAction}>
                    <input type="hidden" name="evaluator_nim" value={row.evaluator_nim} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                    >
                      Hapus
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">Belum ada assignment penilai.</p>
            )}
          </div>
        </CardContent>
      </Card>
      ) : null}

      {profile.role === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Publish Periode Rapor</CardTitle>
            <CardDescription>
              Rapor hanya terlihat oleh staf jika status periode sudah published.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {periods?.length ? (
              [...periods]
                .sort((a, b) => {
                  if (a.tahun !== b.tahun) return b.tahun - a.tahun;
                  return b.bulan - a.bulan;
                })
                .map((period) => (
                  <div
                    key={period.id}
                    className="flex flex-col gap-3 rounded-md border border-slate-200 px-3 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        {period.bulan}/{period.tahun}
                      </p>
                      <p className="text-xs text-slate-500">Status saat ini: {period.status}</p>
                    </div>

                    <div className="flex gap-2">
                      <form action={updatePeriodStatusByAdmin}>
                        <input type="hidden" name="period_id" value={period.id} />
                        <input type="hidden" name="status" value="draft" />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          Draft
                        </button>
                      </form>

                      <form action={updatePeriodStatusByAdmin}>
                        <input type="hidden" name="period_id" value={period.id} />
                        <input type="hidden" name="status" value="published" />
                        <button
                          type="submit"
                          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100"
                        >
                          Publish
                        </button>
                      </form>
                    </div>
                  </div>
                ))
            ) : (
              <p className="text-sm text-slate-600">Belum ada periode rapor.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Semua Rapor (Struktur Folder)</CardTitle>
          <CardDescription>Pengelompokan: Kemenko &gt; Kementerian/Biro &gt; daftar rapor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Total Rapor</p>
              <p className="text-sm font-semibold text-slate-800">{visibleTotalReports}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Unit Dengan Rapor</p>
              <p className="text-sm font-semibold text-slate-800">{visibleTotalUnitsWithReports}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Penilai Aktif</p>
              <p className="text-sm font-semibold text-slate-800">{visibleTotalEvaluators}</p>
            </div>
          </div>

          {visibleRows.length ? (
            [...visibleGroupedReports.entries()].map(([kemenkoName, unitGroup]) => {
              const kemenkoCount = [...unitGroup.values()].reduce((sum, rows) => sum + rows.length, 0);
              return (
              <details key={kemenkoName} open className="rounded-lg border border-slate-200 bg-slate-50/50">
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-slate-800">
                  <span>{kemenkoName}</span>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
                    {kemenkoCount} rapor
                  </span>
                </summary>
                <div className="space-y-2 px-3 pb-3">
                  {[...unitGroup.entries()].map(([unitName, rows]) => (
                    <details key={`${kemenkoName}-${unitName}`} open className="rounded-md border border-slate-200 bg-white">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-700">
                        <span>{kemenkoName} &gt; {unitName}</span>
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                          {rows.length} rapor
                        </span>
                      </summary>
                      <div className="space-y-2 px-3 pb-3">
                        {rows.map((row) => (
                          <div key={row.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="font-medium text-slate-800">{row.targetName}</p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                    {reportTypeLabel(row.reportType)}
                                  </span>
                                  <span>{row.periodeLabel}</span>
                                </div>
                                <p className="text-xs text-slate-500">Penilai: {row.evaluatorName}</p>
                                {row.catatan ? <p className="text-xs text-slate-500">Catatan: {row.catatan}</p> : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreTone(row.totalAvg)}`}>
                                  {row.totalAvg.toFixed(2)}
                                </span>
                                <Link
                                  href={`/admin?edit_rapor_id=${row.id}#input-rapor-form`}
                                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                                >
                                  Detail/Edit
                                </Link>
                                <form action={deleteRaporAction}>
                                  <input type="hidden" name="rapor_id" value={row.id} />
                                  <button
                                    type="submit"
                                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                                  >
                                    Hapus
                                  </button>
                                </form>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            );})
          ) : (
            <p className="text-sm text-slate-600">Belum ada data rapor.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
