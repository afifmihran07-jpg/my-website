import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem } from '../types';

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addToCart: (item: Omit<CartItem, 'id' | 'quantity'>, quantity?: number) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  subtotal: number;
  totalItems: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'hss_cart_items_v2';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      // Background Abandoned Cart Tracker (non-intrusive)
      if (items.length > 0) {
        let sessionId = localStorage.getItem('hss_cart_session_id');
        if (!sessionId) {
          sessionId = 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
          localStorage.setItem('hss_cart_session_id', sessionId);
        }
        import('../services/dataService').then(({ DatabaseService }) => {
          DatabaseService.trackAbandonedCart({
            id: 'ab-' + sessionId,
            sessionId,
            items,
            subtotal: items.reduce((acc, item) => acc + item.price * item.quantity, 0),
            updatedAt: new Date().toISOString()
          });
        });
      }
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [items]);

  const addToCart = (item: Omit<CartItem, 'id' | 'quantity'>, quantity: number = 1) => {
    // Generate unique ID based on product ID and variants
    const variantKey = [
      item.productId,
      item.selectedSize || '',
      item.selectedColor || '',
      item.selectedPosterSize || ''
    ].filter(Boolean).join('-');

    setItems(prevItems => {
      const existingIdx = prevItems.findIndex(i => i.id === variantKey);
      if (existingIdx > -1) {
        const next = [...prevItems];
        const newQty = next[existingIdx].quantity + quantity;
        // Don't exceed stock
        next[existingIdx].quantity = Math.min(newQty, item.stockAvailable || 99);
        return next;
      } else {
        const newItem: CartItem = {
          ...item,
          id: variantKey,
          quantity: Math.min(quantity, item.stockAvailable || 99)
        };
        return [...prevItems, newItem];
      }
    });

    setIsOpen(true);
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            quantity: Math.min(quantity, item.stockAvailable || 99)
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setItems([]);
  };

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        setIsOpen,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        subtotal,
        totalItems
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
