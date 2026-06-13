"use client";

import { useStore } from "@/lib/hooks/useStore";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description?: string;
    priceMinor: number;
    stock: number;
    package: string;
    unit: string;
    mediaKeys: string[];
  };
  formatPrice: (priceMinor: number) => string;
  onAddToCart?: (productId: string) => void;
}

export function ProductCard({ product, formatPrice }: ProductCardProps) {
  const cart = useStore((s) => s.cart);
  const addToCart = useStore((s) => s.addToCart);
  const removeFromCart = useStore((s) => s.removeFromCart);

  const cartItem = cart.find((i) => i.productId === product.id);
  const inCart = !!cartItem;

  const imageUrl = product.mediaKeys[0]
    ? `https://your-bucket.r2.cloudflarestorage.com/${product.mediaKeys[0]}`
    : "/placeholder-product.jpg";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gray-100 relative">
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23f3f4f6' width='200' height='200'/%3E%3Ctext fill='%239ca3af' font-family='sans-serif' font-size='16' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3E🥬%3C/text%3E%3C/svg%3E";
          }}
        />
        {inCart && (
          <span className="absolute top-2 right-2 bg-primary-600 text-white text-xs px-2 py-1 rounded-full font-bold">
            {cartItem.quantity} в корзине
          </span>
        )}
        {!inCart && product.stock < 10 && product.stock > 0 && (
          <span className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
            Осталось {product.stock}
          </span>
        )}
        {product.stock === 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            Нет в наличии
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-lg">{product.name}</h3>
        {product.description && (
          <p className="text-gray-500 text-sm mt-1 line-clamp-2">{product.description}</p>
        )}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="text-xl font-bold text-primary-600">{formatPrice(product.priceMinor)}</span>
            <span className="text-gray-400 text-sm ml-1">/ {product.package}</span>
          </div>
          {product.stock > 0 && (
            inCart ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (cartItem.quantity <= 1) removeFromCart(product.id);
                    else addToCart({ productId: product.id, name: product.name, priceMinor: product.priceMinor, quantity: -1, package: product.package, unit: product.unit, mediaKeys: product.mediaKeys });
                  }}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-lg transition-colors"
                >
                  −
                </button>
                <span className="w-8 text-center font-bold text-lg">{cartItem.quantity}</span>
                <button
                  onClick={() => addToCart({ productId: product.id, name: product.name, priceMinor: product.priceMinor, quantity: 1, package: product.package, unit: product.unit, mediaKeys: product.mediaKeys })}
                  className="w-8 h-8 rounded-lg bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center font-bold text-lg transition-colors"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                onClick={() => addToCart({ productId: product.id, name: product.name, priceMinor: product.priceMinor, quantity: 1, package: product.package, unit: product.unit, mediaKeys: product.mediaKeys })}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                В корзину
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}