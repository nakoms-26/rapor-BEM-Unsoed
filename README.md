# Rapor BEM Bulanan

Internal BEM Management System untuk pelaporan performa bulanan dengan struktur unit bertingkat (Kemenko -> Kementerian/Biro), input indikator dinamis, dashboard berbasis peran, dan autentikasi berbasis tabel akun internal.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + komponen bergaya Shadcn
- Supabase PostgreSQL
- Recharts (dashboard Menko)
- React Hook Form + useFieldArray (dynamic sub-indicator form)

## Struktur Utama

- src/app/(auth)/login: halaman login NIM + password
- src/app/(dashboard)/admin: form input rapor dinamis untuk Admin
- src/app/(dashboard)/menko: dashboard rekap unit koordinasi
- src/app/(dashboard)/menteri: dashboard rekap 1 kementerian/biro milik menteri
- src/app/(dashboard)/staff: tampilan rapor personal staf
- supabase/migrations: SQL schema + RLS policy

## Setup Lokal

1. Install dependency

npm install

2. Salin env dari contoh

copy .env.example .env.local

3. Isi variabel Supabase di .env.local

- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

4. Jalankan migration SQL

Eksekusi file berikut di SQL Editor Supabase secara berurutan:

- supabase/migrations/20260316160000_init_bem_rapor.sql
- supabase/migrations/20260317001000_table_auth_accounts_sessions.sql
- supabase/migrations/20260317004000_drop_supabase_auth_legacy.sql
- supabase/migrations/20260328001000_role_model_pres_menko_menteri_staff.sql
- supabase/migrations/20260328002000_backfill_legacy_roles.sql
- supabase/migrations/20260328003000_seed_units_bem26_org_structure.sql
- supabase/migrations/20260328004000_seed_rapor_periods_2026.sql
- supabase/migrations/20260328005000_add_catatan_to_rapor_scores.sql
- supabase/migrations/20260328006000_hardening_constraints_indexes_cleanup.sql

5. Jalankan aplikasi

npm run dev

6. Buat akun admin pertama

Contoh:

npm run create:admin -- --nim H1D024096 --name "Admin BEM" --password "secret123" --role admin --unit "Biro PPM"

## Catatan Auth NIM

Halaman login menggunakan tabel akun internal (`app_accounts`) dan sesi cookie (`app_sessions`).

Contoh NIM yang valid: H1D024096.

## Registrasi Akun (Sign Up)

- Klik tombol Sign Up di halaman login.
- Isi Nama Lengkap, NIM, Role/Jabatan, Unit, Password, dan Konfirmasi Password.
- Sistem akan membuat profil awal jika NIM belum ada, lalu menyimpan hash password di `app_accounts`.
- Setelah berhasil, sistem membuat sesi login di `app_sessions` dan langsung mengarahkan ke dashboard sesuai role.
- Untuk bootstrap akun admin pertama, gunakan script `npm run create:admin` agar hash password cocok dengan aplikasi.

## Model Role

- admin: input rapor dan akses lintas unit
- pres_wapres: akses pemantauan lintas unit
- menko: rekap seluruh unit kementerian di bawah koordinasi kemenko-nya
- menteri: rekap 1 unit kementerian/biro miliknya
- staff: hanya melihat rapor pribadi

## Catatan Legacy

- File migration `20260316173000_auth_signup_profile_trigger.sql` adalah legacy dari Supabase Auth lama.
- Cleanup final sekarang dilakukan oleh `20260317004000_drop_supabase_auth_legacy.sql`.
# rapor-BEM-Unsoed
