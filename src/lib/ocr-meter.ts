/**
 * OCR meter air di sisi klien (browser) memakai Tesseract.js.
 * Tidak butuh API key. Library dimuat secara lazy hanya saat dipakai.
 */

export type OcrResult = {
  reading: number | null;
  confidence: "high" | "medium" | "low";
  score: number;
  notes: string;
  rawText: string;
};

export type PreprocessOptions = {
  /** faktor kontras (1 = tanpa perubahan) */
  contrast?: number;
  /** offset threshold biner relatif terhadap rata-rata kecerahan */
  thresholdOffset?: number;
  /** aktifkan penajaman ringan */
  sharpen?: boolean;
  /** binarisasi hitam-putih */
  binarize?: boolean;
};

/** Perbesar + grayscale + kontras + binarisasi agar angka odometer lebih mudah dibaca. */
export function preprocessForOcr(
  source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  opts: PreprocessOptions = {},
): HTMLCanvasElement {
  const { contrast = 1.8, thresholdOffset = 0, sharpen = true, binarize = true } = opts;

  const srcW =
    (source as HTMLVideoElement).videoWidth ||
    (source as HTMLImageElement).naturalWidth ||
    (source as HTMLCanvasElement).width;
  const srcH =
    (source as HTMLVideoElement).videoHeight ||
    (source as HTMLImageElement).naturalHeight ||
    (source as HTMLCanvasElement).height;

  const scale = Math.max(1, Math.min(4, 1000 / Math.max(1, srcW)));
  const out = document.createElement("canvas");
  out.width = Math.round(srcW * scale);
  out.height = Math.round(srcH * scale);
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, srcW, srcH, 0, 0, out.width, out.height);

  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const w = out.width;
  const h = out.height;

  // grayscale
  const gray = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray[j] = g;
    sum += g;
  }
  const mean = sum / gray.length;

  // sharpening ringan (unsharp mask 3x3)
  let work = gray;
  if (sharpen) {
    const sharpened = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          sharpened[idx] = gray[idx];
          continue;
        }
        const c = gray[idx];
        const s =
          5 * c - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w];
        sharpened[idx] = s < 0 ? 0 : s > 255 ? 255 : s;
      }
    }
    work = sharpened;
  }

  // kontras + (opsional) binarisasi
  const threshold = mean + thresholdOffset;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    let v = (work[j] - mean) * contrast + mean;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    if (binarize) v = v < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Ukur kualitas gambar: rasio piksel silau, kegelapan, dan ketajaman (variance gradien). */
export function analyzeQuality(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  sampleWidth = 160,
): { glare: number; dark: number; brightness: number; sharpness: number } {
  const srcW =
    (source as HTMLVideoElement).videoWidth ||
    (source as HTMLImageElement).naturalWidth ||
    (source as HTMLCanvasElement).width;
  const srcH =
    (source as HTMLVideoElement).videoHeight ||
    (source as HTMLImageElement).naturalHeight ||
    (source as HTMLCanvasElement).height;
  if (!srcW || !srcH) return { glare: 0, dark: 0, brightness: 0, sharpness: 0 };

  const w = Math.min(sampleWidth, srcW);
  const h = Math.max(1, Math.round((srcH / srcW) * w));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, srcW, srcH, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  const gray = new Float32Array(w * h);
  let bright = 0;
  let glare = 0;
  let dark = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray[j] = g;
    bright += g;
    if (g > 245) glare++;
    if (g < 45) dark++;
  }
  // ketajaman: rata-rata magnitudo gradien
  let grad = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      grad += Math.abs(gray[idx] - gray[idx + 1]) + Math.abs(gray[idx] - gray[idx + w]);
      n++;
    }
  }
  return {
    glare: glare / gray.length,
    dark: dark / gray.length,
    brightness: bright / gray.length,
    sharpness: n ? grad / n : 0,
  };
}

export type QualityVerdict = {
  ok: boolean;
  level: "good" | "warn" | "bad";
  message: string;
};

