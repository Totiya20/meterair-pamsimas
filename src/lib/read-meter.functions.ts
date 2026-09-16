import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  imageDataUrl: z.string().min(32),
});

export type AiMeterResult = {
  reading: number | null;
  confidence: "high" | "medium" | "low";
  notes: string;
};

const PROMPT = `Kamu membaca angka pada meteran air (water meter) rumah tangga di Indonesia.
Aturan:
- Baca HANYA deret angka odometer hitam (m3). ABAIKAN dial merah kecil / angka desimal merah.
- Buang angka nol di depan (contoh 03730 -> 3730).
- Jika angka tidak jelas/terpotong/buram, kembalikan reading null.
Balas HANYA JSON valid dengan bentuk:
{"reading": number|null, "confidence": "high"|"medium"|"low", "notes": "penjelasan singkat bahasa Indonesia"}`;

export const readMeterAi = createServerFn({ method: "POST" })
  .inputValidator(input)
  .handler(async ({ data }): Promise<AiMeterResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Layanan AI belum aktif. Gunakan input manual.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[read-meter-ai]", res.status, body);
      if (res.status === 429) throw new Error("Layanan AI sedang sibuk. Coba lagi sebentar lagi atau isi manual.");
      if (res.status === 402) throw new Error("Kuota AI habis. Isi ulang kredit atau gunakan input manual.");
      throw new Error("Layanan AI gagal membaca foto. Gunakan input manual.");
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { reading: null, confidence: "low", notes: "Angka tidak terbaca oleh AI." };

    try {
      const parsed = JSON.parse(match[0]) as Partial<AiMeterResult>;
      const num = typeof parsed.reading === "number" && Number.isFinite(parsed.reading) ? parsed.reading : null;
      const conf: AiMeterResult["confidence"] =
        parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low";
      return {
        reading: num != null && num >= 0 ? Math.round(num) : null,
        confidence: num == null ? "low" : conf,
        notes: typeof parsed.notes === "string" ? parsed.notes : "",
      };
    } catch {
      return { reading: null, confidence: "low", notes: "Hasil AI tidak bisa dibaca." };
    }
  });
