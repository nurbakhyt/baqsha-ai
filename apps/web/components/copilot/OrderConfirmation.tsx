"use client";

interface OrderConfirmationProps {
  orderId: string;
  items: { name: string; quantity: number; priceMinor: number; unit: string }[];
  totalMinor: number;
  deliveryAddress: string;
  contactPhone: string;
}

export function OrderConfirmation({ orderId, items, totalMinor, deliveryAddress, contactPhone }: OrderConfirmationProps) {
  const formatPrice = (priceMinor: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KZT", minimumFractionDigits: 0 }).format(priceMinor / 100);

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5 my-2 max-w-md">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">✅</span>
        <h3 className="font-bold text-green-800 text-lg">Заказ оформлен!</h3>
      </div>

      <div className="text-sm text-green-700 space-y-2">
        <p><span className="font-medium">Номер заказа:</span> <code className="bg-green-100 px-1.5 py-0.5 rounded text-xs">{orderId.slice(0, 8)}</code></p>

        <div className="border-t border-green-200 pt-2">
          <p className="font-medium mb-1">Состав:</p>
          {items.map((item, i) => (
            <p key={i} className="flex justify-between text-sm">
              <span>{item.name} × {item.quantity}</span>
              <span>{formatPrice(item.priceMinor * item.quantity)}</span>
            </p>
          ))}
        </div>

        <div className="border-t border-green-200 pt-2 flex justify-between font-bold text-base">
          <span>Итого:</span>
          <span>{formatPrice(totalMinor)}</span>
        </div>

        <div className="border-t border-green-200 pt-2 text-sm">
          <p><span className="font-medium">Адрес:</span> {deliveryAddress}</p>
          <p><span className="font-medium">Телефон:</span> {contactPhone}</p>
        </div>

        <p className="text-xs text-green-600 pt-1">Оплата при доставке наличными</p>
      </div>
    </div>
  );
}
