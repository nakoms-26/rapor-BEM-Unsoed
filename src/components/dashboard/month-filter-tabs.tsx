"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

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

export interface RaporItem {
  id: string;
  bulan: number;
  tahun: number;
  [key: string]: any;
}

interface MonthFilterTabsProps {
  items: RaporItem[];
  children: (filteredItems: RaporItem[]) => React.ReactNode;
}

export function MonthFilterTabs({ items, children }: MonthFilterTabsProps) {
  // Get unique month/year combinations sorted by date (newest first)
  const uniqueMonths = useMemo(() => {
    const monthSet = new Map<string, { bulan: number; tahun: number }>();
    
    items.forEach((item) => {
      const key = `${item.tahun}-${String(item.bulan).padStart(2, "0")}`;
      monthSet.set(key, { bulan: item.bulan, tahun: item.tahun });
    });

    return Array.from(monthSet.values()).sort((a, b) => {
      const dateA = new Date(a.tahun, a.bulan - 1);
      const dateB = new Date(b.tahun, b.bulan - 1);
      return dateB.getTime() - dateA.getTime(); // Newest first
    });
  }, [items]);

  // Default to the first (newest) month
  const [selectedMonth, setSelectedMonth] = useState<number>(
    uniqueMonths.length > 0 ? uniqueMonths[0].bulan : 1
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    uniqueMonths.length > 0 ? uniqueMonths[0].tahun : new Date().getFullYear()
  );

  // Filter items by selected month/year
  const filteredItems = useMemo(
    () => items.filter((item) => item.bulan === selectedMonth && item.tahun === selectedYear),
    [items, selectedMonth, selectedYear]
  );

  const handleMonthSelect = (bulan: number, tahun: number) => {
    setSelectedMonth(bulan);
    setSelectedYear(tahun);
  };

  return (
    <div className="space-y-4">
      {uniqueMonths.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b pb-3">
          {uniqueMonths.map((month) => (
            <Button
              key={`${month.tahun}-${month.bulan}`}
              variant={
                selectedMonth === month.bulan && selectedYear === month.tahun
                  ? "default"
                  : "outline"
              }
              onClick={() => handleMonthSelect(month.bulan, month.tahun)}
              className="text-sm"
            >
              {BULAN_LABEL[month.bulan]} {month.tahun}
            </Button>
          ))}
        </div>
      )}
      {children(filteredItems)}
    </div>
  );
}
