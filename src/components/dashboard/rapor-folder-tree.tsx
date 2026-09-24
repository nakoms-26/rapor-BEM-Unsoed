"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Calendar,
  Layers,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteRaporForm } from "@/components/dashboard/delete-rapor-form";

export type RaporFolderItem = {
  id: string;
  user_nim: string;
  penilai_nim?: string;
  periode_id: string;
  targetName: string;
  evaluatorName: string;
  unitId: string;
  unitName: string;
  kemenkoName: string;
  totalAvg: number;
  reportType: string;
  isIntern: boolean;
  catatan: string | null;
  periodeLabel: string;
  created_at?: string;
};

export type PeriodOption = {
  id: string;
  bulan: number;
  tahun: number;
  status: string;
};

interface RaporFolderTreeProps {
  items: RaporFolderItem[];
  periods?: PeriodOption[];
  deleteAction?: (formData: FormData) => Promise<void>;
  title?: string;
  description?: string;
  defaultFilterType?: "all" | "staff" | "intern";
  defaultGroupMode?: "period_first" | "unit_first";
}

function scoreTone(score: number) {
  if (score >= 85) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 70) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

function reportTypeBadge(type: string, isIntern: boolean) {
  if (isIntern || type === "internship") {
    return (
      <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
        Internship
      </span>
    );
  }
  if (type === "menteri_kepala_biro") {
    return (
      <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
        Menteri / Kabiro
      </span>
    );
  }
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      Staf Unit
    </span>
  );
}

