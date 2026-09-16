import { createFileRoute } from "@tanstack/react-router";

// Endpoint publik pembaca meter AI. Dipanggil lintas-origin dari versi Netlify
// (yang tidak punya server sendiri) menuju aplikasi yang di-hosting Lovable.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `Kamu membaca angka pada meteran air (water meter) rumah tangga di Indonesia.
Aturan:
- Baca HANYA deret angka odometer hitam (m3). ABAIKAN dial merah kecil / angka desimal merah.
- Buang angka nol di depan (contoh 03730 -> 3730).
- Jika angka tidak jelas/terpotong/buram, kembalikan reading null.
Balas HANYA JSON valid dengan bentuk:
{"reading": number|null, "confidence": "high"|"medium"|"low", "notes": "penjelasan singkat bahasa Indonesia"}`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/read-meter-ai")({
  server: {
    handlers: {
      OPTIONS: async () => new Response("ok", { headers: CORS }),
      POST: async ({ request }) => {
        let imageDataUrl = "";
        try {
          const body = await request.json();
          imageDataUrl = String(body?.imageDataUrl ?? "");
        } catch {
          return json({ error: "Body tidak valid." }, 400);
        }
        if (!imageDataUrl.startsWith("data:image/")) {
          return json({ error: "Gambar tidak valid." }, 400);
        }
        // Batasi ukuran foto (~10MB data URL) agar endpoint tidak disalahgunakan.
        if (imageDataUrl.length > 14_000_000) {
          return json({ error: "Ukuran foto terlalu besar." }, 413);
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return json({ error: "Layanan AI belum dikonfigurasi di server." }, 500);
        }

        let res: Response;
        try {
          res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                    { type: "image_url", image_url: { url: imageDataUrl } },
                  ],
                },
              ],
            }),
          });
        } catch (e) {
          console.error("[read-meter-ai] fetch gagal", e);
          return json({ error: "Layanan AI tidak dapat dihubungi. Coba lagi." }, 502);
        }

        if (!res.ok) {
          const body = await res.text();
          console.error("[read-meter-ai]", res.status, body);
          if (res.status === 429) return json({ error: "Layanan AI sedang sibuk. Coba lagi sebentar lagi." }, 429);
          if (res.status === 402) return json({ error: "Kuota AI habis. Isi ulang kredit." }, 402);
          return json({ error: "Layanan AI gagal membaca foto." }, 502);
        }

        try {
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const text = data?.choices?.[0]?.message?.content ?? "";
          const match = text.match(/\{[\s\S]*\}/);
          if (!match) {
            return json({ reading: null, confidence: "low", notes: "Angka tidak terbaca oleh AI." });
          }
          const parsed = JSON.parse(match[0]) as {
            reading?: number | null;
            confidence?: string;
            notes?: string;
          };
          const num =
            typeof parsed.reading === "number" && Number.isFinite(parsed.reading) ? parsed.reading : null;
          const conf = parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low";
          return json({
            reading: num != null && num >= 0 ? Math.round(num) : null,
            confidence: num == null ? "low" : conf,
            notes: typeof parsed.notes === "string" ? parsed.notes : "",
          });
        } catch {
          return json({ reading: null, confidence: "low", notes: "Hasil AI tidak bisa dibaca." });
        }
      },
    },
  },
});
