"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Download,
  Database,
  TableProperties,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Users,
  Building2,
  Calendar,
  BarChart3,
  ShieldCheck,
  Scale,
  Layers,
  LucideIcon,
} from "lucide-react";

type TableBackupItem = {
  type: string;
  label: string;
  icon: LucideIcon;
  filename: string;
};

export function AdminBackupCard() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const tables: TableBackupItem[] = [
    { type: "profiles", label: "Data Akun & Pengguna", icon: Users, filename: "profiles.csv" },
    { type: "ref_units", label: "Struktur Organisasi Unit", icon: Building2, filename: "ref_units.csv" },
    { type: "rapor_periods", label: "Periode Rapor Bulanan", icon: Calendar, filename: "rapor_periods.csv" },
    { type: "rapor_scores", label: "Nilai Total Rapor", icon: BarChart3, filename: "rapor_scores.csv" },
    { type: "rapor_details", label: "Detail Sub-Indikator", icon: FileText, filename: "rapor_details.csv" },
    { type: "pj_assignments", label: "Penugasan PJ (Kementerian/Kemenko)", icon: ShieldCheck, filename: "pj_assignments.csv" },
    { type: "evaluator_unit_assignments", label: "Penugasan Penilai Mutu", icon: Scale, filename: "evaluator_assignments.csv" },
    { type: "kemenko_sub_indicators", label: "Template Sub-Indikator Kemenko", icon: Layers, filename: "kemenko_sub_indicators.csv" },
  ];

  const handleDownload = (type: string, format = "csv") => {
    const key = `${type}_${format}`;
    setDownloading(key);
    const link = document.createElement("a");
    link.href = `/api/admin/backup?type=${type}&format=${format}`;
    link.setAttribute("download", "");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(null), 2000);
  };

  return (
    <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/30 shadow-2xs overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
      <CardHeader className="p-4 sm:p-6 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm flex-shrink-0">
              <Database className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Backup & Export Seluruh Database</span>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 border border-emerald-200">
                  Excel (.XLSX) & CSV
                </span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-600">
                Ekspor seluruh data dari semua tabel database untuk kebutuhan arsip, backup berkala, dan analisis offline.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
        {/* Main Export Options Grid */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
          {/* Option 1: Multi-Sheet Excel Workbook */}
          <div className="rounded-xl border-2 border-emerald-500 bg-white p-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm font-bold text-slate-900">
                    Full Database Excel (.XLSX)
                  </p>
                </div>
                <span className="rounded-full bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5">
                  Multi-Sheet
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>1 File Excel berisi 9 Sheet lengkap:</strong> Sheet Master Rapor, profiles, ref_units, rapor_periods, rapor_scores, rapor_details, pj_assignments, evaluator_assignments, dan kemenko_sub_indicators.
              </p>
            </div>

            <div className="pt-3 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleDownload("all", "excel")}
                disabled={downloading === "all_excel"}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>
                  {downloading === "all_excel" ? "Menyiapkan File Excel..." : "Download Excel Multi-Sheet (.XLSX)"}
                </span>
              </button>
            </div>
          </div>

          {/* Option 2: Master Rapor CSV */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-bold text-slate-900">
                    Master Rapor Lengkap (.CSV)
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 border border-slate-200">
                  Flat CSV
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tabel master gabungan: Nama, NIM, Jurusan, Angkatan, Unit Kerja, Kemenkoan, Periode, Nilai Total, seluruh Sub-Indikator, Tanggung Jawab, Skala, dan Catatan.
              </p>
            </div>

            <div className="pt-3 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleDownload("master_rapor", "csv")}
                disabled={downloading === "master_rapor_csv"}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-slate-900 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>
                  {downloading === "master_rapor_csv" ? "Menyiapkan CSV..." : "Download Master Rapor (.CSV)"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Specific Table Exports Dropdown */}
        <details className="group rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <summary className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-slate-50 transition-colors select-none">
            <div className="flex items-center gap-2.5">
              <TableProperties className="h-4 w-4 text-slate-600" />
              <span className="text-xs sm:text-sm font-semibold text-slate-800">
                Pilihan Download CSV per Tabel Database ({tables.length} Tabel)
              </span>
            </div>
            <span className="text-xs font-semibold text-blue-600 group-open:hidden">
              Tampilkan Tabel &darr;
            </span>
            <span className="text-xs font-semibold text-slate-500 hidden group-open:inline">
              Sembunyikan &uarr;
            </span>
          </summary>

          <div className="p-3.5 sm:p-4 pt-1 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500 mb-3">
              Unduh raw data dari masing-masing tabel Supabase PostgreSQL secara individual dalam format CSV:
            </p>
            <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {tables.map((tbl) => {
                const IconComponent = tbl.icon;
                const isDownloadingThis = downloading === `${tbl.type}_csv`;
                return (
                  <button
                    key={tbl.type}
                    type="button"
                    onClick={() => handleDownload(tbl.type, "csv")}
                    disabled={Boolean(downloading)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-left text-xs font-medium text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600 flex-shrink-0">
                        <IconComponent className="h-3.5 w-3.5" />
                      </div>
                      <span className="truncate">{tbl.label}</span>
                    </div>
                    <Download className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
