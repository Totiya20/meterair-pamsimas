import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onResult: (text: string) => void;
  onError?: (err: string) => void;
};

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  const name = (e as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || /denied|permission/i.test(msg)) {
    return "Izin kamera ditolak. Ketuk ikon gembok di kolom alamat browser, izinkan kamera, lalu tekan Coba lagi.";
  }
  if (name === "NotFoundError" || /not found|no camera/i.test(msg)) {
    return "Kamera tidak ditemukan di perangkat ini.";
  }
  if (name === "NotReadableError" || /in use|busy/i.test(msg)) {
    return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi.";
  }
  if (/insecure|https/i.test(msg)) {
    return "Kamera hanya bisa dibuka lewat koneksi aman (HTTPS).";
  }
  return "Tidak bisa membuka kamera. Coba lagi atau gunakan input manual.";
}

export function QrScanner({ onResult, onError }: Props) {
  const containerId = "qr-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const start = useCallback(async () => {
    const el = document.getElementById(containerId);
    if (!el) return;
    setError(null);
    handledRef.current = false;

    const scanner = new Html5Qrcode(containerId, false);
    scannerRef.current = scanner;

    // Paksa kamera belakang; kalau gagal, coba varian lain agar kamera tetap terbuka.
    const constraints: MediaTrackConstraints[] = [
      { facingMode: { exact: "environment" } },
      { facingMode: { ideal: "environment" } },
      { facingMode: "environment" },
      {},
    ];

    let lastErr: unknown = null;
    for (const c of constraints) {
      try {
        await scanner.start(
          c,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            if (handledRef.current) return;
            handledRef.current = true;
            onResult(text);
          },
          () => {},
        );
        return;
      } catch (e) {
        lastErr = e;
        // Kalau izin ditolak, percobaan varian lain tidak akan membantu.
        const name = (e as { name?: string })?.name ?? "";
        if (name === "NotAllowedError") break;
      }
    }

    const msg = friendlyError(lastErr);
    setError(msg);
    onError?.(msg);
  }, [onResult, onError]);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    const scanner = scannerRef.current;

    const shutdown = () => {
      const s = scannerRef.current;
      if (!s) return;
      try {
        if (running) {
          s.stop()
            .catch(() => {})
            .finally(() => {
              try {
                s.clear();
              } catch {
                /* sudah dibersihkan */
              }
            });
        } else {
          try {
            s.clear();
          } catch {
            /* kamera belum sempat dibuka */
          }
        }
      } catch {
        try {
          s.clear();
        } catch {
          /* abaikan */
        }
      }
    };

    void (async () => {
      await start();
      if (cancelled) {
        running = true;
        shutdown();
        return;
      }
      running = true;
    })();

    return () => {
      cancelled = true;
      shutdown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <div className="space-y-3">
      <div
        id={containerId}
        className="w-full aspect-square bg-slate-900 rounded-xl overflow-hidden"
      />
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-2">
          <div className="flex items-start gap-2">
            <Camera className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setAttempt((a) => a + 1)}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Coba lagi
          </Button>
        </div>
      )}
    </div>
  );
}
