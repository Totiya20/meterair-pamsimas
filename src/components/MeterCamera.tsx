import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, ImageUp, Loader2 } from "lucide-react";
import { analyzeQuality, judgeQuality, type QualityVerdict } from "@/lib/ocr-meter";
import { toast } from "sonner";

type Props = {
  /** Dipanggil dengan canvas hasil crop area kotak panduan + data URL preview penuh. */
  onCapture: (crop: HTMLCanvasElement, previewDataUrl: string) => void;
  onCancel?: () => void;
  busy?: boolean;
};

/** Proporsi kotak panduan relatif terhadap tampilan video. */
const BOX_W = 0.8;
const BOX_H = 0.22;

export function MeterCamera({ onCapture, onCancel, busy }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const forceRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityVerdict | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kamera tidak bisa dibuka.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  /** Cek kualitas area kotak panduan secara berkala (ringan: sampel kecil). */
  useEffect(() => {
    if (!ready || error || busy) return;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const box = boxCanvas(v, v.videoWidth, v.videoHeight, 240);
      if (!box) return;
      setQuality(judgeQuality(analyzeQuality(box, 160)));
    }, 700);
    return () => window.clearInterval(id);
  }, [ready, error, busy]);

  /** Ambil hanya area kotak panduan sebagai canvas (opsi lebar maksimum untuk sampling ringan). */
  function boxCanvas(
    src: HTMLVideoElement | HTMLImageElement,
    w: number,
    h: number,
    maxWidth?: number,
  ): HTMLCanvasElement | null {
    let visibleX = 0;
    let visibleY = 0;
    let visibleW = w;
    let visibleH = h;

    // Video memakai object-cover. Petakan kotak panduan layar ke bagian frame asli
    // yang benar-benar terlihat agar crop OCR tidak meleset pada kamera 16:9.
    if (src instanceof HTMLVideoElement) {
      const displayW = src.clientWidth;
      const displayH = src.clientHeight;
      if (displayW > 0 && displayH > 0) {
        const frameRatio = w / h;
        const displayRatio = displayW / displayH;
        if (frameRatio > displayRatio) {
          visibleW = h * displayRatio;
          visibleX = (w - visibleW) / 2;
        } else if (frameRatio < displayRatio) {
          visibleH = w / displayRatio;
          visibleY = (h - visibleH) / 2;
        }
      }
    }

    const bw = Math.round(visibleW * BOX_W);
    const bh = Math.round(visibleH * BOX_H);
    if (bw < 1 || bh < 1) return null;
    const bx = Math.round(visibleX + (visibleW - bw) / 2);
    const by = Math.round(visibleY + (visibleH - bh) / 2);
    const scale = maxWidth ? Math.min(1, maxWidth / bw) : 1;
    const crop = document.createElement("canvas");
    crop.width = Math.max(1, Math.round(bw * scale));
    crop.height = Math.max(1, Math.round(bh * scale));
    const ctx = crop.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(src, bx, by, bw, bh, 0, 0, crop.width, crop.height);
    return crop;
  }

  function cropFromSource(src: HTMLVideoElement | HTMLImageElement, w: number, h: number) {
    const crop = boxCanvas(src, w, h);
    if (!crop) return null;

    const full = document.createElement("canvas");
    full.width = w;
    full.height = h;
    const fctx = full.getContext("2d");
    if (!fctx) return null;
    fctx.drawImage(src, 0, 0, w, h);
    return { crop, preview: full.toDataURL("image/jpeg", 0.85) };
  }

  /** Kembalikan true bila boleh lanjut OCR. */
  function passesPreCheck(crop: HTMLCanvasElement) {
    const verdict = judgeQuality(analyzeQuality(crop, 200));
    if (verdict.ok || forceRef.current) {
      forceRef.current = false;
      return true;
    }
    forceRef.current = true;
    toast.warning(`${verdict.message}. Tekan "Potret" sekali lagi untuk tetap lanjut, atau isi manual.`);
    return false;
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const captured = cropFromSource(v, v.videoWidth, v.videoHeight);
    if (!captured) return;
    const { crop, preview } = captured;
    if (!passesPreCheck(crop)) return;
    onCapture(crop, preview);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const captured = cropFromSource(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      if (!captured) return;
      const { crop, preview } = captured;
      if (!passesPreCheck(crop)) return;
      onCapture(crop, preview);
    };
    img.src = url;
  }

  const level = quality?.level ?? "warn";
  const boxColor = level === "good" ? "#22c55e" : level === "warn" ? "#facc15" : "#ef4444";

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-slate-900">
        {!error ? (
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-slate-300">
            {error}. Gunakan tombol "Ambil dari galeri" di bawah.
          </div>
        )}

        {/* Overlay gelap + kotak panduan di tengah */}
        {!error && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg transition-colors"
              style={{
                width: `${BOX_W * 100}%`,
                height: `${BOX_H * 100}%`,
                border: `2px solid ${boxColor}`,
                boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)",
              }}
            />
            <p className="absolute left-0 right-0 top-[18%] text-center text-xs font-medium text-white drop-shadow">
              Posisikan angka meteran di dalam kotak
            </p>
            <p
              className="absolute left-0 right-0 bottom-[20%] text-center text-xs font-semibold drop-shadow"
              style={{ color: boxColor }}
            >
              {quality?.message ?? "Menilai kondisi foto…"}
            </p>
          </div>
        )}

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-white backdrop-blur-sm">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm font-medium">AI sedang membaca angka…</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button className="flex-1 h-11" onClick={capture} disabled={!ready || busy || !!error}>
          <Camera className="h-4 w-4 mr-2" /> Potret
        </Button>
        <Button variant="outline" className="h-11" onClick={() => fileRef.current?.click()} disabled={busy}>
          <ImageUp className="h-4 w-4 mr-1" /> Galeri
        </Button>
        {onCancel && (
          <Button variant="ghost" className="h-11" onClick={onCancel} disabled={busy}>
            Batal
          </Button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