export function judgeQuality(q: ReturnType<typeof analyzeQuality>): QualityVerdict {
  if (q.glare > 0.12)
    return { ok: false, level: "bad", message: "Terdeteksi pantulan cahaya — ubah sudut foto" };
  if (q.brightness < 55 || q.dark > 0.6)
    return { ok: false, level: "bad", message: "Terlalu gelap — dekatkan cahaya" };
  if (q.sharpness < 4)
    return { ok: false, level: "warn", message: "Gambar kurang tajam — tahan HP lebih stabil" };
  if (q.glare > 0.05 || q.brightness > 215)
    return { ok: true, level: "warn", message: "Sedikit silau — geser sedikit sudutnya" };
  return { ok: true, level: "good", message: "Siap dipotret" };
}

/** Ambil kandidat angka meteran dari teks OCR mentah. */
export function extractMeterNumber(raw: string): { value: number | null; digits: string } {
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
  if (candidates.length === 0) return { value: null, digits: "" };
  candidates.sort((a, b) => b.length - a.length);
  const best = candidates[0];
  const value = Number(best);
  if (!Number.isFinite(value)) return { value: null, digits: best };
  return { value, digits: best };
}

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789",
        // PSM 7 = anggap gambar sebagai satu baris teks
        tessedit_pageseg_mode: "7" as never,
      });
      return worker;
    })();
  }
  return workerPromise;
}

const VARIANTS: PreprocessOptions[] = [
  { contrast: 1.8, thresholdOffset: 0 },
  { contrast: 2.4, thresholdOffset: -18 },
  { contrast: 1.4, thresholdOffset: 14, binarize: false },
];

async function runOnce(
  crop: HTMLCanvasElement,
  opts: PreprocessOptions,
  psm: "7" | "8",
): Promise<{ value: number | null; digits: string; score: number; rawText: string }> {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: psm as never });
  const processed = preprocessForOcr(crop, opts);
  const { data } = await worker.recognize(processed);
  const rawText = (data.text ?? "").trim();
  const { value, digits } = extractMeterNumber(rawText);
  const score = typeof data.confidence === "number" ? data.confidence : 0;
  return { value, digits, score, rawText };
}

const HIGH = 80;
const MIN_ACCEPT = 70;

/**
 * Jalankan OCR pada area crop. Mencoba beberapa parameter preprocessing dan
 * mengambil hasil dengan confidence tertinggi (tidak digabung).
 */
export async function ocrMeter(crop: HTMLCanvasElement): Promise<OcrResult> {
  const attempts: { value: number | null; digits: string; score: number; rawText: string }[] = [];

  for (let i = 0; i < VARIANTS.length; i++) {
    const psm: "7" | "8" = i === 2 ? "8" : "7";
    try {
      const r = await runOnce(crop, VARIANTS[i], psm);
      attempts.push(r);
      // berhenti lebih awal bila sudah yakin
      if (r.value != null && r.score >= HIGH && r.digits.length >= 4) break;
    } catch {
      /* lanjut ke varian berikutnya */
    }
  }

  const valid = attempts.filter((a) => a.value != null);
  const best = (valid.length ? valid : attempts).sort((a, b) => b.score - a.score)[0];

  if (!best || best.value == null) {
    return {
      reading: null,
      confidence: "low",
      score: best?.score ?? 0,
      notes: "Angka tidak terdeteksi. Dekatkan kamera & pastikan angka di dalam kotak panduan.",
      rawText: best?.rawText ?? "",
    };
  }

  if (best.score < MIN_ACCEPT) {
    return {
      reading: null,
      confidence: "low",
      score: best.score,
      notes: `Keyakinan OCR terlalu rendah (${Math.round(best.score)}%). Silakan isi manual.`,
      rawText: best.rawText,
    };
  }

  const confidence: OcrResult["confidence"] = best.score >= HIGH ? "high" : "medium";
  return {
    reading: best.value,
    confidence,
    score: best.score,
    notes: `Terbaca "${best.digits}" dengan keyakinan ${Math.round(best.score)}%.`,
    rawText: best.rawText,
  };
}
