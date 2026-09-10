import { useState, useEffect } from 'react';
import { CartProvider } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { SearchOverlay } from './components/SearchOverlay';
import { AccountDrawer } from './components/AccountDrawer';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { OrderTrackPage } from './pages/OrderTrackPage';
import { AboutPage } from './pages/AboutPage';
import { PolicyPage } from './pages/PolicyPage';
import { AdminPage } from './pages/AdminPage';
import { DatabaseService } from './services/dataService';

export function App() {
  // Routing state based on hash or state
  const [route, setRoute] = useState<string>(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return hash || 'home';
  });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [storeReady, setStoreReady] = useState(false);

  useEffect(() => {
    let active = true;
    void DatabaseService.initialize()
      .catch(() => undefined)
      .finally(() => {
        if (active) setStoreReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Sync hash changes with routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      setRoute(hash || 'home');
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (newRoute: string) => {
    window.location.hash = newRoute;
    setRoute(newRoute);
    window.scrollTo(0, 0);
  };

  // Parse route parameters
  const isProductRoute = route.startsWith('product/');
  const productSlug = isProductRoute ? route.replace('product/', '') : null;

  const isOrderSuccessRoute = route.startsWith('order-success/');
  const orderSuccessId = isOrderSuccessRoute ? route.replace('order-success/', '') : null;

  const isTrackRoute = route.startsWith('track') || route.startsWith('order-track');
  const trackOrderId = route.includes('/') ? route.split('/')[1] : undefined;

  const isAdminRoute = route === 'admin';

  return (
    <CartProvider>
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f7] flex flex-col selection:bg-[#e11d48] selection:text-white">
        {/* Navigation - not shown on admin to maximize admin workspace */}
        {!isAdminRoute && (
          <Navbar
            currentRoute={route}
            onNavigate={navigate}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenAccount={() => setIsAccountOpen(true)}
          />
        )}

        {/* Dynamic Page Views */}
        <div className="flex-1" key={storeReady ? 'ready' : 'loading'}>
          {route === 'home' && (
            <HomePage
              onNavigate={navigate}
              onSelectProduct={(slug) => navigate(`product/${slug}`)}
            />
          )}

          {route === 'shop' && (
            <ShopPage
              initialCategory="all"
              onSelectProduct={(slug) => navigate(`product/${slug}`)}
              onNavigate={navigate}
            />
          )}

          {route === 'clothing' && (
            <ShopPage
              initialCategory="clothing"
              onSelectProduct={(slug) => navigate(`product/${slug}`)}
              onNavigate={navigate}
            />
          )}

          {route === 'posters' && (
            <ShopPage
              initialCategory="posters"
              onSelectProduct={(slug) => navigate(`product/${slug}`)}
              onNavigate={navigate}
            />
          )}

          {route === 'new-drops' && (
            <ShopPage
              initialCategory="new-drops"
              onSelectProduct={(slug) => navigate(`product/${slug}`)}
              onNavigate={navigate}
            />
          )}

          {/* Dynamic Category Listing View (/category/[slug]) */}
          {(route.startsWith('category/') ||
            (route !== 'home' &&
              route !== 'shop' &&
              route !== 'clothing' &&
              route !== 'posters' &&
              route !== 'new-drops' &&
              route !== 'about' &&
              route !== 'checkout' &&
              !isProductRoute &&
              !isOrderSuccessRoute &&
              !isTrackRoute &&
              route !== 'shipping' &&
              route !== 'returns' &&
              route !== 'contact' &&
              route !== 'faq' &&
              route !== 'privacy' &&
              route !== 'terms' &&
              !isAdminRoute)) && (
            <ShopPage
              initialCategory={route.replace(/^category\//, '')}
              onSelectProduct={(slug) => navigate(`product/${slug}`)}
              onNavigate={navigate}
            />
          )}

          {route === 'about' && <AboutPage onNavigate={navigate} />}

          {isProductRoute && productSlug && (
            <ProductDetailPage
              slug={productSlug}
              onNavigate={navigate}
              onSelectProduct={(slug) => navigate(`product/${slug}`)}
            />
          )}

          {route === 'checkout' && (
            <CheckoutPage
              onNavigate={navigate}
              onOrderSuccess={(id) => navigate(`order-success/${id}`)}
            />
          )}

          {isOrderSuccessRoute && orderSuccessId && (
            <OrderSuccessPage
              orderId={orderSuccessId}
              onNavigate={navigate}
            />
          )}

          {isTrackRoute && (
            <OrderTrackPage
              initialOrderId={trackOrderId}
              onNavigate={navigate}
            />
          )}

          {(route === 'shipping' ||
            route === 'returns' ||
            route === 'contact' ||
            route === 'faq' ||
            route === 'privacy' ||
            route === 'terms') && (
            <PolicyPage
              pageType={route as any}
              onNavigate={navigate}
            />
          )}

          {isAdminRoute && (
            <AdminPage onNavigateCustomer={navigate} />
          )}
        </div>

        {/* Customer Footer */}
        {!isAdminRoute && <Footer onNavigate={navigate} onOpenAccount={() => setIsAccountOpen(true)} />}

        {/* Global Cart Slide-Out Drawer */}
        <CartDrawer onNavigate={navigate} />

        {/* Global Customer Account Drawer */}
        <AccountDrawer
          isOpen={isAccountOpen}
          onClose={() => setIsAccountOpen(false)}
          onNavigate={navigate}
        />

        {/* Global Search Overlay */}
        <SearchOverlay
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectProduct={(slug) => navigate(`product/${slug}`)}
        />
      </div>
    </CartProvider>
  );
}

export default App;
