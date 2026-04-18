type Props = {
  title: string;
  scoreLabel: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function ReportPeriodItem({ title, scoreLabel, defaultOpen = false, children }: Props) {
  return (
    <details open={defaultOpen} className="rounded-lg border border-slate-200 bg-slate-50/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-left text-sm marker:content-none">
        <span className="font-medium text-slate-700">{title}</span>
        <span className="font-semibold text-slate-900">{scoreLabel}</span>
      </summary>

      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}
