export type OrderStatus = "Pending" | "Preparing" | "Out for Delivery" | "Delivered" | "Cancelled";
export type CustomOrderStatus = "Pending Review" | "Quoted" | "Confirmed" | "Rejected";

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  total: number;
  paymentMethod: "COD" | "GCash";
  deliveryMode: "Delivery" | "Pick-up";
  deliveryAddress?: string;
  status: OrderStatus;
  createdAt: string;
  adminNote?: string;
}

export interface CustomerBasic {
  id: string;
  name: string;
  phone: string;
}

export interface Message {
  id: string;
  role: "customer" | "admin";
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  customer: CustomerBasic;
  messages: Message[];
  status: "open" | "resolved";
  unreadCount: number;
}

export interface CustomOrderRequest {
  id: string;
  customer: CustomerBasic;
  messages: Message[];
  status: CustomOrderStatus;
  agreedPrice?: number;
  description?: string;
  quantity?: number;
  deliveryDate?: string;
}

export interface Product {
  id: string;
  name: string;
  category: "Kakanin" | "Suman" | "Party Trays";
  price: number;
  description: string;
  tags: string[];
  isBestSeller: boolean;
  imageUrl?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  status: "Active" | "Inactive";
}
