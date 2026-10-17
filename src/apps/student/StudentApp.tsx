import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import { Product, OrderItem, Order } from '../../types';
import { LiveOrderTracker } from './LiveOrderTracker';
import { playOrderChime } from '../../utils/audio';
import {
  Coffee,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Search,
  X,
  Clock,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  User,
  History,
  CheckCircle,
} from 'lucide-react';

interface CartItem extends OrderItem {
  maxAvailable?: boolean;
}

export const StudentApp: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [studentOrders, setStudentOrders] = useState<Order[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Student Profile details
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem('campusbite_student_name') || 'Valentina Torres';
  });
  const [studentId, setStudentId] = useState(() => {
    return localStorage.getItem('campusbite_student_id') || 'EST-2024-491';
  });
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderConfirmedNotice, setOrderConfirmedNotice] = useState<string | null>(null);

  // Load products from Firestore in real-time
  useEffect(() => {
    const productsRef = collection(db, 'products');
    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        const prods: Product[] = [];
        snapshot.forEach((doc) => {
          prods.push({ id: doc.id, ...doc.data() } as Product);
        });
        setProducts(prods);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching products:', err);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    );

    return () => unsubscribe();
  }, []);

  // Listen to recent student orders
  useEffect(() => {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ords: Order[] = [];
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() } as Order;
          // Filter if matching this student name or stored IDs
          if (data.studentName.toLowerCase() === studentName.toLowerCase() || data.studentId === studentId) {
            ords.push(data);
          }
        });
        setStudentOrders(ords);

        // If there's an ongoing active order (recibido, preparando, listo), default to tracking it if none chosen
        const active = ords.find((o) => ['recibido', 'preparando', 'listo'].includes(o.status));
        if (active && !activeOrderId) {
          // Keep reference
        }
      },
      (err) => {
        console.debug('Error fetching user orders:', err);
      }
    );

    return () => unsubscribe();
  }, [studentName, studentId, activeOrderId]);

  // Persist student profile changes
  const handleSaveProfile = (name: string, id: string) => {
    setStudentName(name);
    setStudentId(id);
    localStorage.setItem('campusbite_student_name', name);
    localStorage.setItem('campusbite_student_id', id);
  };

  // Add to cart
  const addToCart = (product: Product) => {
    if (!product.isAvailable) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          imageUrl: product.imageUrl,
        },
      ];
    });
  };

  // Update item quantity
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  // Remove item
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Categories list
  const categories = ['Todos', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Generate unique memorable pickup code (e.g. #C-314)
  const generatePickupCode = () => {
    const num = Math.floor(100 + Math.random() * 900);
    return `#C-${num}`;
  };

  // Confirm order and write to Firestore
  const handleConfirmOrder = async () => {
    if (cart.length === 0) return;
    if (!studentName.trim()) {
      alert('Por favor indica tu nombre para la entrega.');
      return;
    }

    setIsSubmitting(true);
    try {
      const pickupCode = generatePickupCode();
      const newOrderPayload: Omit<Order, 'id'> = {
        studentName: studentName.trim(),
        studentId: studentId.trim() || 'EST-GEN',
        notes: orderNotes.trim(),
        totalPrice: cartTotal,
        pickupCode,
        status: 'recibido',
        items: cart.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          imageUrl: i.imageUrl,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'orders'), newOrderPayload);
      playOrderChime();

      // Clear cart
      setCart([]);
      setOrderNotes('');
      setIsCartOpen(false);

      // Set confirmation message required by user specification:
      // "Pedido enviado a la cafetería. El pago se realiza físicamente en caja al recoger."
      setOrderConfirmedNotice(
        'Pedido enviado a la cafetería. El pago se realiza físicamente en caja al recoger.'
      );

      // Open live tracker for this order
      setActiveOrderId(docRef.id);
    } catch (err) {
      console.error('Error creating order:', err);
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If viewing specific active order
  if (activeOrderId) {
    return (
      <div className="bg-stone-50 min-h-screen">
        {/* Top Mini Header */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-30 px-4 py-3 shadow-xs">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                ☕
              </div>
              <div>
                <h1 className="text-sm font-bold text-stone-900 leading-tight">CampusBite</h1>
                <p className="text-[10px] text-stone-500 font-medium">Click & Collect • Estudiantes</p>
              </div>
            </div>

            <button
              onClick={() => setActiveOrderId(null)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
            >
              Ver Menú Completo
            </button>
          </div>
        </header>

        {/* Notice Modal/Alert if just created */}
        {orderConfirmedNotice && (
          <div className="max-w-md mx-auto p-4 animate-fade-in">
            <div className="p-4 rounded-2xl bg-amber-500 text-white shadow-md flex items-start gap-3">
              <Sparkles className="w-5 h-5 shrink-0 mt-0.5 text-amber-200" />
              <div className="flex-1">
                <h4 className="font-bold text-sm">¡Pedido registrado con éxito!</h4>
                <p className="text-xs text-amber-100 mt-0.5 font-medium leading-relaxed">
                  {orderConfirmedNotice}
                </p>
              </div>
              <button
                onClick={() => setOrderConfirmedNotice(null)}
                className="text-amber-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <LiveOrderTracker
          orderId={activeOrderId}
          onBackToMenu={() => {
            setActiveOrderId(null);
            setOrderConfirmedNotice(null);
          }}
        />
      </div>
    );
  }

  // Active ongoing orders for quick top banner
  const inProgressOrder = studentOrders.find((o) =>
    ['recibido', 'preparando', 'listo'].includes(o.status)
  );

  return (
    <div className="bg-stone-50 min-h-screen text-stone-800 pb-28">
      {/* Mobile-First Header */}
      <header className="bg-white border-b border-stone-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                ☕
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold text-stone-900 tracking-tight">CampusBite</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider">
                    Estudiantes
                  </span>
                </div>
                <p className="text-xs text-stone-500 font-medium">Cafetería Central Universitaria</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Order history trigger */}
              {studentOrders.length > 0 && (
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="relative p-2 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 transition"
                  title="Historial de mis pedidos"
                >
                  <History className="w-4 h-4" />
                  {inProgressOrder && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                  )}
                </button>
              )}

              {/* Student identity badge */}
              <div className="flex items-center gap-2 pl-2 border-l border-stone-200 text-xs">
                <div className="text-right hidden sm:block">
                  <p className="font-bold text-stone-800 leading-tight">{studentName}</p>
                  <p className="text-[10px] text-stone-500">{studentId}</p>
                </div>
                <button
                  onClick={() => {
                    const newName = prompt('Ingresa tu nombre para los pedidos:', studentName);
                    if (newName) {
                      const newId = prompt('Código universitario (ej: EST-2024-01):', studentId) || studentId;
                      handleSaveProfile(newName, newId);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center hover:ring-2 hover:ring-amber-500 transition font-bold"
                  title="Cambiar datos de estudiante"
                >
                  <User className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Active Order Banner if student has order in progress */}
        {inProgressOrder && (
          <div
            onClick={() => setActiveOrderId(inProgressOrder.id)}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-mono font-bold text-sm">
                {inProgressOrder.pickupCode}
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  Pedido en curso ({inProgressOrder.status.toUpperCase()})
                </p>
                <p className="text-xs font-medium mt-0.5">Toca aquí para ver el rastreo en vivo</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-200" />
          </div>
        )}

        {/* Hero Banner / Instructions */}
        <div className="rounded-3xl bg-gradient-to-br from-amber-900 via-stone-900 to-stone-950 text-white p-5 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-full border border-amber-700/50 mb-2">
              ⚡ Click & Collect Universitario
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Pide desde tu móvil, evita las filas.
            </h2>
            <p className="text-stone-300 text-xs sm:text-sm mt-1.5 max-w-md leading-relaxed">
              Elige tus favoritos, confirma tu orden y retira en ventanilla pagando directamente en caja.
            </p>
          </div>
          {/* Subtle graphic accent */}
          <div className="absolute right-2 -bottom-6 opacity-15 pointer-events-none text-9xl">
            🍔
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar hamburguesas, café, empanadas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-stone-200/90 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Categories Horizontal Scroll */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-xs scale-102'
                    : 'bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-100'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Interactive Products Grid */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-stone-500 font-medium">Cargando menú en tiempo real...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-14 text-center bg-white rounded-3xl border border-stone-200/80 p-6">
            <Coffee className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <h3 className="font-bold text-stone-700 text-sm">No encontramos productos</h3>
            <p className="text-xs text-stone-500 mt-1">
              Prueba con otro término de búsqueda o cambia de categoría.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.map((product) => {
              const inCart = cart.find((i) => i.productId === product.id);
              const isAvailable = product.isAvailable;

              return (
                <div
                  key={product.id}
                  className={`group bg-white rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                    isAvailable
                      ? 'border-stone-200/80 shadow-2xs hover:shadow-md hover:border-amber-200'
                      : 'border-stone-200 bg-stone-50/70 opacity-75'
                  }`}
                >
                  {/* Image Container with CSS object-cover */}
                  <div className="relative h-44 w-full overflow-hidden bg-stone-100">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                        !isAvailable ? 'grayscale-[50%] opacity-85' : ''
                      }`}
                      loading="lazy"
                    />

                    {/* Category pill */}
                    <span className="absolute top-3 left-3 bg-stone-900/75 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {product.category}
                    </span>

                    {/* Prep time badge */}
                    {product.prepTimeMinutes && (
                      <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-stone-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                        <Clock className="w-3 h-3 text-amber-600" />
                        {product.prepTimeMinutes} min
                      </span>
                    )}

                    {/* Out of Stock Overlay / Badge */}
                    {!isAvailable && (
                      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-[2px] flex items-center justify-center p-3 text-center">
                        <span className="px-3.5 py-1.5 rounded-full bg-red-600 text-white text-xs font-black tracking-wider uppercase shadow-md animate-pulse">
                          Agotado en Cocina
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm line-clamp-1 leading-snug">
                        {product.name}
                      </h3>
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-stone-400 font-semibold block uppercase">
                          Precio
                        </span>
                        <span className="text-base font-extrabold text-stone-900">
                          ${product.price.toLocaleString('es-CO')}
                        </span>
                      </div>

                      {/* Add button or quantity adjuster */}
                      {isAvailable ? (
                        inCart ? (
                          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-xl p-1">
                            <button
                              onClick={() => updateQuantity(product.id, -1)}
                              className="w-7 h-7 rounded-lg bg-white text-stone-800 flex items-center justify-center hover:bg-stone-100 shadow-2xs transition"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-amber-900">
                              {inCart.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(product.id, 1)}
                              className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center hover:bg-amber-700 shadow-2xs transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(product)}
                            className="inline-flex items-center gap-1 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Agregar
                          </button>
                        )
                      ) : (
                        <span className="text-xs font-medium text-stone-400 italic">
                          No disponible
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar (if items in cart) */}
      {cartItemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-40 animate-slide-up">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-stone-900 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between hover:bg-stone-800 active:scale-98 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center font-bold text-sm shadow-xs">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-stone-300">
                  {cartItemCount} {cartItemCount === 1 ? 'producto' : 'productos'} en bandeja
                </p>
                <p className="text-base font-extrabold text-white">
                  ${cartTotal.toLocaleString('es-CO')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
              Ver Bandeja & Confirmar
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Cart & Checkout Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-stone-900 text-base">Resumen de tu Pedido</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Mandatory Physical Payment Banner */}
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300/80 flex items-start gap-3 shadow-xs">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">
                    Aviso importante de pago
                  </h4>
                  <p className="text-xs text-amber-950 font-semibold mt-1 leading-relaxed">
                    Pedido enviado a la cafetería. El pago se realiza físicamente en caja al recoger.
                  </p>
                  <p className="text-[11px] text-amber-800/90 mt-1">
                    No se requiere tarjeta online ni cobros virtuales en este momento.
                  </p>
                </div>
              </div>

              {/* Student identification info */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-3">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Datos de entrega
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                      Nombre del Estudiante *
                    </label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => handleSaveProfile(e.target.value, studentId)}
                      placeholder="Tu nombre completo"
                      className="w-full text-xs font-medium px-3 py-2 bg-white rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                      Carnet o Código
                    </label>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => handleSaveProfile(studentName, e.target.value)}
                      placeholder="EST-2024-..."
                      className="w-full text-xs font-medium px-3 py-2 bg-white rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                    Indicaciones especiales para la cafetería (opcional)
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Ej: salsa aparte, café bien caliente, sin azúcar..."
                    className="w-full text-xs px-3 py-2 bg-white rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Productos ({cartItemCount})
                </h4>

                <div className="divide-y divide-stone-100">
                  {cart.map((item) => (
                    <div key={item.productId} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-stone-200"
                        />
                        <div>
                          <h5 className="text-xs font-bold text-stone-900 leading-snug">
                            {item.name}
                          </h5>
                          <p className="text-xs font-semibold text-amber-700 mt-0.5">
                            ${item.price.toLocaleString('es-CO')} c/u
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(item.productId, -1)}
                            className="w-6 h-6 rounded-lg bg-white text-stone-700 flex items-center justify-center hover:bg-stone-200"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-stone-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, 1)}
                            className="w-6 h-6 rounded-lg bg-stone-900 text-white flex items-center justify-center hover:bg-stone-800"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-stone-400 hover:text-red-500 p-1 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation */}
              <div className="pt-3 border-t border-stone-200 space-y-1.5">
                <div className="flex justify-between text-xs text-stone-500">
                  <span>Subtotal productos:</span>
                  <span>${cartTotal.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-xs text-stone-500">
                  <span>Tarifa de servicio cafetería:</span>
                  <span className="text-emerald-600 font-semibold">$0 (Gratis)</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-stone-900 pt-2 border-t border-stone-100">
                  <span>Total a pagar en caja:</span>
                  <span className="text-amber-900 font-mono text-lg">
                    ${cartTotal.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer / Confirm CTA */}
            <div className="p-4 bg-stone-50 border-t border-stone-100">
              <button
                onClick={handleConfirmOrder}
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 disabled:opacity-50 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando orden a la cafetería...
                  </>
                ) : (
                  <>
                    <span>Confirmar Pedido (Pagar en Caja)</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Order History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-stone-900 text-sm">Mis Pedidos Recientes</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {studentOrders.length === 0 ? (
                <p className="text-center text-xs text-stone-500 py-8">
                  Aún no tienes pedidos registrados en esta cafetería.
                </p>
              ) : (
                studentOrders.map((ord) => (
                  <div
                    key={ord.id}
                    onClick={() => {
                      setActiveOrderId(ord.id);
                      setShowHistoryModal(false);
                    }}
                    className="p-3.5 rounded-2xl border border-stone-200/90 hover:border-amber-400 bg-white hover:bg-amber-50/40 transition cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-sm text-stone-900">
                        {ord.pickupCode}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          ord.status === 'listo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.status === 'preparando'
                            ? 'bg-blue-100 text-blue-800'
                            : ord.status === 'recibido'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>

                    <p className="text-xs text-stone-500 line-clamp-1">
                      {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100 text-xs">
                      <span className="text-stone-400">
                        {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-bold text-stone-800">
                        ${ord.totalPrice.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
