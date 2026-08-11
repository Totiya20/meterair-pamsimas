// Rumus tagihan Pamsimas
export const ABONEMEN = 5000;
export const TAGIHAN_CAP = 100_000; // batas maksimal untuk pemakaian < 50 m³
export const HIGH_USAGE_THRESHOLD = 50; // m³
export const HIGH_USAGE_DISCOUNT = 0.5; // 50%

export type BillRule = "normal" | "batas" | "diskon";

export type Bill = {
  /** harga air murni (pemakaian × tarif) */
  hargaAir: number;
  abonemen: number;
  /** harga air + abonemen sebelum penyesuaian */
  base: number;
  /** tagihan akhir setelah batas / diskon */
  total: number;
  rule: BillRule;
};

export function computeBill(usage: number, tariff: number, abonemen: number = ABONEMEN): Bill {
  const u = Math.max(0, Number(usage) || 0);
  const hargaAir = Math.round(u * (Number(tariff) || 0));
  const base = hargaAir + abonemen;

  if (u >= HIGH_USAGE_THRESHOLD) {
    return { hargaAir, abonemen, base, total: Math.round(base * (1 - HIGH_USAGE_DISCOUNT)), rule: "diskon" };
  }
  if (base > TAGIHAN_CAP) {
    return { hargaAir, abonemen, base, total: TAGIHAN_CAP, rule: "batas" };
  }
  return { hargaAir, abonemen, base, total: base, rule: "normal" };
}

export const billRuleLabel = (rule: BillRule) =>
  rule === "diskon" ? "Diskon 50% (≥50 m³)" : rule === "batas" ? "Dibatasi Rp 100.000" : "";

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
