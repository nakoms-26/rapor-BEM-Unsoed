import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-6 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#dbeafe,transparent_55%)]" />
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-200/40 blur-3xl" />

      <section className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Internal System</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 md:text-5xl">Rapor BEM Unsoed</h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Sistem Rapor BEM Unsoed 2026 Kabinet Kausa Cipta
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700"
          >
            Sign In <ArrowRight className="h-4 w-4" />
          </Link>
          {/* <Link
            href="/menteri"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Lihat Dashboard Menteri
          </Link> */}
        </div>
      </section>
    </main>
  );
}
