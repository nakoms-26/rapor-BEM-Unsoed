import { NextRequest, NextResponse } from "next/server";
import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { formatRoleName } from "@/lib/constants";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow sufficient time for large exports (34k+ rows)

// Helper to escape CSV fields according to RFC 4180
function escapeCsv(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper to convert array of objects into CSV with UTF-8 BOM
function toCsv(rows: Record<string, any>[], headers?: string[]): string {
  if (!rows || rows.length === 0) {
    if (headers && headers.length > 0) {
      return "\uFEFF" + headers.map(escapeCsv).join(",") + "\n";
    }
    return "\uFEFF";
  }

  const keys = headers || Object.keys(rows[0]);
  const headerRow = keys.map(escapeCsv).join(",");
  const lines: string[] = [headerRow];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    lines.push(keys.map((key) => escapeCsv(row[key])).join(","));
  }

  return "\uFEFF" + lines.join("\r\n");
}

const BULAN_NAMES: Record<number, string> = {
  1: "Januari", 2: "Februari", 3: "Maret", 4: "April", 5: "Mei", 6: "Juni",
  7: "Juli", 8: "Agustus", 9: "September", 10: "Oktober", 11: "November", 12: "Desember"
};

// Helper to style an ExcelJS worksheet
function styleWorksheet(worksheet: ExcelJS.Worksheet, rows: Record<string, any>[], headerBgColor = "FF0F766E") {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const sample = rows.slice(0, 100);
  worksheet.columns = headers.map((header) => {
    let maxValLen = header.length;
    for (const row of sample) {
      const val = row[header];
      if (val !== null && val !== undefined) {
        const len = String(val).length;
        if (len > maxValLen) maxValLen = len;
      }
    }
    return {
      header,
      key: header,
      width: Math.min(Math.max(maxValLen + 4, 12), 45),
    };
  });

  worksheet.addRows(rows);

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerBgColor },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Only apply detailed cell border and alternating fill styling for moderate sized datasets (<= 2000 rows).
  // For massive datasets (e.g. 34k rows), per-cell object allocations cause severe memory bloat and slow response.
  if (rows.length <= 2000) {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.height = 22;
      row.eachCell((cell) => {
        cell.font = { size: 10, color: { argb: "FF0F172A" } };
        cell.alignment = { vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFF1F5F9" } },
          left: { style: "thin", color: { argb: "FFF1F5F9" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFF1F5F9" } },
        };
        if (rowNumber % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        }
      });
    });
  }
}

/**
 * Supabase PostgREST default limit is 1,000 rows per query.
 * To export the entire database without truncation (e.g. 34k+ rows in rapor_details),
 * this helper queries total count and paginates in parallel chunks.
 */
