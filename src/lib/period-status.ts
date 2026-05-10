export function isPublishedStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "published" || normalized === "publish";
}
