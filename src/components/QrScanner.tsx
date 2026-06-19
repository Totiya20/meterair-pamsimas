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
    const el = document.getElementById(containerId);
    if (!el) return;
    const scanner = new Html5Qrcode(containerId, false);
    scannerRef.current = scanner;
    handledRef.current = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          if (handledRef.current || cancelled) return;
          handledRef.current = true;
          onResult(text);
        },
        () => {},
      )
      .catch((e) => {
        if (cancelled) return;
        onError?.(e instanceof Error ? e.message : "Tidak bisa membuka kamera");
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => {
          try { s.clear(); } catch {}
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id={containerId} className="w-full aspect-square bg-slate-900 rounded-xl overflow-hidden" />;
}