export function RaporFolderTree({
  items,
  periods = [],
  deleteAction,
  title = "Semua Rapor (Struktur Folder)",
  description = "Pengelompokan: Periode > Kemenko > Unit > daftar rapor staf & internship.",
  defaultFilterType = "all",
  defaultGroupMode = "period_first",
}: RaporFolderTreeProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<"all" | "staff" | "intern">(defaultFilterType);
  const [groupMode, setGroupMode] = useState<"period_first" | "unit_first">(defaultGroupMode);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const periodMap = useMemo(() => {
    return new Map(periods.map((p) => [p.id, p]));
  }, [periods]);

  // Filter items based on search, period dropdown, and report type
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Period filter
      if (selectedPeriod !== "all" && item.periode_id !== selectedPeriod) {
        return false;
      }

      // Type filter
      if (selectedType === "staff" && item.isIntern) {
        return false;
      }
      if (selectedType === "intern" && !item.isIntern) {
        return false;
      }

      // Search query filter (matches name, NIM, evaluator, or unit)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = item.targetName.toLowerCase().includes(query);
        const matchesNim = item.user_nim.toLowerCase().includes(query);
        const matchesEvaluator = item.evaluatorName.toLowerCase().includes(query);
        const matchesUnit = item.unitName.toLowerCase().includes(query);
        return matchesName || matchesNim || matchesEvaluator || matchesUnit;
      }

      return true;
    });
  }, [items, selectedPeriod, selectedType, searchQuery]);

  // Group Mode 1: Periode -> Kemenko -> Unit -> Reports
  const periodFirstGroup = useMemo(() => {
    // Map: periodId -> Map(kemenkoName -> Map(unitName -> RaporFolderItem[]))
    const map = new Map<string, { label: string; kemenkos: Map<string, Map<string, RaporFolderItem[]>> }>();

    for (const item of filteredItems) {
      const pid = item.periode_id;
      const periodObj = periodMap.get(pid);
      const label = periodObj
        ? `Periode Bulan ${periodObj.bulan}/${periodObj.tahun} (${periodObj.status})`
        : item.periodeLabel || "Periode Lain";

      if (!map.has(pid)) {
        map.set(pid, { label, kemenkos: new Map() });
      }
      const pEntry = map.get(pid)!;

      const kemenko = item.kemenkoName || "Tanpa Kemenko";
      const unit = item.unitName || "-";

      if (!pEntry.kemenkos.has(kemenko)) {
        pEntry.kemenkos.set(kemenko, new Map());
      }
      const unitMap = pEntry.kemenkos.get(kemenko)!;
      if (!unitMap.has(unit)) {
        unitMap.set(unit, []);
      }
      unitMap.get(unit)!.push(item);
    }

    return map;
  }, [filteredItems, periodMap]);

  // Group Mode 2: Kemenko -> Unit -> Periode -> Reports
  const unitFirstGroup = useMemo(() => {
    const map = new Map<string, Map<string, Map<string, { label: string; items: RaporFolderItem[] }>>>();

    for (const item of filteredItems) {
      const kemenko = item.kemenkoName || "Tanpa Kemenko";
      const unit = item.unitName || "-";
      const pid = item.periode_id;
      const periodObj = periodMap.get(pid);
      const label = periodObj
        ? `Bulan ${periodObj.bulan}/${periodObj.tahun} (${periodObj.status})`
        : item.periodeLabel || "Periode Lain";

      if (!map.has(kemenko)) {
        map.set(kemenko, new Map());
      }
      const unitMap = map.get(kemenko)!;

      if (!unitMap.has(unit)) {
        unitMap.set(unit, new Map());
      }
      const periodMapInUnit = unitMap.get(unit)!;

      if (!periodMapInUnit.has(pid)) {
        periodMapInUnit.set(pid, { label, items: [] });
      }
      periodMapInUnit.get(pid)!.items.push(item);
    }

    return map;
  }, [filteredItems, periodMap]);

  const totalFilteredReports = filteredItems.length;
  const totalUnitsWithReports = useMemo(() => {
    return new Set(filteredItems.map((r) => r.unitName)).size;
  }, [filteredItems]);
  const totalEvaluators = useMemo(() => {
    return new Set(filteredItems.map((r) => r.evaluatorName)).size;
  }, [filteredItems]);

  // Expand / collapse helper
  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    if (groupMode === "period_first") {
      for (const [pid, pEntry] of periodFirstGroup.entries()) {
        next[`p:${pid}`] = true;
        for (const [kemenko, uMap] of pEntry.kemenkos.entries()) {
          next[`pk:${pid}:${kemenko}`] = true;
          for (const unit of uMap.keys()) {
            next[`pku:${pid}:${kemenko}:${unit}`] = true;
          }
        }
      }
    } else {
      for (const [kemenko, uMap] of unitFirstGroup.entries()) {
        next[`k:${kemenko}`] = true;
        for (const [unit, pMap] of uMap.entries()) {
          next[`ku:${kemenko}:${unit}`] = true;
          for (const pid of pMap.keys()) {
            next[`kup:${kemenko}:${unit}:${pid}`] = true;
          }
        }
      }
    }
    setExpandedFolders(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    if (groupMode === "period_first") {
      for (const [pid, pEntry] of periodFirstGroup.entries()) {
        next[`p:${pid}`] = false;
        for (const [kemenko, uMap] of pEntry.kemenkos.entries()) {
          next[`pk:${pid}:${kemenko}`] = false;
          for (const unit of uMap.keys()) {
            next[`pku:${pid}:${kemenko}:${unit}`] = false;
          }
        }
      }
    } else {
      for (const [kemenko, uMap] of unitFirstGroup.entries()) {
        next[`k:${kemenko}`] = false;
        for (const [unit, pMap] of uMap.entries()) {
          next[`ku:${kemenko}:${unit}`] = false;
          for (const pid of pMap.keys()) {
            next[`kup:${kemenko}:${unit}:${pid}`] = false;
          }
        }
      }
    }
    setExpandedFolders(next);
  };

  const hasInternItems = useMemo(() => items.some((i) => i.isIntern), [items]);
  const hasStaffItems = useMemo(() => items.some((i) => !i.isIntern), [items]);

  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <CardHeader className="p-4 sm:p-6 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg text-slate-900">{title}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Group mode selector */}
            <div className="flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setGroupMode("period_first")}
                className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors ${
                  groupMode === "period_first" ? "bg-white text-blue-700 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Calendar className="h-3 w-3" />
                <span>Per Periode</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupMode("unit_first")}
                className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors ${
                  groupMode === "unit_first" ? "bg-white text-blue-700 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="h-3 w-3" />
                <span>Per Unit</span>
              </button>
            </div>

            <button
              type="button"
              onClick={expandAll}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Buka Semua
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Tutup Semua
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          {/* Search Input */}
          <div className={`relative ${hasStaffItems && hasInternItems ? "sm:col-span-5" : "sm:col-span-7"}`}>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, NIM, unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Period Dropdown */}
          <div className={hasStaffItems && hasInternItems ? "sm:col-span-4" : "sm:col-span-5"}>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Semua Periode</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  Bulan {p.bulan}/{p.tahun} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter Buttons (Only show when there is a mix of staff and intern) */}
          {hasStaffItems && hasInternItems ? (
            <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 sm:col-span-3">
              <button
                type="button"
                onClick={() => setSelectedType("all")}
                className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
                  selectedType === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSelectedType("staff")}
                className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
                  selectedType === "staff" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Staf
              </button>
              <button
                type="button"
                onClick={() => setSelectedType("intern")}
                className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
                  selectedType === "intern" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Intern
              </button>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
        {/* Quick Stats Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
            <p className="text-[11px] text-slate-500">Total Rapor</p>
            <p className="text-sm font-semibold text-slate-800">{totalFilteredReports}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
            <p className="text-[11px] text-slate-500">Unit Terisi</p>
            <p className="text-sm font-semibold text-slate-800">{totalUnitsWithReports}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
            <p className="text-[11px] text-slate-500">Penilai Aktif</p>
            <p className="text-sm font-semibold text-slate-800">{totalEvaluators}</p>
          </div>
        </div>

        {/* Render Mode 1: Periode First (Bulan/Tahun -> Kemenko -> Unit) */}
        {groupMode === "period_first" && periodFirstGroup.size > 0 && (
          <div className="space-y-3">
            {[...periodFirstGroup.entries()].map(([pid, pEntry], pIdx) => {
              const pKey = `p:${pid}`;
              // Open first (latest) period by default, collapse older ones unless searched or explicitly toggled
              const isPeriodOpen = expandedFolders[pKey] ?? (searchQuery ? true : pIdx === 0);
              const pTotal = [...pEntry.kemenkos.values()].reduce(
                (sum, km) => sum + [...km.values()].reduce((s, rows) => s + rows.length, 0),
                0,
              );

              return (
                <div key={pid} className="rounded-xl border border-indigo-200/80 bg-indigo-50/30 overflow-hidden shadow-2xs">
                  {/* Period Header */}
                  <button
                    type="button"
                    onClick={() => toggleFolder(pKey)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left text-sm font-bold text-indigo-950 bg-indigo-100/60 hover:bg-indigo-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isPeriodOpen ? (
                        <ChevronDown className="h-4 w-4 text-indigo-600 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-indigo-600 shrink-0" />
                      )}
                      <Calendar className="h-4 w-4 text-indigo-700 shrink-0" />
                      <span className="truncate">{pEntry.label}</span>
                    </div>
                    <span className="rounded-full border border-indigo-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-indigo-800 shrink-0">
                      {pTotal} rapor
                    </span>
                  </button>

                  {/* Kemenkos within this Period */}
                  {isPeriodOpen ? (
                    <div className="space-y-2.5 p-3">
                      {[...pEntry.kemenkos.entries()].map(([kemenkoName, unitMap]) => {
                        const pkKey = `pk:${pid}:${kemenkoName}`;
                        const isKemenkoOpen = expandedFolders[pkKey] ?? true;
                        const kemenkoCount = [...unitMap.values()].reduce((sum, list) => sum + list.length, 0);

                        return (
                          <div key={kemenkoName} className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
                            {/* Kemenko Header */}
                            <button
                              type="button"
                              onClick={() => toggleFolder(pkKey)}
                              className="flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-left text-xs sm:text-sm font-semibold text-slate-800 bg-slate-50/80 hover:bg-slate-100/80 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isKemenkoOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                )}
                                <Folder className="h-4 w-4 text-blue-600 shrink-0" />
                                <span className="truncate">{kemenkoName}</span>
                              </div>
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 shrink-0">
                                {kemenkoCount} rapor
                              </span>
                            </button>

                            {/* Units within this Kemenko */}
                            {isKemenkoOpen ? (
                              <div className="space-y-2 p-2.5 pt-1.5">
                                {[...unitMap.entries()].map(([unitName, rows]) => {
                                  const pkuKey = `pku:${pid}:${kemenkoName}:${unitName}`;
                                  const isUnitOpen = expandedFolders[pkuKey] ?? true;

                                  return (
                                    <div
                                      key={`${pid}-${kemenkoName}-${unitName}`}
                                      className="rounded-md border border-slate-200 bg-slate-50/40 overflow-hidden"
                                    >
                                      {/* Unit Header */}
                                      <button
                                        type="button"
                                        onClick={() => toggleFolder(pkuKey)}
                                        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100/70 transition-colors"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {isUnitOpen ? (
                                            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
                                          )}
                                          <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                          <span className="truncate">{unitName}</span>
                                        </div>
                                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 shrink-0">
                                          {rows.length} rapor
                                        </span>
                                      </button>

                                      {/* Reports List */}
                                      {isUnitOpen ? (
                                        <div className="space-y-1.5 p-2 pt-0 bg-white">
                                          {rows.map((row) => (
                                            <ReportCard key={row.id} row={row} deleteAction={deleteAction} />
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {/* Render Mode 2: Unit First (Kemenko -> Unit -> Periode) */}
        {groupMode === "unit_first" && unitFirstGroup.size > 0 && (
          <div className="space-y-2.5">
            {[...unitFirstGroup.entries()].map(([kemenkoName, unitMap]) => {
              const kKey = `k:${kemenkoName}`;
              const isKemenkoOpen = expandedFolders[kKey] ?? true;
              const kemenkoCount = [...unitMap.values()].reduce(
                (sum, pMap) => sum + [...pMap.values()].reduce((s, p) => s + p.items.length, 0),
                0,
              );

              return (
                <div key={kemenkoName} className="rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden">
                  {/* Kemenko Header */}
                  <button
                    type="button"
                    onClick={() => toggleFolder(kKey)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isKemenkoOpen ? (
                        <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                      )}
                      <Folder className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>{kemenkoName}</span>
                    </div>
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 shrink-0">
                      {kemenkoCount} rapor
                    </span>
                  </button>

                  {/* Units */}
                  {isKemenkoOpen ? (
                    <div className="space-y-2 px-3 pb-3">
                      {[...unitMap.entries()].map(([unitName, periodMapInUnit]) => {
                        const kuKey = `ku:${kemenkoName}:${unitName}`;
                        const isUnitOpen = expandedFolders[kuKey] ?? true;
                        const unitCount = [...periodMapInUnit.values()].reduce((s, p) => s + p.items.length, 0);

                        return (
                          <div
                            key={`${kemenkoName}-${unitName}`}
                            className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-2xs"
                          >
                            {/* Unit Header */}
                            <button
                              type="button"
                              onClick={() => toggleFolder(kuKey)}
                              className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center gap-1.5">
                                {isUnitOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                )}
                                <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span>{unitName}</span>
                              </div>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 shrink-0">
                                {unitCount} rapor
                              </span>
                            </button>

                            {/* Periods inside Unit */}
                            {isUnitOpen ? (
                              <div className="space-y-2 p-2.5 pt-0">
                                {[...periodMapInUnit.entries()].map(([pid, pData]) => {
                                  const kupKey = `kup:${kemenkoName}:${unitName}:${pid}`;
                                  const isPeriodInUnitOpen = expandedFolders[kupKey] ?? true;

                                  return (
                                    <div key={pid} className="rounded border border-indigo-100 bg-indigo-50/20 overflow-hidden">
                                      <button
                                        type="button"
                                        onClick={() => toggleFolder(kupKey)}
                                        className="flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs font-medium text-indigo-900 bg-indigo-50/70 hover:bg-indigo-100/70 transition-colors"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          {isPeriodInUnitOpen ? (
                                            <ChevronDown className="h-3 w-3 text-indigo-500 shrink-0" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3 text-indigo-500 shrink-0" />
                                          )}
                                          <Calendar className="h-3 w-3 text-indigo-600 shrink-0" />
                                          <span>{pData.label}</span>
                                        </div>
                                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-indigo-700 border border-indigo-200 shrink-0">
                                          {pData.items.length} rapor
                                        </span>
                                      </button>

                                      {isPeriodInUnitOpen ? (
                                        <div className="space-y-1.5 p-2 bg-white">
                                          {pData.items.map((row) => (
                                            <ReportCard key={row.id} row={row} deleteAction={deleteAction} />
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {((groupMode === "period_first" && periodFirstGroup.size === 0) ||
          (groupMode === "unit_first" && unitFirstGroup.size === 0)) && (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-700">Tidak ada rapor yang sesuai filter</p>
            <p className="text-xs text-slate-500">
              {searchQuery || selectedPeriod !== "all" || selectedType !== "all"
                ? "Coba ubah kata kunci pencarian, periode, atau filter jenis rapor."
                : "Belum ada data rapor yang tersimpan."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportCard({
  row,
  deleteAction,
}: {
  row: RaporFolderItem;
  deleteAction?: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/60 p-2.5 text-sm hover:border-slate-300 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold text-slate-900 text-xs sm:text-sm">{row.targetName}</p>
            {reportTypeBadge(row.reportType, row.isIntern)}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>NIM: {row.user_nim}</span>
            <span>•</span>
            <span>{row.periodeLabel}</span>
            <span>•</span>
            <span>Penilai: {row.evaluatorName}</span>
          </div>
          {row.catatan ? (
            <p className="text-xs text-slate-600 line-clamp-2 bg-white/70 rounded px-2 py-1 border border-slate-100 italic">
              "{row.catatan}"
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t border-slate-200/60 sm:border-0 shrink-0">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${scoreTone(row.totalAvg)}`}>
            {row.totalAvg.toFixed(2)}
          </span>
          <div className="flex items-center gap-1.5">
            <Link
              href={
                row.isIntern
                  ? `/pj-ppm-intern/input?edit_rapor_id=${row.id}`
                  : `/admin?edit_rapor_id=${row.id}#input-rapor-form`
              }
              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              Detail/Edit
            </Link>
            {deleteAction ? (
              <DeleteRaporForm
                action={deleteAction}
                raporId={row.id}
                raporName={`${row.targetName} - ${row.periodeLabel}`}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
