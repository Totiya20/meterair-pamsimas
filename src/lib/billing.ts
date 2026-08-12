// Rumus tagihan Pamsimas
export const ABONEMEN = 5000;
export const TAGIHAN_CAP = 100_000; // batas maksimal untuk pemakaian < 50 m³
export const HIGH_USAGE_THRESHOLD = 50; // m³
export const HIGH_USAGE_DISCOUNT = 0.5; // 50%

export type BillRule = "normal" | "batas" | "diskon";

export type Bill = {
  /** tagihan per kubik SETELAH aturan batas/diskon (belum termasuk abonemen) */
  hargaAir: number;
  /** tagihan per kubik normal (pemakaian × tarif), sebelum aturan */
  hargaAirNormal: number;
  abonemen: number;
  /** harga air normal + abonemen (sebelum penyesuaian) */
  base: number;
  /** tagihan akhir = hargaAir (setelah aturan) + abonemen */
  total: number;
  rule: BillRule;
};

export function computeBill(usage: number, tariff: number, abonemen: number = ABONEMEN): Bill {
  const u = Math.max(0, Number(usage) || 0);
  const hargaAirNormal = Math.round(u * (Number(tariff) || 0));
  const base = hargaAirNormal + abonemen;

  let hargaAir = hargaAirNormal;
  let rule: BillRule = "normal";

  if (u >= HIGH_USAGE_THRESHOLD) {
    hargaAir = Math.round(hargaAirNormal * (1 - HIGH_USAGE_DISCOUNT));
    rule = "diskon";
  } else if (hargaAirNormal > TAGIHAN_CAP) {
    hargaAir = TAGIHAN_CAP;
    rule = "batas";
  }

  return { hargaAir, hargaAirNormal, abonemen, base, total: hargaAir + abonemen, rule };
}

export const billRuleLabel = (rule: BillRule) =>
  rule === "diskon" ? "Diskon 50% (≥50 m³)" : rule === "batas" ? "Dibatasi Rp 100.000" : "";


export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
