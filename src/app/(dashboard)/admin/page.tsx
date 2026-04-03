import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  clearEvaluatorAssignmentByAdmin,
  deleteRaporByAdmin,
  upsertEvaluatorAssignmentByAdmin,
} from "@/app/(dashboard)/admin/actions";
import { AdminDynamicForm } from "@/components/dashboard/admin-dynamic-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function reportTypeLabel(type: "staf_unit" | "menteri_kepala_biro") {
  return type === "menteri_kepala_biro" ? "Menteri/Kepala Biro" : "Staf Unit";
}

function scoreTone(score: number) {
  if (score >= 4) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 3) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

export default async function AdminPage() {
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

  if (profile?.role !== "admin") {
    redirect(ROLE_HOME[profile.role] ?? "/login");
  }

  const [{ data: units }, { data: periods }, { data: staffs }, { data: reportRows }, { data: allProfiles }, { data: assignments }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit, kategori, parent_id").order("nama_unit"),
    supabase.from("rapor_periods").select("id, bulan, tahun, status").order("tahun", { ascending: false }).order("bulan", { ascending: false }),
    supabase.from("profiles").select("nim, nama_lengkap, unit_id").in("role", ["staff", "menteri"]).order("nama_lengkap"),
    supabase
      .from("rapor_scores")
      .select("id, user_nim, penilai_nim, periode_id, report_type, total_avg, catatan, created_at")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase.from("profiles").select("nim, nama_lengkap, role, unit_id"),
    supabase.from("evaluator_unit_assignments").select("evaluator_nim, target_unit_id, is_active"),
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
      targetName,
      evaluatorName,
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

  const noReferenceData = !(units ?? []).length || !(periods ?? []).length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Admin</h2>
        <p className="text-sm text-slate-600">Input rapor bulanan staf berdasarkan unit.</p>
      </div>
      {noReferenceData ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Dropdown tidak akan terisi jika data unit atau bulan/periode belum ada di database.
        </p>
      ) : null}
      <AdminDynamicForm
        units={units ?? []}
        periods={periods ?? []}
        staffs={staffs ?? []}
      />

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

      <Card>
        <CardHeader>
          <CardTitle>Semua Rapor (Struktur Folder)</CardTitle>
          <CardDescription>Pengelompokan: Kemenko &gt; Kementerian/Biro &gt; daftar rapor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Total Rapor</p>
              <p className="text-sm font-semibold text-slate-800">{totalReports}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Unit Dengan Rapor</p>
              <p className="text-sm font-semibold text-slate-800">{totalUnitsWithReports}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Penilai Aktif</p>
              <p className="text-sm font-semibold text-slate-800">{totalEvaluators}</p>
            </div>
          </div>

          {formattedRows.length ? (
            [...groupedReports.entries()].map(([kemenkoName, unitGroup]) => {
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