async function fetchAllRows<T = any>(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  table: string,
  options?: {
    select?: string;
    orderCol?: string;
    ascending?: boolean;
    secondaryOrderCol?: string;
    batchSize?: number;
    concurrency?: number;
  }
): Promise<T[]> {
  const batchSize = options?.batchSize ?? 1000;
  const select = options?.select ?? "*";
  const orderCol = options?.orderCol ?? "id";
  const ascending = options?.ascending ?? true;
  const secondaryOrderCol = options?.secondaryOrderCol;
  const concurrency = options?.concurrency ?? 6;

  // 1. Get exact total row count using head: true
  const { count, error: countErr } = await supabase
    .from(table)
    .select(select, { count: "exact", head: true });

  // If head count failed or null, fallback to iterative pagination
  if (countErr || count === null || count === undefined) {
    const all: T[] = [];
    let from = 0;
    while (true) {
      let query = supabase.from(table).select(select).range(from, from + batchSize - 1);
      if (orderCol) {
        query = query.order(orderCol, { ascending });
      }
      if (secondaryOrderCol) {
        query = query.order(secondaryOrderCol, { ascending });
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...(data as T[]));
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return all;
  }

  if (count === 0) return [];

  // Single page query if within 1000 rows
  if (count <= batchSize) {
    let query = supabase.from(table).select(select).range(0, batchSize - 1);
    if (orderCol) {
      query = query.order(orderCol, { ascending });
    }
    if (secondaryOrderCol) {
      query = query.order(secondaryOrderCol, { ascending });
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data as T[]) ?? [];
  }

  // Generate range intervals
  const chunks: { from: number; to: number }[] = [];
  for (let from = 0; from < count; from += batchSize) {
    chunks.push({ from, to: from + batchSize - 1 });
  }

  // Fetch chunks with controlled concurrency
  const results: T[][] = new Array(chunks.length);
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (chunk, bIdx) => {
        const targetIdx = i + bIdx;
        let query = supabase.from(table).select(select).range(chunk.from, chunk.to);
        if (orderCol) {
          query = query.order(orderCol, { ascending });
        }
        if (secondaryOrderCol) {
          query = query.order(secondaryOrderCol, { ascending });
        }
        const { data, error } = await query;
        if (error) throw error;
        results[targetIdx] = (data as T[]) ?? [];
      })
    );
  }

  return results.flat();
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireSessionProfile();

    if (profile.role !== "admin") {
      return NextResponse.json(
        { ok: false, message: "Akses ditolak. Fitur backup hanya untuk Administrator." },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "excel"; // default excel
    const type = searchParams.get("type") || "all";
    const dateStr = new Date().toISOString().split("T")[0];

    // =========================================================================
    // 1. SINGLE TABLE CSV EXPORT (Optimized: fetch only requested table)
    // =========================================================================
    if (format === "csv" && type !== "all" && type !== "master_rapor") {
      let tableData: any[] = [];
      const filename = `backup_${type}_${dateStr}.csv`;

      switch (type) {
        case "profiles":
          tableData = await fetchAllRows(supabase, "profiles", { orderCol: "nim" });
          break;
        case "ref_units":
          tableData = await fetchAllRows(supabase, "ref_units", { orderCol: "nama_unit" });
          break;
        case "rapor_periods":
          tableData = await fetchAllRows(supabase, "rapor_periods", { orderCol: "tahun", secondaryOrderCol: "bulan" });
          break;
        case "rapor_scores":
          tableData = await fetchAllRows(supabase, "rapor_scores", { orderCol: "created_at", ascending: false });
          break;
        case "rapor_details":
          tableData = await fetchAllRows(supabase, "rapor_details", {
            orderCol: "created_at",
            ascending: false,
            secondaryOrderCol: "id",
          });
          break;
        case "pj_assignments":
          tableData = await fetchAllRows(supabase, "pj_assignments", { orderCol: "created_at", ascending: false });
          break;
        case "evaluator_unit_assignments":
          tableData = await fetchAllRows(supabase, "evaluator_unit_assignments", { orderCol: "created_at", ascending: false });
          break;
        case "kemenko_sub_indicators":
          tableData = await fetchAllRows(supabase, "kemenko_sub_indicator_templates", { orderCol: "id" });
          break;
        default:
          return NextResponse.json(
            { ok: false, message: `Tabel '${type}' tidak dikenal untuk export CSV.` },
            { status: 400 }
          );
      }

      const csvData = toCsv(tableData);
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // =========================================================================
    // 2. MASTER RAPOR CSV OR FULL EXCEL WORKBOOK
    // =========================================================================
    // Fetch tables required for Master Rapor (and all sheets if Excel)
    const isExcel = format === "excel";

    const [
      details,
      scores,
      profiles,
      units,
      periods,
      pjAssignments,
      evaluatorAssignments,
      kemenkoSubIndicators,
    ] = await Promise.all([
      fetchAllRows(supabase, "rapor_details", { orderCol: "created_at", ascending: false, secondaryOrderCol: "id" }),
      fetchAllRows(supabase, "rapor_scores", { orderCol: "created_at", ascending: false }),
      fetchAllRows(supabase, "profiles", { orderCol: "nim" }),
      fetchAllRows(supabase, "ref_units", { orderCol: "nama_unit" }),
      fetchAllRows(supabase, "rapor_periods", { orderCol: "tahun", secondaryOrderCol: "bulan" }),
      isExcel ? fetchAllRows(supabase, "pj_assignments", { orderCol: "created_at", ascending: false }) : Promise.resolve([]),
      isExcel ? fetchAllRows(supabase, "evaluator_unit_assignments", { orderCol: "created_at", ascending: false }) : Promise.resolve([]),
      isExcel ? fetchAllRows(supabase, "kemenko_sub_indicator_templates", { orderCol: "id" }) : Promise.resolve([]),
    ]);

    const profileByNim = new Map((profiles ?? []).map((p: any) => [p.nim, p]));
    const unitById = new Map((units ?? []).map((u: any) => [u.id, u]));
    const periodById = new Map((periods ?? []).map((p: any) => [p.id, p]));
    const scoreById = new Map((scores ?? []).map((s: any) => [s.id, s]));

    // Build joined Master Rapor dataset
    const masterRows = (details ?? []).map((detail: any) => {
      const score = scoreById.get(detail.rapor_id);
      const userProfile = score ? profileByNim.get(score.user_nim) : undefined;
      const evaluatorNim = score?.penilai_nim ?? (score as any)?.evaluator_nim ?? "";
      const evaluatorProfile = evaluatorNim ? profileByNim.get(evaluatorNim) : undefined;
      const userUnit = userProfile?.unit_id ? unitById.get(userProfile.unit_id) : undefined;
      const parentUnit = userUnit?.parent_id ? unitById.get(userUnit.parent_id) : undefined;
      const period = score ? periodById.get(score.periode_id) : undefined;

      return {
        "ID Rapor": detail.rapor_id,
        "NIM Anggota": score?.user_nim ?? "",
        "Nama Anggota": userProfile?.nama_lengkap ?? "",
        "Role/Jabatan": formatRoleName(userProfile?.role),
        "Jurusan": userProfile?.jurusan ?? "",
        "Tahun Angkatan": userProfile?.tahun_angkatan ?? "",
        "Unit Kerja": userUnit?.nama_unit ?? "",
        "Kategori Unit": userUnit?.kategori ?? "",
        "Kemenkoan Pengampu": parentUnit?.nama_unit ?? (userUnit?.kategori === "kemenko" ? userUnit.nama_unit : "-"),
        "Bulan Periode": period ? (BULAN_NAMES[period.bulan] ?? period.bulan) : "",
        "Tahun Periode": period?.tahun ?? "",
        "Status Periode": period?.status ?? "",
        "Tipe Laporan": score?.report_type ?? "",
        "Nilai Total Rapor": score?.total_avg ?? "",
        "NIM Penilai": evaluatorNim,
        "Nama Penilai": evaluatorProfile?.nama_lengkap ?? "",
        "Indikator Utama": detail.main_indicator_name ?? "",
        "Sub Indikator": detail.sub_indicator_name ?? "",
        "Skor Indikator": detail.score ?? "",
        "Bentuk Tanggung Jawab": detail.bentuk_tanggung_jawab ?? "",
        "Nilai Kuantitatif Tanggung Jawab": detail.nilai_kuantitatif_tanggung_jawab ?? "",
        "Skala": detail.skala ?? "",
        "Nilai Kuantitatif Skala": detail.nilai_kuantitatif_skala ?? "",
        "Nilai Kualitatif": detail.nilai_kualitatif ?? "",
        "Nilai Akhir Sub-Indikator": detail.nilai_akhir ?? "",
        "Catatan Sub-Indikator": detail.catatan ?? "",
        "Catatan Rapor": score?.catatan ?? "",
        "Waktu Input Rapor": score?.created_at ?? "",
      };
    });

    // Master Rapor CSV
    if (format === "csv") {
      const csvData = toCsv(masterRows);
      const filename = `backup_master_rapor_${dateStr}.csv`;
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Excel multi-sheet (.xlsx)
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BEM Unsoed 2026";
    workbook.created = new Date();

    // Sheet 1: Master Rapor (Joined)
    const sheetMaster = workbook.addWorksheet("Master Rapor Lengkap", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    styleWorksheet(sheetMaster, masterRows, "FF0F766E");

    // Sheet 2: Profiles
    const sheetProfiles = workbook.addWorksheet("profiles", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    styleWorksheet(sheetProfiles, profiles ?? [], "FF1E3A8A");

    // Sheet 3: ref_units
    const sheetUnits = workbook.addWorksheet("ref_units", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    styleWorksheet(sheetUnits, units ?? [], "FF1E3A8A");

    // Sheet 4: rapor_periods
    const sheetPeriods = workbook.addWorksheet("rapor_periods", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    styleWorksheet(sheetPeriods, periods ?? [], "FF1E3A8A");

    // Sheet 5: rapor_scores
    const sheetScores = workbook.addWorksheet("rapor_scores", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    styleWorksheet(sheetScores, scores ?? [], "FF1E3A8A");

    // Sheet 6: rapor_details
    const sheetDetails = workbook.addWorksheet("rapor_details", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    styleWorksheet(sheetDetails, details ?? [], "FF1E3A8A");

    // Sheet 7: pj_assignments
    const sheetPj = workbook.addWorksheet("pj_assignments", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    styleWorksheet(sheetPj, pjAssignments ?? [], "FF334155");

    // Sheet 8: evaluator_unit_assignments
    const sheetEvaluator = workbook.addWorksheet("evaluator_assignments", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    styleWorksheet(sheetEvaluator, evaluatorAssignments ?? [], "FF334155");

    // Sheet 9: kemenko_sub_indicators
    const sheetKemenko = workbook.addWorksheet("kemenko_sub_indicators", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    styleWorksheet(sheetKemenko, kemenkoSubIndicators ?? [], "FF334155");

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `backup_database_bem_unsoed_${dateStr}.xlsx`;

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Backup export error:", err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Terjadi kesalahan internal saat export backup." },
      { status: 500 }
    );
  }
}
