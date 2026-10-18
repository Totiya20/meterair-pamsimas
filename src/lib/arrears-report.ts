import { MONTHS, rupiah } from "./billing";

export type CustomerArrearsReport = {
  name: string;
  code: string;
  items: { month: number; year: number; amount: number; paid: boolean }[];
};

/** One source for the WhatsApp message and the customer's printed notice. */
export function customerArrearsReportText(report: CustomerArrearsReport, whatsapp = false) {
  const unpaid = report.items.filter((item) => !item.paid)
    .sort((a, b) => a.year - b.year || a.month - b.month);
  const total = unpaid.reduce((sum, item) => sum + Number(item.amount), 0);
  return [
    whatsapp ? "*LAPORAN TUNGGAKAN METERAN AIR*" : "LAPORAN TUNGGAKAN METERAN AIR",
    "",
    `Nama Pelanggan: ${report.name}`,
    `ID Pelanggan: ${report.code}`,
    `Bulan Tunggakan (${unpaid.length} bulan):`,
    ...unpaid.map((item) => `- ${MONTHS[item.month - 1]} ${item.year}: ${rupiah(Number(item.amount))}`),
    "",
    `Total Tunggakan: ${rupiah(total)}`,
    "",
    "Pembayaran dapat dilakukan melalui:",
    "- Rek BRI 722801000048560 an Pamsimas manguntirta",
    "- QRIS Pamsimas",
    "- Langsung ke bendahara Pamsimas",
    "",
    "Mohon segera melakukan pembayaran. Terima kasih.",
    whatsapp ? "_Pamsimas Mangun Tirta_" : "Pamsimas Mangun Tirta",
  ].join("\n");
}