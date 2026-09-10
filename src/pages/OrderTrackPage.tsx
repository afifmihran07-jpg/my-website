import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/dataService';
import { Order } from '../types';
import { SafeImage } from '../components/SafeImage';
import { HssStarIcon } from '../components/HssLogo';
import {
  Search,
  Package,
  Truck,
  CheckCircle,
  ExternalLink,
  Phone,
  RefreshCw,
  XCircle,
  RotateCcw
} from 'lucide-react';

interface OrderTrackPageProps {
  onNavigate: (route: string) => void;
  initialOrderId?: string;
}

export const OrderTrackPage: React.FC<OrderTrackPageProps> = ({ onNavigate, initialOrderId }) => {
  const [orderId, setOrderId] = useState(initialOrderId || '');
  const [phone, setPhone] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialOrderId) {
      const order = DatabaseService.getOrderById(initialOrderId);
      if (order) {
        setSearchedOrder(order);
        setPhone(order.phone);
        setSearched(true);
      }
    }
  }, [initialOrderId]);

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    if (!orderId.trim()) return;

    // First try direct lookup by Order ID and Phone
    let found = await DatabaseService.trackOrder(orderId, phone);

    // If phone wasn't strictly provided, allow order ID lookup
    if (!found) {
      const ord = DatabaseService.getOrderById(orderId.trim().toUpperCase());
      if (ord) found = ord;
    }

    setSearchedOrder(found || null);
    setSearched(true);
  };

  const handleCancelOrder = (id: string) => {
    if (window.confirm('Are you sure you want to cancel this order? This will release reserved stock.')) {
      DatabaseService.updateOrderStatus(id, 'cancelled', 'Cancelled by customer');
      const updated = DatabaseService.getOrderById(id);
      if (updated) setSearchedOrder(updated);
      setActionMessage('Your order has been cancelled. If paid via bKash, refund process will begin.');
    }
  };

  const handleRequestExchange = (id: string) => {
    DatabaseService.updateOrderStatus(id, 'refund_requested', 'Exchange/Return requested by customer');
    const updated = DatabaseService.getOrderById(id);
    if (updated) setSearchedOrder(updated);
    setActionMessage('Size exchange request logged. Our concierge will contact you within 4 business hours.');
  };

  const steps = [
    { key: 'pending', label: 'PLACED' },
    { key: 'confirmed', label: 'CONFIRMED' },
    { key: 'processing', label: 'PACKING' },
    { key: 'shipped', label: 'SHIPPED' },
    { key: 'delivered', label: 'DELIVERED' }
  ];

  const getStepIndex = (status: Order['orderStatus']) => {
    switch (status) {
      case 'pending': return 0;
      case 'confirmed': return 1;
      case 'processing': return 2;
      case 'shipped': return 3;
      case 'delivered': return 4;
      default: return 0;
    }
  };

  const activeIndex = searchedOrder ? getStepIndex(searchedOrder.orderStatus) : 0;
  const isCancelled = searchedOrder?.orderStatus === 'cancelled';
  const isRefundRequested = searchedOrder?.orderStatus === 'refund_requested';

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 sm:py-20 text-neutral-300">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="text-center space-y-3 pb-6 border-b border-neutral-900">
          <div className="inline-flex items-center gap-2 text-[#e11d48]">
            <HssStarIcon className="w-4 h-4" />
            <span className="font-mono text-xs tracking-widest uppercase font-bold">
              ORDER RECONCILIATION
            </span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
            TRACK YOUR CONSIGNMENT
          </h1>
          <p className="text-xs text-neutral-400 font-sans max-w-md mx-auto">
            Real-time status updates from our Dhaka fulfillment center and courier logistics partners.
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-neutral-950 border border-neutral-900 p-6 shadow-xl">
          <form onSubmit={handleTrackSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                  ORDER REFERENCE NUMBER *
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. HSS-2026-1042"
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#e11d48] font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                  PHONE NUMBER (OPTIONAL VERIFICATION)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#e11d48] font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-950/40"
            >
              <Search className="w-4 h-4" />
              TRACK CONSIGNMENT
            </button>
          </form>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div className="p-4 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Search Result */}
        {searched && (
          <>
            {!searchedOrder ? (
              <div className="text-center py-12 bg-neutral-950 border border-neutral-900 p-8">
                <Package className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                <h3 className="font-display font-bold text-base text-white uppercase">
                  Order Not Found
                </h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto mb-6">
                  Please verify your Order ID format (e.g. <code>HSS-2026-XXXX</code>) or reach our concierge directly.
                </p>
                <div className="flex justify-center gap-4 text-xs font-mono text-neutral-400">
                  <a href="tel:+8801879665602" className="hover:text-white flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#e11d48]" /> +8801879665602
                  </a>
                  <span>•</span>
                  <a href="tel:+8801303080934" className="hover:text-white flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#e11d48]" /> +8801303080934
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-950 border border-neutral-800 p-6 sm:p-8 space-y-8 shadow-2xl">
                {/* Top Meta */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-900">
                  <div>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                      CONSIGNMENT ID
                    </span>
                    <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight">
                      {searchedOrder.id}
                    </h2>
                    <p className="text-xs text-neutral-400 font-mono mt-0.5">
                      Placed on {new Date(searchedOrder.createdAt).toLocaleDateString()} • {searchedOrder.customerName}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">
                      PAYMENT & STATUS
                    </span>
                    <span className="font-tech text-base font-bold text-white uppercase">
                      {searchedOrder.paymentMethod} •{' '}
                      <span className={
                        searchedOrder.paymentStatus === 'paid'
                          ? 'text-emerald-400'
                          : searchedOrder.paymentStatus === 'rejected'
                          ? 'text-red-400'
                          : 'text-amber-400'
                      }>
                        {searchedOrder.paymentStatus === 'pending_verification' ? 'PENDING VERIFICATION' : searchedOrder.paymentStatus.toUpperCase()}
                      </span>
                    </span>
                    {searchedOrder.paymentReferenceId && (
                      <p className="text-[10px] font-mono text-neutral-400">
                        TRX: <span className="text-white font-bold">{searchedOrder.paymentReferenceId}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Manual Verification Status Notice Banner */}
                {searchedOrder.paymentStatus === 'pending_verification' && (
                  <div className="p-3 bg-amber-950/40 border border-amber-900/60 text-amber-300 text-xs font-mono">
                    <strong>PAYMENT PENDING MANUAL VERIFICATION:</strong> Your payment reference ({searchedOrder.paymentReferenceId}) is being reviewed against our {searchedOrder.paymentMethod.toUpperCase()} merchant statements. Once confirmed, you will receive an SMS update on {searchedOrder.phone}.
                  </div>
                )}

                {searchedOrder.paymentStatus === 'rejected' && (
                  <div className="p-3 bg-red-950/50 border border-red-900 text-red-200 text-xs font-mono">
                    <strong>ACTION REQUIRED — PAYMENT NOT VERIFIED:</strong> Transaction ID {searchedOrder.paymentReferenceId} could not be confirmed against our {searchedOrder.paymentMethod.toUpperCase()} account statements. Please contact HSS concierge at +8801879665602 or WhatsApp to resolve your order.
                  </div>
                )}

                {/* Status Progression Bar */}
                {isCancelled ? (
                  <div className="p-4 bg-red-950/60 border border-red-900 text-red-200 text-xs font-mono flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <span>THIS ORDER HAS BEEN CANCELLED.</span>
                  </div>
                ) : isRefundRequested ? (
                  <div className="p-4 bg-amber-950/60 border border-amber-900 text-amber-200 text-xs font-mono flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <span>SIZE EXCHANGE / RETURN REQUEST IN PROGRESS WITH CONCIERGE.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-neutral-500 uppercase">
                      <span>ORDER LIFECYCLE</span>
                      <span className="text-[#e11d48] font-bold">
                        CURRENT: {searchedOrder.orderStatus.toUpperCase()}
                      </span>
                    </div>

                    {/* Step Visualizer */}
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
                      {steps.map((st, idx) => {
                        const isCompleted = idx <= activeIndex;
                        const isCurrent = idx === activeIndex;
                        return (
                          <div key={st.key} className="space-y-1.5">
                            <div
                              className={`h-2 transition-all ${
                                isCompleted
                                  ? 'bg-[#e11d48]'
                                  : 'bg-neutral-800'
                              } ${isCurrent ? 'ring-2 ring-white/60' : ''}`}
                            />
                            <span
                              className={`block text-[9px] sm:text-[11px] font-mono uppercase font-bold truncate ${
                                isCompleted ? 'text-white' : 'text-neutral-600'
                              }`}
                            >
                              {st.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Courier Shipping Details */}
                {searchedOrder.courierName && (
                  <div className="p-4 bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-neutral-950 border border-neutral-800 text-[#e11d48]">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-neutral-400 uppercase">DISPATCHED CARRIER</span>
                        <h4 className="font-display font-bold text-sm text-white uppercase">
                          {searchedOrder.courierName}
                        </h4>
                        <p className="text-xs font-mono text-neutral-400">
                          Waybill / Consignment #{' '}
                          <strong className="text-white">{searchedOrder.courierTrackingNumber}</strong>
                        </p>
                      </div>
                    </div>

                    {searchedOrder.courierTrackingUrl && (
                      <a
                        href={searchedOrder.courierTrackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-neutral-950 hover:bg-[#e11d48] text-white border border-neutral-700 text-xs font-tech font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                      >
                        COURIER LIVE PORTAL
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}

                {/* Items in Consignment */}
                <div className="space-y-3">
                  <h4 className="font-display font-bold text-xs uppercase tracking-widest text-neutral-400">
                    CONSIGNMENT CONTENTS ({searchedOrder.items.length})
                  </h4>
                  <div className="divide-y divide-neutral-900 border-y border-neutral-900">
                    {searchedOrder.items.map((item, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-14 bg-neutral-900 overflow-hidden flex-shrink-0">
                            <SafeImage
                              src={item.image}
                              alt={item.name}
                              containerClassName="w-full h-full"
                              aspectRatio="auto"
                            />
                          </div>
                          <div>
                            <p className="font-bold text-white uppercase">{item.name}</p>
                            <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
                              {item.selectedSize ? `SIZE: ${item.selectedSize} ` : ''}
                              {item.selectedColor ? `• ${item.selectedColor} ` : ''}
                              {item.posterDimensions ? `• ${item.posterDimensions} ` : ''}
                            </p>
                            <span className="text-neutral-500 text-[10px] font-mono">
                              ৳{item.price.toLocaleString()} × {item.quantity}
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="font-tech font-bold text-white text-sm">
                            ৳{item.lineTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 bg-neutral-900/40 border border-neutral-900 space-y-1.5 text-xs font-mono max-w-xs ml-auto">
                  <div className="flex justify-between text-neutral-400">
                    <span>Subtotal:</span>
                    <span>৳{searchedOrder.subtotal.toLocaleString()}</span>
                  </div>
                  {searchedOrder.discount > 0 && (
                    <div className="flex justify-between text-[#e11d48] font-bold">
                      <span>
                        Discount ({searchedOrder.couponCode || 'Promo'}{searchedOrder.couponDiscountType === 'percentage' ? ` - ${searchedOrder.couponDiscountValue}%` : ''}):
                      </span>
                      <span>-৳{searchedOrder.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-neutral-400">
                    <span>Delivery ({searchedOrder.deliveryLocation === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}):</span>
                    <span>৳{searchedOrder.deliveryCharge}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-neutral-900">
                    <span>Final Total:</span>
                    <span className="text-[#e11d48] font-tech">৳{searchedOrder.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Customer Actions: Cancel or Request Size Exchange */}
                <div className="pt-4 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    {/* Can cancel if order is pending */}
                    {searchedOrder.orderStatus === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(searchedOrder.id)}
                        className="px-3.5 py-2 bg-neutral-900 hover:bg-red-950 text-neutral-300 hover:text-red-400 border border-neutral-800 text-xs font-mono uppercase"
                      >
                        CANCEL ORDER
                      </button>
                    )}

                    {/* Can request exchange if delivered or shipped */}
                    {(searchedOrder.orderStatus === 'delivered' || searchedOrder.orderStatus === 'shipped') && (
                      <button
                        type="button"
                        onClick={() => handleRequestExchange(searchedOrder.id)}
                        className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-xs font-mono uppercase flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-[#e11d48]" />
                        REQUEST SIZE EXCHANGE (4-DAY POLICY)
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => onNavigate(`order-success/${searchedOrder.id}`)}
                    className="text-xs font-mono text-[#e11d48] hover:underline uppercase font-bold"
                  >
                    VIEW OFFICIAL RECEIPT →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
