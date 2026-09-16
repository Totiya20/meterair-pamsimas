// Pemanggil endpoint pembaca meter AI.
// Diarahkan langsung ke Supabase Edge Function agar kompatibel 100% dengan Netlify.
export type AiMeterResult = {
  reading: number | null;
  confidence: "high" | "medium" | "low";
  notes: string;
};

// PERBAIKAN RUTE: Mengarahkan langsung ke Edge Function proyek Supabase Anda sendiri
const SUPABASE_URL = "https://supabase.co";
const PATH = "/functions/v1/read-meter-ai";

function endpoint(): string {
  // Langsung panggil URL Supabase yang sudah di-whitelist CORS-nya
  return `${SUPABASE_URL}${PATH}`;
}

export async function callReadMeterAi(imageDataUrl: string): Promise<AiMeterResult> {
  let res: Response;
  
  // Ambil token anon dari environment variable Netlify/Lovable untuk otentikasi ke Supabase
  const anonKey = (typeof window !== "undefined" && (window as any)._env_?.VITE_SUPABASE_ANON_KEY) || "";

  try {
    res = await fetch(endpoint(), {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`
      },
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
