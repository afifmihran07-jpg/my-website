import React, { useMemo } from 'react';
import { DatabaseService } from '../services/dataService';
import { CheckCircle2, ArrowRight, Phone, MapPin, Printer } from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { HssStarIcon } from '../components/HssLogo';

interface OrderSuccessPageProps {
  orderId: string;
  onNavigate: (route: string) => void;
}

export const OrderSuccessPage: React.FC<OrderSuccessPageProps> = ({ orderId, onNavigate }) => {
  const order = useMemo(() => {
    return DatabaseService.getOrderById(orderId);
  }, [orderId]);
  const content = useMemo(() => DatabaseService.getSiteContent(false), []);
  const co = content.checkout;

  if (!order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0a]">
        <h2 className="font-display font-black text-2xl text-white uppercase">Order Not Found</h2>
        <p className="text-xs text-neutral-400 mt-2 mb-6">
          Could not locate order #{orderId}. Please check your order ID or contact customer care.
        </p>
        <button
          onClick={() => onNavigate('shop')}
          className="px-6 py-3 bg-[#e11d48] text-white font-tech font-bold text-xs uppercase tracking-widest hover:bg-[#be123c] transition-colors"
        >
          RETURN TO SHOP
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Receipt Container */}
        <div className="bg-neutral-950 border border-neutral-800 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Top Badge */}
          <div className="text-center pb-8 border-b border-neutral-900">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${
              order.paymentStatus === 'pending_verification'
                ? 'bg-amber-950/60 border-amber-800 text-amber-400'
                : 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
            }`}>
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="flex items-center justify-center gap-2 text-[#e11d48] mb-1">
              <HssStarIcon className="w-4 h-4" />
              <span className="text-xs font-mono tracking-widest uppercase font-bold">
                {order.paymentStatus === 'pending_verification'
                  ? 'ORDER SUBMITTED • PAYMENT PENDING VERIFICATION'
                  : order.paymentMethod === 'cod'
                  ? 'ORDER PLACED • CASH ON DELIVERY'
                  : 'ORDER CONFIRMED • PAYMENT VERIFIED'}
              </span>
            </div>
            <h1 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
              {order.paymentStatus === 'pending_verification'
                ? (co.orderConfirmedTitle || 'ORDER RECEIVED')
                : (co.orderConfirmedSubtitle || 'THANK YOU FOR YOUR ORDER')}
            </h1>
            <p className="text-xs text-neutral-400 mt-2 font-mono">
              ORDER REFERENCE: <span className="text-white font-bold">{order.id}</span>
            </p>
            {order.paymentStatus === 'pending_verification' && (
              <p className="text-xs font-mono text-amber-300 max-w-lg mx-auto mt-2 bg-amber-950/40 p-2.5 border border-amber-900/60">
                Your payment is pending manual verification by HSS. We are verifying Transaction ID <strong>{order.paymentReferenceId}</strong> against our {order.paymentMethod.toUpperCase()} merchant statements. You will receive an SMS confirmation once verified.
              </p>
            )}
          </div>

          {/* Customer & Delivery Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-neutral-900 text-xs font-mono">
            <div className="space-y-1 text-neutral-400">
              <span className="text-white font-bold uppercase block text-[11px]">DISPATCH TO:</span>
              <p className="text-white font-semibold">{order.customerName}</p>
              <p>{order.phone}</p>
              <p className="flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 mt-0.5 text-[#e11d48] flex-shrink-0" />
                <span>{order.address} {order.area ? `(${order.area})` : ''}</span>
              </p>
            </div>

            <div className="space-y-1 text-neutral-400 sm:text-right">
              <span className="text-white font-bold uppercase block text-[11px]">PAYMENT & STATUS:</span>
              <p className="text-white uppercase font-bold">
                {order.paymentMethod === 'bkash'
                  ? 'bKash Manual Verification'
                  : order.paymentMethod === 'nagad'
                  ? 'Nagad Manual Verification'
                  : 'Cash on Delivery (COD)'}
              </p>
              <p>
                PAYMENT STATUS:{' '}
                <span className={`uppercase font-bold ${
                  order.paymentStatus === 'paid'
                    ? 'text-emerald-400'
                    : order.paymentStatus === 'pending_verification'
                    ? 'text-amber-400'
                    : 'text-neutral-300'
                }`}>
                  {order.paymentStatus === 'pending_verification' ? 'PENDING VERIFICATION' : order.paymentStatus.toUpperCase()}
                </span>
              </p>
              {order.paymentReferenceId && (
                <p className="text-neutral-400 font-mono">
                  SUBMITTED TRX ID: <span className="text-white font-bold">{order.paymentReferenceId}</span>
                </p>
              )}
              <p>
                DELIVERY ZONE:{' '}
                <span className="text-white font-bold">
                  {order.deliveryLocation === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}
                </span>
              </p>
            </div>
          </div>

          {/* Order Items Breakdown */}
          <div className="py-6 border-b border-neutral-900">
            <h3 className="font-display font-bold text-xs uppercase tracking-widest text-neutral-400 mb-4">
              PURCHASED PIECES ({order.items.length})
            </h3>
            <div className="divide-y divide-neutral-900">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center gap-4">
                  <div className="w-14 h-16 bg-neutral-900 border border-neutral-800 flex-shrink-0 overflow-hidden">
                    <SafeImage
                      src={item.image}
                      alt={item.name}
                      containerClassName="w-full h-full"
                      aspectRatio="auto"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-bold text-xs sm:text-sm text-white uppercase truncate">
                      {item.name}
                    </h4>
                    <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
                      {item.selectedSize ? `SIZE: ${item.selectedSize} ` : ''}
                      {item.selectedColor ? `• ${item.selectedColor} ` : ''}
                      {item.posterDimensions ? `${item.selectedPosterSize ? item.selectedPosterSize + ' — ' : ''}${item.posterDimensions}` : ''}
                    </p>
                    <p className="text-[11px] font-mono text-neutral-500">
                      ৳{item.price.toLocaleString()} × {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-tech font-bold text-sm text-white">
                      ৳{item.lineTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Calculation */}
          <div className="pt-6 space-y-2 text-xs font-mono max-w-xs ml-auto">
            <div className="flex justify-between text-neutral-400">
              <span>SUBTOTAL</span>
              <span className="font-tech font-bold text-white">৳{order.subtotal.toLocaleString()}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-[#e11d48] font-bold">
                <span>
                  DISCOUNT ({order.couponCode || 'PROMO'}{order.couponDiscountType === 'percentage' ? ` - ${order.couponDiscountValue}%` : ''})
                </span>
                <span>-৳{order.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-neutral-400">
              <span>DELIVERY CHARGE</span>
              <span className="font-tech font-bold text-white">৳{order.deliveryCharge}</span>
            </div>
            <div className="flex justify-between text-sm sm:text-base font-display font-black text-white pt-2 border-t border-neutral-900">
              <span>TOTAL</span>
              <span className="font-tech font-extrabold text-[#e11d48]">
                ৳{order.total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Client Concierge Note */}
          <div className="mt-8 p-4 bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400 space-y-2">
            <p className="font-bold text-white uppercase flex items-center gap-1.5 font-display">
              <Phone className="w-3.5 h-3.5 text-[#e11d48]" />
              NEXT STEPS & CLIENT ASSISTANCE
            </p>
            <p>
              Our fulfillment team in Dhaka will contact your mobile ({order.phone}) to confirm package dispatch.
              For urgent inquiries, quote your Order ID ({order.id}) directly to our concierge:
            </p>
            <div className="flex flex-wrap gap-4 pt-1 font-mono text-white font-bold">
              <a href="tel:+8801879665602" className="hover:text-[#e11d48] transition-colors">
                +8801879665602
              </a>
              <span>•</span>
              <a href="tel:+8801303080934" className="hover:text-[#e11d48] transition-colors">
                +8801303080934
              </a>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 text-xs font-mono uppercase text-neutral-400 hover:text-white transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              PRINT RECEIPT
            </button>
            <button
              onClick={() => onNavigate('shop')}
              className="px-6 py-3 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              CONTINUE SHOPPING
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
