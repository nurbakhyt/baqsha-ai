import { create } from "zustand";
import { setToken } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: "customer" | "admin";
}

interface CartItem {
  productId: string;
  name: string;
  priceMinor: number;
  quantity: number;
  package: string;
  unit: string;
  mediaKeys: string[];
}

interface StoreState {
  user: User | null;
  cart: CartItem[];
  setUser: (user: User | null) => void;
  setCart: (cart: CartItem[]) => void;
  addToCart: (item: CartItem) => void;
  updateQuantity: (productId: string, delta: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useStore = create<StoreState>((set) => ({
  user: null,
  cart: [],
  setUser: (user) => set({ user }),
  setCart: (cart) => set({ cart }),
  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((i) => i.productId === item.productId);
      if (existing) {
        const newQty = existing.quantity + item.quantity;
        if (newQty <= 0) {
          return { cart: state.cart.filter((i) => i.productId !== item.productId) };
        }
        return {
          cart: state.cart.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: newQty }
              : i
          ),
        };
      }
      return { cart: [...state.cart, item] };
    }),
  updateQuantity: (productId, delta) =>
    set((state) => ({
      cart: state.cart.reduce<CartItem[]>((acc, item) => {
        if (item.productId !== productId) {
          acc.push(item);
          return acc;
        }
        const newQty = item.quantity + delta;
        if (newQty <= 0) return acc;
        acc.push({ ...item, quantity: newQty });
        return acc;
      }, []),
    })),
  removeFromCart: (productId) =>
    set((state) => ({
      cart: state.cart.filter((i) => i.productId !== productId),
    })),
  clearCart: () => set({ cart: [] }),
  login: (user, token) => {
    setToken(token);
    set({ user });
  },
  logout: () => {
    setToken(null);
    set({ user: null, cart: [] });
  },
}));
