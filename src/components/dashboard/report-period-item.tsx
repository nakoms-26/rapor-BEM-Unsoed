"use client";

import { useState } from "react";

type Props = {
  title: string;
  scoreLabel: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function ReportPeriodItem({ title, scoreLabel, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
      >
        <span className="font-medium text-slate-700">{title}</span>
        <span className="font-semibold text-slate-900">{scoreLabel}</span>
      </button>

      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  );
}
