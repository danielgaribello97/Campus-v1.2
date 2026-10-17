import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { Product, Order } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-burger-classic',
    name: 'Hamburguesa Universitaria Doble Queso',
    description: 'Carne 100% de res, queso cheddar fundido, lechuga fresca, tomate y salsa especial de la casa en pan brioche.',
    price: 18500,
    category: 'Comida Rápida',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    isAvailable: true,
    prepTimeMinutes: 12,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-empanada-carne',
    name: 'Empanada Criolla de Carne y Papa',
    description: 'Empanada dorada y crujiente rellena de carne desmechada sazonada con finas hierbas y papa criolla.',
    price: 4500,
    category: 'Snacks & Típicos',
    imageUrl: 'https://images.unsplash.com/photo-1628106235973-f655b57cad49?auto=format&fit=crop&w=800&q=80',
    isAvailable: true,
    prepTimeMinutes: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-latte-artesanal',
    name: 'Café Latte Artesanal Campus',
    description: 'Espresso doble de origen colombiano con leche vaporizada sedosa y delicado arte latte.',
    price: 6500,
    category: 'Cafetería',
    imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80',
    isAvailable: true,
    prepTimeMinutes: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-croissant-mantequilla',
    name: 'Croissant Francés de Mantequilla',
    description: 'Hojaldre tradicional horneado cada mañana con pura mantequilla, crujiente por fuera y suave por dentro.',
    price: 5200,
    category: 'Repostería',
    imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80',
    isAvailable: true,
    prepTimeMinutes: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-sandwich-pollo',
    name: 'Sandwich Gourmet de Pollo y Aguacate',
    description: 'Pechuga a la plancha, aguacate maduro, queso mozzarella y mayonesa de cilantro en pan ciabatta rústico.',
    price: 15500,
    category: 'Comida Rápida',
    imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80',
    isAvailable: true,
    prepTimeMinutes: 8,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-bowl-yogur',
    name: 'Bowl de Yogur Griego y Frutas',
    description: 'Yogur griego cremoso, mix de fresas, arándanos, banano fresco, miel de abejas y granola crujiente.',
    price: 11000,
    category: 'Desayunos & Bowls',
    imageUrl: 'https://images.unsplash.com/photo-1511688878353-3a2f5be94cd7?auto=format&fit=crop&w=800&q=80',
    isAvailable: true,
    prepTimeMinutes: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-muffin-arandanos',
    name: 'Muffin Rústico de Arándanos',
    description: 'Esponjoso panecillo con arándanos silvestres frescos, toque de ralladura de limón y crumble dulce.',
    price: 5800,
    category: 'Repostería',
    imageUrl: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=800&q=80',
    isAvailable: false, // Initially demo out-of-stock behavior
    prepTimeMinutes: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-iced-caramel',
    name: 'Iced Caramel Macchiato Frío',
    description: 'Bebida refrescante con espresso intenso, leche fría con hielo y un generoso sirope de caramelo salado.',
    price: 8200,
    category: 'Cafetería',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80',
    isAvailable: true,
    prepTimeMinutes: 4,
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-seed-001',
    studentName: 'Mateo Gómez',
    studentId: 'EST-2023-412',
    notes: 'Por favor con salsa tártara aparte.',
    totalPrice: 23000,
    pickupCode: '#C-101',
    status: 'recibido',
    items: [
      {
        productId: 'prod-burger-classic',
        name: 'Hamburguesa Universitaria Doble Queso',
        price: 18500,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
      },
      {
        productId: 'prod-empanada-carne',
        name: 'Empanada Criolla de Carne y Papa',
        price: 4500,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1628106235973-f655b57cad49?auto=format&fit=crop&w=800&q=80',
      },
    ],
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
  {
    id: 'ord-seed-002',
    studentName: 'Camila Ríos',
    studentId: 'EST-2024-108',
    notes: 'Leche de almendras o deslactosada por favor.',
    totalPrice: 11700,
    pickupCode: '#C-102',
    status: 'preparando',
    items: [
      {
        productId: 'prod-latte-artesanal',
        name: 'Café Latte Artesanal Campus',
        price: 6500,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80',
      },
      {
        productId: 'prod-croissant-mantequilla',
        name: 'Croissant Francés de Mantequilla',
        price: 5200,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80',
      },
    ],
    createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  },
  {
    id: 'ord-seed-003',
    studentName: 'Santiago Vargas',
    studentId: 'EST-2022-879',
    notes: '',
    totalPrice: 15500,
    pickupCode: '#C-103',
    status: 'listo',
    items: [
      {
        productId: 'prod-sandwich-pollo',
        name: 'Sandwich Gourmet de Pollo y Aguacate',
        price: 15500,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80',
      },
    ],
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
];

export async function ensureSeedData(force = false): Promise<void> {
  try {
    const productsRef = collection(db, 'products');
    const prodSnapshot = await getDocs(productsRef);

    if (prodSnapshot.empty || force) {
      console.log('Seeding initial products to Firestore...');
      for (const prod of INITIAL_PRODUCTS) {
        await setDoc(doc(db, 'products', prod.id), prod);
      }
    }

    const ordersRef = collection(db, 'orders');
    const orderSnapshot = await getDocs(ordersRef);

    if (orderSnapshot.empty || force) {
      console.log('Seeding demo initial orders to Firestore...');
      for (const order of INITIAL_ORDERS) {
        await setDoc(doc(db, 'orders', order.id), order);
      }
    }
  } catch (err) {
    console.error('Error during ensureSeedData:', err);
    handleFirestoreError(err, OperationType.WRITE, 'products');
  }
}
