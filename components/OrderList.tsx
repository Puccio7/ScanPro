
import React, { useState } from 'react';
import { Trash2, Send, FileOutput, Minus, Plus, X, Tag, FileText, Share2, FileCode, AlertTriangle } from 'lucide-react';
import { CartItem } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderListProps {
  items: CartItem[];
  onUpdateQuantity: (ean: string, delta: number) => void;
  onClear: () => void;
}

const OrderList: React.FC<OrderListProps> = ({ items, onUpdateQuantity, onClear }) => {
  const [selectedItem, setSelectedItem] = useState<CartItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalValue = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleExportCSV = () => {
    const header = "Codice;Descrizione;Marca;Quantità;Prezzo Unitario;Totale\n";
    const rows = items.map(item => 
        `${item.code};${item.description};${item.brand};${item.quantity};${item.price.toFixed(2)};${(item.price * item.quantity).toFixed(2)}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `ordine_${new Date().toISOString().slice(0,10)}.csv`);
    link.click();
  };

  const handleExportMexal = () => {
    const rows = items.map(item => 
        `${item.code};${item.quantity};${item.price.toFixed(2).replace('.', ',')}`
    ).join("\r\n");
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `import_mexal_${new Date().toISOString().slice(0,10)}.csv`);
    link.click();
  };

  const handleShare = async () => {
      const text = items.map(i => `${i.quantity}pz - ${i.code} - ${i.description}`).join('\n');
      if (navigator.share) await navigator.share({ title: 'Ordine ScanOrder', text });
      else alert("Copiato negli appunti");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('it-IT');
    // Simple PDF logic
    doc.text("Ordine ScanOrder Pro", 14, 22);
    doc.text(`Totale: € ${totalValue.toFixed(2)}`, 14, 30);
    const body = items.map(i => [i.code, i.brand, i.description.substring(0,30), i.quantity, i.price.toFixed(2)]);
    autoTable(doc, { head: [["Codice", "Brand", "Desc", "Qta", "Prezzo"]], body, startY: 35 });
    doc.save('ordine.pdf');
  };

  if (items.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <div className="w-32 h-32 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-slate-200 dark:shadow-none">
                <FileOutput className="text-slate-300 dark:text-slate-600 w-16 h-16" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Carrello Vuoto</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Vai allo scanner per iniziare ad aggiungere prodotti alla tua lista.</p>
        </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative transition-colors duration-300">
      
      {/* Scrollable List Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-64">
        {items.sort((a,b) => b.timestamp - a.timestamp).map((item) => (
            <div 
                key={item.ean} 
                onClick={() => setSelectedItem(item)}
                className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 active:scale-[0.98] transition-all"
            >
                <div className="flex justify-between items-start mb-2">
                     <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                        {item.brand || 'GEN'}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">€ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
                
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug mb-1">{item.description}</h4>
                <p className="text-xs text-slate-400 font-mono mb-3">{item.code}</p>

                <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-2">
                    <p className="text-[10px] text-slate-400">€ {item.price.toFixed(2)} cad.</p>
                    <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg p-0.5 gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.ean, -1); }}
                            className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-600 dark:text-white active:bg-slate-100 dark:active:bg-slate-600"
                        >
                            {item.quantity === 1 ? <Trash2 size={14} className="text-red-500" /> : <Minus size={14} />}
                        </button>
                        <span className="font-bold text-slate-800 dark:text-white w-4 text-center text-sm">{item.quantity}</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.ean, 1); }}
                            className="w-7 h-7 flex items-center justify-center bg-blue-600 rounded-md shadow-sm text-white active:bg-blue-700"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>
            </div>
        ))}
      </div>

      {/* FIXED BOTTOM FOOTER: Totals & Actions */}
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-30 pb-24 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        
        {/* Total Row (Small) */}
        <div className="px-6 py-3 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Totale ({items.length} art.)</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">€ {totalValue.toFixed(2)}</span>
        </div>

        {/* Action Buttons Grid */}
        <div className="p-4 grid grid-cols-4 gap-3">
             {/* PDF Button (Larger) */}
            <button 
                onClick={handleExportPDF}
                className="col-span-2 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none active:scale-[0.98] transition-all"
            >
                <FileText size={18} />
                <span>PDF</span>
            </button>

             {/* Share Button */}
            <button 
                onClick={handleShare}
                className="col-span-1 py-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold rounded-xl flex flex-col items-center justify-center gap-1 border border-green-200 dark:border-green-900/50"
            >
                <Share2 size={18} />
            </button>

            {/* Mexal Button */}
             <button 
                onClick={handleExportMexal}
                className="col-span-1 py-3 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold rounded-xl flex flex-col items-center justify-center gap-1 border border-orange-200 dark:border-orange-900/50"
            >
                <FileCode size={18} />
            </button>
            
            {/* Clear Button (Row 2, Full Width optional, or just an icon) */}
            <div className="col-span-4 mt-1">
                 <button 
                    onClick={() => setShowClearConfirm(true)} 
                    className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-red-400 hover:text-red-600 uppercase tracking-widest"
                >
                    <Trash2 size={14} /> Svuota Carrello
                </button>
            </div>
        </div>
      </div>
    </div>

    {/* Detail Modal */}
    {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedItem(null)}></div>
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl relative z-10 overflow-hidden p-6 animate-in zoom-in-95 border border-white dark:border-slate-800">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full">{selectedItem.brand}</span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-2 leading-snug">{selectedItem.description}</h2>
                        <p className="font-mono text-slate-400 text-sm mt-1">{selectedItem.code}</p>
                    </div>
                    <button onClick={() => setSelectedItem(null)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400"><X size={20}/></button>
                </div>
                
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded-2xl p-2 mb-6">
                    <button onClick={() => {onUpdateQuantity(selectedItem.ean, -1); setSelectedItem(prev => prev ? {...prev, quantity: prev.quantity-1} : null)}} className="w-14 h-14 bg-white dark:bg-slate-700 shadow-sm rounded-xl flex items-center justify-center text-slate-900 dark:text-white"><Minus/></button>
                    <span className="text-3xl font-bold text-slate-800 dark:text-white">{selectedItem.quantity}</span>
                    <button onClick={() => {onUpdateQuantity(selectedItem.ean, 1); setSelectedItem(prev => prev ? {...prev, quantity: prev.quantity+1} : null)}} className="w-14 h-14 bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none rounded-xl flex items-center justify-center"><Plus/></button>
                </div>

                <button 
                    onClick={() => { onUpdateQuantity(selectedItem.ean, -selectedItem.quantity); setSelectedItem(null); }}
                    className="w-full py-4 text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center gap-2"
                >
                    <Trash2 size={20}/> Rimuovi dall'ordine
                </button>
            </div>
        </div>
    )}

    {/* Clear Confirm */}
    {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowClearConfirm(false)}></div>
            <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-[2rem] p-6 text-center z-10 shadow-2xl border border-white dark:border-slate-800">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32}/></div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sei sicuro?</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Il carrello verrà svuotato completamente.</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl">No</button>
                    <button onClick={() => { onClear(); setShowClearConfirm(false); }} className="flex-1 py-3 font-bold text-white bg-red-500 rounded-xl">Sì, svuota</button>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default OrderList;
