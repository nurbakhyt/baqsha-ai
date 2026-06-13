"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/generative/ProductCard";
import { useStore } from "@/lib/hooks/useStore";

interface Product {
  id: string;
  name: string;
  description?: string;
  priceMinor: number;
  stock: number;
  package: string;
  unit: string;
  mediaKeys: string[];
  categoryId: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  children?: Category[];
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);

  const cart = useStore((s) => s.cart);
  const addToCart = useStore((s) => s.addToCart);
  const removeFromCart = useStore((s) => s.removeFromCart);

  useEffect(() => {
    Promise.all([
      fetch("/api/catalog/products").then((r) => r.json()),
      fetch("/api/catalog/categories").then((r) => r.json()),
    ]).then(([productsRes, categoriesRes]) => {
      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
      setLoading(false);
    });
  }, []);

  const filteredProducts = products.filter((p) => {
    if (selectedCategory && p.categoryId !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.priceMinor * i.quantity, 0);

  const formatPrice = (priceMinor: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "KZT",
      minimumFractionDigits: 0,
    }).format(priceMinor / 100);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary-600">🥬 Baqsha.AI</h1>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Поиск товаров..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded-lg px-4 py-2 w-64 focus:ring-2 focus:ring-primary-500 outline-none"
            />
            <button
              onClick={() => setCartOpen(!cartOpen)}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 relative"
            >
              🛒 Корзина
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Cart dropdown */}
      {cartOpen && cart.length > 0 && (
        <div className="fixed top-16 right-4 w-96 bg-white rounded-xl shadow-xl border z-20 max-h-[70vh] overflow-auto">
          <div className="p-4">
            <h2 className="font-bold text-lg mb-3">Корзина</h2>
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 py-3 border-b last:border-0">
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-gray-500">{formatPrice(item.priceMinor)} / {item.package}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (item.quantity <= 1) removeFromCart(item.productId);
                      else addToCart({ ...item, quantity: -1 });
                    }}
                    className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-medium">{item.quantity}</span>
                  <button
                    onClick={() => addToCart({ ...item, quantity: 1 })}
                    className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
                <span className="font-semibold w-20 text-right">{formatPrice(item.priceMinor * item.quantity)}</span>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t flex justify-between font-bold text-lg">
              <span>Итого:</span>
              <span className="text-primary-600">{formatPrice(cartTotal)}</span>
            </div>
            <button className="mt-3 w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700">
              Оформить заказ
            </button>
          </div>
        </div>
      )}

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              !selectedCategory
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            Все товары
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                selectedCategory === cat.id
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-700 border hover:bg-gray-50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="max-w-7xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Товары не найдены</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} formatPrice={formatPrice} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}