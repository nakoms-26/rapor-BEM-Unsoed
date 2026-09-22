"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  Database,
  Home,
  LogOut,
  Menu,
  User,
  UserRoundCheck,
  X,
} from "lucide-react";
import { formatRoleName } from "@/lib/constants";

export type IconKey = "home" | "clipboard" | "chart" | "user" | "userCheck" | "database";
export type NavCategory = "main" | "kementerian" | "internship" | "personal" | "other" | "account";

export interface HeaderNavItem {
  href: string;
  label: string;
  iconKey: IconKey;
  category: NavCategory;
}

export interface HeaderProfile {
  nama_lengkap: string;
  nim: string;
  role: string;
  is_pj_kemenkoan?: boolean;
}

interface DashboardHeaderProps {
  profile: HeaderProfile;
  navItems: HeaderNavItem[];
  signOutAction: () => Promise<void>;
}

const ICON_MAP = {
  home: Home,
  clipboard: ClipboardList,
  chart: BarChart3,
  user: User,
  userCheck: UserRoundCheck,
  database: Database,
};

export function DashboardHeader({ profile, navItems, signOutAction }: DashboardHeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close mobile menu and dropdowns when navigating
  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  // Close dropdown on click outside or Esc key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenDropdown(null);
        setMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Categorize navigation items
  const mainItems = navItems.filter((item) => item.category === "main");
  const kementerianItems = navItems.filter((item) => item.category === "kementerian");
  const internshipItems = navItems.filter((item) => item.category === "internship");
  const personalItems = navItems.filter((item) => item.category === "personal");
  const otherItems = navItems.filter((item) => item.category === "other");

  const isKementerianActive = kementerianItems.some(
    (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href)),
  );
  const isInternshipActive = internshipItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href),
  );

  const initialLetter = profile.nama_lengkap
    ? profile.nama_lengkap.trim().charAt(0).toUpperCase()
    : "U";

  const roleBadgeLabel = formatRoleName(profile.role, profile.is_pj_kemenkoan);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3">
        {/* Left: User Identity Branding (Guaranteed non-shrinking) */}
        <Link
          href="/profile"
          className="group flex items-center gap-2.5 sm:gap-3 shrink-0 focus:outline-hidden"
          title="Lihat profil"
        >
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-sm shadow-xs ring-2 ring-blue-100 group-hover:ring-blue-300 transition-all shrink-0">
            {initialLetter}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight truncate max-w-[130px] sm:max-w-[200px] md:max-w-[240px]">
              {profile.nama_lengkap}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
              <span className="font-mono font-medium text-slate-600">{profile.nim}</span>
              <span className="text-slate-300">•</span>
              <span className="truncate max-w-[110px] sm:max-w-[150px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded text-[10px] border border-blue-100">
                {roleBadgeLabel}
              </span>
            </div>
          </div>
        </Link>

        {/* Center/Right: Desktop Navigation (Hidden on screens < lg) */}
        <nav
          ref={dropdownRef}
          className="hidden lg:flex items-center gap-1 xl:gap-1.5 ml-4 shrink-0"
          aria-label="Navigasi desktop"
        >
          {/* Main Items (e.g. Dashboard) */}
          {mainItems.map((item) => {
            const Icon = ICON_MAP[item.iconKey] || Home;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Kementerian Group: Dropdown if multiple, Direct Link if single */}
          {kementerianItems.length === 1 && (
            <Link
              href={kementerianItems[0].href}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium whitespace-nowrap transition-colors ${
                pathname === kementerianItems[0].href
                  ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-2xs"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {(() => {
                const Icon = ICON_MAP[kementerianItems[0].iconKey] || ClipboardList;
                return <Icon className="h-4 w-4 shrink-0 text-slate-500" />;
              })()}
              <span>{kementerianItems[0].label}</span>
            </Link>
          )}

          {kementerianItems.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown((curr) => (curr === "kementerian" ? null : "kementerian"))
                }
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium whitespace-nowrap transition-colors ${
                  isKementerianActive || openDropdown === "kementerian"
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-expanded={openDropdown === "kementerian"}
              >
                <ClipboardList className={`h-4 w-4 shrink-0 ${isKementerianActive ? "text-blue-600" : "text-slate-500"}`} />
                <span>Kementerian</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-150 ${
                    openDropdown === "kementerian" ? "rotate-180 text-blue-600" : "text-slate-400"
                  }`}
                />
              </button>

              {openDropdown === "kementerian" && (
                <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5 z-50">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Menu Kementerian
                  </div>
                  {kementerianItems.map((sub) => {
                    const SubIcon = ICON_MAP[sub.iconKey] || ClipboardList;
                    const isSubActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setOpenDropdown(null)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                          isSubActive
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <SubIcon className={`h-4 w-4 shrink-0 ${isSubActive ? "text-blue-600" : "text-slate-400"}`} />
                        <span>{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Internship Group: Dropdown if multiple, Direct Link if single */}
          {internshipItems.length === 1 && (
            <Link
              href={internshipItems[0].href}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium whitespace-nowrap transition-colors ${
                pathname === internshipItems[0].href
                  ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-2xs"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {(() => {
                const Icon = ICON_MAP[internshipItems[0].iconKey] || BarChart3;
                return <Icon className="h-4 w-4 shrink-0 text-slate-500" />;
              })()}
              <span>{internshipItems[0].label}</span>
            </Link>
          )}

          {internshipItems.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown((curr) => (curr === "internship" ? null : "internship"))
                }
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium whitespace-nowrap transition-colors ${
                  isInternshipActive || openDropdown === "internship"
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-expanded={openDropdown === "internship"}
              >
                <BarChart3 className={`h-4 w-4 shrink-0 ${isInternshipActive ? "text-blue-600" : "text-slate-500"}`} />
                <span>Internship</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-150 ${
                    openDropdown === "internship" ? "rotate-180 text-blue-600" : "text-slate-400"
                  }`}
                />
              </button>

              {openDropdown === "internship" && (
                <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5 z-50">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Menu Internship
                  </div>
                  {internshipItems.map((sub) => {
                    const SubIcon = ICON_MAP[sub.iconKey] || BarChart3;
                    const isSubActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setOpenDropdown(null)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                          isSubActive
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <SubIcon className={`h-4 w-4 shrink-0 ${isSubActive ? "text-blue-600" : "text-slate-400"}`} />
                        <span>{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Personal Items (e.g. Rapor Diri) */}
          {personalItems.map((item) => {
            const Icon = ICON_MAP[item.iconKey] || UserRoundCheck;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Other Items */}
          {otherItems.map((item) => {
            const Icon = ICON_MAP[item.iconKey] || ClipboardList;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* User Profil link */}
          <Link
            href="/profile"
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs xl:text-sm font-medium whitespace-nowrap transition-colors ${
              pathname === "/profile"
                ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/80"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
            title="Profil Saya"
          >
            <User className="h-4 w-4 shrink-0 text-slate-500" />
            <span>Profil</span>
          </Link>

          {/* Logout Button */}
          <form action={signOutAction}>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs xl:text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 whitespace-nowrap transition-colors cursor-pointer"
              type="submit"
              title="Keluar dari akun"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Keluar</span>
            </button>
          </form>
        </nav>

        {/* Mobile Hamburger Button (Screens < lg) */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-hidden"
          aria-label={mobileOpen ? "Tutup navigasi" : "Buka navigasi"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <aside
          className="fixed inset-y-0 right-0 w-full max-w-xs sm:max-w-sm bg-white shadow-2xl z-50 lg:hidden flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
          aria-label="Navigasi drawer mobile"
        >
          {/* Drawer Header */}
          <div className="border-b border-slate-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-sm shadow-xs shrink-0">
                {initialLetter}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{profile.nama_lengkap}</p>
                <p className="text-xs text-slate-500 font-mono">{profile.nim}</p>
                <span className="inline-block mt-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                  {roleBadgeLabel}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Navigation Links */}
          <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
            {/* Menu Utama */}
            {mainItems.length > 0 && (
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Menu Utama
                </p>
                {mainItems.map((item) => {
                  const Icon = ICON_MAP[item.iconKey] || Home;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-2xs"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Menu Kementerian */}
            {kementerianItems.length > 0 && (
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Kementerian / Biro
                </p>
                {kementerianItems.map((item) => {
                  const Icon = ICON_MAP[item.iconKey] || ClipboardList;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-2xs"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Menu Internship */}
            {internshipItems.length > 0 && (
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Internship (Cakrawala)
                </p>
                {internshipItems.map((item) => {
                  const Icon = ICON_MAP[item.iconKey] || BarChart3;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-2xs"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Menu Rapor Pribadi */}
            {personalItems.length > 0 && (
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Rapor Pribadi
                </p>
                {personalItems.map((item) => {
                  const Icon = ICON_MAP[item.iconKey] || UserRoundCheck;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-2xs"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Other Items */}
            {otherItems.length > 0 && (
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Lainnya
                </p>
                {otherItems.map((item) => {
                  const Icon = ICON_MAP[item.iconKey] || ClipboardList;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-2xs"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Drawer Footer: Akun & Keluar */}
          <div className="border-t border-slate-100 p-4 space-y-2 bg-slate-50/50">
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                pathname === "/profile"
                  ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200"
                  : "text-slate-700 hover:bg-white hover:text-slate-900"
              }`}
            >
              <User className="h-4.5 w-4.5 shrink-0 text-slate-500" />
              <span>Profil Saya</span>
            </Link>

            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 active:bg-red-100 transition-colors cursor-pointer"
              >
                <LogOut className="h-4.5 w-4.5 shrink-0" />
                <span>Keluar dari Akun</span>
              </button>
            </form>
          </div>
        </aside>
      )}
    </header>
  );
}
