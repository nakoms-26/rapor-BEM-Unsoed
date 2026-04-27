"use client";

import { ReportPeriodItem } from "@/components/dashboard/report-period-item";
import { RaporDocument } from "@/components/dashboard/rapor-document";
import { MonthFilterTabs, type RaporItem } from "@/components/dashboard/month-filter-tabs";
import { getMenteriFinalStatus } from "@/lib/menko-menteri-rapor";

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

export interface RaporWithDetails extends RaporItem {
  id: string;
  total_avg: number;
  catatan: string | null;
  bulan: number;
  tahun: number;
  status: string;
  details?: {
    main_indicator_name: string;
    sub_indicator_name: string;
    score: number;
    bentuk_tanggung_jawab: string | null;
    nilai_kuantitatif_tanggung_jawab: number | null;
    skala: string | null;
    nilai_kuantitatif_skala: number | null;
    nilai_kualitatif: number | null;
    nilai_akhir: number | null;
  }[];
}

interface RaporListWithMonthFilterProps {
  raporItems: RaporWithDetails[];
  userProfile: {
    nama_lengkap: string;
  };
  unitName: string;
  emptyMessage?: string;
  reportVariant?: "staff" | "menteri";
}

export function RaporListWithMonthFilter({
  raporItems,
  userProfile,
  unitName,
  emptyMessage = "Belum ada rapor yang tersedia.",
  reportVariant = "staff",
}: RaporListWithMonthFilterProps) {
  return (
    <MonthFilterTabs items={raporItems}>
      {(filteredItems) => (
        <div className="space-y-3">
          {filteredItems.length ? (
            filteredItems.map((row, index) => (
              <ReportPeriodItem
                key={row.id}
                defaultOpen={index === 0}
                title={`${formatPeriode(row.bulan, row.tahun)} (${row.status})`}
                scoreLabel={reportVariant === "menteri" ? getMenteriFinalStatus(row.total_avg) : row.total_avg.toFixed(2)}
              >
                <RaporDocument
                  reportId={`rapor-${row.id}`}
                  title="Rapor BEM UNSOED 2026"
                  periodLabel={formatPeriode(row.bulan, row.tahun)}
                  name={userProfile.nama_lengkap}
                  jurusan={null}
                  tahunAngkatan={null}
                  unitName={unitName}
                  totalScore={Number(row.total_avg)}
                  catatan={row.catatan}
                  details={row.details ?? []}
                  reportVariant={reportVariant}
                />
              </ReportPeriodItem>
            ))
          ) : (
            <p className="text-sm text-slate-600">{emptyMessage}</p>
          )}
        </div>
      )}
    </MonthFilterTabs>
  );
}
