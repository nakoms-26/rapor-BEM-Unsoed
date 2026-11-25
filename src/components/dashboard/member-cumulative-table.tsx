"use client";

import { Fragment, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Search, Users, ArrowUpDown } from "lucide-react";

export type MemberPeriodScore = {
  periode_id: string;
  label: string;
  bulan: number;
  tahun: number;
  score: number;
  status?: string;
};

export type MemberCumulativeRow = {
  nim: string;
  nama_lengkap: string;
  unit_name: string;
  role_label?: string;
  cumulative_avg: number;
  published_count: number;
  latest_score: number | null;
  latest_period_label: string | null;
  period_scores: MemberPeriodScore[];
};

type Props = {
  title: string;
  subtitle?: string;
  members: MemberCumulativeRow[];
  accentColor?: "blue" | "teal" | "indigo";
  emptyText?: string;
  divisor?: number;
};

const ACCENT_CLASSES = {
  blue: {
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    score: "text-blue-700",
    ring: "focus:ring-blue-500/20 focus:border-blue-500",
    icon: "text-blue-600",
  },
  teal: {
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    score: "text-teal-700",
    ring: "focus:ring-teal-500/20 focus:border-teal-500",
    icon: "text-teal-600",
  },
  indigo: {
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    score: "text-indigo-700",
    ring: "focus:ring-indigo-500/20 focus:border-indigo-500",
    icon: "text-indigo-600",
  },
};

export function MemberCumulativeTable({
  title,
  subtitle,
  members,
  accentColor = "blue",
  emptyText = "Belum ada data anggota pada kemenko yang diampu.",
  divisor = 8,
}: Props) {
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "name_asc">("score_desc");
  const [expandedNim, setExpandedNim] = useState<string | null>(null);

  const accent = ACCENT_CLASSES[accentColor];

  const unitOptions = useMemo(() => {
    const unique = Array.from(new Set(members.map((m) => m.unit_name).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = members.filter((m) => {
      const matchesUnit = unitFilter === "all" || m.unit_name === unitFilter;
      const matchesQuery =
        !q ||
        m.nama_lengkap.toLowerCase().includes(q) ||
        m.nim.toLowerCase().includes(q) ||
        m.unit_name.toLowerCase().includes(q);
      return matchesUnit && matchesQuery;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "score_desc") return b.cumulative_avg - a.cumulative_avg;
      if (sortBy === "score_asc") return a.cumulative_avg - b.cumulative_avg;
      return a.nama_lengkap.localeCompare(b.nama_lengkap);
    });
  }, [members, search, unitFilter, sortBy]);

  return (
    <Card className="border-slate-200/90 bg-white shadow-2xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-slate-900">
              <Users className={`h-4.5 w-4.5 ${accent.icon} shrink-0`} />
              <span>{title}</span>
            </CardTitle>
            {subtitle && (
              <CardDescription className="text-xs sm:text-sm mt-0.5">{subtitle}</CardDescription>
            )}
          </div>
          <span className={`self-start sm:self-auto rounded-full border px-2.5 py-0.5 text-xs font-semibold ${accent.badge}`}>
            {filteredMembers.length} Orang
          </span>
        </div>

        {/* Filter Controls */}
        {members.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau NIM..."
                className={`w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 ${accent.ring}`}
              />
            </div>

            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className={`w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 ${accent.ring}`}
              aria-label="Filter unit kementerian atau biro"
            >
              <option value="all">Semua Kementerian / Biro</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className={`w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 ${accent.ring}`}
                aria-label="Urutkan daftar anggota"
              >
                <option value="score_desc">Nilai Kumulatif Tertinggi</option>
                <option value="score_asc">Nilai Kumulatif Terendah</option>
                <option value="name_asc">Nama (A - Z)</option>
              </select>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {filteredMembers.length === 0 ? (
          <p className="py-6 text-center text-xs sm:text-sm text-slate-500">{emptyText}</p>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold w-8"></th>
                    <th className="px-3.5 py-2.5 font-semibold">Nama & NIM</th>
                    <th className="px-3.5 py-2.5 font-semibold">Kementerian / Biro</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Periode Terbaru</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">
                      Nilai Kumulatif (÷ {divisor})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredMembers.map((m) => {
                    const isExpanded = expandedNim === m.nim;
                    return (
                      <Fragment key={m.nim}>
                        <tr
                          onClick={() => setExpandedNim((curr) => (curr === m.nim ? null : m.nim))}
                          className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="px-3.5 py-2.5 text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">{m.nama_lengkap}</span>
                              {m.role_label && (
                                <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                  {m.role_label}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-500">{m.nim}</p>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-700">{m.unit_name}</td>
                          <td className="px-3.5 py-2.5 text-right">
                            {m.latest_score !== null ? (
                              <div>
                                <span className="font-semibold text-slate-800">
                                  {m.latest_score.toFixed(2)}
                                </span>
                                <p className="text-[11px] text-slate-400">{m.latest_period_label}</p>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <div>
                              <span className={`text-sm font-bold ${accent.score}`}>
                                {m.cumulative_avg.toFixed(2)}
                              </span>
                              <p className="text-[11px] text-slate-400">
                                {m.published_count}/{divisor} bulan dinilai
                              </p>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={5} className="px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                                Rincian Nilai per Bulan — Published &amp; Draft ({m.nama_lengkap})
                              </p>
                              {m.period_scores.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {m.period_scores.map((ps) => (
                                    <div
                                      key={ps.periode_id}
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-2"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-xs text-slate-600 truncate">{ps.label}</span>
                                        {ps.status && ps.status !== "published" && (
                                          <span className="rounded bg-amber-50 border border-amber-200 px-1 py-0.2 text-[9px] font-semibold text-amber-700 uppercase">
                                            {ps.status}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-xs font-bold text-slate-900 shrink-0">
                                        {ps.score.toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">
                                  Belum ada periode yang dinilai untuk anggota ini.
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="space-y-2.5 md:hidden">
              {filteredMembers.map((m) => {
                const isExpanded = expandedNim === m.nim;
                return (
                  <div
                    key={m.nim}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedNim((curr) => (curr === m.nim ? null : m.nim))}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {m.nama_lengkap}
                            </p>
                            {m.role_label && (
                              <span className="rounded-full bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                {m.role_label}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-slate-500">{m.nim}</p>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">{m.unit_name}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`text-base font-extrabold ${accent.score}`}>
                            {m.cumulative_avg.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Kumulatif ({m.published_count}/{divisor})
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Terbaru:{" "}
                          <strong className="text-slate-800">
                            {m.latest_score !== null ? `${m.latest_score.toFixed(2)} (${m.latest_period_label})` : "-"}
                          </strong>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                          {isExpanded ? "Tutup" : "Detail"}
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1.5">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                          Rincian Nilai per Bulan (Published &amp; Draft)
                        </p>
                        {m.period_scores.length > 0 ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            {m.period_scores.map((ps) => (
                              <div
                                key={ps.periode_id}
                                className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 flex items-center justify-between gap-1"
                              >
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="text-[11px] text-slate-600 truncate">{ps.label}</span>
                                  {ps.status && ps.status !== "published" && (
                                    <span className="rounded bg-amber-50 border border-amber-200 px-1 text-[8.5px] font-semibold text-amber-700 uppercase">
                                      {ps.status}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-bold text-slate-900 shrink-0">
                                  {ps.score.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Belum ada periode yang dinilai.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
