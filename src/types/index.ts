export type OrderStatus = 'recibido' | 'preparando' | 'listo' | 'entregado' | 'cancelado';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  isAvailable: boolean;
  prepTimeMinutes: number;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  studentName: string;
  studentId: string;
  notes?: string;
  totalPrice: number;
  pickupCode: string;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'student' | 'cafeteria' | 'split';
