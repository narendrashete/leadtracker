import type { Product } from './types';

export const PRODUCTS: Product[] = [
  { id: 1, name: 'Wireless Noise-Cancelling Headphones', category: 'Electronics', price: 4999, rating: 4.6, stock: 24, emoji: '🎧', from: '#c7d2fe', to: '#a5b4fc' },
  { id: 2, name: 'Smart Fitness Watch', category: 'Electronics', price: 3499, rating: 4.3, stock: 8, emoji: '⌚', from: '#ddd6fe', to: '#c4b5fd' },
  { id: 3, name: 'Bluetooth Speaker', category: 'Electronics', price: 1899, rating: 4.4, stock: 40, emoji: '🔊', from: '#bfdbfe', to: '#93c5fd' },
  { id: 4, name: 'Classic Denim Jacket', category: 'Fashion', price: 2299, rating: 4.2, stock: 15, emoji: '🧥', from: '#e0e7ff', to: '#a5b4fc' },
  { id: 5, name: 'Running Sneakers', category: 'Fashion', price: 2799, rating: 4.5, stock: 3, emoji: '👟', from: '#fae8ff', to: '#e9d5ff' },
  { id: 6, name: 'Stainless Steel Cookware Set', category: 'Home & Kitchen', price: 3299, rating: 4.1, stock: 12, emoji: '🍳', from: '#cffafe', to: '#a5f3fc' },
  { id: 7, name: 'Automatic Coffee Maker', category: 'Home & Kitchen', price: 5499, rating: 4.7, stock: 0, emoji: '☕', from: '#fde68a', to: '#fcd34d' },
  { id: 8, name: 'Leather Wallet', category: 'Accessories', price: 799, rating: 4.0, stock: 60, emoji: '👛', from: '#fecdd3', to: '#fda4af' },
  { id: 9, name: 'Polarized Sunglasses', category: 'Accessories', price: 1299, rating: 4.3, stock: 22, emoji: '🕶️', from: '#d9f99d', to: '#bef264' },
  { id: 10, name: 'Travel Backpack 35L', category: 'Accessories', price: 1999, rating: 4.5, stock: 17, emoji: '🎒', from: '#bae6fd', to: '#7dd3fc' },
];

export const CATEGORIES = ['All', 'Electronics', 'Fashion', 'Home & Kitchen', 'Accessories'];

export const STAGES = [
  { label: 'Order Confirmed', desc: 'We received your order and payment (demo).', icon: '🧾', at: 0 },
  { label: 'Shipment Booked', desc: 'Courier partner assigned and AWB generated.', icon: '📋', at: 0.01 },
  { label: 'Pickup Scheduled', desc: 'Pickup agent assigned to collect your parcel.', icon: '📅', at: 0.08 },
  { label: 'Picked Up', desc: 'Parcel collected from the seller warehouse.', icon: '📦', at: 0.18 },
  { label: 'In Transit', desc: 'Parcel is moving between courier hubs.', icon: '🚚', at: 0.4 },
  { label: 'Reached Destination Hub', desc: 'Parcel arrived at the destination city hub.', icon: '🏢', at: 0.7 },
  { label: 'Out for Delivery', desc: 'Delivery partner is on the way to your address.', icon: '🛵', at: 0.9 },
  { label: 'Delivered', desc: 'Parcel delivered successfully.', icon: '✅', at: 1 },
];

export const COURIERS = [
  { code: 'GATI', name: 'GATI', prefix: 'GTI', base: 100, per: 10, tat: '2–3 days', days: 3, service: 'Express', color: '#dc2626' },
  { code: 'XPB', name: 'Xpressbees', prefix: 'XPB', base: 79, per: 8, tat: '3–5 days', days: 5, service: 'Surface', color: '#ea580c' },
  { code: 'SHR', name: 'Shiprocket', prefix: 'SHR', base: 69, per: 8, tat: '4–6 days', days: 6, service: 'Surface', color: '#7c3aed' },
];
