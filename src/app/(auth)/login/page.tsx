import { LoginForm } from "@/components/auth/login-form";
import { getSignUpOptions } from "@/app/(auth)/login/actions";
import type { SignUpRoleOption, SignUpUnitOption } from "@/types/app";

export const dynamic = "force-dynamic";

const FALLBACK_ROLE_OPTIONS: SignUpRoleOption[] = [
  {
    value: "staff",
    label: "Staff",
    description: "Melihat rapor pribadi dan dapat ditugaskan sebagai penilai unit oleh admin.",
  },
  {
    value: "menteri",
    label: "Menteri / Kepala Biro",
    description: "Melihat rapor diri dan rapor staff unit.",
  },
  {
    value: "menko",
    label: "Menko",
    description: "Melihat rekap seluruh kementerian di bawah koordinasi kemenko.",
  },
  {
    value: "internship",
    label: "Intern / Internship (Cakrawala)",
    description: "Melihat rapor internship personal. Staf magang dari Biro PPM otomatis ditetapkan sebagai PJ PPM Intern.",
  },
];

const FALLBACK_UNIT_OPTIONS: SignUpUnitOption[] = [
  { id: "01e09287-4406-4b4c-b0a6-c1b3d360a0db", nama_unit: "Riset dan Media", kategori: "kemenko" },
  { id: "24a951aa-30b5-422c-90c1-6972f7fcd4af", nama_unit: "Relasi Publik", kategori: "kemenko" },
  { id: "795a8f48-9d46-4450-aa9d-04e60cc13fda", nama_unit: "Lingkar Presiden", kategori: "kemenko" },
  { id: "7e3682c4-69cc-4542-a07a-f90f8290a478", nama_unit: "Sekretaris Jenderal", kategori: "kemenko" },
  { id: "90cb7958-5ed5-43bf-a0d5-7b9ed13f2ae8", nama_unit: "Satuan Pengawas Internal", kategori: "kemenko" },
  { id: "a5263966-6d0f-4cc5-94e9-7c841ff3895c", nama_unit: "Politik Pergerakan", kategori: "kemenko" },
  { id: "f2530077-614f-4a74-a8b7-22a610dacc28", nama_unit: "Pemberdayaan Mahasiswa", kategori: "kemenko" },
  { id: "0d6effda-d23d-4d32-a843-ce0b02f8c69d", nama_unit: "Biro Pengembangan Sumber Daya Anggota", kategori: "biro" },
  { id: "174f90f4-1abe-4a29-aab8-efa23ef5568a", nama_unit: "Biro Keuangan", kategori: "biro" },
  { id: "72583272-f223-4793-b149-ff7f288b1df3", nama_unit: "Biro Pengendali & Penjamin Mutu", kategori: "biro" },
  { id: "ca7c7149-24c3-483b-8c23-1ae28a4628d2", nama_unit: "Biro Kesekretariatan", kategori: "biro" },
  { id: "26b12713-e918-4ed2-a3a7-65fe3da59b49", nama_unit: "Kementerian Pengabdian Masyarakat", kategori: "kementerian" },
  { id: "2aea1987-df84-498c-b0aa-001066adea69", nama_unit: "Kementerian Seni dan Olahraga", kategori: "kementerian" },
  { id: "795508d6-37c7-4061-970c-59463c108d96", nama_unit: "Kementerian Aksi dan Propaganda", kategori: "kementerian" },
  { id: "83087dce-0177-464e-b096-bd6f0816d103", nama_unit: "Kementerian Dalam Negeri", kategori: "kementerian" },
  { id: "85f07a72-d02d-4740-8537-52dd2743cc44", nama_unit: "Kementerian Advokasi Kesejahteraan Mahasiswa", kategori: "kementerian" },
  { id: "935c0ad9-af41-4cf7-b979-c19702253e58", nama_unit: "Kementerian Pemberdayaan Perempuan", kategori: "kementerian" },
  { id: "987a42ea-3f0f-49b6-920f-bec1d51c8148", nama_unit: "Kementerian Riset dan Data", kategori: "kementerian" },
  { id: "a3e1ea2e-f59f-4b4e-828d-e9e0a0fddb1d", nama_unit: "Kementerian Media Komunikasi dan Informasi", kategori: "kementerian" },
  { id: "afc73a52-b5d3-4570-93c7-a6f6eae6f14c", nama_unit: "Kementerian Prestasi dan Inovasi", kategori: "kementerian" },
  { id: "c6a7fb73-93bc-49cd-81b9-1edad084ca0b", nama_unit: "Kementerian Luar Negeri", kategori: "kementerian" },
  { id: "cb575e87-e747-411b-9b88-ec8ce8e9966a", nama_unit: "Kementerian Pengembangan Sumber Daya Mahasiswa", kategori: "kementerian" },
  { id: "d43d7ffc-1d1a-482f-b7c2-f7a51a4b33e1", nama_unit: "Kementerian Analisis Isu Strategis", kategori: "kementerian" },
  { id: "ec172080-c0f9-45a5-a2d4-85734f8f991a", nama_unit: "Kementerian Media Kreatif dan Aplikatif", kategori: "kementerian" },
];

export default async function LoginPage() {
  let roleOptions: SignUpRoleOption[] = FALLBACK_ROLE_OPTIONS;
  let unitOptions: SignUpUnitOption[] = FALLBACK_UNIT_OPTIONS;

  try {
    const options = await getSignUpOptions();
    if (options.roleOptions && options.roleOptions.length > 0) {
      roleOptions = options.roleOptions;
    }
    if (options.unitOptions && options.unitOptions.length > 0) {
      unitOptions = options.unitOptions;
    }
  } catch {
    // Keep fallbacks if database query encounters an issue
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#dbeafe,transparent_60%)]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
      <LoginForm roleOptions={roleOptions} unitOptions={unitOptions} />
    </main>
  );
}
