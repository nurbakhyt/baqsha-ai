"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/hooks/useStore";
import { apiFetch } from "@/lib/api";
import type { Order } from "@baqsha/shared";

export default function OrdersPage() {
  const user = useStore((s) => s.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiFetch("/api/orders").then((res) => {
      setOrders(res.data || []);
      setLoading(false);
    });
  }, [user]);

  const formatPrice = (priceMinor: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "KZT",
      minimumFractionDigits: 0,
    }).format(priceMinor / 100);
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    created: { label: "Создан", color: "bg-blue-100 text-blue-800" },
    paid: { label: "Оплачен", color: "bg-yellow-100 text-yellow-800" },
    shipped: { label: "Отправлен", color: "bg-purple-100 text-purple-800" },
    delivered: { label: "Доставлен", color: "bg-green-100 text-green-800" },
    cancelled: { label: "Отменён", color: "bg-red-100 text-red-800" },
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Войдите в аккаунт, чтобы увидеть заказы</p>
          <a href="/" className="text-primary-600 hover:text-primary-700">На главную</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-primary-600">Baqsha.AI</a>
          <h2 className="text-lg font-semibold text-gray-700">Мои заказы</h2>
          <div className="w-24" />
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">У вас пока нет заказов</p>
            <a href="/" className="text-primary-600 hover:text-primary-700 font-medium">Перейти к покупкам</a>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusInfo = statusLabels[order.status] || { label: order.status, color: "bg-gray-100 text-gray-800" };
              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">
                        {formatDate(order.createdAt)}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <span className="font-bold text-lg text-primary-600">
                      {formatPrice(order.totalMinor)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    {order.items.map((item) => (
                      <div key={item.productId} className="flex justify-between">
                        <span>{item.name} &times; {item.quantity} {item.unit}</span>
                        <span className="text-gray-500">{formatPrice(item.priceMinor * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t text-sm text-gray-500 space-y-0.5">
                    <div>📍 {order.deliveryAddress}</div>
                    <div>📞 {order.contactPhone}</div>
                    {order.notes && <div>📝 {order.notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
