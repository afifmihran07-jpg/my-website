import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { DatabaseService } from '../services/dataService';
import { SafeImage } from '../components/SafeImage';
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Lock,
  ArrowLeft,
  X,
  Tag,
  UserCheck,
  Copy,
  Check,
  Info
} from 'lucide-react';
import { Coupon } from '../types';

interface CheckoutPageProps {
  onNavigate: (route: string) => void;
  onOrderSuccess: (orderId: string) => void;
}

const BD_DISTRICTS = [
  'Dhaka',
  'Chattogram',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh',
  'Gazipur',
  'Narayanganj',
  'Comilla',
  'Cox\'s Bazar',
  'Bogura',
  'Jessore',
  'Kushtia',
  'Faridpur',
  'Tangail',
  'Feni',
  'Brahmanbaria',
  'Dinajpur',
  'Pabna',
  'Noakhali',
  'Other District'
];

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onNavigate, onOrderSuccess }) => {
  const { items, subtotal, clearCart } = useCart();
  const settings = DatabaseService.getSettings();
  const [content, setContent] = useState(() => DatabaseService.getSiteContent(false));

  useEffect(() => {
    setContent(DatabaseService.getSiteContent(false));
  }, []);

  const co = content.checkout;

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');

  // Delivery & Payment
  const [deliveryLocation, setDeliveryLocation] = useState<'inside_dhaka' | 'outside_dhaka'>('inside_dhaka');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bkash' | 'nagad'>('cod');

  // Manual Payment Verification Fields (bKash & Nagad)
  const [trxId, setTrxId] = useState('');
  const [copiedNumber, setCopiedNumber] = useState(false);

  // Coupon / Promo Code State (Server Validated)
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  // UI & Loading States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedInUser, setIsLoggedInUser] = useState(false);

  // Auto-fill from active customer session if available
  useEffect(() => {
    const session = DatabaseService.getActiveSession();
    if (session) {
      setIsLoggedInUser(true);
      setCustomerName(session.fullName);
      setEmail(session.email);
      setPhone(session.phone);
      if (session.savedAddresses && session.savedAddresses.length > 0) {
        const def = session.savedAddresses.find(a => a.isDefault) || session.savedAddresses[0];
        setAddress(def.address);
        setArea(def.area);
        setDistrict(def.district || 'Dhaka');
        setDeliveryLocation(def.deliveryLocation || 'inside_dhaka');
      }
    }
  }, []);

  // Update delivery location automatically if district changes to non-Dhaka
  const handleDistrictChange = (dist: string) => {
    setDistrict(dist);
    if (dist.toLowerCase() === 'dhaka') {
      setDeliveryLocation('inside_dhaka');
    } else {
      setDeliveryLocation('outside_dhaka');
    }
  };

  // Dynamic calculations
  const deliveryCharge = deliveryLocation === 'inside_dhaka'
    ? settings.deliveryInsideDhaka
    : settings.deliveryOutsideDhaka;

  const total = Math.max(0, subtotal - discountAmount + deliveryCharge);

  // Copy Merchant Number helper
  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2500);
  };

  // Coupon Apply Handler (Strictly Server-Side Validated)
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    setCouponSuccess(null);

    if (!couponCodeInput.trim()) {
      setCouponError('Enter a promo code');
      return;
    }

    try {
      const res = await DatabaseService.validateCouponServer(
        couponCodeInput,
        phone || undefined,
        items.map((item) => {
          const product = DatabaseService.getProductById(item.productId) as any;
          const variant = product?.variants?.find((entry: any) =>
            (item.selectedPosterSize && entry.posterSizeName === item.selectedPosterSize) ||
            (item.selectedSize && entry.size === item.selectedSize && (!item.selectedColor || entry.colorName === item.selectedColor)),
          );
          return { productId: item.productId, variantId: variant?.id, quantity: item.quantity };
        }),
      );
      const coupon = DatabaseService.getCoupons().find((entry) => entry.code === res.code) ?? {
        id: "", code: res.code, type: res.type, value: res.value, usedCount: 0, isActive: true, createdAt: new Date().toISOString(),
      };
      setAppliedCoupon(coupon as Coupon);
      setDiscountAmount(res.discount);
      setCouponSuccess(`Code ${res.code} applied! You saved ৳${res.discount.toLocaleString()}`);
    } catch {
      setCouponError('Invalid or unavailable coupon code.');
      setAppliedCoupon(null);
      setDiscountAmount(0);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponCodeInput('');
    setCouponSuccess(null);
    setCouponError(null);
  };

  // Validate form
  const validateForm = (): boolean => {
    setErrorMsg(null);
    if (!customerName.trim()) {
      setErrorMsg('Please enter your full name');
      return false;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMsg('Please enter a valid 11-digit Bangladesh phone number (e.g. 01879665602)');
      return false;
    }
    if (!address.trim()) {
      setErrorMsg('Please enter your complete delivery address');
      return false;
    }
    if (items.length === 0) {
      setErrorMsg('Your shopping bag is empty');
      return false;
    }

    // Manual bKash / Nagad validation
    if (paymentMethod === 'bkash' || paymentMethod === 'nagad') {
      if (!trxId.trim()) {
        setErrorMsg(`Please enter your ${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} Transaction ID (TRX ID) after sending payment.`);
        return false;
      }
    }

    return true;
  };

  // Submit Order Handler (Temporary Manual Verification Workflow)
  const handleProceedOrder = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    // Call server-side transactional order creation
    const result = await DatabaseService.createOrder({
      customerName,
      email,
      phone,
      district,
      address,
      area,
      deliveryLocation,
      paymentMethod,
      paymentReferenceId: (paymentMethod === 'bkash' || paymentMethod === 'nagad') ? trxId.trim().toUpperCase() : undefined,
      couponCode: appliedCoupon?.code,
      notes,
      items: items.map(i => {
        const product = DatabaseService.getProductById(i.productId) as any;
        const variant = product?.variants?.find((entry: any) =>
          (i.selectedPosterSize && entry.posterSizeName === i.selectedPosterSize) ||
          (i.selectedSize && entry.size === i.selectedSize && (!i.selectedColor || entry.colorName === i.selectedColor)),
        );
        return { productId: i.productId, variantId: variant?.id, quantity: i.quantity };
      })
    });

    setIsSubmitting(false);

    if (result.success && result.order) {
      clearCart();
      onOrderSuccess(result.order.id);
    } else {
      setErrorMsg(result.error || 'Could not complete order. Please check item stock.');
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0a]">
        <h2 className="font-display font-black text-2xl text-white uppercase mb-2">
          Your Bag is Empty
        </h2>
        <p className="text-xs text-neutral-400 mb-6">
          Add items to your bag before proceeding to checkout.
        </p>
        <button
          onClick={() => onNavigate('shop')}
          className="px-6 py-3 bg-[#e11d48] text-white font-tech font-bold text-xs uppercase tracking-widest hover:bg-[#be123c] transition-colors"
        >
          BROWSE COLLECTION
        </button>
      </div>
    );
  }

  // Active payment destination number & type from settings
  const currentPaymentNumber = paymentMethod === 'bkash'
    ? (settings.bKashMerchantNumber || '0187966502')
    : (settings.nagadMerchantNumber || '0187966502');

  const currentAccountType = paymentMethod === 'bkash'
    ? (settings.bKashAccountType || 'Merchant')
    : (settings.nagadAccountType || 'Merchant');

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 pb-4 border-b border-neutral-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('shop')}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
              {co.title || 'SECURE CHECKOUT'}
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            {isLoggedInUser && (
              <span className="text-emerald-400 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                PRE-FILLED PROFILE
              </span>
            )}
            <div className="flex items-center gap-1.5 text-neutral-400">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>256-BIT ENCRYPTED</span>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-8 p-4 bg-red-950/60 border border-red-900 text-red-200 text-xs sm:text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Error completing order</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Form (7 Cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* 1. Customer Information */}
            <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-black text-base text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#e11d48] text-white text-xs flex items-center justify-center font-mono">
                    1
                  </span>
                  {co.contactSectionTitle || 'CONTACT & DELIVERY RECIPIENT'}
                </h2>
                <span className="text-[10px] font-mono text-neutral-500 uppercase">
                  GUEST CHECKOUT READY
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                    FULL NAME <span className="text-[#e11d48]">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Tanvir Ahmed"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#e11d48] transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                    PHONE NUMBER (FOR SMS DISPATCH) <span className="text-[#e11d48]">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#e11d48] transition-colors font-mono"
                    required
                  />
                  <p className="text-[10px] font-mono text-neutral-500 mt-1">
                    11-digit active mobile number for SMS dispatch updates
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                    EMAIL ADDRESS (OPTIONAL)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. tanvir@domain.com"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#e11d48] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                    DISTRICT <span className="text-[#e11d48]">*</span>
                  </label>
                  <select
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white focus:outline-none focus:border-[#e11d48] transition-colors"
                  >
                    {BD_DISTRICTS.map(dist => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                    AREA / THANA / POLICE STATION
                  </label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Banani, Dhanmondi, GEC Circle"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#e11d48] transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                    COMPLETE STREET ADDRESS <span className="text-[#e11d48]">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House No, Road No, Apartment / Flat, Landmark"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#e11d48] transition-colors resize-none"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                    DELIVERY INSTRUCTIONS (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Call before arrival, leave with security"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#e11d48] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* 2. Delivery Zone Selector */}
            <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
              <h2 className="font-display font-black text-base text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#e11d48] text-white text-xs flex items-center justify-center font-mono">
                  2
                </span>
                DELIVERY ZONE & SHIPPING RATE
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Inside Dhaka */}
                <div
                  onClick={() => setDeliveryLocation('inside_dhaka')}
                  className={`p-4 border cursor-pointer transition-all ${
                    deliveryLocation === 'inside_dhaka'
                      ? 'border-[#e11d48] bg-neutral-900 shadow-md'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          deliveryLocation === 'inside_dhaka'
                            ? 'border-[#e11d48] bg-[#e11d48]'
                            : 'border-neutral-600'
                        }`}
                      >
                        {deliveryLocation === 'inside_dhaka' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="font-display font-bold text-sm text-white uppercase">
                        INSIDE DHAKA
                      </span>
                    </div>
                    <span className="font-tech font-bold text-sm text-white">
                      ৳{settings.deliveryInsideDhaka}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 pl-6">
                    Express 24–48 Hours Doorstep Delivery
                  </p>
                </div>

                {/* Outside Dhaka */}
                <div
                  onClick={() => setDeliveryLocation('outside_dhaka')}
                  className={`p-4 border cursor-pointer transition-all ${
                    deliveryLocation === 'outside_dhaka'
                      ? 'border-[#e11d48] bg-neutral-900 shadow-md'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          deliveryLocation === 'outside_dhaka'
                            ? 'border-[#e11d48] bg-[#e11d48]'
                            : 'border-neutral-600'
                        }`}
                      >
                        {deliveryLocation === 'outside_dhaka' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="font-display font-bold text-sm text-white uppercase">
                        OUTSIDE DHAKA
                      </span>
                    </div>
                    <span className="font-tech font-bold text-sm text-white">
                      ৳{settings.deliveryOutsideDhaka}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 pl-6">
                    Nationwide 48–72 Hours Express Delivery
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Payment Method with Manual Verification Mode */}
            <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-black text-base text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#e11d48] text-white text-xs flex items-center justify-center font-mono">
                    3
                  </span>
                  PAYMENT METHOD
                </h2>
                <span className="text-[10px] font-mono text-neutral-400 uppercase">
                  MANUAL VERIFICATION MODE
                </span>
              </div>

              {/* Payment Method Radio Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* COD Option */}
                {settings.enableCod !== false && (
                  <div
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-4 border cursor-pointer transition-all text-left ${
                      paymentMethod === 'cod'
                        ? 'border-[#e11d48] bg-neutral-900 shadow-md'
                        : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          paymentMethod === 'cod' ? 'border-[#e11d48] bg-[#e11d48]' : 'border-neutral-600'
                        }`}
                      >
                        {paymentMethod === 'cod' && <span className="w-1 h-1 rounded-full bg-white" />}
                      </span>
                      <span className="font-display font-extrabold text-xs uppercase text-white">
                        CASH ON DELIVERY
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-2">
                      Pay cash upon receiving and inspecting parcel
                    </p>
                  </div>
                )}

                {/* bKash Option */}
                {settings.enableBkash !== false && (
                  <div
                    onClick={() => setPaymentMethod('bkash')}
                    className={`p-4 border cursor-pointer transition-all text-left ${
                      paymentMethod === 'bkash'
                        ? 'border-[#e11d48] bg-neutral-900 shadow-md'
                        : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          paymentMethod === 'bkash' ? 'border-[#e11d48] bg-[#e11d48]' : 'border-neutral-600'
                        }`}
                      >
                        {paymentMethod === 'bkash' && <span className="w-1 h-1 rounded-full bg-white" />}
                      </span>
                      <span className="font-display font-extrabold text-xs uppercase text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#e2136e]" />
                        BKASH MANUAL
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-2">
                      Send payment via bKash app & provide TRX ID
                    </p>
                  </div>
                )}

                {/* Nagad Option */}
                {settings.enableNagad !== false && (
                  <div
                    onClick={() => setPaymentMethod('nagad')}
                    className={`p-4 border cursor-pointer transition-all text-left ${
                      paymentMethod === 'nagad'
                        ? 'border-[#e11d48] bg-neutral-900 shadow-md'
                        : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          paymentMethod === 'nagad' ? 'border-[#e11d48] bg-[#e11d48]' : 'border-neutral-600'
                        }`}
                      >
                        {paymentMethod === 'nagad' && <span className="w-1 h-1 rounded-full bg-white" />}
                      </span>
                      <span className="font-display font-extrabold text-xs uppercase text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#f7931e]" />
                        NAGAD MANUAL
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-2">
                      Send payment via Nagad app & provide TRX ID
                    </p>
                  </div>
                )}
              </div>

              {/* DYNAMIC PAYMENT INSTRUCTIONS & TRANSACTION ID INPUT FOR BKASH & NAGAD */}
              {(paymentMethod === 'bkash' || paymentMethod === 'nagad') && (
                <div className="p-5 bg-neutral-900/80 border border-neutral-800 space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${paymentMethod === 'bkash' ? 'bg-[#e2136e]' : 'bg-[#f7931e]'}`} />
                      <span className="font-display font-extrabold text-xs uppercase text-white">
                        {paymentMethod.toUpperCase()} PAYMENT INSTRUCTIONS
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400">
                      EXACT AMOUNT: <strong className="text-white font-tech text-sm">৳{total.toLocaleString()}</strong>
                    </span>
                  </div>

                  {/* Business Account Details Card */}
                  <div className="p-3.5 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-mono uppercase text-neutral-500">
                        {paymentMethod.toUpperCase()} {currentAccountType.toUpperCase()} NUMBER:
                      </span>
                      <span className="font-mono font-black text-base text-white tracking-wider">
                        {currentPaymentNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyNumber(currentPaymentNumber)}
                      className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-xs uppercase border border-neutral-700 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedNumber ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>

                  {/* Clear Step-by-Step Instructions */}
                  <div className="text-xs font-mono text-neutral-400 space-y-1.5 bg-neutral-950/60 p-3.5 border border-neutral-900">
                    <p className="text-white font-bold uppercase text-[11px] mb-1">STEPS TO COMPLETE PAYMENT:</p>
                    <p>1. Open your <strong>{paymentMethod === 'bkash' ? 'bKASH' : 'NAGAD'} app</strong> on your mobile phone.</p>
                    <p>2. Select <strong>Send Money</strong>.</p>
                    <p>3. Enter the number <strong>{currentPaymentNumber}</strong> and the exact order amount (<strong>৳{total.toLocaleString()}</strong>).</p>
                    <p>4. Complete the transaction using your secret PIN in the official app.</p>
                    <p>5. Copy the <strong>Transaction ID (TRX ID)</strong> from your app statement or SMS and paste it below.</p>
                  </div>

                  {/* Transaction ID Input */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-mono uppercase text-neutral-300 font-bold">
                      ENTER {paymentMethod.toUpperCase()} TRANSACTION ID (TRX ID) <span className="text-[#e11d48]">*</span>
                    </label>
                    <input
                      type="text"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                      placeholder="e.g. 9K82N44P1 or BL738914"
                      className="w-full bg-neutral-950 border border-neutral-700 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#e11d48] font-mono uppercase tracking-widest font-bold"
                      required
                    />
                    <p className="text-[10px] font-mono text-neutral-500">
                      Located in your {paymentMethod.toUpperCase()} app receipt or confirmation SMS. We never ask for your PIN or OTP.
                    </p>
                  </div>

                  {/* Explicit Verification Notice */}
                  <div className="p-3 bg-neutral-950 border border-amber-900/50 text-amber-300 text-xs font-mono flex items-start gap-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      {co.manualVerificationNotice || 'Your payment will be manually verified by HSS. Your order is not confirmed until payment verification is completed.'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 4. COUPON / PROMO CODE SECTION */}
            <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-black text-base text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#e11d48] text-white text-xs flex items-center justify-center font-mono">
                    4
                  </span>
                  COUPON / PROMO CODE
                </h2>
                {appliedCoupon && (
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> APPLIED
                  </span>
                )}
              </div>

              {appliedCoupon ? (
                <div className="p-4 bg-neutral-900 border border-emerald-800/60 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2.5">
                    <Tag className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white uppercase tracking-wider font-tech text-sm">
                          {appliedCoupon.code}
                        </span>
                        <span className="text-emerald-400 font-bold">
                          ({appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% OFF` : `৳${appliedCoupon.value} OFF`})
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Discount of ৳{discountAmount.toLocaleString()} deducted from your total.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="px-3 py-1.5 bg-neutral-950 hover:bg-red-950 text-neutral-400 hover:text-red-300 border border-neutral-800 text-[11px] uppercase font-mono transition-colors"
                  >
                    REMOVE
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-mono text-neutral-400">
                    Have a promo or promotional discount voucher from High Street Society?
                  </p>
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponCodeInput}
                      onChange={(e) => {
                        setCouponCodeInput(e.target.value.toUpperCase());
                        if (couponError) setCouponError(null);
                      }}
                      placeholder="ENTER COUPON CODE (E.G. HSS20)..."
                      className="flex-1 bg-neutral-900 border border-neutral-800 px-4 py-3 text-xs font-mono text-white placeholder-neutral-600 uppercase tracking-wider focus:outline-none focus:border-[#e11d48] transition-colors"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-neutral-800 hover:bg-[#e11d48] text-white font-tech font-bold text-xs uppercase tracking-widest transition-colors border border-neutral-700 hover:border-[#e11d48]"
                    >
                      APPLY
                    </button>
                  </form>
                  {couponError && (
                    <p className="text-xs font-mono text-red-400 flex items-center gap-1.5 pt-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {couponError}
                    </p>
                  )}
                  {couponSuccess && (
                    <p className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 pt-1">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      {couponSuccess}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary & Coupon (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="bg-neutral-950 border border-neutral-900 p-6 sticky top-24 space-y-6">
              <h2 className="font-display font-black text-lg text-white uppercase tracking-tight pb-3 border-b border-neutral-900">
                {co.summaryTitle || 'ORDER SUMMARY'} ({items.length})
              </h2>

              {/* Items List */}
              <div className="divide-y divide-neutral-900 max-h-64 overflow-y-auto pr-1">
                {items.map(item => (
                  <div key={item.id} className="py-3 flex gap-3">
                    <div className="w-14 h-16 bg-neutral-900 border border-neutral-800 flex-shrink-0 overflow-hidden">
                      <SafeImage
                        src={item.image}
                        alt={item.name}
                        containerClassName="w-full h-full"
                        aspectRatio="auto"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-bold text-xs text-white uppercase truncate">
                        {item.name}
                      </h4>
                      <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
                        {item.selectedSize ? `SIZE: ${item.selectedSize} ` : ''}
                        {item.selectedColor ? `• ${item.selectedColor} ` : ''}
                        {item.posterDimensions ? `${item.selectedPosterSize ? item.selectedPosterSize + ' — ' : ''}${item.posterDimensions}` : ''}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-xs">
                        <span className="font-mono text-neutral-500">Qty: {item.quantity}</span>
                        <span className="font-tech font-bold text-white">
                          ৳{(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Server-Side Validated Promo Code / Coupon */}
              <div className="pt-4 border-t border-neutral-900 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-300">
                  <span className="font-bold uppercase flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#e11d48]" />
                    PROMO CODE / COUPON
                  </span>
                  {appliedCoupon && (
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">
                      ACTIVE
                    </span>
                  )}
                </div>

                {appliedCoupon ? (
                  <div className="p-3 bg-neutral-900 border border-emerald-900/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Tag className="w-3.5 h-3.5" />
                      <div>
                        <span className="font-bold">{appliedCoupon.code}</span>
                        <span className="text-[11px] text-neutral-400 ml-1.5">
                          ({appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% OFF` : `৳${appliedCoupon.value} OFF`})
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-neutral-500 hover:text-red-400 p-1"
                      title="Remove promo code"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={(e) => {
                          setCouponCodeInput(e.target.value.toUpperCase());
                          if (couponError) setCouponError(null);
                        }}
                        placeholder="ENTER PROMO CODE..."
                        className="flex-1 bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono text-white placeholder-neutral-600 uppercase focus:outline-none focus:border-[#e11d48]"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-neutral-900 hover:bg-[#e11d48] border border-neutral-700 hover:border-[#e11d48] text-xs font-mono uppercase text-white font-bold transition-colors"
                      >
                        APPLY
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-[11px] font-mono text-red-400">{couponError}</p>
                    )}
                    {couponSuccess && (
                      <p className="text-[11px] font-mono text-emerald-400">{couponSuccess}</p>
                    )}
                  </form>
                )}
              </div>

              {/* Price Calculation (Strictly Server-Recalculated) */}
              <div className="border-t border-neutral-900 pt-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-neutral-400">
                  <span>SUBTOTAL</span>
                  <span className="font-tech font-bold text-white">৳{subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#e11d48] font-bold">
                    <span>
                      DISCOUNT ({appliedCoupon?.code}{appliedCoupon?.type === 'percentage' ? ` - ${appliedCoupon.value}%` : ''})
                    </span>
                    <span>-৳{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-400">
                  <span>
                    DELIVERY ({deliveryLocation === 'inside_dhaka' ? 'INSIDE DHAKA' : 'OUTSIDE DHAKA'})
                  </span>
                  <span className="font-tech font-bold text-white">৳{deliveryCharge}</span>
                </div>
                <div className="flex justify-between text-base font-display font-black text-white pt-2 border-t border-neutral-900">
                  <span>TOTAL DUE</span>
                  <span className="font-tech font-extrabold text-[#e11d48]">
                    ৳{total.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Order Submission CTA */}
              <button
                type="button"
                onClick={handleProceedOrder}
                disabled={isSubmitting}
                className="w-full py-4 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-950/40 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SUBMITTING ORDER...
                  </>
                ) : (paymentMethod === 'bkash' || paymentMethod === 'nagad') ? (
                  <>
                    SUBMIT ORDER FOR VERIFICATION • ৳{total.toLocaleString()}
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    CONFIRM CASH ON DELIVERY • ৳{total.toLocaleString()}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-[11px] font-mono text-neutral-500 text-center space-y-1">
                <p>No account required • Instant order tracking</p>
                <p>Concierge: +8801879665602 • Dhaka, Bangladesh</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
