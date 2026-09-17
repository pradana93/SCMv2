import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CameraOff, X, CheckCircle2, AlertCircle, LoaderCircle, ScanLine } from "lucide-react";

/**
 * BarcodeScanner — kamera HP untuk scan barcode (Code128, EAN13, EAN8, QR, dll).
 * Props:
 *  - onScan(barcode): called when a barcode is detected
 *  - onClose(): close scanner
 *  - matchFn?(barcode): optional, returns { found: boolean, label: string } to show match status
 *  - title?: string
 */
export default function BarcodeScanner({ onScan, onClose, matchFn, title = "Scan Barcode" }) {
  const containerId = "barcode-scanner-region";
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [lastScan, setLastScan] = useState("");
  const [matchInfo, setMatchInfo] = useState(null);
  const [manualValue, setManualValue] = useState("");
  const lastScanRef = useRef("");
  const lastTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const matchFnRef = useRef(matchFn);
  matchFnRef.current = matchFn;

  const handleResult = useCallback((decodedText) => {
    const now = Date.now();
    // Shorter debounce allows faster re-scanning of different barcodes (1200ms).
    if (decodedText === lastScanRef.current && now - lastTimeRef.current < 1200) return;
    lastScanRef.current = decodedText;
    lastTimeRef.current = now;
    setLastScan(decodedText);
    if (matchFnRef.current) {
      const m = matchFnRef.current(decodedText);
      setMatchInfo(m);
    } else {
      setMatchInfo({ found: true, label: decodedText });
    }
    onScanRef.current(decodedText);
  }, []);

  useEffect(() => {
    let active = true;
    const startCamera = async () => {
      try {
        const html5Qrcode = new Html5Qrcode(containerId, {
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
          ],
        });
        scannerRef.current = html5Qrcode;
        // Higher fps + dynamic qrbox (adapts to viewport) → faster, more accurate detection.
        const config = {
          fps: 25,
          qrbox: (vw, vh) => {
            const w = Math.min(Math.floor(vw * 0.88), 420);
            const h = Math.min(Math.floor(vh * 0.34), 220);
            return { width: w, height: h };
          },
          aspectRatio: 1.333,
        };
        await html5Qrcode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => { if (active) handleResult(decodedText); },
          () => {}
        );
        if (active) setScanning(true);
      } catch (e) {
        if (active) setError("Tidak bisa mengakses kamera. Pastikan izin kamera diberikan. Anda bisa input barcode manual di bawah.");
      }
    };
    startCamera();
    return () => {
      active = false;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [handleResult]);

  const submitManual = () => {
    const v = manualValue.trim();
    if (!v) return;
    handleResult(v);
    setManualValue("");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-4 py-3.5 text-white backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300"><ScanLine className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-semibold leading-tight">{title}</p>
            <p className="text-[11px] text-slate-400">Arahkan kamera ke barcode</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 transition hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>

      {/* Camera viewport */}
      <div className="relative flex-1 overflow-hidden bg-slate-950">
        <div id={containerId} className="h-full w-full" />

        {!scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 text-white">
            <div className="flex flex-col items-center gap-3">
              <LoaderCircle className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-slate-300">Memulai kamera...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/95 p-6 text-center">
            <div className="flex max-w-xs flex-col items-center gap-3 text-white">
              <CameraOff className="h-10 w-10 text-rose-400" />
              <p className="text-sm text-slate-300">{error}</p>
            </div>
          </div>
        )}

        {/* Scan frame overlay */}
        {scanning && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-44 w-64">
              {/* dark mask via box-shadow */}
              <div className="absolute inset-0 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
              {/* corner indicators */}
              <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-xl border-l-4 border-t-4 border-indigo-400" />
              <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-xl border-r-4 border-t-4 border-indigo-400" />
              <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-xl border-b-4 border-l-4 border-indigo-400" />
              <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-xl border-b-4 border-r-4 border-indigo-400" />
              {/* animated scan line */}
              <span className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse rounded-full bg-indigo-400 shadow-[0_0_8px_2px_rgba(129,140,248,0.6)]" />
            </div>
          </div>
        )}

        {/* Hint */}
        {scanning && !error && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/70 px-4 py-1.5 text-center text-xs font-medium text-slate-200 backdrop-blur">
            Posisikan barcode di dalam bingkai
          </div>
        )}
      </div>

      {/* Scan result feedback */}
      {lastScan && (
        <div className="border-t border-white/10 bg-slate-900/90 px-4 py-3 text-white backdrop-blur">
          <div className="flex items-center gap-2.5">
            {matchInfo?.found ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{lastScan}</p>
              {matchInfo?.label && <p className={`truncate text-xs ${matchInfo.found ? "text-emerald-300" : "text-rose-300"}`}>{matchInfo.label}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Manual input */}
      <div className="border-t border-white/10 bg-slate-900 px-4 py-3.5">
        <p className="mb-2 text-center text-xs text-slate-400">Atau ketik barcode manual</p>
        <div className="flex gap-2">
          <input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitManual()}
            placeholder="Ketik barcode..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
            autoFocus
          />
          <button onClick={submitManual} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Enter</button>
        </div>
      </div>
    </div>
  );
}