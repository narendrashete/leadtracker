export type Product = { id: number; name: string; category: string; price: number; rating: number; stock: number; emoji: string; from: string; to: string };

export type CartLine = { id: number; qty: number };

export type Customer = { name: string; email: string; mobile: string; address: string; city: string; state: string; pin: string };

export type Courier = { code: string; name: string; prefix: string; price: number; tat: string; days: number; service: string; serviceable: boolean; color: string; est: string };

export type Order = {
  orderNo: string; draftId: string; awb: string; createdAt: number;
  items: { id: number; name: string; price: number; qty: number; emoji: string }[];
  customer: Customer; courier: Courier; subtotal: number; shipping: number; total: number; progress: number;
};

export type Draft = { id: string; customer: Customer };
