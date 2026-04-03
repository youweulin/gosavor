import { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, MapPin, Calendar, Navigation } from 'lucide-react';
import type { SavedOrder } from '../types';
import { getOrderHistory, deleteOrder } from '../services/storage';
import { useT } from '../i18n/context';

interface OrderHistoryProps {
  onBack: () => void;
}

const OrderHistory = ({ onBack }: OrderHistoryProps) => {
  const t = useT();
  const [orders, setOrders] = useState<SavedOrder[]>([]);

  useEffect(() => {
    setOrders(getOrderHistory());
  }, []);

  const handleDelete = (id: string) => {
    const updated = deleteOrder(id);
    setOrders(updated);
  };

  const navigateTo = (order: SavedOrder) => {
    if (order.location) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${order.location.lat},${order.location.lng}`,
        '_blank'
      );
    } else {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.restaurantName)}`,
        '_blank'
      );
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    const val = Math.round(amount);
    if (['¥', '$', '€'].includes(currency)) return `${currency}${val}`;
    return `${val} ${currency}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm px-4 py-4 flex items-center gap-3 border-b border-gray-200">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg">{t('history.title')}</h1>
      </div>

      {/* Orders */}
      <div className="p-4 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 opacity-30" />
            <p>{t('history.empty')}</p>
            <p className="text-sm mt-1">{t('history.emptyHint')}</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm p-4 border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Calendar size={12} />
                    {new Date(order.timestamp).toLocaleDateString()}
                  </div>
                  <h3 className="font-bold text-base">{order.restaurantName}</h3>
                  {order.location && (
                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <MapPin size={10} /> {order.location.lat.toFixed(4)}, {order.location.lng.toFixed(4)}
                    </p>
                  )}
                </div>
                <button onClick={() => handleDelete(order.id)} className="p-2 rounded-full hover:bg-gray-100">
                  <Trash2 size={16} className="text-gray-500" />
                </button>
              </div>

              {/* Items preview */}
              <div className="mt-3 space-y-1">
                {order.items.slice(0, 3).map((oi, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-300">{oi.item.translatedName}</span>
                    <span className="text-gray-500">x{oi.quantity}</span>
                  </div>
                ))}
                {order.items.length > 3 && (
                  <p className="text-xs text-gray-500">+ {order.items.length - 3} 項...</p>
                )}
              </div>

              {/* Total + Navigate */}
              <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="font-bold text-lg text-orange-400">
                  {formatPrice(order.totalAmount, order.currency)}
                </span>
                <button
                  onClick={() => navigateTo(order)}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm flex items-center gap-2"
                >
                  <Navigation size={14} /> {t('history.navigate')}
                </button>
              </div>

              {/* Split info */}
              {order.splitInfo && (
                <div className="mt-2 p-2 bg-gray-800/50 rounded-lg text-xs text-gray-400">
                  {order.splitInfo.paidBy} 先付 &middot; {order.splitInfo.persons} 人分帳 &middot; 每人 {formatPrice(order.splitInfo.perPerson, order.currency)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
