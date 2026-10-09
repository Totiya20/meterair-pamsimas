// Pemanggil endpoint pembaca meter AI.
// Menggunakan import metadata bawaan agar token terbaca 100% lancar di Lovable & Netlify.
export type AiMeterResult = {
  reading: number | null;
  confidence: "high" | "medium" | "low";
  notes: string;
};

// Endpoint AI berjalan di server aplikasi Lovable. Versi Netlify (statis, tanpa server)
// memanggil endpoint publik yang sama secara lintas-origin (CORS diizinkan).
const LOVABLE_APP_URL = "https://meterair-pamsimas.lovable.app";
const PATH = "/api/public/read-meter-ai";

function endpoint(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.endsWith(".lovable.app") || host === "localhost" || host === "127.0.0.1") {
      return PATH; // aplikasi Lovable / dev: pakai server sendiri
    }
  }
  return `${LOVABLE_APP_URL}${PATH}`; // Netlify & hosting lain
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
