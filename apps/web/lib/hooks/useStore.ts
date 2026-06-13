import { create } from "zustand";

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
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
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
  removeFromCart: (productId) =>
    set((state) => ({
      cart: state.cart.filter((i) => i.productId !== productId),
    })),
  clearCart: () => set({ cart: [] }),
  logout: () => set({ user: null, cart: [] }),
}));