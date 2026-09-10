import React from 'react';
import { X, Plus, Minus, Trash2, ArrowRight, ShoppingBag, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { SafeImage } from './SafeImage';
import { DatabaseService } from '../services/dataService';

interface CartDrawerProps {
  onNavigate: (route: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onNavigate }) => {
  const { items, isOpen, setIsOpen, updateQuantity, removeFromCart, subtotal, totalItems } = useCart();

  if (!isOpen) return null;

  const content = DatabaseService.getSiteContent(false);
  const es = content.emptyStates;

  // Most recently added item (top item)
  const latestItem = items[items.length - 1];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#0e0e10] border-l border-neutral-800 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-4 h-4 text-[#e11d48]" />
              <h2 className="font-display font-extrabold text-base uppercase tracking-wider text-white">
                YOUR BAG <span className="text-neutral-400 text-xs font-mono">({totalItems})</span>
              </h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors rounded-sm"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* COMPACT CONFIRMATION & DIRECT BUY NOW ACTION */}
          {items.length > 0 && latestItem && (
            <div className="p-4 bg-neutral-900/70 border-b border-neutral-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5 uppercase tracking-wider">
                  <Check className="w-3.5 h-3.5" /> ADDED TO BAG
                </span>
                <span className="text-neutral-300 font-tech font-bold">
                  ৳{subtotal.toLocaleString()} SUB
                </span>
              </div>

              {/* Direct BUY NOW Primary CTA */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigate('checkout');
                }}
                className="w-full py-3.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-950/40 flex items-center justify-center gap-2"
              >
                BUY NOW
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 divide-y divide-neutral-800/80">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600 mb-4">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-display font-bold text-lg text-white mb-1 uppercase tracking-wide">
                  {es.emptyBagTitle || 'Your bag is empty'}
                </h3>
                <p className="text-xs text-neutral-400 max-w-xs mb-6 font-sans">
                  {es.emptyBagSubtitle || 'Explore our latest drops and heavyweight streetwear collection.'}
                </p>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('shop');
                  }}
                  className="px-6 py-3 bg-white text-black font-display font-bold text-xs uppercase tracking-widest hover:bg-[#e11d48] hover:text-white transition-colors"
                >
                  {es.emptyBagCta || 'DISCOVER THE DROP'}
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-3.5">
                  {/* Small Product Image */}
                  <div className="w-16 h-20 sm:w-18 sm:h-22 flex-shrink-0 bg-neutral-900 border border-neutral-800 overflow-hidden">
                    <SafeImage
                      src={item.image}
                      alt={item.name}
                      containerClassName="w-full h-full"
                      aspectRatio="auto"
                    />
                  </div>

                  {/* Item Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          onClick={() => {
                            setIsOpen(false);
                            onNavigate(`product/${item.slug}`);
                          }}
                          className="font-display font-bold text-xs sm:text-sm text-white hover:text-[#e11d48] cursor-pointer line-clamp-1 uppercase transition-colors"
                        >
                          {item.name}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Selected Variant info */}
                      <div className="text-[11px] text-neutral-400 mt-1 flex flex-wrap gap-1.5 font-mono">
                        {item.selectedSize && (
                          <span className="inline-block px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-300">
                            SIZE: {item.selectedSize}
                          </span>
                        )}
                        {item.selectedColor && (
                          <span className="inline-block px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-300">
                            {item.selectedColor}
                          </span>
                        )}
                        {item.posterDimensions && (
                          <span className="inline-block px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[#e11d48] font-medium">
                            {item.selectedPosterSize ? `${item.selectedPosterSize} — ` : ''}{item.posterDimensions}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2.5">
                      {/* Quantity Stepper (- 1 +) */}
                      <div className="flex items-center border border-neutral-800 bg-neutral-900/80 h-7 px-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-1 text-neutral-400 hover:text-white transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-[11px] font-mono font-bold text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.stockAvailable}
                          className="px-1 text-neutral-400 hover:text-white transition-colors disabled:opacity-30"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <span className="font-tech text-xs sm:text-sm font-bold text-white">
                          ৳{(item.price * item.quantity).toLocaleString()}
                        </span>
                        {item.quantity > 1 && (
                          <span className="block text-[9.5px] text-neutral-500 font-mono">
                            ৳{item.price.toLocaleString()} each
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with Subtotal & Proceed to Checkout */}
          {items.length > 0 && (
            <div className="p-5 sm:p-6 border-t border-neutral-800 bg-[#0a0a0c] space-y-3.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-neutral-400 uppercase tracking-wider">SUBTOTAL</span>
                  <span className="font-tech text-base font-bold text-white">৳{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                  <span>DELIVERY</span>
                  <span>DHAKA ৳80 / OUTSIDE ৳120</span>
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('checkout');
                  }}
                  className="w-full py-3.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-950/40"
                >
                  PROCEED TO CHECKOUT
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('shop');
                  }}
                  className="w-full py-2 bg-transparent text-neutral-400 font-display font-semibold text-xs uppercase tracking-wider hover:text-white transition-colors"
                >
                  CONTINUE SHOPPING
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
