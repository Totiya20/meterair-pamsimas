import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { customerArrearsReportText, type CustomerArrearsReport } from "./arrears-report";

export function createCustomerArrearsPdf(report: CustomerArrearsReport): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const lines = customerArrearsReportText(report).split("\n");
  let y = 20;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bold = i === 0 || line.startsWith("Total Tunggakan:");
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(i === 0 ? 14 : 11);
    const wrapped: string[] = doc.splitTextToSize(line, 174);
    for (const part of wrapped) {
      if (y > 277) { doc.addPage(); y = 20; }
      doc.text(part, 18, y);
      y += 6;
    }
  }
  return doc.output("blob");
}

type DirectoryCustomer = {
  customer_code: string; name: string; address: string; phone: string; last_reading: number;
};

export function createCustomerDirectoryPdf(customers: DirectoryCustomer[], date: string, search: string): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("LAPORAN DAFTAR PELANGGAN", 148.5, 16, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("MeterAir Pamsimas - Pamsimas Mangun Tirta", 148.5, 23, { align: "center" });
  const details = [`Tanggal cetak: ${date}`, `Total: ${customers.length} pelanggan`];
  if (search.trim()) details.push(`Pencarian: ${search.trim()}`);
  const wrapped: string[] = doc.splitTextToSize(details.join("\n"), 269);
  doc.text(wrapped, 14, 32);
  autoTable(doc, {
    startY: 34 + wrapped.length * 5,
    margin: { top: 14, bottom: 18, left: 14, right: 14 },
    head: [["No", "Kode", "Nama Pelanggan", "Alamat", "No. HP", "Meter Terakhir (m3)"]],
    body: customers.map((c, i) => [i + 1, c.customer_code, c.name, c.address || "-", c.phone || "-", Number(c.last_reading).toLocaleString("id-ID")]),
    styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [14, 116, 144] },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 32 }, 2: { cellWidth: 58 }, 3: { cellWidth: 88 }, 4: { cellWidth: 39 }, 5: { cellWidth: 40, halign: "right" } },
    rowPageBreak: "avoid",
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.text(`Halaman ${doc.getNumberOfPages()}`, 283, 202, { align: "right" });
    },
  });
  return doc.output("blob");
}

/** Invoke synchronously from the click: iOS uses Save to Files in its share sheet. */
export async function saveReportPdf(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (error) { if (error instanceof Error && error.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}