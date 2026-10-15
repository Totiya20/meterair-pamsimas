import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  onResult: (text: string) => void;
  onError?: (err: string) => void;
};

export function QrScanner({ onResult, onError }: Props) {
  const containerId = "qr-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    const el = document.getElementById(containerId);
    if (!el) return;
    const scanner = new Html5Qrcode(containerId, false);
    scannerRef.current = scanner;
    handledRef.current = false;

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
        // stop() melempar sinkron kalau scanner belum siap — jangan sampai
        // error ini merobohkan seluruh halaman.
        try {
          s.clear();
        } catch {
          /* abaikan */
        }
      }
    };

    scanner
      .start(
        { facingMode: { ideal: "environment" } },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          if (handledRef.current || cancelled) return;
          handledRef.current = true;
          onResult(text);
        },
        () => {},
      )
      .then(() => {
        if (cancelled) {
          running = true;
          shutdown();
          return;
        }
        running = true;
      })
      .catch((e) => {
        if (cancelled) return;
        onError?.(e instanceof Error ? e.message : "Tidak bisa membuka kamera");
      });

    return () => {
      cancelled = true;
      shutdown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id={containerId} className="w-full aspect-square bg-slate-900 rounded-xl overflow-hidden" />;
}
