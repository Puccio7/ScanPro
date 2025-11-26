
import React, { useRef, useState, useMemo } from 'react';
import { Upload, FileText, AlertTriangle, Loader2, Folder, Search, Trash2, ArrowLeft, Eye, WifiOff, FileSpreadsheet, X, Moon, Sun } from 'lucide-react';
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
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

const ImportFile: React.FC<ImportFileProps> = ({ onImport, batches, onDeleteBatch, isOnline, theme, onToggleTheme }) => {
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
          <div className="p-4 h-full flex flex-col bg-white dark:bg-slate-900 transition-colors duration-300">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-slate-800">
                  <button 
                    onClick={() => {
                        setSelectedBatchId(null);
                        setSearchTerm('');
                        setViewLimit(50);
                    }}
                    className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700"
                  >
                      <ArrowLeft size={20} className="text-slate-700 dark:text-slate-200" />
                  </button>
                  <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-lg text-slate-800 dark:text-white truncate">{selectedBatch.fileName}</h2>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{selectedBatch.products.length} articoli</p>
                  </div>
              </div>

              <div className="relative mb-4">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input 
                      type="text"
                      placeholder="Cerca in questo file (Codice, Sigla, EAN)..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-gray-400"
                  />
              </div>

              <div className="flex-1 overflow-auto border border-gray-200 dark:border-slate-700 rounded-xl relative">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-bold text-xs uppercase sticky top-0 z-10 shadow-sm">
                          <tr>
                              <th className="px-3 py-3 border-b dark:border-slate-700">Codice</th>
                              <th className="px-3 py-3 border-b dark:border-slate-700">Sigla (Brand)</th>
                              <th className="px-3 py-3 border-b dark:border-slate-700">Descrizione</th>
                              <th className="px-3 py-3 text-right border-b dark:border-slate-700">Min Qty</th>
                              <th className="px-3 py-3 text-right border-b dark:border-slate-700">Prezzo</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                          {filteredBatchItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-blue-50 dark:hover:bg-slate-800/50">
                                  <td className="px-3 py-2 font-mono font-medium text-slate-800 dark:text-slate-200">{item.code}</td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{item.brand}</td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[150px] truncate" title={item.description}>{item.description}</td>
                                  <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-500">{item.minQty || '-'}</td>
                                  <td className="px-3 py-2 text-right font-bold text-blue-600 dark:text-blue-400">
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
                        className="mt-4 w-full py-2 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium"
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
      
      {/* SECTION 1: Theme & Header */}
      <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Carica Listino</h2>
          
          {onToggleTheme && (
            <button 
                onClick={onToggleTheme}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 rounded-full text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors"
            >
                {theme === 'dark' ? <Moon size={18} className="text-blue-400" /> : <Sun size={18} className="text-orange-400" />}
                <span>{theme === 'dark' ? 'Tema Scuro' : 'Tema Chiaro'}</span>
            </button>
          )}
      </div>

      {/* SECTION 2: Import File */}
      <div>
        <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                loading ? 'bg-gray-50 border-gray-300 dark:bg-slate-900 dark:border-slate-700' : 'border-blue-300 bg-blue-50 dark:bg-slate-800/50 dark:border-slate-600 hover:bg-blue-100 dark:hover:bg-slate-800 hover:border-blue-400'
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
                    <Upload className="w-10 h-10 text-blue-500 dark:text-blue-400" />
                    <FileSpreadsheet className="w-10 h-10 text-green-500 dark:text-green-400" />
                </div>
            )}
            
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 text-sm max-w-[200px]">
                {loading ? 'Lettura in corso...' : 'Tocca per caricare file METEL (TXT), CSV o Excel (XLS/X)'}
            </h3>
        </div>

        <div className={`mt-3 flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border transition-all ${!isOnline ? 'border-gray-100 dark:border-slate-800 opacity-60' : 'border-gray-200 dark:border-slate-700'}`}>
            <div className="flex items-center gap-2">
                <FileText size={16} className={useAI ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'} />
                <div className="flex-1">
                    <p className="font-medium text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        AI Magic Parse (Sperimentale)
                        {!isOnline && <span className="text-red-500 flex items-center gap-1 text-[9px] border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded"><WifiOff size={8}/> Offline</span>}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">Usalo se il file è molto disordinato</p>
                </div>
            </div>
            <button 
                onClick={() => isOnline && setUseAI(!useAI)}
                disabled={!isOnline}
                className={`w-8 h-4 rounded-full p-0.5 transition-colors ${useAI ? 'bg-purple-600' : 'bg-gray-300 dark:bg-slate-700'}`}
            >
                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${useAI ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
        </div>

        {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-start gap-2 border border-red-100 dark:border-red-900/50">
                <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                <p>{error}</p>
            </div>
        )}
      </div>

      {/* SECTION 3: Batches List (Folders) */}
      <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3">Listini Caricati ({batches.length})</h3>
          
          <div className="space-y-3">
              {batches.length === 0 ? (
                  <div className="text-center p-8 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
                      <Folder className="mx-auto text-gray-300 dark:text-slate-600 mb-2" size={32} />
                      <p className="text-gray-400 dark:text-slate-500 text-sm">Nessun listino presente.</p>
                  </div>
              ) : (
                  batches.map((batch) => (
                      <div key={batch.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between group relative overflow-hidden transition-colors">
                          <div 
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                            onClick={() => setSelectedBatchId(batch.id)}
                          >
                              <div className="w-10 h-10 bg-blue-50 dark:bg-slate-800 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                  <Folder size={20} />
                              </div>
                              <div className="min-w-0">
                                  <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{batch.fileName}</h4>
                                  <p className="text-xs text-gray-500 dark:text-slate-500">
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
                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
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
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                     >
                                         <Eye size={18} />
                                     </button>
                                     <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteId(batch.id);
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
