import { NextRequest, NextResponse } from "next/server";
import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

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
  const dataRows = rows.map((row) =>
    keys.map((key) => escapeCsv(row[key])).join(",")
  );

  return "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
}

const BULAN_NAMES: Record<number, string> = {
  1: "Januari", 2: "Februari", 3: "Maret", 4: "April", 5: "Mei", 6: "Juni",
  7: "Juli", 8: "Agustus", 9: "September", 10: "Oktober", 11: "November", 12: "Desember"
};

// Helper to style an ExcelJS worksheet
function styleWorksheet(worksheet: ExcelJS.Worksheet, rows: Record<string, any>[], headerBgColor = "FF0F766E") {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  worksheet.columns = headers.map((header) => {
    // calculate max content length for column width
    const maxValLen = rows.reduce((max, row) => Math.max(max, String(row[header] ?? "").length), header.length);
    return {
      header,
      key: header,
      width: Math.min(Math.max(maxValLen + 4, 14), 45),
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

  // Style data rows
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

    // Fetch all database tables
    const [
      { data: details },
      { data: scores },
      { data: profiles },
      { data: units },
      { data: periods },
      { data: pjAssignments },
      { data: evaluatorAssignments },
      { data: kemenkoSubIndicators },
    ] = await Promise.all([
      supabase.from("rapor_details").select("*").order("created_at", { ascending: false }),
      supabase.from("rapor_scores").select("*"),
      supabase.from("profiles").select("nim, nama_lengkap, role, jurusan, tahun_angkatan, unit_id, is_pj_kemenkoan"),
      supabase.from("ref_units").select("id, nama_unit, kategori, parent_id"),
      supabase.from("rapor_periods").select("id, bulan, tahun, status"),
      supabase.from("pj_assignments").select("*"),
      supabase.from("evaluator_unit_assignments").select("*"),
      supabase.from("kemenko_sub_indicators").select("*"),
    ]);

    const profileByNim = new Map((profiles ?? []).map((p) => [p.nim, p]));
    const unitById = new Map((units ?? []).map((u) => [u.id, u]));
    const periodById = new Map((periods ?? []).map((p) => [p.id, p]));
    const scoreById = new Map((scores ?? []).map((s) => [s.id, s]));

    // Build joined Master Rapor dataset
    const masterRows = (details ?? []).map((detail) => {
      const score = scoreById.get(detail.rapor_id);
      const userProfile = score ? profileByNim.get(score.user_nim) : undefined;
      const evaluatorProfile = score ? profileByNim.get(score.evaluator_nim) : undefined;
      const userUnit = userProfile?.unit_id ? unitById.get(userProfile.unit_id) : undefined;
      const parentUnit = userUnit?.parent_id ? unitById.get(userUnit.parent_id) : undefined;
      const period = score ? periodById.get(score.periode_id) : undefined;

      return {
        "ID Rapor": detail.rapor_id,
        "NIM Anggota": score?.user_nim ?? "",
        "Nama Anggota": userProfile?.nama_lengkap ?? "",
        "Role/Jabatan": userProfile?.role ?? "",
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
        "NIM Penilai": score?.evaluator_nim ?? "",
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
        "Catatan Rapor": score?.catatan ?? "",
        "Waktu Input Rapor": score?.created_at ?? "",
      };
    });

    // =========================================================================
    // 1. EXCEL MULTI-SHEET WORKBOOK (.xlsx)
    // =========================================================================
    if (format === "excel") {
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
    }

    // =========================================================================
    // 2. CSV EXPORTS (.csv)
    // =========================================================================
    if (type === "master_rapor" || type === "all") {
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

    // Single table CSV fallback
    let tableData: any[] = [];
    let filename = `backup_${type}_${dateStr}.csv`;

    switch (type) {
      case "profiles":
        tableData = profiles ?? [];
        break;
      case "ref_units":
        tableData = units ?? [];
        break;
      case "rapor_periods":
        tableData = periods ?? [];
        break;
      case "rapor_scores":
        tableData = scores ?? [];
        break;
      case "rapor_details":
        tableData = details ?? [];
        break;
      case "pj_assignments":
        tableData = pjAssignments ?? [];
        break;
      case "evaluator_unit_assignments":
        tableData = evaluatorAssignments ?? [];
        break;
      case "kemenko_sub_indicators":
        tableData = kemenkoSubIndicators ?? [];
        break;
      default:
        tableData = masterRows;
        filename = `backup_master_rapor_${dateStr}.csv`;
    }

    const csvData = toCsv(tableData);
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || "Terjadi kesalahan internal saat export backup." },
      { status: 500 }
    );
  }
}
