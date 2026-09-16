// Pemanggil endpoint pembaca meter AI.
// Di hosting Lovable (preview/produksi) dipanggil relatif; di Netlify (statis,
// tanpa server) diarahkan ke aplikasi Lovable yang sudah dipublikasikan.
export type AiMeterResult = {
  reading: number | null;
  confidence: "high" | "medium" | "low";
  notes: string;
};

const PUBLISHED_ORIGIN = "https://meterair-pamsimas.lovable.app";
const PATH = "/api/public/read-meter-ai";

function endpoint(): string {
  if (typeof window === "undefined") return PATH;
  const host = window.location.hostname;
  if (host.endsWith("lovable.app") || host === "localhost" || host === "127.0.0.1") {
    return PATH;
  }
  return `${PUBLISHED_ORIGIN}${PATH}`;
}

export async function callReadMeterAi(imageDataUrl: string): Promise<AiMeterResult> {
  let res: Response;
  try {
    res = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
    });
  } catch {
    throw new Error("Layanan AI tidak dapat dihubungi. Periksa koneksi internet.");
  }

  let body: (Partial<AiMeterResult> & { error?: string }) | null = null;
  try {
    body = (await res.json()) as Partial<AiMeterResult> & { error?: string };
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new Error(body?.error || "Layanan AI gagal membaca foto. Gunakan input manual.");
  }
  if (!body) throw new Error("Hasil AI tidak bisa dibaca.");

  const num = typeof body.reading === "number" && Number.isFinite(body.reading) ? body.reading : null;
  const conf = body.confidence === "high" || body.confidence === "medium" ? body.confidence : "low";
  return {
    reading: num != null && num >= 0 ? Math.round(num) : null,
    confidence: num == null ? "low" : conf,
    notes: typeof body.notes === "string" ? body.notes : "",
  };
}
