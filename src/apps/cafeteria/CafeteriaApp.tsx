import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import { Order, OrderStatus, Product } from '../../types';
import { ensureSeedData } from '../../firebase/seed';
import { playOrderChime } from '../../utils/audio';
import {
  Clock,
  ChefHat,
  Bell,
  CheckCircle2,
  DollarSign,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  RotateCcw,
  Plus,
  Search,
  Check,
  CheckSquare,
  Square,
  ArrowRight,
  ArrowLeft,
  X,
  Sun,
  Moon,
  LogOut,
  Pencil,
  Trash2,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

interface CafeteriaAppProps {
  onLogout?: () => void;
}

const POPULAR_IMAGE_PRESETS = [
  { label: 'Hamburguesa', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80' },
  { label: 'Café Latte', url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80' },
  { label: 'Empanada', url: 'https://images.unsplash.com/photo-1628106235973-f655b57cad49?auto=format&fit=crop&w=800&q=80' },
  { label: 'Croissant', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80' },
  { label: 'Sandwich', url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80' },
  { label: 'Bowl Frutas', url: 'https://images.unsplash.com/photo-1511688878353-3a2f5be94cd7?auto=format&fit=crop&w=800&q=80' },
  { label: 'Muffin', url: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=800&q=80' },
  { label: 'Iced Coffee', url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80' },
  { label: 'Pizza / Snack', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80' },
  { label: 'Jugo Natural', url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80' },
];

export const CafeteriaApp: React.FC<CafeteriaAppProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'kanban' | 'menu' | 'history'>('kanban');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // High contrast theme state for kitchen glare readability
  const [isHighContrast, setIsHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('campusbite_kds_theme') === 'dark';
  });

  const toggleHighContrast = () => {
    setIsHighContrast((prev) => {
      const next = !prev;
      localStorage.setItem('campusbite_kds_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Product Filter & Search
  const [menuSearch, setMenuSearch] = useState('');
  const [menuFilterCategory, setMenuFilterCategory] = useState('Todas');

  // Track previous order count to chime on new incoming orders
  const prevOrdersCountRef = useRef<number | null>(null);

  // New product form state
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProd, setNewProd] = useState({
    name: '',
    description: '',
    price: 6000,
    category: 'Cafetería',
    imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80',
    prepTimeMinutes: 5,
  });

  // Edit product modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete product confirmation state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

  // Listen to orders in real-time
  useEffect(() => {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ords: Order[] = [];
        snapshot.forEach((docSnap) => {
          ords.push({ id: docSnap.id, ...docSnap.data() } as Order);
        });

        // Trigger chime if a new order just appeared and sound is on
        if (
          prevOrdersCountRef.current !== null &&
          ords.length > prevOrdersCountRef.current &&
          soundEnabled
        ) {
          playOrderChime();
        }
        prevOrdersCountRef.current = ords.length;

        setOrders(ords);
        setLoadingOrders(false);
      },
      (err) => {
        console.error('Error fetching orders in cafeteria:', err);
        setLoadingOrders(false);
        handleFirestoreError(err, OperationType.LIST, 'orders');
      }
    );

    return () => unsubscribe();
  }, [soundEnabled]);

  // Listen to products in real-time
  useEffect(() => {
    const productsRef = collection(db, 'products');
    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        const prods: Product[] = [];
        snapshot.forEach((docSnap) => {
          prods.push({ id: docSnap.id, ...docSnap.data() } as Product);
        });
        setProducts(prods);
        setLoadingProducts(false);
      },
      (err) => {
        console.error('Error fetching products in cafeteria:', err);
        setLoadingProducts(false);
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    );

    return () => unsubscribe();
  }, []);

  // Update order status in Firestore
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error updating order status:', err);
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // Toggle product availability in Firestore
  const handleToggleProductAvailability = async (product: Product) => {
    try {
      const prodRef = doc(db, 'products', product.id);
      await updateDoc(prodRef, {
        isAvailable: !product.isAvailable,
      });
    } catch (err) {
      console.error('Error updating product availability:', err);
      handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  // Reset or Seed Initial Products
  const handleReseed = async () => {
    if (window.confirm('¿Deseas restaurar el menú con los 8 productos originales y órdenes de prueba?')) {
      try {
        await ensureSeedData(true);
        alert('Catálogo y órdenes restaurados con éxito.');
      } catch (e) {
        console.error('Error reseeding', e);
      }
    }
  };

  // Add new product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name.trim()) return;

    try {
      const prodId = 'prod-' + Date.now();
      const productPayload: Product = {
        id: prodId,
        name: newProd.name.trim(),
        description: newProd.description.trim(),
        price: Number(newProd.price),
        category: newProd.category,
        imageUrl: newProd.imageUrl.trim() || POPULAR_IMAGE_PRESETS[0].url,
        isAvailable: true,
        prepTimeMinutes: Number(newProd.prepTimeMinutes) || 5,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'products'), productPayload);
      setIsNewProductModalOpen(false);
      setNewProd({
        name: '',
        description: '',
        price: 6000,
        category: 'Cafetería',
        imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80',
        prepTimeMinutes: 5,
      });
    } catch (err) {
      console.error('Error creating product:', err);
      handleFirestoreError(err, OperationType.CREATE, 'products');
    }
  };

  // Save complete product edits in Firestore
  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editingProduct.name.trim()) {
      alert('El nombre del producto es obligatorio.');
      return;
    }
    if (editingProduct.price <= 0) {
      alert('El precio debe ser mayor a cero.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const prodRef = doc(db, 'products', editingProduct.id);
      await updateDoc(prodRef, {
        name: editingProduct.name.trim(),
        description: editingProduct.description.trim(),
        price: Number(editingProduct.price),
        category: editingProduct.category,
        imageUrl: editingProduct.imageUrl.trim() || POPULAR_IMAGE_PRESETS[0].url,
        prepTimeMinutes: Number(editingProduct.prepTimeMinutes) || 5,
        isAvailable: Boolean(editingProduct.isAvailable),
      });

      setEditingProduct(null);
    } catch (err) {
      console.error('Error updating product in Firestore:', err);
      handleFirestoreError(err, OperationType.UPDATE, `products/${editingProduct.id}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Permanently delete product from Firestore
  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;

    setIsDeletingProduct(true);
    try {
      const prodRef = doc(db, 'products', productToDelete.id);
      await deleteDoc(prodRef);

      // If this product was currently open in the edit modal, close it
      if (editingProduct?.id === productToDelete.id) {
        setEditingProduct(null);
      }
      setProductToDelete(null);
    } catch (err) {
      console.error('Error deleting product in Firestore:', err);
      handleFirestoreError(err, OperationType.DELETE, `products/${productToDelete.id}`);
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // Local image file upload handler with base64 conversion
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditMode = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      alert('La imagen seleccionada supera los 800KB. Por favor elige una imagen más pequeña para optimizar la velocidad.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      if (isEditMode && editingProduct) {
        setEditingProduct({ ...editingProduct, imageUrl: base64Url });
      } else {
        setNewProd({ ...newProd, imageUrl: base64Url });
      }
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('text/plain', orderId);
    setDraggedOrderId(orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: OrderStatus) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('text/plain') || draggedOrderId;
    if (orderId) {
      handleUpdateStatus(orderId, targetStatus);
    }
    setDraggedOrderId(null);
  };

  // Filter orders by column
  const nuevosOrders = orders.filter((o) => o.status === 'recibido');
  const preparandoOrders = orders.filter((o) => o.status === 'preparando');
  const listosOrders = orders.filter((o) => o.status === 'listo');
  const deliveredOrders = orders.filter((o) => ['entregado', 'cancelado'].includes(o.status));

  // Metrics
  const activeOrdersCount = nuevosOrders.length + preparandoOrders.length + listosOrders.length;
  const totalRevenueToCollect = orders
    .filter((o) => o.status !== 'cancelado')
    .reduce((sum, o) => sum + o.totalPrice, 0);

  // Helper for elapsed time format
  const getElapsedMinutes = (dateStr: string) => {
    const elapsed = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (elapsed <= 0) return 'Hace un instante';
    if (elapsed === 1) return 'Hace 1 min';
    return `Hace ${elapsed} min`;
  };

  // Toggle checklist item
  const toggleItemCheck = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`;
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filtered menu items
  const menuCategories = ['Todas', ...Array.from(new Set(products.map((p) => p.category)))];
  const filteredProducts = products.filter((p) => {
    const matchCat = menuFilterCategory === 'Todas' || p.category === menuFilterCategory;
    const matchSearch =
      p.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(menuSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        isHighContrast
          ? 'bg-stone-950 text-stone-100 font-sans'
          : 'bg-stone-100 text-stone-800'
      }`}
    >
      {/* Top Professional POS Bar */}
      <header
        className={`px-4 sm:px-6 py-3.5 sticky top-0 z-30 transition-colors ${
          isHighContrast
            ? 'bg-stone-900 border-b border-stone-800 shadow-md'
            : 'bg-white border-b border-stone-200 shadow-xs'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Brand & Mode info */}
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm ${
                isHighContrast
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-amber-600 text-white'
              }`}
            >
              👨‍🍳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className={`text-lg font-black tracking-tight ${
                    isHighContrast ? 'text-white' : 'text-stone-900'
                  }`}
                >
                  CampusBite Staff
                </h1>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                    isHighContrast
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
                {isHighContrast && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 uppercase tracking-widest">
                    ALTO CONTRASTE
                  </span>
                )}
              </div>
              <p
                className={`text-xs font-medium ${
                  isHighContrast ? 'text-stone-400' : 'text-stone-500'
                }`}
              >
                Panel Operativo de Cocina & Gestión de Menú
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar & Controls */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Active Orders Count */}
            <div
              className={`rounded-xl px-3 py-1.5 flex items-center gap-2 border ${
                isHighContrast
                  ? 'bg-stone-800/90 border-stone-700 text-stone-100'
                  : 'bg-stone-50 border-stone-200/80 text-stone-800'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-500" />
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Activos</span>
                <span className="font-extrabold text-sm">{activeOrdersCount}</span>
              </div>
            </div>

            {/* Total Revenue */}
            <div
              className={`rounded-xl px-3 py-1.5 flex items-center gap-2 border ${
                isHighContrast
                  ? 'bg-stone-800/90 border-stone-700 text-stone-100'
                  : 'bg-stone-50 border-stone-200/80 text-stone-800'
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Total a Cobrar</span>
                <span className="font-extrabold text-sm">
                  ${totalRevenueToCollect.toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            {/* Theme Toggle (High Contrast / Dark vs Light) */}
            <button
              onClick={toggleHighContrast}
              className={`px-3 py-2 rounded-xl border font-bold transition flex items-center gap-1.5 shadow-xs ${
                isHighContrast
                  ? 'bg-amber-400 text-stone-950 border-amber-300 hover:bg-amber-300'
                  : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
              }`}
              title={
                isHighContrast
                  ? 'Cambiar a Modo Claro'
                  : 'Activar Modo Alto Contraste (para cocina con iluminación intensa)'
              }
            >
              {isHighContrast ? (
                <>
                  <Sun className="w-4 h-4 text-stone-950" />
                  <span className="text-[11px] font-black uppercase tracking-wider">
                    Modo Cocina (Alto Contraste)
                  </span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-stone-600" />
                  <span className="text-[11px] font-bold">Tema: Claro</span>
                </>
              )}
            </button>

            {/* Sound Mute/Unmute */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition flex items-center gap-1.5 ${
                soundEnabled
                  ? isHighContrast
                    ? 'bg-stone-800 text-amber-400 border-stone-700 hover:bg-stone-700'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : isHighContrast
                  ? 'bg-stone-900 text-stone-500 border-stone-800 hover:bg-stone-800'
                  : 'bg-stone-100 text-stone-400 border-stone-200 hover:bg-stone-200'
              }`}
              title={soundEnabled ? 'Silenciar campanada de pedidos' : 'Activar campanada de pedidos'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-[11px] font-bold hidden sm:inline">
                {soundEnabled ? 'Campana ON' : 'Mudo'}
              </span>
            </button>

            {/* Lock / Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className={`p-2 rounded-xl border transition flex items-center gap-1.5 ${
                  isHighContrast
                    ? 'bg-red-950/80 text-red-300 border-red-800 hover:bg-red-900'
                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
                title="Bloquear pantalla de administración"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-[11px] font-bold hidden sm:inline">Bloquear</span>
              </button>
            )}
          </div>

          {/* Tab Navigation */}
          <div
            className={`flex items-center gap-1 p-1 rounded-2xl border ${
              isHighContrast
                ? 'bg-stone-950 border-stone-800'
                : 'bg-stone-100 border-stone-200'
            }`}
          >
            <button
              onClick={() => setActiveTab('kanban')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'kanban'
                  ? isHighContrast
                    ? 'bg-amber-500 text-stone-950 shadow-md font-black'
                    : 'bg-white text-stone-900 shadow-xs'
                  : isHighContrast
                  ? 'text-stone-400 hover:text-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              Tablero Kanban ({activeOrdersCount})
            </button>

            <button
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'menu'
                  ? isHighContrast
                    ? 'bg-amber-500 text-stone-950 shadow-md font-black'
                    : 'bg-white text-stone-900 shadow-xs'
                  : isHighContrast
                  ? 'text-stone-400 hover:text-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              Gestión del Menú ({products.length})
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? isHighContrast
                    ? 'bg-amber-500 text-stone-950 shadow-md font-black'
                    : 'bg-white text-stone-900 shadow-xs'
                  : isHighContrast
                  ? 'text-stone-400 hover:text-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Historial ({deliveredOrders.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main App Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* ======================================================== */}
        {/* TAB 1: KANBAN LIVE BOARD */}
        {/* ======================================================== */}
        {activeTab === 'kanban' && (
          <div className="space-y-4">
            {/* Top helper hint */}
            <div
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 px-4 rounded-2xl border text-xs ${
                isHighContrast
                  ? 'bg-stone-900/90 border-stone-800 text-stone-300'
                  : 'bg-white/80 border-stone-200/80 text-stone-600'
              }`}
            >
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>
                  <strong className={isHighContrast ? 'text-white' : 'text-stone-900'}>
                    Modo Cocina en Vivo:
                  </strong>{' '}
                  Arrastra pedidos o usa los botones para avanzar el estado. Los estudiantes ven el
                  cambio en tiempo real.
                </span>
              </p>
              <button
                onClick={handleReseed}
                className={`inline-flex items-center gap-1 font-semibold underline self-start sm:self-auto ${
                  isHighContrast ? 'text-amber-400 hover:text-amber-300' : 'text-stone-500 hover:text-amber-700'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar datos semilla
              </button>
            </div>

            {loadingOrders ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
                {/* ---------------- COLUMN 1: NUEVOS ---------------- */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'recibido')}
                  className={`rounded-3xl border p-4 min-h-[580px] flex flex-col transition-colors ${
                    isHighContrast
                      ? 'bg-stone-900/90 border-amber-500/70 shadow-xl ring-1 ring-amber-500/30'
                      : 'bg-amber-50/60 border-amber-200/80 shadow-2xs'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between pb-3 mb-3 border-b ${
                      isHighContrast ? 'border-amber-500/40' : 'border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-amber-400 animate-pulse ring-2 ring-amber-300/40" />
                      <h3
                        className={`font-black text-sm uppercase tracking-wider ${
                          isHighContrast ? 'text-amber-400' : 'text-stone-900'
                        }`}
                      >
                        1. Nuevos
                      </h3>
                    </div>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full font-mono ${
                        isHighContrast
                          ? 'bg-amber-400 text-stone-950'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {nuevosOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[75vh] custom-scrollbar pr-1">
                    {nuevosOrders.length === 0 ? (
                      <div
                        className={`h-44 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-4 ${
                          isHighContrast
                            ? 'border-stone-800 text-stone-500'
                            : 'border-amber-200 text-stone-400'
                        }`}
                      >
                        <Clock className="w-8 h-8 text-amber-400/60 mb-1" />
                        <p className="text-xs font-semibold">Sin nuevos pedidos por ahora</p>
                        <p className="text-[10px] mt-1">Aparecerán automáticamente aquí</p>
                      </div>
                    ) : (
                      nuevosOrders.map((order) => (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, order.id)}
                          className={`rounded-2xl p-4 border transition cursor-grab active:cursor-grabbing group ${
                            isHighContrast
                              ? 'bg-stone-950 border-stone-700 text-stone-100 shadow-lg hover:border-amber-400'
                              : 'bg-white border-stone-200 text-stone-800 shadow-xs hover:shadow-md'
                          }`}
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between">
                            <div>
                              <span
                                className={`text-xs font-mono font-black px-2 py-0.5 rounded-md ${
                                  isHighContrast
                                    ? 'bg-amber-400 text-stone-950'
                                    : 'text-amber-800 bg-amber-100'
                                }`}
                              >
                                {order.pickupCode}
                              </span>
                              <h4
                                className={`text-sm font-black mt-1 ${
                                  isHighContrast ? 'text-white' : 'text-stone-900'
                                }`}
                              >
                                {order.studentName}
                              </h4>
                              <span
                                className={`text-[10px] font-semibold ${
                                  isHighContrast ? 'text-stone-400' : 'text-stone-400'
                                }`}
                              >
                                {order.studentId}
                              </span>
                            </div>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                isHighContrast
                                  ? 'text-amber-300 bg-amber-950/70 border-amber-600/60'
                                  : 'text-amber-800 bg-amber-50 border-amber-100'
                              }`}
                            >
                              <Clock className="w-3 h-3 text-amber-500" />
                              {getElapsedMinutes(order.createdAt)}
                            </span>
                          </div>

                          {/* Order Items with interactive checkboxes for kitchen staff */}
                          <div
                            className={`mt-3 pt-2.5 border-t space-y-1.5 text-xs ${
                              isHighContrast ? 'border-stone-800' : 'border-stone-100'
                            }`}
                          >
                            {order.items.map((item, idx) => {
                              const checked = checkedItems[`${order.id}-${idx}`];
                              return (
                                <div
                                  key={idx}
                                  onClick={() => toggleItemCheck(order.id, idx)}
                                  className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition select-none ${
                                    checked
                                      ? isHighContrast
                                        ? 'bg-stone-900 text-stone-500 line-through'
                                        : 'bg-stone-100 text-stone-400 line-through'
                                      : isHighContrast
                                      ? 'hover:bg-stone-800 text-stone-200'
                                      : 'hover:bg-stone-50 text-stone-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {checked ? (
                                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                                    ) : (
                                      <Square
                                        className={`w-4 h-4 shrink-0 ${
                                          isHighContrast ? 'text-stone-600' : 'text-stone-300'
                                        }`}
                                      />
                                    )}
                                    <span
                                      className={`font-black text-[11px] ${
                                        isHighContrast ? 'text-amber-400' : 'text-stone-800'
                                      }`}
                                    >
                                      {item.quantity}x
                                    </span>
                                    <span className="font-medium line-clamp-1">{item.name}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Notes */}
                          {order.notes && (
                            <div
                              className={`mt-2.5 p-2 rounded-xl text-xs border ${
                                isHighContrast
                                  ? 'bg-amber-950/40 text-amber-200 border-amber-600/50'
                                  : 'bg-amber-50/80 text-amber-900 border-amber-200/50'
                              }`}
                            >
                              <strong className="text-[10px] uppercase font-bold block mb-0.5">
                                Nota del Estudiante:
                              </strong>
                              {order.notes}
                            </div>
                          )}

                          {/* Footer & Action button */}
                          <div
                            className={`mt-3 pt-3 border-t flex items-center justify-between ${
                              isHighContrast ? 'border-stone-800' : 'border-stone-100'
                            }`}
                          >
                            <div>
                              <span className="text-[10px] text-stone-400 uppercase font-semibold block">
                                Cobrar en Caja
                              </span>
                              <span
                                className={`text-xs font-black ${
                                  isHighContrast ? 'text-amber-400' : 'text-stone-900'
                                }`}
                              >
                                ${order.totalPrice.toLocaleString('es-CO')}
                              </span>
                            </div>

                            <button
                              onClick={() => handleUpdateStatus(order.id, 'preparando')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition"
                            >
                              <span>Preparar</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ---------------- COLUMN 2: EN PREPARACIÓN ---------------- */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'preparando')}
                  className={`rounded-3xl border p-4 min-h-[580px] flex flex-col transition-colors ${
                    isHighContrast
                      ? 'bg-stone-900/90 border-sky-500/70 shadow-xl ring-1 ring-sky-500/30'
                      : 'bg-blue-50/60 border-blue-200/80 shadow-2xs'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between pb-3 mb-3 border-b ${
                      isHighContrast ? 'border-sky-500/40' : 'border-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ChefHat className="w-4 h-4 text-sky-400 animate-bounce" />
                      <h3
                        className={`font-black text-sm uppercase tracking-wider ${
                          isHighContrast ? 'text-sky-400' : 'text-stone-900'
                        }`}
                      >
                        2. En Preparación
                      </h3>
                    </div>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full font-mono ${
                        isHighContrast
                          ? 'bg-sky-400 text-stone-950'
                          : 'bg-blue-200 text-blue-900'
                      }`}
                    >
                      {preparandoOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[75vh] custom-scrollbar pr-1">
                    {preparandoOrders.length === 0 ? (
                      <div
                        className={`h-44 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-4 ${
                          isHighContrast
                            ? 'border-stone-800 text-stone-500'
                            : 'border-blue-200 text-stone-400'
                        }`}
                      >
                        <ChefHat className="w-8 h-8 text-sky-400/60 mb-1" />
                        <p className="text-xs font-semibold">No hay órdenes en cocina</p>
                        <p className="text-[10px] mt-1">Avanza pedidos desde "Nuevos"</p>
                      </div>
                    ) : (
                      preparandoOrders.map((order) => (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, order.id)}
                          className={`rounded-2xl p-4 border transition cursor-grab active:cursor-grabbing group ${
                            isHighContrast
                              ? 'bg-stone-950 border-stone-700 text-stone-100 shadow-lg hover:border-sky-400'
                              : 'bg-white border-blue-100 text-stone-800 shadow-xs hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span
                                className={`text-xs font-mono font-black px-2 py-0.5 rounded-md ${
                                  isHighContrast
                                    ? 'bg-sky-400 text-stone-950'
                                    : 'text-blue-700 bg-blue-100'
                                }`}
                              >
                                {order.pickupCode}
                              </span>
                              <h4
                                className={`text-sm font-black mt-1 ${
                                  isHighContrast ? 'text-white' : 'text-stone-900'
                                }`}
                              >
                                {order.studentName}
                              </h4>
                              <span
                                className={`text-[10px] font-semibold ${
                                  isHighContrast ? 'text-stone-400' : 'text-stone-400'
                                }`}
                              >
                                {order.studentId}
                              </span>
                            </div>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                isHighContrast
                                  ? 'text-sky-300 bg-sky-950/70 border-sky-600/60'
                                  : 'text-blue-800 bg-blue-50 border-blue-100'
                              }`}
                            >
                              <Clock className="w-3 h-3 text-sky-400" />
                              {getElapsedMinutes(order.createdAt)}
                            </span>
                          </div>

                          <div
                            className={`mt-3 pt-2.5 border-t space-y-1.5 text-xs ${
                              isHighContrast ? 'border-stone-800' : 'border-stone-100'
                            }`}
                          >
                            {order.items.map((item, idx) => {
                              const checked = checkedItems[`${order.id}-${idx}`];
                              return (
                                <div
                                  key={idx}
                                  onClick={() => toggleItemCheck(order.id, idx)}
                                  className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition select-none ${
                                    checked
                                      ? isHighContrast
                                        ? 'bg-stone-900 text-stone-500 line-through'
                                        : 'bg-stone-100 text-stone-400 line-through'
                                      : isHighContrast
                                      ? 'hover:bg-stone-800 text-stone-200'
                                      : 'hover:bg-stone-50 text-stone-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {checked ? (
                                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                                    ) : (
                                      <Square
                                        className={`w-4 h-4 shrink-0 ${
                                          isHighContrast ? 'text-stone-600' : 'text-stone-300'
                                        }`}
                                      />
                                    )}
                                    <span
                                      className={`font-black text-[11px] ${
                                        isHighContrast ? 'text-sky-400' : 'text-stone-800'
                                      }`}
                                    >
                                      {item.quantity}x
                                    </span>
                                    <span className="font-medium line-clamp-1">{item.name}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {order.notes && (
                            <div
                              className={`mt-2.5 p-2 rounded-xl text-xs border ${
                                isHighContrast
                                  ? 'bg-sky-950/40 text-sky-200 border-sky-600/50'
                                  : 'bg-blue-50/70 text-blue-900 border-blue-200/50'
                              }`}
                            >
                              <strong className="text-[10px] uppercase font-bold block mb-0.5">
                                Nota:
                              </strong>
                              {order.notes}
                            </div>
                          )}

                          <div
                            className={`mt-3 pt-3 border-t flex items-center justify-between gap-2 ${
                              isHighContrast ? 'border-stone-800' : 'border-stone-100'
                            }`}
                          >
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'recibido')}
                              className={`p-1.5 rounded-lg transition ${
                                isHighContrast
                                  ? 'text-stone-400 hover:text-white hover:bg-stone-800'
                                  : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                              }`}
                              title="Regresar a Nuevos"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleUpdateStatus(order.id, 'listo')}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              <span>Marcar Listo</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ---------------- COLUMN 3: LISTOS PARA ENTREGAR ---------------- */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'listo')}
                  className={`rounded-3xl border p-4 min-h-[580px] flex flex-col transition-colors ${
                    isHighContrast
                      ? 'bg-stone-900/90 border-emerald-500/70 shadow-xl ring-1 ring-emerald-500/30'
                      : 'bg-emerald-50/60 border-emerald-200/80 shadow-2xs'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between pb-3 mb-3 border-b ${
                      isHighContrast ? 'border-emerald-500/40' : 'border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <h3
                        className={`font-black text-sm uppercase tracking-wider ${
                          isHighContrast ? 'text-emerald-400' : 'text-stone-900'
                        }`}
                      >
                        3. Listos para Entregar
                      </h3>
                    </div>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full font-mono ${
                        isHighContrast
                          ? 'bg-emerald-400 text-stone-950'
                          : 'bg-emerald-200 text-emerald-900'
                      }`}
                    >
                      {listosOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[75vh] custom-scrollbar pr-1">
                    {listosOrders.length === 0 ? (
                      <div
                        className={`h-44 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-4 ${
                          isHighContrast
                            ? 'border-stone-800 text-stone-500'
                            : 'border-emerald-200 text-stone-400'
                        }`}
                      >
                        <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mb-1" />
                        <p className="text-xs font-semibold">Ventanilla despejada</p>
                        <p className="text-[10px] mt-1">Sin bandejas pendientes de entrega</p>
                      </div>
                    ) : (
                      listosOrders.map((order) => (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, order.id)}
                          className={`rounded-2xl p-4 transition cursor-grab active:cursor-grabbing group ${
                            isHighContrast
                              ? 'bg-stone-950 border-2 border-emerald-400 text-stone-100 shadow-xl ring-2 ring-emerald-500/30'
                              : 'bg-white border-2 border-emerald-300 text-stone-800 shadow-sm ring-2 ring-emerald-100'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs font-mono font-black text-white bg-emerald-600 px-2.5 py-1 rounded-md shadow-sm">
                                {order.pickupCode}
                              </span>
                              <h4
                                className={`text-sm font-black mt-2 ${
                                  isHighContrast ? 'text-white' : 'text-stone-900'
                                }`}
                              >
                                {order.studentName}
                              </h4>
                            </div>
                            <span
                              className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                                isHighContrast
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              En Ventanilla
                            </span>
                          </div>

                          {/* In-Person Counter Payment Alert */}
                          <div
                            className={`mt-3 p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                              isHighContrast
                                ? 'bg-amber-950/50 border-amber-500/70 text-amber-200'
                                : 'bg-amber-50 border-amber-300 text-amber-900'
                            }`}
                          >
                            <span className="font-bold">Cobrar en caja:</span>
                            <span
                              className={`font-mono font-black text-sm ${
                                isHighContrast ? 'text-amber-400' : 'text-amber-950'
                              }`}
                            >
                              ${order.totalPrice.toLocaleString('es-CO')}
                            </span>
                          </div>

                          <div
                            className={`mt-2.5 space-y-1 text-xs ${
                              isHighContrast ? 'text-stone-300' : 'text-stone-600'
                            }`}
                          >
                            {order.items.map((i, idx) => (
                              <p key={idx} className="line-clamp-1 font-medium">
                                • {i.quantity}x {i.name}
                              </p>
                            ))}
                          </div>

                          <div
                            className={`mt-3 pt-3 border-t flex items-center justify-between gap-2 ${
                              isHighContrast ? 'border-stone-800' : 'border-stone-100'
                            }`}
                          >
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'preparando')}
                              className={`p-1.5 rounded-lg transition ${
                                isHighContrast
                                  ? 'text-stone-400 hover:text-white hover:bg-stone-800'
                                  : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                              }`}
                              title="Regresar a Preparación"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleUpdateStatus(order.id, 'entregado')}
                              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black shadow-md active:scale-95 transition ${
                                isHighContrast
                                  ? 'bg-amber-400 text-stone-950 hover:bg-amber-300'
                                  : 'bg-stone-900 text-white hover:bg-stone-800'
                              }`}
                            >
                              <Check className="w-4 h-4 text-emerald-500" />
                              <span>Cobrado y Entregado</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: GESTIÓN DEL MENÚ (CRUD COMPLETO Y SWITCH DE DISPONIBILIDAD) */}
        {/* ======================================================== */}
        {activeTab === 'menu' && (
          <div className="space-y-5">
            {/* Top Toolbar */}
            <div
              className={`p-5 rounded-3xl border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isHighContrast
                  ? 'bg-stone-900 border-stone-800 text-white'
                  : 'bg-white border-stone-200 text-stone-800'
              }`}
            >
              <div>
                <h2 className="text-base font-black">Control de Disponibilidad y Menú</h2>
                <p
                  className={`text-xs mt-0.5 ${
                    isHighContrast ? 'text-stone-400' : 'text-stone-500'
                  }`}
                >
                  Modifica productos, ajusta precios, edita descripciones o elimínalos en tiempo real.
                  El interruptor marca artículos como <strong>Agotado</strong> al instante para los estudiantes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsNewProductModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black shadow-sm transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Producto
                </button>

                <button
                  onClick={handleReseed}
                  className={`px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                    isHighContrast
                      ? 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                  title="Restaurar el catálogo original con imágenes de muestra"
                >
                  Restaurar Menú
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o descripción..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isHighContrast
                      ? 'bg-stone-900 border-stone-700 text-white placeholder-stone-500'
                      : 'bg-white border-stone-200 text-stone-800'
                  }`}
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                {menuCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setMenuFilterCategory(cat)}
                    className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                      menuFilterCategory === cat
                        ? isHighContrast
                          ? 'bg-amber-400 text-stone-950 font-black'
                          : 'bg-stone-900 text-white'
                        : isHighContrast
                        ? 'bg-stone-900 text-stone-400 border border-stone-800 hover:bg-stone-800'
                        : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            {loadingProducts ? (
              <div className="h-44 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div
                className={`p-8 text-center rounded-3xl border ${
                  isHighContrast
                    ? 'bg-stone-900 border-stone-800 text-stone-400'
                    : 'bg-white border-stone-200 text-stone-500'
                }`}
              >
                <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No se encontraron productos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className={`rounded-3xl border p-4 flex flex-col justify-between transition-all ${
                      isHighContrast
                        ? prod.isAvailable
                          ? 'bg-stone-900 border-stone-800 text-stone-100 shadow-md'
                          : 'bg-stone-900/60 border-red-900/60 text-stone-300'
                        : prod.isAvailable
                        ? 'bg-white border-stone-200 text-stone-800 shadow-2xs hover:shadow-xs'
                        : 'bg-red-50/20 border-red-200 text-stone-800'
                    }`}
                  >
                    <div>
                      {/* Product Head & Toggle Switch */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className={`w-16 h-16 rounded-2xl object-cover shrink-0 border ${
                              prod.isAvailable
                                ? isHighContrast
                                  ? 'border-stone-700'
                                  : 'border-stone-200'
                                : 'border-red-400 grayscale-[40%]'
                            }`}
                          />
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                              {prod.category}
                            </span>
                            <h4
                              className={`text-sm font-bold line-clamp-1 ${
                                isHighContrast ? 'text-white' : 'text-stone-900'
                              }`}
                            >
                              {prod.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`text-sm font-mono font-black ${
                                  isHighContrast ? 'text-amber-400' : 'text-amber-900'
                                }`}
                              >
                                ${prod.price.toLocaleString('es-CO')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* AVAILABILITY TOGGLE SWITCH */}
                        <div className="flex flex-col items-end">
                          <button
                            onClick={() => handleToggleProductAvailability(prod)}
                            className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              prod.isAvailable ? 'bg-emerald-500' : 'bg-stone-600'
                            }`}
                            title={prod.isAvailable ? 'Marcar como Agotado' : 'Marcar como Disponible'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                prod.isAvailable ? 'translate-x-6' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider mt-1 ${
                              prod.isAvailable
                                ? isHighContrast
                                  ? 'text-emerald-400'
                                  : 'text-emerald-700'
                                : 'text-red-400'
                            }`}
                          >
                            {prod.isAvailable ? 'Disponible' : 'Agotado'}
                          </span>
                        </div>
                      </div>

                      <p
                        className={`text-xs line-clamp-2 leading-relaxed ${
                          isHighContrast ? 'text-stone-400' : 'text-stone-500'
                        }`}
                      >
                        {prod.description}
                      </p>
                    </div>

                    {/* Card Actions: Edit Button + Delete Button + Prep Time Badge */}
                    <div
                      className={`mt-4 pt-3 border-t space-y-2.5 text-xs ${
                        isHighContrast ? 'border-stone-800' : 'border-stone-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-400 flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          Prep: ~{prod.prepTimeMinutes || 5} min
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            prod.isAvailable
                              ? isHighContrast
                                ? 'bg-emerald-950 text-emerald-300'
                                : 'bg-emerald-50 text-emerald-800'
                              : isHighContrast
                              ? 'bg-red-950 text-red-300'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {prod.isAvailable ? 'En Stock' : 'Sin Stock'}
                        </span>
                      </div>

                      {/* Explicit Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setEditingProduct({ ...prod })}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs active:scale-95 ${
                            isHighContrast
                              ? 'bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                          title="Editar producto completo (nombre, precio, foto, etc.)"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar Producto</span>
                        </button>

                        <button
                          onClick={() => setProductToDelete(prod)}
                          className={`inline-flex items-center justify-center p-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                            isHighContrast
                              ? 'bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800'
                              : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                          }`}
                          title="Eliminar producto permanentemente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: HISTORIAL & REPORTES */}
        {/* ======================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div
              className={`p-5 rounded-3xl border shadow-xs flex items-center justify-between ${
                isHighContrast
                  ? 'bg-stone-900 border-stone-800 text-white'
                  : 'bg-white border-stone-200 text-stone-800'
              }`}
            >
              <div>
                <h2 className="text-base font-black">
                  Historial de Pedidos Entregados & Cobrados
                </h2>
                <p
                  className={`text-xs mt-0.5 ${
                    isHighContrast ? 'text-stone-400' : 'text-stone-500'
                  }`}
                >
                  Registro de auditoría de los pedidos completados en caja durante la jornada.
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-stone-400 block font-semibold">Total Cobrado</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  $
                  {deliveredOrders
                    .filter((o) => o.status === 'entregado')
                    .reduce((sum, o) => sum + o.totalPrice, 0)
                    .toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            {deliveredOrders.length === 0 ? (
              <div
                className={`p-12 text-center rounded-3xl border ${
                  isHighContrast
                    ? 'bg-stone-900 border-stone-800 text-stone-400'
                    : 'bg-white border-stone-200 text-stone-500'
                }`}
              >
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40 text-emerald-500" />
                <p className="text-xs font-medium">Aún no hay pedidos entregados hoy.</p>
              </div>
            ) : (
              <div
                className={`rounded-3xl border overflow-hidden shadow-xs ${
                  isHighContrast ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
                }`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead
                      className={`border-b font-bold uppercase tracking-wider text-[10px] ${
                        isHighContrast
                          ? 'bg-stone-950 border-stone-800 text-stone-400'
                          : 'bg-stone-50 border-stone-200 text-stone-500'
                      }`}
                    >
                      <tr>
                        <th className="p-3.5 pl-5">Código</th>
                        <th className="p-3.5">Estudiante</th>
                        <th className="p-3.5">Productos</th>
                        <th className="p-3.5">Hora</th>
                        <th className="p-3.5">Total Cobrado</th>
                        <th className="p-3.5 pr-5">Estado</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isHighContrast ? 'divide-stone-800' : 'divide-stone-100'}`}>
                      {deliveredOrders.map((ord) => (
                        <tr
                          key={ord.id}
                          className={`transition ${
                            isHighContrast ? 'hover:bg-stone-800/60' : 'hover:bg-stone-50'
                          }`}
                        >
                          <td
                            className={`p-3.5 pl-5 font-mono font-bold ${
                              isHighContrast ? 'text-amber-400' : 'text-stone-900'
                            }`}
                          >
                            {ord.pickupCode}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`font-semibold block ${
                                isHighContrast ? 'text-white' : 'text-stone-800'
                              }`}
                            >
                              {ord.studentName}
                            </span>
                            <span className="text-[10px] text-stone-400">{ord.studentId}</span>
                          </td>
                          <td
                            className={`p-3.5 max-w-xs ${
                              isHighContrast ? 'text-stone-300' : 'text-stone-600'
                            }`}
                          >
                            {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          </td>
                          <td className="p-3.5 text-stone-400">
                            {new Date(ord.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td
                            className={`p-3.5 font-bold font-mono ${
                              isHighContrast ? 'text-emerald-400' : 'text-stone-900'
                            }`}
                          >
                            ${ord.totalPrice.toLocaleString('es-CO')}
                          </td>
                          <td className="p-3.5 pr-5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                ord.status === 'entregado'
                                  ? isHighContrast
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                    : 'bg-emerald-100 text-emerald-800'
                                  : isHighContrast
                                  ? 'bg-red-950 text-red-300 border border-red-700/60'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {ord.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: EDITAR PRODUCTO COMPLETO */}
      {/* ======================================================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-fade-in">
          <div
            className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-slide-up border max-h-[90vh] flex flex-col ${
              isHighContrast
                ? 'bg-stone-900 border-stone-700 text-white'
                : 'bg-white border-stone-100 text-stone-900'
            }`}
          >
            {/* Header */}
            <div
              className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${
                isHighContrast ? 'border-stone-800' : 'border-stone-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base">Editar Producto</h3>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                  isHighContrast
                    ? 'bg-stone-800 text-stone-400 hover:text-white'
                    : 'bg-stone-100 text-stone-500 hover:text-stone-800'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveEditProduct} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Image Preview & Controls */}
              <div>
                <label className="font-bold block mb-1.5">Foto del Producto</label>
                <div className="flex items-start gap-3">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-stone-100 border border-stone-300 shrink-0 relative">
                    <img
                      src={editingProduct.imageUrl}
                      alt={editingProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="text-[11px] text-stone-400 block mb-0.5">
                        URL de la imagen (Unsplash o externa):
                      </label>
                      <input
                        type="url"
                        required
                        value={editingProduct.imageUrl}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, imageUrl: e.target.value })
                        }
                        className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                          isHighContrast
                            ? 'bg-stone-800 border-stone-700 text-white placeholder-stone-500'
                            : 'border-stone-200'
                        }`}
                      />
                    </div>

                    {/* Local File Upload Button */}
                    <div className="flex items-center gap-2">
                      <label
                        className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition border ${
                          isHighContrast
                            ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir desde dispositivo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileUpload(e, true)}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Quick Preset Selector */}
                <div className="mt-2.5">
                  <span className="text-[10px] text-stone-400 block mb-1 font-medium">
                    O elige una foto de muestra rápida:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_IMAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setEditingProduct({ ...editingProduct, imageUrl: preset.url })
                        }
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition border ${
                          editingProduct.imageUrl === preset.url
                            ? isHighContrast
                              ? 'bg-amber-400 text-stone-950 border-amber-300'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                            : isHighContrast
                            ? 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="font-bold block mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium ${
                    isHighContrast
                      ? 'bg-stone-800 border-stone-700 text-white placeholder-stone-500'
                      : 'border-stone-200'
                  }`}
                />
              </div>

              {/* Description */}
              <div>
                <label className="font-bold block mb-1">Descripción Breve</label>
                <textarea
                  rows={2}
                  value={editingProduct.description}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, description: e.target.value })
                  }
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isHighContrast
                      ? 'bg-stone-800 border-stone-700 text-white placeholder-stone-500'
                      : 'border-stone-200'
                  }`}
                />
              </div>

              {/* Price, Category & Prep Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold block mb-1">Precio ($ COP) *</label>
                  <input
                    type="number"
                    required
                    min={500}
                    step={100}
                    value={editingProduct.price}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, price: Number(e.target.value) })
                    }
                    className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold ${
                      isHighContrast
                        ? 'bg-stone-800 border-stone-700 text-white'
                        : 'border-stone-200'
                    }`}
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">Categoría</label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, category: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isHighContrast
                        ? 'bg-stone-800 border-stone-700 text-white'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    <option value="Cafetería">Cafetería</option>
                    <option value="Comida Rápida">Comida Rápida</option>
                    <option value="Snacks & Típicos">Snacks & Típicos</option>
                    <option value="Repostería">Repostería</option>
                    <option value="Desayunos & Bowls">Desayunos & Bowls</option>
                    <option value="Bebidas">Bebidas</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">Tiempo Prep (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={editingProduct.prepTimeMinutes || 5}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        prepTimeMinutes: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isHighContrast
                        ? 'bg-stone-800 border-stone-700 text-white'
                        : 'border-stone-200'
                    }`}
                  />
                </div>
              </div>

              {/* In-Stock / Availability Switch */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between ${
                  isHighContrast ? 'bg-stone-800/80 border-stone-700' : 'bg-stone-50 border-stone-200'
                }`}
              >
                <div>
                  <span className="font-bold text-xs block">Disponibilidad en Menú</span>
                  <span className="text-[11px] text-stone-400">
                    Si se desmarca, los estudiantes lo verán como "Agotado".
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.isAvailable}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, isAvailable: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                </label>
              </div>

              {/* Modal Footer Controls */}
              <div
                className={`pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
                  isHighContrast ? 'border-stone-800' : 'border-stone-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setProductToDelete(editingProduct)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-red-500 hover:text-red-400 hover:bg-red-500/10 font-bold transition border border-red-500/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar producto</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className={`px-4 py-2 rounded-xl font-semibold transition ${
                      isHighContrast
                        ? 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black shadow-md transition disabled:opacity-50"
                  >
                    {isSavingEdit ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Guardar Cambios
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CONFIRMACIÓN DE ELIMINACIÓN PERMANENTE */}
      {/* ======================================================== */}
      {productToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-xs animate-fade-in">
          <div
            className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slide-up border p-6 ${
              isHighContrast
                ? 'bg-stone-900 border-red-900/60 text-white'
                : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="text-center mb-5">
              <h3 className="text-lg font-black tracking-tight text-red-600 dark:text-red-400">
                ¿Eliminar permanentemente este producto?
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 leading-relaxed">
                Esta acción eliminará el producto directamente de <strong>Firebase Firestore</strong> y
                desaparecerá inmediatamente tanto de este panel como de la App del Estudiante.
              </p>
            </div>

            {/* Product Card Preview */}
            <div
              className={`p-3.5 rounded-2xl border mb-6 flex items-center gap-3 ${
                isHighContrast
                  ? 'bg-stone-950 border-stone-800'
                  : 'bg-stone-50 border-stone-200'
              }`}
            >
              <img
                src={productToDelete.imageUrl}
                alt={productToDelete.name}
                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-stone-300"
              />
              <div className="overflow-hidden">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">
                  {productToDelete.category}
                </span>
                <h4 className="text-xs font-bold text-stone-900 dark:text-white truncate">
                  {productToDelete.name}
                </h4>
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                  ${productToDelete.price.toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={isDeletingProduct}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${
                  isHighContrast
                    ? 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteProduct}
                disabled={isDeletingProduct}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingProduct ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sí, Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: AGREGAR NUEVO PRODUCTO AL MENÚ */}
      {/* ======================================================== */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-fade-in">
          <div
            className={`w-full max-w-md rounded-3xl shadow-xl overflow-hidden animate-slide-up border ${
              isHighContrast
                ? 'bg-stone-900 border-stone-700 text-white'
                : 'bg-white border-stone-100 text-stone-900'
            }`}
          >
            <div
              className={`px-5 py-4 border-b flex items-center justify-between ${
                isHighContrast ? 'border-stone-800' : 'border-stone-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">Nuevo Producto en Menú</h3>
              </div>
              <button
                onClick={() => setIsNewProductModalOpen(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                  isHighContrast
                    ? 'bg-stone-800 text-stone-400 hover:text-white'
                    : 'bg-stone-100 text-stone-500 hover:text-stone-800'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold block mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Croissant de Jamón y Queso"
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isHighContrast
                      ? 'bg-stone-800 border-stone-700 text-white placeholder-stone-500'
                      : 'border-stone-200'
                  }`}
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Descripción Breve</label>
                <textarea
                  rows={2}
                  placeholder="Ingredientes clave, preparación..."
                  value={newProd.description}
                  onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isHighContrast
                      ? 'bg-stone-800 border-stone-700 text-white placeholder-stone-500'
                      : 'border-stone-200'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Precio ($ COP) *</label>
                  <input
                    type="number"
                    required
                    min={500}
                    step={100}
                    value={newProd.price}
                    onChange={(e) => setNewProd({ ...newProd, price: Number(e.target.value) })}
                    className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isHighContrast
                        ? 'bg-stone-800 border-stone-700 text-white'
                        : 'border-stone-200'
                    }`}
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">Categoría</label>
                  <select
                    value={newProd.category}
                    onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isHighContrast
                        ? 'bg-stone-800 border-stone-700 text-white'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    <option value="Cafetería">Cafetería</option>
                    <option value="Comida Rápida">Comida Rápida</option>
                    <option value="Snacks & Típicos">Snacks & Típicos</option>
                    <option value="Repostería">Repostería</option>
                    <option value="Desayunos & Bowls">Desayunos & Bowls</option>
                    <option value="Bebidas">Bebidas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">
                  URL de Imagen (Unsplash)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={newProd.imageUrl}
                    onChange={(e) => setNewProd({ ...newProd, imageUrl: e.target.value })}
                    className={`flex-1 px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isHighContrast
                        ? 'bg-stone-800 border-stone-700 text-white placeholder-stone-500'
                        : 'border-stone-200'
                    }`}
                  />
                  <label
                    className={`cursor-pointer inline-flex items-center gap-1 px-3 py-2 rounded-xl font-bold border transition ${
                      isHighContrast
                        ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                    }`}
                    title="Subir imagen desde archivo"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFileUpload(e, false)}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-1">
                  {POPULAR_IMAGE_PRESETS.slice(0, 5).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setNewProd({ ...newProd, imageUrl: preset.url })}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                        newProd.imageUrl === preset.url
                          ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border-transparent'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={`pt-3 border-t flex items-center justify-end gap-2 ${
                  isHighContrast ? 'border-stone-800' : 'border-stone-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className={`px-4 py-2 rounded-xl font-semibold ${
                    isHighContrast
                      ? 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-xs transition"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
