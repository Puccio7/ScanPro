
import React, { useState, useEffect } from 'react';
import { AppView, Product, CartItem, ImportBatch } from './types';
import Scanner from './components/Scanner';
import ImportFile from './components/ImportFile';
import OrderList from './components/OrderList';
import { Scan, Settings, ShoppingCart, ChevronLeft, Download, Loader2, Wifi, WifiOff, Save, CheckCircle2 } from 'lucide-react';
import { dbService } from './utils/db';

const App = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.SCANNER);
  const [loadingApp, setLoadingApp] = useState(true);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [inventory, setInventory] = useState<Map<string, Product>>(new Map());
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info'} | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbStatus, setDbStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
      const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }, []);

  useEffect(() => {
      const loadData = async () => {
          try {
              const storedBatches = await dbService.getBatches();
              setImportBatches(storedBatches);
              const storedCartItems = await dbService.getCart();
              if (Array.isArray(storedCartItems)) setCart(new Map(storedCartItems));
          } finally { setLoadingApp(false); }
      };
      loadData();
  }, []);

  useEffect(() => {
      if (!loadingApp) {
          setDbStatus('saving');
          dbService.saveCart(Array.from(cart.entries())).then(() => {
                setDbStatus('saved'); setTimeout(() => setDbStatus('idle'), 2000);
            });
      }
  }, [cart, loadingApp]);

  useEffect(() => {
    if (loadingApp) return;
    const t = setTimeout(() => {
        const newInventory = new Map<string, Product>();
        importBatches.forEach(batch => {
            batch.products.forEach(p => {
                const key = p.ean && p.ean.length > 3 ? p.ean : p.code;
                if (key) { newInventory.set(key, p); if (p.code !== key) newInventory.set(p.code, p); }
            });
        });
        setInventory(newInventory);
    }, 100);
    return () => clearTimeout(t);
  }, [importBatches, loadingApp]);

  // Actions
  const handleImport = async (products: Product[], fileName: string) => {
    const newBatch = { id: Date.now().toString(), fileName, timestamp: Date.now(), products };
    setImportBatches(prev => [...prev, newBatch]);
    await dbService.addBatch(newBatch);
    showNotification(`Importati ${products.length} articoli`, 'success');
  };

  const handleDeleteBatch = async (batchId: string) => {
      setImportBatches(prev => prev.filter(b => b.id !== batchId));
      await dbService.deleteBatch(batchId);
      showNotification("Listino eliminato", 'info');
  };

  const handleScan = (product: Product) => {
    setCart((prev) => {
        const newCart = new Map<string, CartItem>(prev);
        const key = product.ean || product.code;
        const item = newCart.get(key);
        newCart.set(key, item ? { ...item, quantity: item.quantity + 1, timestamp: Date.now() } : { ...product, quantity: 1, timestamp: Date.now() });
        return newCart;
    });
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const updateQuantity = (ean: string, delta: number) => {
     setCart((prev) => {
        const newCart = new Map<string, CartItem>(prev);
        const item = newCart.get(ean);
        if (!item) return prev;
        const newQty = item.quantity + delta;
        newQty <= 0 ? newCart.delete(ean) : newCart.set(ean, { ...item, quantity: newQty });
        return newCart;
     });
  };

  const showNotification = (msg: string, type: 'success' | 'info') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 3000);
  };

  const cartTotalItems = (Array.from(cart.values()) as CartItem[]).reduce((a, b) => a + b.quantity, 0);

  if (loadingApp) return <div className="h-screen w-full flex flex-col items-center justify-center bg-white"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>;

  return (
    <div className="h-screen w-full flex flex-col bg-white overflow-hidden font-sans">
      
      {/* Dynamic Header */}
      {currentView !== AppView.SCANNER && (
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center gap-4 z-20 safe-area-top sticky top-0">
           {currentView === AppView.SETTINGS && (
               <button onClick={() => setCurrentView(AppView.SCANNER)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                   <ChevronLeft className="text-slate-800" size={20} />
               </button>
           )}
           <div className="flex-1">
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                   {currentView === AppView.SETTINGS ? 'Impostazioni' : 'Il tuo Ordine'}
               </h1>
               <div className="flex items-center gap-3 mt-1">
                    <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'text-green-500' : 'text-amber-500'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                    </div>
                    {dbStatus !== 'idle' && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-500 font-bold uppercase tracking-wider">
                            {dbStatus === 'saving' ? 'Salvataggio...' : 'Salvato'}
                        </div>
                    )}
               </div>
           </div>
           {currentView !== AppView.SETTINGS && deferredPrompt && (
               <button onClick={() => deferredPrompt.prompt()} className="bg-slate-900 text-white p-2 rounded-full"><Download size={18}/></button>
           )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden bg-slate-50">
        {currentView === AppView.SCANNER && <Scanner onScan={handleScan} inventory={inventory} />}
        {currentView === AppView.SETTINGS && (
            <div className="h-full overflow-y-auto">
                <ImportFile onImport={handleImport} batches={importBatches} onDeleteBatch={handleDeleteBatch} deferredPrompt={deferredPrompt} isOnline={isOnline} />
            </div>
        )}
        {currentView === AppView.CART && (
            <OrderList items={Array.from(cart.values())} onUpdateQuantity={updateQuantity} onClear={() => setCart(new Map())} />
        )}
      </div>

      {/* Notifications */}
      {notification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4 w-auto shadow-2xl">
            <div className="px-6 py-3 rounded-full bg-slate-900 text-white font-bold text-sm shadow-lg flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-400" /> {notification.msg}
            </div>
        </div>
      )}

      {/* Modern Floating Navigation */}
      <div className="absolute bottom-6 left-6 right-6 z-50">
        <div className="bg-slate-900/90 backdrop-blur-xl text-white rounded-[2rem] p-2 flex justify-between items-center shadow-2xl shadow-slate-900/20 border border-white/10">
            <NavButton active={currentView === AppView.SETTINGS} onClick={() => setCurrentView(AppView.SETTINGS)} icon={<Settings size={22} />} label="Menu" />
            
            <button 
                onClick={() => setCurrentView(AppView.SCANNER)}
                className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 shadow-xl ${currentView === AppView.SCANNER ? 'bg-blue-600 scale-110 -translate-y-4 border-4 border-slate-50' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
            >
                <Scan size={28} className={currentView === AppView.SCANNER ? 'text-white' : ''} />
            </button>

            <NavButton 
                active={currentView === AppView.CART} 
                onClick={() => setCurrentView(AppView.CART)} 
                icon={
                    <div className="relative">
                        <ShoppingCart size={22} />
                        {cartTotalItems > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-900">{cartTotalItems}</span>}
                    </div>
                } 
                label="Ordine" 
            />
        </div>
      </div>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all ${active ? 'text-blue-400 bg-white/10' : 'text-slate-400 hover:text-white'}`}>
        {icon}
        <span className="text-[9px] font-bold mt-1 uppercase tracking-wider opacity-70">{label}</span>
    </button>
);

export default App;
