import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  imageDataUrl: z.string().min(20),
});

export const readWaterMeter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Anda pembaca meter air analog/digital. Tugas: baca angka pemakaian utama (odometer hitam dengan latar putih) yang menunjukkan meter kubik (m³). ABAIKAN dial bulat merah kecil (itu pecahan liter, bukan m³ utama). ABAIKAN nomor seri, nomor ISO, dan teks teknis lain. Kembalikan HANYA JSON: {\"reading\": <number>, \"confidence\": \"high\"|\"medium\"|\"low\", \"notes\": \"<catatan singkat dalam bahasa Indonesia>\"}. Jika angka utama tidak terlihat / buram / bukan meter air, gunakan reading: null dan jelaskan di notes. Jangan tambahkan teks apa pun di luar JSON.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Baca angka meter air pada foto ini." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Terlalu banyak permintaan. Coba lagi sebentar.");
    if (res.status === 402) throw new Error("Kredit AI habis. Silakan top-up workspace.");
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI error: ${res.status} ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { reading: number | null; confidence?: string; notes?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Respons AI tidak valid.");
    }
    return parsed;
  });
