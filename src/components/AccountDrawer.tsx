import React, { useState, useEffect } from 'react';
import { X, User, Package, MapPin, Heart, LogOut, ArrowRight, ShieldCheck, ExternalLink, Plus, Check } from 'lucide-react';
import { DatabaseService } from '../services/dataService';
import { CustomerUser, Order, Product } from '../types';
import { SafeImage } from './SafeImage';

interface AccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

export const AccountDrawer: React.FC<AccountDrawerProps> = ({ isOpen, onClose, onNavigate }) => {
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(null);
  const [activeView, setActiveView] = useState<'signin' | 'register' | 'orders' | 'addresses' | 'wishlist'>('signin');

  // Form states for login/register
  const [authEmailOrPhone, setAuthEmailOrPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Address creation form
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newLabel, setNewLabel] = useState('Home');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDistrict, setNewDistrict] = useState('Dhaka');
  const [newArea, setNewArea] = useState('');
  const [newAddressText, setNewAddressText] = useState('');
  const [newLocation, setNewLocation] = useState<'inside_dhaka' | 'outside_dhaka'>('inside_dhaka');

  // Orders for active user
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadUserData();
    }
  }, [isOpen]);

  const loadUserData = () => {
    const session = DatabaseService.getActiveSession();
    setCurrentUser(session);
    setAuthError(null);

    if (session) {
      setActiveView('orders');
      // Fetch matching orders
      const allOrders = DatabaseService.getOrders();
      const matched = allOrders.filter(
        o =>
          o.customerId === session.id ||
          (o.email && o.email.toLowerCase() === session.email.toLowerCase()) ||
          o.phone.replace(/[^0-9]/g, '') === session.phone.replace(/[^0-9]/g, '')
      );
      setUserOrders(matched);

      // Fetch wishlist
      const allProducts = DatabaseService.getProducts();
      const wishlisted = allProducts.filter(p => (session.wishlist || []).includes(p.id));
      setWishlistProducts(wishlisted);
    } else {
      setActiveView('signin');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = await DatabaseService.customerLogin(authEmailOrPhone, authPassword);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      loadUserData();
    } else {
      setAuthError(res.error || 'Failed to authenticate');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = await DatabaseService.customerRegister({
      fullName: regFullName,
      email: regEmail,
      phone: regPhone,
      password: regPassword
    });
    if (res.success && res.user) {
      setCurrentUser(res.user);
      loadUserData();
    } else {
      setAuthError(res.error || 'Failed to create account');
    }
  };

  const handleLogout = () => {
    void DatabaseService.customerLogout();
    setCurrentUser(null);
    setActiveView('signin');
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!newName || !newPhone || !newAddressText) return;

    await DatabaseService.saveCustomerAddress(currentUser.id, {
      label: newLabel,
      fullName: newName,
      phone: newPhone,
      district: newDistrict,
      area: newArea,
      address: newAddressText,
      deliveryLocation: newLocation,
      isDefault: currentUser.savedAddresses.length === 0
    });

    setIsAddingAddress(false);
    loadUserData();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#0e0e10] border-l border-neutral-800 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-[#e11d48]">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-display font-extrabold text-base uppercase tracking-wider text-white">
                  {currentUser ? currentUser.fullName : 'SOCIETY ACCOUNT'}
                </h2>
                <p className="text-[10px] font-mono text-neutral-400">
                  {currentUser ? currentUser.email : 'EXCLUSIVE ACCESS & ORDER ARCHIVES'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors rounded-sm"
              aria-label="Close Account"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub Navigation if Logged in */}
          {currentUser && (
            <div className="flex border-b border-neutral-800/80 bg-neutral-950 text-xs font-tech font-bold uppercase tracking-wider">
              <button
                onClick={() => setActiveView('orders')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  activeView === 'orders'
                    ? 'border-[#e11d48] text-white bg-neutral-900/60'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                ORDERS ({userOrders.length})
              </button>
              <button
                onClick={() => setActiveView('addresses')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  activeView === 'addresses'
                    ? 'border-[#e11d48] text-white bg-neutral-900/60'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                ADDRESSES
              </button>
              <button
                onClick={() => setActiveView('wishlist')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  activeView === 'wishlist'
                    ? 'border-[#e11d48] text-white bg-neutral-900/60'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                WISHLIST
              </button>
            </div>
          )}

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {authError && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-900 text-red-300 text-xs font-mono">
                {authError}
              </div>
            )}

            {/* NOT LOGGED IN: SIGN IN VIEW */}
            {!currentUser && activeView === 'signin' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-display font-black text-xl text-white uppercase tracking-tight">
                    WELCOME BACK
                  </h3>
                  <p className="text-xs text-neutral-400 font-sans mt-1">
                    Sign in to track orders, access saved addresses, and view your private wishlist.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                      EMAIL OR PHONE NUMBER
                    </label>
                    <input
                      type="text"
                      value={authEmailOrPhone}
                      onChange={e => setAuthEmailOrPhone(e.target.value)}
                      placeholder="e.g. 01879665602 or email@domain.com"
                      required
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                      PASSWORD
                    </label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48] transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    SIGN IN TO ACCOUNT
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="pt-4 border-t border-neutral-800/80 space-y-3 text-center">
                  <p className="text-xs text-neutral-400 font-sans">
                    New to High Street Society?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setActiveView('register');
                    }}
                    className="w-full py-2.5 border border-neutral-700 hover:border-white text-white font-display font-bold text-xs uppercase tracking-widest transition-colors"
                  >
                    CREATE AN ACCOUNT
                  </button>
                  <p className="text-[11px] font-mono text-neutral-500 pt-2">
                    * Guest checkout is always available during checkout without an account.
                  </p>
                </div>
              </div>
            )}

            {/* NOT LOGGED IN: REGISTER VIEW */}
            {!currentUser && activeView === 'register' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-display font-black text-xl text-white uppercase tracking-tight">
                    JOIN THE SOCIETY
                  </h3>
                  <p className="text-xs text-neutral-400 font-sans mt-1">
                    Create an account for one-click checkout and private archive drops.
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      FULL NAME *
                    </label>
                    <input
                      type="text"
                      value={regFullName}
                      onChange={e => setRegFullName(e.target.value)}
                      placeholder="e.g. Samira Khan"
                      required
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      EMAIL ADDRESS *
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="e.g. samira@example.com"
                      required
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      PHONE NUMBER (BANGLADESH) *
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      required
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#e11d48]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      CREATE PASSWORD *
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      required
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-colors mt-2"
                  >
                    COMPLETE REGISTRATION
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setActiveView('signin');
                    }}
                    className="text-xs font-mono text-neutral-400 hover:text-white underline"
                  >
                    Already have an account? Sign In
                  </button>
                </div>
              </div>
            )}

            {/* LOGGED IN: VIEW 1 - ORDERS */}
            {currentUser && activeView === 'orders' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-white">
                    ORDER HISTORY ({userOrders.length})
                  </span>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('track');
                    }}
                    className="text-[11px] font-mono text-[#e11d48] hover:underline"
                  >
                    TRACK CONSIGNMENT →
                  </button>
                </div>

                {userOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    <p className="font-display font-bold text-sm text-white uppercase">No orders yet</p>
                    <p className="text-xs text-neutral-400 mt-1 mb-4">
                      Your purchased drops and art prints will appear here.
                    </p>
                    <button
                      onClick={() => {
                        onClose();
                        onNavigate('shop');
                      }}
                      className="px-5 py-2.5 bg-[#e11d48] text-white font-tech text-xs uppercase tracking-wider"
                    >
                      BROWSE THE COLLECTION
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userOrders.map(order => (
                      <div
                        key={order.id}
                        className="p-4 bg-neutral-950 border border-neutral-800/80 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-display font-bold text-xs text-white uppercase block">
                              {order.id}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                              order.orderStatus === 'delivered'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : order.orderStatus === 'shipped'
                                ? 'bg-blue-950 text-blue-400 border border-blue-800'
                                : 'bg-neutral-900 text-neutral-300 border border-neutral-800'
                            }`}
                          >
                            {order.orderStatus}
                          </span>
                        </div>

                        {/* Order Items Preview */}
                        <div className="space-y-1.5 pt-1 border-t border-neutral-900">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-[11px] font-mono text-neutral-400">
                              <span className="truncate max-w-[200px]">
                                {item.name} {item.selectedSize ? `(${item.selectedSize})` : ''} × {item.quantity}
                              </span>
                              <span className="text-white">৳{item.lineTotal.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>

                        {/* Courier Tracking Info if Shipped */}
                        {order.courierName && (
                          <div className="p-2.5 bg-neutral-900/60 border border-neutral-800 text-[11px] font-mono text-neutral-300 space-y-1">
                            <div className="flex items-center justify-between text-[#e11d48] font-bold">
                              <span>COURIER: {order.courierName}</span>
                              {order.courierTrackingUrl && (
                                <a
                                  href={order.courierTrackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 hover:underline"
                                >
                                  LIVE TRACK <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <p className="text-neutral-400">
                              WAYBILL: <span className="text-white">{order.courierTrackingNumber}</span>
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-neutral-900 text-xs font-mono">
                          <span className="text-neutral-400">
                            TOTAL: <strong className="text-white font-tech font-bold">৳{order.total.toLocaleString()}</strong>
                          </span>
                          <button
                            onClick={() => {
                              onClose();
                              onNavigate(`order-success/${order.id}`);
                            }}
                            className="text-[#e11d48] hover:underline uppercase text-[11px] font-bold"
                          >
                            VIEW RECEIPT →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LOGGED IN: VIEW 2 - SAVED ADDRESSES */}
            {currentUser && activeView === 'addresses' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-white">
                    SAVED ADDRESSES
                  </span>
                  {!isAddingAddress && (
                    <button
                      onClick={() => setIsAddingAddress(true)}
                      className="text-[11px] font-mono text-[#e11d48] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> ADD NEW
                    </button>
                  )}
                </div>

                {isAddingAddress ? (
                  <form onSubmit={handleSaveAddress} className="bg-neutral-950 border border-neutral-800 p-4 space-y-3">
                    <h4 className="font-display font-bold text-xs uppercase text-white">Add Delivery Address</h4>
                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 mb-1">LABEL</label>
                      <input
                        type="text"
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        placeholder="e.g. Home, Studio, Office"
                        className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 mb-1">RECIPIENT NAME</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        required
                        className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 mb-1">PHONE NUMBER</label>
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        required
                        className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 mb-1">DELIVERY REGION</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNewLocation('inside_dhaka');
                            setNewDistrict('Dhaka');
                          }}
                          className={`py-1.5 text-xs font-mono border ${
                            newLocation === 'inside_dhaka'
                              ? 'bg-[#e11d48] text-white border-[#e11d48]'
                              : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          INSIDE DHAKA
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewLocation('outside_dhaka')}
                          className={`py-1.5 text-xs font-mono border ${
                            newLocation === 'outside_dhaka'
                              ? 'bg-[#e11d48] text-white border-[#e11d48]'
                              : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          OUTSIDE DHAKA
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 mb-1">DISTRICT & AREA</label>
                      <input
                        type="text"
                        value={newArea}
                        onChange={e => setNewArea(e.target.value)}
                        placeholder="e.g. Banani, Dhaka or GEC, Chattogram"
                        className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 mb-1">FULL STREET ADDRESS</label>
                      <textarea
                        rows={2}
                        value={newAddressText}
                        onChange={e => setNewAddressText(e.target.value)}
                        required
                        className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-white resize-none"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingAddress(false)}
                        className="flex-1 py-2 bg-neutral-900 text-xs text-neutral-400 font-mono"
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-[#e11d48] text-xs font-bold text-white font-mono"
                      >
                        SAVE ADDRESS
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {currentUser.savedAddresses.map(addr => (
                      <div
                        key={addr.id}
                        className="p-3.5 bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs font-mono"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white uppercase flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#e11d48]" />
                            {addr.label}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-white">{addr.fullName} ({addr.phone})</p>
                        <p className="text-neutral-400">
                          {addr.address}, {addr.area} ({addr.district})
                        </p>
                        <span className="inline-block text-[10px] text-[#e11d48] uppercase">
                          {addr.deliveryLocation === 'inside_dhaka' ? 'Inside Dhaka (৳80)' : 'Outside Dhaka (৳120)'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LOGGED IN: VIEW 3 - WISHLIST */}
            {currentUser && activeView === 'wishlist' && (
              <div className="space-y-4">
                <div className="pb-2 border-b border-neutral-800">
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-white">
                    YOUR CURATED WISHLIST ({wishlistProducts.length})
                  </span>
                </div>

                {wishlistProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    <p className="font-display font-bold text-sm text-white uppercase">Your wishlist is empty</p>
                    <p className="text-xs text-neutral-400 mt-1 mb-4">
                      Tap the star icon on any piece to save it for later.
                    </p>
                    <button
                      onClick={() => {
                        onClose();
                        onNavigate('shop');
                      }}
                      className="px-5 py-2.5 bg-[#e11d48] text-white font-tech text-xs uppercase tracking-wider"
                    >
                      EXPLORE ARCHIVE
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wishlistProducts.map(prod => (
                      <div
                        key={prod.id}
                        className="flex gap-3 p-3 bg-neutral-950 border border-neutral-800 items-center justify-between"
                      >
                        <div className="flex gap-3 items-center">
                          <div className="w-12 h-14 bg-neutral-900 border border-neutral-800 overflow-hidden flex-shrink-0">
                            <SafeImage
                              src={prod.images[0]}
                              alt={prod.name}
                              containerClassName="w-full h-full"
                              aspectRatio="auto"
                            />
                          </div>
                          <div>
                            <h4
                              onClick={() => {
                                onClose();
                                onNavigate(`product/${prod.slug}`);
                              }}
                              className="font-display font-bold text-xs text-white uppercase hover:text-[#e11d48] cursor-pointer"
                            >
                              {prod.name}
                            </h4>
                            <span className="font-tech text-xs font-bold text-neutral-300">
                              ৳{prod.price.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            onClose();
                            onNavigate(`product/${prod.slug}`);
                          }}
                          className="px-3 py-1.5 bg-white text-black hover:bg-[#e11d48] hover:text-white font-tech text-[10px] font-bold uppercase transition-colors"
                        >
                          VIEW PIECE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          {currentUser && (
            <div className="p-4 border-t border-neutral-800 bg-[#0a0a0c] flex items-center justify-between">
              <span className="text-[11px] font-mono text-neutral-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> AUTHENTICATED
              </span>
              <button
                onClick={handleLogout}
                className="text-xs font-tech text-red-400 hover:text-red-300 uppercase flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                SIGN OUT
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
