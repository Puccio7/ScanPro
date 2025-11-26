
import React, { useRef, useState, useMemo } from 'react';
import { Upload, FileText, AlertTriangle, Loader2, Folder, Search, Download, Share, Monitor, Trash2, ArrowLeft, Eye, Menu, PlusSquare, ExternalLink, WifiOff, FileSpreadsheet, X, Smartphone, ArrowUpRight } from 'lucide-react';
import { parseMetelOrCsv } from '../utils/parsers';
import { parseUnstructuredData } from '../services/gemini';
import { Product, ImportBatch } from '../types';
import * as XLSX from 'xlsx';

interface ImportFileProps {
  onImport: (products: Product[], fileName: string) => void;
  batches: ImportBatch[];
  onDeleteBatch: (id: string) => void;
  deferredPrompt?: any;
  isOnline: boolean;
}

const ImportFile: React.FC<ImportFileProps> = ({ onImport, batches, onDeleteBatch, deferredPrompt, isOnline }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Detail View State
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [viewLimit, setViewLimit] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Delete Confirmation State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Check if we are inside an iframe (like the editor preview)
  const isInIframe = window.self !== window.top;

  const openInNewTab = () => {
      window.open(window.location.href, '_blank');
  };

  const processContent = async (text: string, fileName: string) => {
    try {
        let products: Product[] = [];

        if (useAI && isOnline) {
           const result = await parseUnstructuredData(text);
           products = result.products.map(p => ({
               ...p,
               unit: 'PZ',
               price: typeof p.price === 'number' ? p.price : 0
           }));
        } else {
           products = parseMetelOrCsv(text);
        }

        if (products.length === 0) {
            setError("Nessun prodotto valido trovato. Assicurati di seguire l'ordine colonne: Brand, Codice, EAN, Descrizione, MinQty, Prezzo.");
        } else {
            onImport(products, fileName);
        }
      } catch (err) {
        console.error(err);
        setError("Errore durante l'analisi del file.");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const fileNameLower = file.name.toLowerCase();

    // Check if it's an Excel file (case insensitive)
    if (fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.xlsx')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Read first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Use sheet_to_json with raw: false to get formatted strings.
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
                
                if (!jsonData || jsonData.length === 0) {
                     throw new Error("Empty Excel sheet");
                }

                const csvText = jsonData.map((row: any) => {
                     if (!Array.isArray(row)) return "";
                     return row.map(cell => {
                         if (cell === null || cell === undefined) return "";
                         return String(cell).replace(/[\t\n\r]/g, " ").trim();
                     }).join("\t");
                }).join("\n");
                
                processContent(csvText, file.name);
            } catch (err) {
                console.error("Excel parse error:", err);
                setError("Errore lettura Excel. Il file potrebbe essere corrotto o vuoto.");
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    } 
    // Handle Text/CSV
    else {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            processContent(text, file.name);
        };
        reader.readAsText(file);
    }
  };

  const handleInstallClick = () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
    }
  };

  // --- Logic for Detail View ---
  const selectedBatch = useMemo(() => 
      batches.find(b => b.id === selectedBatchId), 
  [batches, selectedBatchId]);

  const filteredBatchItems = useMemo(() => {
      if (!selectedBatch) return [];
      let items = selectedBatch.products;
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          items = items.filter(p => 
              p.code.toLowerCase().includes(lower) || 
              p.brand.toLowerCase().includes(lower) ||
              p.ean.includes(lower) ||
              p.description.toLowerCase().includes(lower)
          );
      }
      return items.slice(0, viewLimit);
  }, [selectedBatch, searchTerm, viewLimit]);

  // --- RENDER DETAIL VIEW ---
  if (selectedBatch) {
      return (
          <div className="p-4 h-full flex flex-col bg-white">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                  <button 
                    onClick={() => {
                        setSelectedBatchId(null);
                        setSearchTerm('');
                        setViewLimit(50);
                    }}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                  >
                      <ArrowLeft size={20} className="text-slate-700" />
                  </button>
                  <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-lg text-slate-800 truncate">{selectedBatch.fileName}</h2>
                      <p className="text-xs text-gray-500">{selectedBatch.products.length} articoli</p>
                  </div>
              </div>

              <div className="relative mb-4">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input 
                      type="text"
                      placeholder="Cerca in questo file (Codice, Sigla, EAN)..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
              </div>

              <div className="flex-1 overflow-auto border border-gray-200 rounded-xl relative">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase sticky top-0 z-10 shadow-sm">
                          <tr>
                              <th className="px-3 py-3 bg-gray-50 border-b">Codice</th>
                              <th className="px-3 py-3 bg-gray-50 border-b">Sigla (Brand)</th>
                              <th className="px-3 py-3 bg-gray-50 border-b">Descrizione</th>
                              <th className="px-3 py-3 text-right bg-gray-50 border-b">Min Qty</th>
                              <th className="px-3 py-3 text-right bg-gray-50 border-b">Prezzo</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {filteredBatchItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-blue-50">
                                  <td className="px-3 py-2 font-mono font-medium text-slate-800">{item.code}</td>
                                  <td className="px-3 py-2 text-slate-600">{item.brand}</td>
                                  <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate" title={item.description}>{item.description}</td>
                                  <td className="px-3 py-2 text-right text-slate-500">{item.minQty || '-'}</td>
                                  <td className="px-3 py-2 text-right font-bold text-blue-600">
                                    {item.price.toFixed(2)}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {filteredBatchItems.length === 0 && (
                      <div className="p-8 text-center text-gray-400">Nessun articolo trovato</div>
                  )}
              </div>

              {selectedBatch.products.length > viewLimit && (
                   <button 
                        onClick={() => setViewLimit(prev => prev + 50)}
                        className="mt-4 w-full py-2 bg-gray-100 text-slate-600 rounded-lg text-sm font-medium"
                   >
                       Carica altri
                   </button>
              )}
          </div>
      );
  }

  // --- RENDER MAIN IMPORT VIEW ---
  return (
    <div className="p-6 pb-24 space-y-8">
      
      {/* SECTION 1: Install App (Redesigned logic) */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
              <Download size={100} />
          </div>

          <div className="relative z-10">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                <Smartphone size={24} className="text-blue-400" />
                Scarica ScanOrder Pro
            </h3>
            
            {isInIframe ? (
                // IFRAME WARNING VIEW
                <div className="mt-4 bg-orange-500/20 border border-orange-500/50 p-4 rounded-xl backdrop-blur-sm animate-pulse">
                    <p className="text-orange-300 text-sm font-bold mb-3 flex items-center gap-2">
                         <AlertTriangle size={18} /> APRI PER INSTALLARE
                    </p>
                    <div className="text-slate-200 text-xs space-y-3 leading-relaxed mb-4">
                        <p>Non puoi installare l'app da questa anteprima.</p>
                        <p>Clicca il pulsante qui sotto per aprire la pagina di installazione in una nuova scheda.</p>
                    </div>
                    
                    <button 
                        onClick={openInNewTab}
                        className="w-full bg-white text-orange-900 font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors shadow-lg"
                    >
                        Apri Pagina di Installazione <ExternalLink size={16} />
                    </button>
                </div>
            ) : (
                // STANDALONE INSTALL VIEW
                <>
                    <p className="text-slate-300 text-sm mb-6 max-w-xs">
                        Installa l'app per usarla a tutto schermo e offline.
                    </p>

                    {/* Primary Button */}
                    <button 
                        onClick={handleInstallClick}
                        disabled={!deferredPrompt}
                        className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 mb-4 shadow-lg ${
                            deferredPrompt 
                            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95' 
                            : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                        }`}
                    >
                        <Download size={20} />
                        {deferredPrompt ? 'Installa Applicazione' : 'Installa (Segui istruzioni sotto)'}
                    </button>

                    {/* Manual Instructions */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Se il tasto sopra è grigio:</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* iOS Guide */}
                            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                                <p className="font-bold text-white mb-2 flex items-center gap-1"><span className="text-lg">🍎</span> iPhone / iPad</p>
                                <ol className="list-decimal list-inside space-y-2 text-slate-300 text-xs leading-relaxed">
                                    <li>Premi <span className="inline-flex items-center gap-1 bg-blue-600/30 px-1.5 py-0.5 rounded text-blue-200"><Share size={10}/> Condividi</span> (basso)</li>
                                    <li>Tocca <span className="inline-flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded text-white"><PlusSquare size={10}/> Aggiungi a Home</span></li>
                                </ol>
                            </div>
                            
                            {/* Android Guide */}
                            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                                <p className="font-bold text-white mb-2 flex items-center gap-1"><span className="text-lg">🤖</span> Android</p>
                                <ol className="list-decimal list-inside space-y-2 text-slate-300 text-xs leading-relaxed">
                                    <li>Premi <span className="inline-flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded text-white"><Menu size={10}/> Menu</span> (3 puntini alto)</li>
                                    <li>Seleziona <b>"Installa app"</b> o <b>"Aggiungi a schermata Home"</b></li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </>
            )}
          </div>
      </div>

      {/* SECTION 2: Import File */}
      <div>
        <h2 className="text-2xl font-bold mb-4 text-slate-800">Carica Listino</h2>
        <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                loading ? 'bg-gray-50 border-gray-300' : 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400'
            }`}
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".txt,.csv,.xls,.xlsx"
            />
            
            {loading ? (
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
            ) : (
                <div className="flex gap-2 mb-3">
                    <Upload className="w-10 h-10 text-blue-500" />
                    <FileSpreadsheet className="w-10 h-10 text-green-500" />
                </div>
            )}
            
            <h3 className="font-semibold text-blue-900 text-sm max-w-[200px]">
                {loading ? 'Lettura in corso...' : 'Tocca per caricare file METEL (TXT), CSV o Excel (XLS/X)'}
            </h3>
        </div>

        <div className={`mt-3 flex items-center justify-between bg-white p-3 rounded-xl border transition-all ${!isOnline ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
                <FileText size={16} className={useAI ? 'text-purple-600' : 'text-gray-400'} />
                <div className="flex-1">
                    <p className="font-medium text-xs text-slate-700 flex items-center gap-2">
                        AI Magic Parse (Sperimentale)
                        {!isOnline && <span className="text-red-500 flex items-center gap-1 text-[9px] border border-red-100 bg-red-50 px-1.5 py-0.5 rounded"><WifiOff size={8}/> Offline</span>}
                    </p>
                    <p className="text-[10px] text-gray-400">Usalo se il file è molto disordinato</p>
                </div>
            </div>
            <button 
                onClick={() => isOnline && setUseAI(!useAI)}
                disabled={!isOnline}
                className={`w-8 h-4 rounded-full p-0.5 transition-colors ${useAI ? 'bg-purple-600' : 'bg-gray-300'}`}
            >
                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${useAI ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
        </div>

        {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-2 border border-red-100">
                <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                <p>{error}</p>
            </div>
        )}
      </div>

      {/* SECTION 3: Batches List (Folders) */}
      <div>
          <h3 className="text-lg font-bold text-slate-800 mb-3">Listini Caricati ({batches.length})</h3>
          
          <div className="space-y-3">
              {batches.length === 0 ? (
                  <div className="text-center p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <Folder className="mx-auto text-gray-300 mb-2" size={32} />
                      <p className="text-gray-400 text-sm">Nessun listino presente.</p>
                  </div>
              ) : (
                  batches.map((batch) => (
                      <div key={batch.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group relative overflow-hidden">
                          <div 
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                            onClick={() => setSelectedBatchId(batch.id)}
                          >
                              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
                                  <Folder size={20} />
                              </div>
                              <div className="min-w-0">
                                  <h4 className="font-bold text-slate-800 text-sm truncate">{batch.fileName}</h4>
                                  <p className="text-xs text-gray-500">
                                      {new Date(batch.timestamp).toLocaleDateString()} • {batch.products.length} articoli
                                  </p>
                              </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-2">
                             {confirmDeleteId === batch.id ? (
                                <>
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteBatch(batch.id);
                                            setConfirmDeleteId(null);
                                        }}
                                        className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-red-700 transition-colors animate-in fade-in slide-in-from-right-2"
                                    >
                                        Elimina
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteId(null);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-gray-100"
                                    >
                                        <X size={18} />
                                    </button>
                                </>
                             ) : (
                                <>
                                     <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedBatchId(batch.id);
                                        }}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                     >
                                         <Eye size={18} />
                                     </button>
                                     <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteId(batch.id);
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                     >
                                         <Trash2 size={18} />
                                     </button>
                                </>
                             )}
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
    </div>
  );
};

export default ImportFile;
