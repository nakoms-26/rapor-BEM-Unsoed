"use client";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  raporId: string;
  raporName: string;
};

export function DeleteRaporForm({ action, raporId, raporName }: Props) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const ok = window.confirm(`Yakin ingin menghapus rapor untuk ${raporName}?`);
        if (!ok) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="rapor_id" value={raporId} />
      <button
        type="submit"
        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
      >
        Hapus
      </button>
    </form>
  );
}