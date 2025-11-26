
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Search, Zap, AlertCircle, RefreshCw, CameraOff, Lock, Check, X, Keyboard, ZoomIn } from 'lucide-react';
import { Product } from '../types';

interface ScannerProps {
  onScan: (product: Product) => void;
  inventory: Map<string, Product>;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, inventory }) => {
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [manualInputOpen, setManualInputOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  
  const [lastScannedItem, setLastScannedItem] = useState<Product | null>(null);
  
  const [permissionError, setPermissionError] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Zoom State
  const [zoomCap, setZoomCap] = useState<{min: number, max: number, step: number} | null>(null);
  const [zoom, setZoom] = useState(1);
  
  // Use a stable unique ID for the reader element
  const regionId = useRef(`reader-${Math.random().toString(36).substr(2, 9)}`).current;
  const isMounted = useRef(false);

  // Audio feedback
  const playBeep = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1200; // Hz
        osc.type = 'sine';
        gain.gain.value = 0.1;
        osc.start();
        setTimeout(() => {
            osc.stop();
            ctx.close();
        }, 150);
    } catch (e) {
        // Audio blocked
    }
  };

  const processCode = useCallback(async (code: string) => {
    if (!code) return;
    
    // Normalize input
    const cleanCode = code.trim();

    playBeep();
    
    // Stop scanning immediately (trigger mode)
    setIsScanningActive(false);

    // 1. Try direct lookup
    let product = inventory.get(cleanCode);

    // 2. Fallback search
    if (!product) {
         const searchLower = cleanCode.toLowerCase();
         for (const p of inventory.values()) {
             if (p.ean === cleanCode || 
                 p.code.toLowerCase() === searchLower || 
                 p.code.toLowerCase().endsWith(searchLower)
             ) {
                 product = p;
                 break;
             }
         }
    }

    if (!product) {
         product = {
            ean: cleanCode,
            code: cleanCode,
            description: `Articolo sconosciuto`,
            brand: 'GEN',
            price: 0,
            unit: 'PZ'
        };
    }
    
    setLastScannedItem(product);
    onScan(product);
    
    // Auto-hide toast
    setTimeout(() => {
        if (isMounted.current) setLastScannedItem(null);
    }, 4000);

  }, [inventory, onScan]);

  // Handle Manual Input Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.length > 2) {
        processCode(manualCode);
        setManualCode('');
        setManualInputOpen(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Sync state to Ref for the engine
  const activeRef = useRef(isScanningActive);
  useEffect(() => { activeRef.current = isScanningActive; }, [isScanningActive]);

  return (
    <div className="flex flex-col h-full bg-black text-white relative overflow-hidden">
      <ScannerEngine 
        regionId={regionId} 
        activeRef={activeRef} 
        onCodeFound={processCode}
        setCameraReady={setCameraReady}
        setPermissionError={setPermissionError}
        setInitError={setInitError}
        torchOn={torchOn}
        setZoomCap={setZoomCap}
        zoom={zoom}
      />

      {/* Main UI Overlay */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between pointer-events-none">
        
        {/* TOP BAR */}
        <div className="p-4 pt-safe-top flex justify-between items-start pointer-events-auto bg-gradient-to-b from-black/60 to-transparent pb-12">
            
            {cameraReady && (
                <button 
                    onClick={() => setTorchOn(!torchOn)}
                    className={`ml-auto w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${
                        torchOn ? 'bg-yellow-400 text-black border-yellow-300' : 'bg-white/10 text-white border-white/20'
                    }`}
                >
                    <Zap size={24} fill={torchOn ? "currentColor" : "none"} />
                </button>
            )}
        </div>

        {/* CENTER SCAN AREA */}
        <div className="flex-1 flex flex-col items-center justify-start pt-10 relative">
            
            {/* Manual Input Trigger (Floating Card) */}
            <div className="pointer-events-auto mb-8 animate-in fade-in slide-in-from-top-4">
                 <button 
                    onClick={() => setManualInputOpen(true)}
                    className="flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-full pl-4 pr-6 py-3 text-white/90 hover:bg-black/60 transition-all shadow-lg active:scale-95"
                 >
                    <Keyboard size={20} className="text-blue-400" />
                    <span className="font-medium text-sm">Inserisci a mano...</span>
                 </button>
            </div>

            {/* The "Box" is always there but dims/lights up */}
            <div className={`w-[280px] h-[280px] rounded-[3rem] border-[4px] transition-all duration-300 relative flex items-center justify-center ${
                isScanningActive 
                ? 'border-blue-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]' // Darken outside when active
                : 'border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.2)]' // Lighter overlay when idle
            }`}>
                
                {/* Idle Text */}
                {!isScanningActive && (
                    <div className="text-white/70 text-center px-6 animate-in fade-in">
                        <p className="text-sm font-medium tracking-wide">PRONTO</p>
                    </div>
                )}

                {/* Active Laser */}
                {isScanningActive && (
                    <>
                        <div className="absolute inset-0 rounded-[2.5rem] border border-blue-500/50 animate-pulse"></div>
                        <div className="absolute left-4 right-4 h-0.5 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,1)] animate-scan"></div>
                    </>
                )}
            </div>

            {/* ZOOM CONTROLS (Right Side) */}
            {cameraReady && zoomCap && (
                <div className="absolute right-4 top-1/2 translate-y-8 pointer-events-auto flex flex-col items-center gap-2">
                    <div className="bg-black/40 backdrop-blur-md rounded-full py-4 px-1.5 border border-white/10 flex flex-col items-center">
                         <span className="text-[10px] font-bold mb-2 opacity-80">{zoomCap.max}x</span>
                         {/* Vertical Slider Wrapper */}
                         <div className="h-40 w-6 flex items-center justify-center relative">
                             <input 
                                type="range" 
                                min={zoomCap.min} 
                                max={zoomCap.max} 
                                step={zoomCap.step} 
                                value={zoom} 
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="absolute w-40 h-6 -rotate-90 origin-center appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-runnable-track]:w-full [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-white/30 [&::-webkit-slider-runnable-track]:rounded-full"
                             />
                         </div>
                         <span className="text-[10px] font-bold mt-2 opacity-80">{zoomCap.min}x</span>
                    </div>
                    <div className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-md text-xs font-bold border border-white/10">
                        {zoom.toFixed(1)}x
                    </div>
                </div>
            )}
        </div>

        {/* BOTTOM CONTROLS */}
        <div className="p-6 pb-32 pointer-events-auto flex justify-center items-center bg-gradient-to-t from-black/80 to-transparent pt-12">
            {/* TRIGGER BUTTON */}
            <button 
                onClick={() => setIsScanningActive(!isScanningActive)}
                className={`w-24 h-24 rounded-full border-[6px] transition-all duration-200 shadow-2xl flex items-center justify-center active:scale-95 ${
                    isScanningActive 
                    ? 'bg-red-500 border-red-200 animate-pulse' 
                    : 'bg-white border-gray-200 hover:bg-gray-100'
                }`}
            >
                {isScanningActive ? (
                    <X size={40} className="text-white" />
                ) : (
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-inner">
                        <div className="w-6 h-6 border-2 border-white rounded-sm"></div>
                    </div>
                )}
            </button>
        </div>
      </div>

      {/* MANUAL INPUT MODAL */}
      {manualInputOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-24 px-6 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative border border-white/20">
                  <button 
                    onClick={() => setManualInputOpen(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"
                  >
                      <X size={24} />
                  </button>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Inserimento Manuale</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">Digita il codice articolo o EAN</p>
                  
                  <form onSubmit={handleManualSubmit}>
                      <div className="relative mb-6">
                          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                          <input 
                            autoFocus
                            type="text"
                            value={manualCode}
                            onChange={e => setManualCode(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-slate-800 border-2 border-transparent focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 rounded-xl py-3 pl-12 pr-4 text-lg font-mono outline-none text-slate-900 dark:text-white transition-all"
                            placeholder="Codice..."
                          />
                      </div>
                      <button 
                        type="submit" 
                        disabled={manualCode.length < 2}
                        className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all"
                      >
                          Cerca e Aggiungi
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* SUCCESS TOAST */}
      {lastScannedItem && (
        <div className="absolute top-8 left-4 right-4 z-50 animate-in slide-in-from-top-4 duration-300">
            <div className="bg-white rounded-2xl shadow-2xl p-4 border border-blue-100 flex gap-4 items-center">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                    <Check size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 truncate">{lastScannedItem.description}</h4>
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                            {lastScannedItem.code}
                        </span>
                        <span className="font-bold text-blue-600">
                            € {lastScannedItem.price.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Errors */}
      {(permissionError || initError) && (
          <div className="absolute inset-0 z-40 bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
                  <CameraOff size={40} />
              </div>
              <h3 className="text-white text-2xl font-bold mb-2">Errore Fotocamera</h3>
              <p className="text-gray-400 mb-8">{initError || "Accesso negato. Controlla i permessi."}</p>
              <button onClick={() => window.location.reload()} className="bg-white text-black px-8 py-3 rounded-full font-bold">Ricarica</button>
          </div>
      )}

      <style>{`
        @keyframes scan-line {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan {
          animation: scan-line 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

// Separated Engine to handle the weird html5-qrcode lifecycle without re-rendering the whole UI
const ScannerEngine = ({ 
    regionId, activeRef, onCodeFound, setCameraReady, 
    setPermissionError, setInitError, torchOn, 
    setZoomCap, zoom 
}: any) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        const html5QrCode = new Html5Qrcode(regionId);
        scannerRef.current = html5QrCode;

        html5QrCode.start(
            { facingMode: "environment" },
            { 
                fps: 20, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0, 
                disableFlip: false 
            },
            (decodedText) => {
                if (activeRef.current === true) {
                    onCodeFound(decodedText);
                }
            },
            () => {}
        ).then(() => {
            setCameraReady(true);
            
            // Check Capabilities for ZOOM after a small delay to ensure stream is active
            setTimeout(() => {
                try {
                    // Try to access the video element created by html5-qrcode
                    const videoElement = document.querySelector(`#${regionId} video`) as HTMLVideoElement;
                    if (videoElement && videoElement.srcObject) {
                        const stream = videoElement.srcObject as MediaStream;
                        const track = stream.getVideoTracks()[0];
                        const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
                        
                        // If zoom is supported
                        if (caps.zoom) {
                            setZoomCap({
                                min: caps.zoom.min,
                                max: caps.zoom.max,
                                step: caps.zoom.step
                            });
                        }
                    }
                } catch (e) {
                    console.debug("Capability check failed", e);
                }
            }, 500);

        }).catch((err: any) => {
            const msg = err?.message || "";
            if (!msg.includes("play")) {
                if (msg.includes("Permission")) setPermissionError(true);
                else setInitError(msg);
            }
        });

        // SAFE CLEANUP
        return () => {
            const performCleanup = async () => {
                // Critical: Stop must be awaited before Clear can be called
                if (html5QrCode.isScanning) {
                    try {
                        await html5QrCode.stop();
                    } catch (e) {
                        console.debug("Scanner stop error (harmless):", e);
                    }
                }
                
                try {
                    html5QrCode.clear();
                } catch (e) {
                    console.debug("Scanner clear error:", e);
                }
            };
            performCleanup();
        };
    }, []);

    // Handle Torch
    useEffect(() => {
        if (scannerRef.current) {
            try {
                scannerRef.current.applyVideoConstraints({
                    advanced: [{ torch: !!torchOn }]
                } as any).catch(e => console.debug(e));
            } catch(e) {}
        }
    }, [torchOn]);

    // Handle Zoom
    useEffect(() => {
        if (scannerRef.current && zoom) {
             try {
                scannerRef.current.applyVideoConstraints({
                    advanced: [{ zoom: zoom }]
                } as any).catch(e => console.debug(e));
             } catch(e) {}
        }
    }, [zoom]);

    return <div id={regionId} className="w-full h-full object-cover bg-black" />;
};

export default Scanner;
