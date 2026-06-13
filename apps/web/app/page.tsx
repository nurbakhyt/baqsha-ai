"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/generative/ProductCard";

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
      <header className="bg-white shadow-sm">
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
            <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
              🛒 Корзина
            </button>
          </div>
        </div>
      </header>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} formatPrice={formatPrice} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}