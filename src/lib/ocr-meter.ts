/**
 * OCR meter air di sisi klien (browser) memakai Tesseract.js.
 * Tidak butuh API key. Library dimuat secara lazy hanya saat dipakai.
 */

export type OcrResult = {
  reading: number | null;
  confidence: "high" | "medium" | "low";
  notes: string;
  rawText: string;
};

/** Perbesar + grayscale + kontras tinggi agar angka odometer lebih mudah dibaca. */
export function preprocessForOcr(source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement, crop?: { x: number; y: number; w: number; h: number }): HTMLCanvasElement {
  const srcW = crop?.w ?? (source as HTMLVideoElement).videoWidth ?? (source as HTMLImageElement).naturalWidth ?? (source as HTMLCanvasElement).width;
  const srcH = crop?.h ?? (source as HTMLVideoElement).videoHeight ?? (source as HTMLImageElement).naturalHeight ?? (source as HTMLCanvasElement).height;
  const sx = crop?.x ?? 0;
  const sy = crop?.y ?? 0;

  const scale = Math.max(1, Math.min(4, 1200 / Math.max(1, srcW)));
  const out = document.createElement("canvas");
  out.width = Math.round(srcW * scale);
  out.height = Math.round(srcH * scale);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, srcW, srcH, 0, 0, out.width, out.height);

  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  // grayscale + hitung rata-rata untuk threshold adaptif sederhana
  let sum = 0;
  const gray = new Uint8ClampedArray(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray[j] = g;
    sum += g;
  }
  const mean = sum / gray.length;
  // kontras: tarik menjauh dari rata-rata
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    let v = (gray[j] - mean) * 1.8 + mean;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Ambil kandidat angka meteran dari teks OCR mentah. */
export function extractMeterNumber(raw: string): { value: number | null; confidence: OcrResult["confidence"] } {
  const cleaned = raw
    .replace(/[OoDQ]/g, "0")
    .replace(/[Il|!]/g, "1")
    .replace(/[Ss$]/g, "5")
    .replace(/[Bb]/g, "8")
    .replace(/[Zz]/g, "2");
  const groups = cleaned.match(/\d[\d\s.,]*\d|\d/g) ?? [];
  const candidates = groups
    .map((g) => g.replace(/[\s.,]/g, ""))
    .filter((g) => g.length >= 3 && g.length <= 8);
  if (candidates.length === 0) return { value: null, confidence: "low" };
  // Angka meter biasanya 4–7 digit; pilih yang terpanjang (odometer utama)
  candidates.sort((a, b) => b.length - a.length);
  const best = candidates[0];
  const value = Number(best);
  if (!Number.isFinite(value)) return { value: null, confidence: "low" };
  const confidence: OcrResult["confidence"] =
    best.length >= 4 && best.length <= 7 && candidates.length === 1 ? "high" : best.length >= 4 ? "medium" : "low";
  return { value, confidence };
}

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789",
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function ocrMeter(canvas: HTMLCanvasElement): Promise<OcrResult> {
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas);
  const rawText = (data.text ?? "").trim();
  const { value, confidence } = extractMeterNumber(rawText);
  return {
    reading: value,
    confidence,
    notes:
      value == null
        ? "Angka tidak terdeteksi. Dekatkan kamera & pastikan angka di dalam kotak panduan."
        : `Hasil OCR: "${rawText.replace(/\s+/g, " ").slice(0, 40)}"`,
    rawText,
  };
}
