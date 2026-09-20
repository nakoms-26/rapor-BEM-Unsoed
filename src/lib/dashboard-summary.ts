import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isPublishedStatus } from "@/lib/period-status";
import {
  calculateSingleStaffCumulative,
  calculateStaffCumulativeScores,
  type StaffPeriodScoreInput,
} from "@/lib/rapor-score";
import {
  type DashboardBannerProps,
  type StaffItemCumulative,
  type MinistryItemCumulative,
} from "@/components/dashboard/dashboard-cumulative-banner";
import { formatRoleName } from "@/lib/constants";

type AppDbClient = ReturnType<typeof createAdminSupabaseClient>;

const BULAN_LABEL: Record<number, string> = {
  1: "Januari",
  2: "Februari",
  3: "Maret",
  4: "April",
  5: "Mei",
  6: "Juni",
  7: "Juli",
  8: "Agustus",
  9: "September",
  10: "Oktober",
  11: "November",
  12: "Desember",
};

function formatPeriode(bulan: number, tahun: number) {
  return `${BULAN_LABEL[bulan] ?? `Bulan ${bulan}`}/${tahun}`;
}

type PeriodItem = {
  id: string;
  bulan: number;
  tahun: number;
  status: string;
};

export async function getDashboardBannerData(
  supabase: AppDbClient,
  profile: {
    nim: string;
    nama_lengkap: string;
    role: string;
    unit_id: string | null;
    is_pj_kemenkoan?: boolean | null;
  },
): Promise<DashboardBannerProps | null> {
  const isPjKemenkoan =
    profile.is_pj_kemenkoan === true &&
    (profile.role === "pj_kementerian" || profile.role === "admin");

  // Fetch all published periods
  const { data: allPeriodsData } = await supabase
    .from("rapor_periods")
    .select("id, bulan, tahun, status");

  const allPeriods: PeriodItem[] = (allPeriodsData as PeriodItem[] | null) ?? [];

  const publishedPeriods = allPeriods
    .filter((p) => isPublishedStatus(p.status))
    .sort((a, b) => {
      if (a.tahun !== b.tahun) return b.tahun - a.tahun;
      return b.bulan - a.bulan;
    });

  const publishedPeriodIds = new Set(publishedPeriods.map((p) => p.id));
  const periodById = new Map<string, PeriodItem>(publishedPeriods.map((p) => [p.id, p]));

  // 1. Staff / Intern Personal View
  if (
    profile.role === "staff" ||
    profile.role === "internship" ||
    profile.role === "the_meridian" ||
    profile.role === "pj_ppm_intern"
  ) {
    const isInternRole = profile.role === "internship";

    const scoresRes = isInternRole
      ? await supabase
          .from("intern_rapor_scores")
          .select("id, periode_id, total_avg, created_at")
          .eq("user_nim", profile.nim)
          .order("created_at", { ascending: false })
      : await supabase
          .from("rapor_scores")
          .select("id, periode_id, total_avg, created_at")
          .eq("user_nim", profile.nim)
          .in("report_type", ["staf_unit", "internship"])
          .order("created_at", { ascending: false });

    type ScoreRow = { id: string; periode_id: string; total_avg: number };
    const rawScores = (scoresRes.data as ScoreRow[] | null) ?? [];

    const publishedScores = rawScores.filter((s) =>
      publishedPeriodIds.has(s.periode_id),
    );

    const scoreIds = publishedScores.map((s) => s.id);
    const detailsByScoreId = new Map<string, Array<{ main_indicator_name: string; score: number }>>();

    if (scoreIds.length > 0) {
      type DetailRow = { rapor_id: string; main_indicator_name: string; score: number };
      const detailsRes = isInternRole
        ? await supabase
            .from("intern_rapor_details")
            .select("rapor_id, main_indicator_name, score")
            .in("rapor_id", scoreIds)
        : await supabase
            .from("rapor_details")
            .select("rapor_id, main_indicator_name, score")
            .in("rapor_id", scoreIds);

      const rawDetails = (detailsRes.data as DetailRow[] | null) ?? [];

      for (const d of rawDetails) {
        if (!detailsByScoreId.has(d.rapor_id)) {
          detailsByScoreId.set(d.rapor_id, []);
        }
        detailsByScoreId.get(d.rapor_id)!.push({
          main_indicator_name: d.main_indicator_name,
          score: Number(d.score),
        });
      }
    }

    const singleResult = calculateSingleStaffCumulative(
      publishedScores.map((s) => {
        const period = periodById.get(s.periode_id);
        return {
          scoreId: s.id,
          totalAvg: Number(s.total_avg),
          bulan: period?.bulan ?? 0,
          tahun: period?.tahun ?? 0,
          details: detailsByScoreId.get(s.id),
        };
      }),
      "staff",
    );

    const latestPeriodLabel =
      singleResult.latestBulan && singleResult.latestTahun
        ? formatPeriode(singleResult.latestBulan, singleResult.latestTahun)
        : "";

    return {
      variant: "staff",
      cumulativeAvg: singleResult.cumulativeAvg,
      periodCount: singleResult.periodCount,
      latestScore: singleResult.latestScore,
      latestPeriodLabel,
      roleTitle: formatRoleName(profile.role, isPjKemenkoan),
    };
  }

  // 2. Unit Leaders (Menteri & PJ Kementerian)
  if (
    (profile.role === "menteri" || profile.role === "pj_kementerian") &&
    !isPjKemenkoan &&
    profile.unit_id
  ) {
    type UnitRow = { id: string; nama_unit: string };
    type ProfileRow = { nim: string; nama_lengkap: string; role: string; unit_id?: string | null };

    const [{ data: unitData }, { data: staffProfilesData }] = await Promise.all([
      supabase.from("ref_units").select("id, nama_unit").eq("id", profile.unit_id).single(),
      supabase
        .from("profiles")
        .select("nim, nama_lengkap, role")
        .eq("unit_id", profile.unit_id)
        .in("role", ["staff", "pj_kementerian", "internship", "pj_ppm_intern", "the_meridian"])
        .order("nama_lengkap"),
    ]);

    const unit = unitData as UnitRow | null;
    const staffProfiles: ProfileRow[] = (staffProfilesData as ProfileRow[] | null) ?? [];

    const staffNims = staffProfiles.map((s) => s.nim);

    if (staffNims.length === 0) {
      return {
        variant: "unit_leader",
        unitName: unit?.nama_unit ?? "-",
        unitCumulativeAvg: 0,
        totalEvaluatedStaff: 0,
        staffList: [],
        detailHref: profile.role === "menteri" ? "/menteri/staff" : "/pj-kementerian/staff-detail",
        isMenteri: profile.role === "menteri",
      };
    }

    type RawScoreRow = { id: string; user_nim: string; periode_id: string; total_avg: number };

    // Fetch scores from both regular and intern tables
    const [regScoresRes, internScoresRes] = await Promise.all([
      supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg")
        .in("user_nim", staffNims)
        .in("report_type", ["staf_unit", "internship"]),
      supabase
        .from("intern_rapor_scores")
        .select("id, user_nim, periode_id, total_avg")
        .in("user_nim", staffNims),
    ]);

    const regScores = (regScoresRes.data as RawScoreRow[] | null) ?? [];
    const internScores = (internScoresRes.data as RawScoreRow[] | null) ?? [];

    const allScores: Array<RawScoreRow & { isIntern: boolean }> = [
      ...regScores.map((s) => ({ ...s, isIntern: false })),
      ...internScores.map((s) => ({ ...s, isIntern: true })),
    ].filter((s) => publishedPeriodIds.has(s.periode_id));

    const regScoreIds = allScores.filter((s) => !s.isIntern).map((s) => s.id);
    const internScoreIds = allScores.filter((s) => s.isIntern).map((s) => s.id);

    type DetailItemRow = { rapor_id: string; main_indicator_name: string; score: number };

    const [regDetailsRes, internDetailsRes] = await Promise.all([
      regScoreIds.length
        ? supabase.from("rapor_details").select("rapor_id, main_indicator_name, score").in("rapor_id", regScoreIds)
        : { data: [] as DetailItemRow[] },
      internScoreIds.length
        ? supabase.from("intern_rapor_details").select("rapor_id, main_indicator_name, score").in("rapor_id", internScoreIds)
        : { data: [] as DetailItemRow[] },
    ]);

    const rawRegDetails = (regDetailsRes.data as DetailItemRow[] | null) ?? [];
    const rawInternDetails = (internDetailsRes.data as DetailItemRow[] | null) ?? [];

    const detailsByScoreId = new Map<string, Array<{ main_indicator_name: string; score: number }>>();
    for (const d of [...rawRegDetails, ...rawInternDetails]) {
      if (!detailsByScoreId.has(d.rapor_id)) {
        detailsByScoreId.set(d.rapor_id, []);
      }
      detailsByScoreId.get(d.rapor_id)!.push({
        main_indicator_name: d.main_indicator_name,
        score: Number(d.score),
      });
    }

    const inputs: StaffPeriodScoreInput[] = allScores.map((s) => {
      const period = periodById.get(s.periode_id);
      return {
        scoreId: s.id,
        userNim: s.user_nim,
        totalAvg: Number(s.total_avg),
        bulan: period?.bulan ?? 0,
        tahun: period?.tahun ?? 0,
        details: detailsByScoreId.get(s.id),
      };
    });

    const cumulativeMap = calculateStaffCumulativeScores(inputs, "staff");

    const staffList: StaffItemCumulative[] = staffProfiles.map((staf) => {
      const cum = cumulativeMap.get(staf.nim);
      return {
        nim: staf.nim,
        nama_lengkap: staf.nama_lengkap,
        cumulativeAvg: cum?.cumulativeAvg ?? 0,
        periodCount: cum?.periodCount ?? 0,
        role: staf.role,
      };
    });

    const evaluatedStaff = staffList.filter((s) => s.periodCount > 0);
    const unitCumulativeAvg = evaluatedStaff.length
      ? Number(
          (
            evaluatedStaff.reduce((sum, s) => sum + s.cumulativeAvg, 0) /
            evaluatedStaff.length
          ).toFixed(2),
        )
      : 0;

    return {
      variant: "unit_leader",
      unitName: unit?.nama_unit ?? "-",
      unitCumulativeAvg,
      totalEvaluatedStaff: evaluatedStaff.length,
      staffList,
      detailHref: profile.role === "menteri" ? "/menteri/staff" : "/pj-kementerian/staff-detail",
      isMenteri: profile.role === "menteri",
    };
  }

  // 3. Menko & PJ Kemenkoan
  if (profile.role === "menko" || isPjKemenkoan) {
    let coordinatedUnitIds: string[] = [];

    if (isPjKemenkoan) {
      type PjAssignRow = { target_unit_id: string };
      const { data: assignmentsData } = await supabase
        .from("pj_assignments")
        .select("target_unit_id")
        .eq("nim", profile.nim)
        .eq("scope", "kemenko")
        .eq("is_active", true);

      const assignments = (assignmentsData as PjAssignRow[] | null) ?? [];
      const targetKemenkoIds = assignments.map((a) => a.target_unit_id);
      if (targetKemenkoIds.length) {
        type ChildUnitRow = { id: string; nama_unit: string };
        const { data: childUnitsData } = await supabase
          .from("ref_units")
          .select("id, nama_unit")
          .in("parent_id", targetKemenkoIds);

        const childUnits = (childUnitsData as ChildUnitRow[] | null) ?? [];
        coordinatedUnitIds = childUnits.map((u) => u.id);
      }
    } else if (profile.unit_id) {
      type ChildUnitRow = { id: string; nama_unit: string };
      const { data: childUnitsData } = await supabase
        .from("ref_units")
        .select("id, nama_unit")
        .eq("parent_id", profile.unit_id);

      const childUnits = (childUnitsData as ChildUnitRow[] | null) ?? [];
      coordinatedUnitIds = childUnits.map((u) => u.id);
    }

    if (coordinatedUnitIds.length === 0) {
      return null;
    }

    type UnitRow = { id: string; nama_unit: string };
    type StaffProfileRow = { nim: string; nama_lengkap: string; unit_id: string | null; role: string };

    const [{ data: unitsData }, { data: staffProfilesData }] = await Promise.all([
      supabase
        .from("ref_units")
        .select("id, nama_unit")
        .in("id", coordinatedUnitIds)
        .order("nama_unit"),
      supabase
        .from("profiles")
        .select("nim, nama_lengkap, unit_id, role")
        .in("unit_id", coordinatedUnitIds)
        .in("role", ["staff", "pj_kementerian", "internship", "pj_ppm_intern", "the_meridian"]),
    ]);

    const units: UnitRow[] = (unitsData as UnitRow[] | null) ?? [];
    const staffProfiles: StaffProfileRow[] = (staffProfilesData as StaffProfileRow[] | null) ?? [];

    const staffNims = staffProfiles.map((s) => s.nim);
    type RawScoreRow = { id: string; user_nim: string; periode_id: string; total_avg: number };

    const [regScoresRes, internScoresRes] = await Promise.all([
      staffNims.length
        ? supabase
            .from("rapor_scores")
            .select("id, user_nim, periode_id, total_avg")
            .in("user_nim", staffNims)
            .in("report_type", ["staf_unit", "internship"])
        : { data: [] as RawScoreRow[] },
      staffNims.length
        ? supabase
            .from("intern_rapor_scores")
            .select("id, user_nim, periode_id, total_avg")
            .in("user_nim", staffNims)
        : { data: [] as RawScoreRow[] },
    ]);

    const regScores = (regScoresRes.data as RawScoreRow[] | null) ?? [];
    const internScores = (internScoresRes.data as RawScoreRow[] | null) ?? [];

    const allScores: RawScoreRow[] = [
      ...regScores.map((s) => ({ ...s, isIntern: false })),
      ...internScores.map((s) => ({ ...s, isIntern: true })),
    ].filter((s) => publishedPeriodIds.has(s.periode_id));

    const inputs: StaffPeriodScoreInput[] = allScores.map((s) => {
      const period = periodById.get(s.periode_id);
      return {
        scoreId: s.id,
        userNim: s.user_nim,
        totalAvg: Number(s.total_avg),
        bulan: period?.bulan ?? 0,
        tahun: period?.tahun ?? 0,
      };
    });

    const cumulativeMap = calculateStaffCumulativeScores(inputs, "staff");

    // Group staff by unit
    const staffByUnit = new Map<string, StaffItemCumulative[]>();
    for (const staf of staffProfiles) {
      const unitId = staf.unit_id;
      if (!unitId) continue;
      if (!staffByUnit.has(unitId)) {
        staffByUnit.set(unitId, []);
      }
      const cum = cumulativeMap.get(staf.nim);
      staffByUnit.get(unitId)!.push({
        nim: staf.nim,
        nama_lengkap: staf.nama_lengkap,
        cumulativeAvg: cum?.cumulativeAvg ?? 0,
        periodCount: cum?.periodCount ?? 0,
        role: staf.role,
      });
    }

    const ministryList: MinistryItemCumulative[] = units.map((u) => {
      const uStaffs = staffByUnit.get(u.id) ?? [];
      const evaluated = uStaffs.filter((s) => s.periodCount > 0);
      const cumulativeAvg = evaluated.length
        ? Number(
            (
              evaluated.reduce((sum, s) => sum + s.cumulativeAvg, 0) / evaluated.length
            ).toFixed(2),
          )
        : 0;

      return {
        id: u.id,
        nama_unit: u.nama_unit,
        cumulativeAvg,
        staffCount: uStaffs.length,
      };
    });

    const allEvaluatedStaff = Array.from(cumulativeMap.values()).filter((c) => c.periodCount > 0);
    const kemenkoCumulativeAvg = allEvaluatedStaff.length
      ? Number(
          (
            allEvaluatedStaff.reduce((sum, s) => sum + s.cumulativeAvg, 0) /
            allEvaluatedStaff.length
          ).toFixed(2),
        )
      : 0;

    return {
      variant: "menko",
      kemenkoCumulativeAvg,
      totalStaff: allEvaluatedStaff.length,
      ministries: ministryList,
    };
  }

  return null;
}
