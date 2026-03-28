"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { signInWithTableAccount, signUpWithTableAccount } from "@/app/(auth)/login/actions";
import { ROLE_HOME, type AppRole } from "@/lib/constants";
import type { SignUpRoleOption, SignUpUnitOption } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  roleOptions: SignUpRoleOption[];
  unitOptions: SignUpUnitOption[];
};

const ADMIN_ALLOWED_UNITS = new Set(["Biro PPM", "Biro Pengendali & Penjamin Mutu"]);
const PRES_WAPRES_ALLOWED_UNITS = new Set(["Lingkar Presiden"]);

function isUnitEligibleForRole(
  role: string,
  unit: { nama_unit: string; kategori: "kemenko" | "kementerian" | "biro" },
) {
  if (role === "menko") {
    return unit.kategori === "kemenko";
  }
  if (role === "pres_wapres") {
    return PRES_WAPRES_ALLOWED_UNITS.has(unit.nama_unit);
  }
  if (role === "admin") {
    return ADMIN_ALLOWED_UNITS.has(unit.nama_unit);
  }
  if (role === "menteri" || role === "staff") {
    return unit.kategori === "kementerian" || unit.kategori === "biro";
  }
  return true;
}

export function LoginForm({ roleOptions, unitOptions }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>(roleOptions[0]?.value ?? "staff");

  const filteredUnitOptions = useMemo(
    () => unitOptions.filter((unit) => isUnitEligibleForRole(selectedRole, unit)),
    [selectedRole, unitOptions],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const formData = new FormData(event.currentTarget);
    const rawNim = String(formData.get("nim") ?? "").trim();
    // NIM can be alphanumeric (e.g. H1D024096), so we normalize case and whitespace.
    const nim = rawNim.replace(/\s+/g, "").toUpperCase();
    const namaLengkap = String(formData.get("nama_lengkap") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();
    const unitId = String(formData.get("unit_id") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");

    if (!nim || !password) {
      setErrorMessage("NIM dan password wajib diisi.");
      setIsLoading(false);
      return;
    }

    if (mode === "signup") {
      if (!namaLengkap) {
        setErrorMessage("Nama lengkap wajib diisi untuk registrasi.");
        setIsLoading(false);
        return;
      }

      if (!role || !unitId) {
        setErrorMessage("Role dan unit wajib dipilih untuk registrasi.");
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setErrorMessage("Password minimal 6 karakter.");
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage("Konfirmasi password tidak sama.");
        setIsLoading(false);
        return;
      }

      const result = await signUpWithTableAccount({
        nim,
        namaLengkap,
        role,
        unitId,
        password,
        confirmPassword,
      });

      if (!result.ok) {
        setErrorMessage(result.message ?? "Registrasi gagal.");
        setIsLoading(false);
        return;
      }

      setSuccessMessage("Registrasi berhasil. Akun Anda sudah aktif, mengarahkan ke dashboard...");
      router.push(result.redirectTo ?? "/staff");
      router.refresh();
      return;
    }

    const result = await signInWithTableAccount({
      nim,
      password,
    });

    if (!result.ok) {
      setErrorMessage(result.message ?? "Login gagal.");
      setIsLoading(false);
      return;
    }

    router.push(result.redirectTo ?? ROLE_HOME.staff);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md border-slate-200/80 bg-white/90 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-2xl">{mode === "signin" ? "Login Internal BEM" : "Registrasi Akun BEM"}</CardTitle>
        <CardDescription>
          {mode === "signin"
            ? "Gunakan NIM dan password akun internal Anda."
            : "Daftarkan akun baru dengan NIM untuk bisa login ke depannya."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <>
              <div className="space-y-1">
                <label htmlFor="nama_lengkap" className="text-sm font-medium text-slate-700">
                  Nama Lengkap
                </label>
                <Input id="nama_lengkap" name="nama_lengkap" placeholder="contoh: Budi Santoso" autoComplete="name" />
              </div>

              <div className="space-y-1">
                <label htmlFor="role" className="text-sm font-medium text-slate-700">
                  Role / Jabatan
                </label>
                <select
                  id="role"
                  name="role"
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value as AppRole)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  {roleOptions.find((option) => option.value === selectedRole)?.description}
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="unit_id" className="text-sm font-medium text-slate-700">
                  Kementerian / Biro / Kemenko
                </label>
                <select id="unit_id" name="unit_id" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="">Pilih unit</option>
                  {filteredUnitOptions.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                        {unit.nama_unit}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          <div className="space-y-1">
            <label htmlFor="nim" className="text-sm font-medium text-slate-700">
              NIM
            </label>
            <Input id="nim" name="nim" placeholder="contoh: H1D024096" autoComplete="username" />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <Input id="password" name="password" type="password" autoComplete="current-password" />
          </div>

          {mode === "signup" ? (
            <div className="space-y-1">
              <label htmlFor="confirm_password" className="text-sm font-medium text-slate-700">
                Konfirmasi Password
              </label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
              />
            </div>
          ) : null}

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

          <Button className="w-full" type="submit" disabled={isLoading}>
            {mode === "signin" ? <LogIn className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {isLoading ? "Memproses..." : mode === "signin" ? "Sign In" : "Sign Up"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setMode((prev) => (prev === "signin" ? "signup" : "signin"));
              setSelectedRole(roleOptions[0]?.value ?? "staff");
              setErrorMessage("");
              setSuccessMessage("");
            }}
          >
            {mode === "signin" ? "Belum punya akun? Sign Up" : "Sudah punya akun? Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
