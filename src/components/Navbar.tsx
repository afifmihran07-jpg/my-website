import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Search, Menu, X, User, Package, ChevronDown } from 'lucide-react';
import { HssLogo } from './HssLogo';
import { useCart } from '../context/CartContext';
import { DatabaseService } from '../services/dataService';
import { CategoryItem } from '../types';

interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  onOpenSearch: () => void;
  onOpenAccount: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onNavigate, onOpenSearch, onOpenAccount }) => {
  const { totalItems, setIsOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileCatOpen, setMobileCatOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [settings, setSettings] = useState(DatabaseService.getSettings());
  const [content, setContent] = useState(() => DatabaseService.getSiteContent(false));
  const [categories, setCategories] = useState<CategoryItem[]>(() => DatabaseService.getCategories(false));
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 25);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Refresh settings & categories & content when nav opens/changes
  useEffect(() => {
    setSettings(DatabaseService.getSettings());
    setContent(DatabaseService.getSiteContent(false));
    setCategories(DatabaseService.getCategories(false));
  }, [currentRoute]);

  // Click outside listener for category dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isCurrentCategoryRoute = currentRoute.startsWith('category/') || currentRoute === 'clothing' || currentRoute === 'posters';

  return (
    <header className="sticky top-0 z-40 w-full transition-colors duration-300">
      {/* Top Restrained Announcement Bar */}
      {content.homepage.showAnnouncement !== false && settings.announcementActive !== false && (
        <div className="bg-[#e11d48] text-white text-[10.5px] font-tech font-bold uppercase tracking-[0.2em] py-1.5 px-4 text-center overflow-hidden border-b border-red-700/50">
          <span>{content.homepage.announcementText || settings.announcementText || 'NEW DROP LIVE · NATIONWIDE DELIVERY'}</span>
        </div>
      )}

      {/* Main Navbar */}
      <nav
        className={`w-full border-b transition-all duration-300 ${
          isScrolled
            ? 'bg-[#0a0a0a]/95 backdrop-blur-md border-neutral-800 py-3 shadow-xl'
            : 'bg-[#0a0a0a]/85 backdrop-blur-sm border-neutral-900 py-3.5 sm:py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left: Brand Logo with EST. 2025 */}
          <div
            onClick={() => {
              onNavigate('home');
              setMobileMenuOpen(false);
            }}
            className="cursor-pointer flex-shrink-0"
          >
            <HssLogo variant="full" size="md" />
          </div>

          {/* Center: Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => onNavigate('home')}
              className={`text-xs font-display font-extrabold tracking-widest uppercase transition-colors relative py-1 ${
                currentRoute === 'home' ? 'text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {content.navigation.menuHome || 'HOME'}
              {currentRoute === 'home' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e11d48]" />
              )}
            </button>

            <button
              onClick={() => onNavigate('shop')}
              className={`text-xs font-display font-extrabold tracking-widest uppercase transition-colors relative py-1 ${
                currentRoute === 'shop' ? 'text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {content.navigation.menuShop || 'SHOP'}
              {currentRoute === 'shop' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e11d48]" />
              )}
            </button>

            <button
              onClick={() => onNavigate('new-drops')}
              className={`text-xs font-display font-extrabold tracking-widest uppercase transition-colors relative py-1 ${
                currentRoute === 'new-drops' ? 'text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {content.navigation.menuNewDrops || 'NEW DROPS'}
              {currentRoute === 'new-drops' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e11d48]" />
              )}
            </button>

            {/* Dynamic CATEGORIES Dropdown Menu */}
            <div
              ref={dropdownRef}
              className="relative"
              onMouseEnter={() => setIsCatDropdownOpen(true)}
              onMouseLeave={() => setIsCatDropdownOpen(false)}
            >
              <button
                onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                className={`text-xs font-display font-extrabold tracking-widest uppercase transition-colors relative py-1 flex items-center gap-1 ${
                  isCurrentCategoryRoute ? 'text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>{content.navigation.menuCategories || 'CATEGORIES'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isCatDropdownOpen ? 'rotate-180 text-[#e11d48]' : 'text-neutral-500'}`} />
                {isCurrentCategoryRoute && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e11d48]" />
                )}
              </button>

              {/* Refined Dropdown Menu */}
              {isCatDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-[#0e0e11] border border-neutral-800 shadow-2xl py-2 z-50 animate-fadeIn">
                  <div className="px-3.5 py-1 text-[10px] font-mono text-neutral-500 uppercase tracking-widest border-b border-neutral-900">
                    DEPARTMENTS
                  </div>
                  <div className="py-1">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setIsCatDropdownOpen(false);
                          onNavigate(`category/${cat.slug}`);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-display font-bold uppercase tracking-wider text-neutral-300 hover:text-white hover:bg-neutral-900 flex items-center justify-between transition-colors"
                      >
                        <span>{cat.name}</span>
                        <span className="text-[10px] font-mono text-neutral-500">→</span>
                      </button>
                    ))}
                    {categories.length === 0 && (
                      <div className="px-4 py-2 text-xs text-neutral-500 font-mono">
                        No active categories
                      </div>
                    )}
                  </div>
                  <div className="border-t border-neutral-900 pt-1 mt-1 px-3">
                    <button
                      onClick={() => {
                        setIsCatDropdownOpen(false);
                        onNavigate('shop');
                      }}
                      className="w-full text-left py-1 text-[11px] font-mono text-[#e11d48] hover:underline uppercase"
                    >
                      EXPLORE ALL CATALOG →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => onNavigate('about')}
              className={`text-xs font-display font-extrabold tracking-widest uppercase transition-colors relative py-1 ${
                currentRoute === 'about' ? 'text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {content.navigation.menuAbout || 'ABOUT'}
              {currentRoute === 'about' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e11d48]" />
              )}
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Search Trigger */}
            <button
              onClick={onOpenSearch}
              className="p-2 text-neutral-300 hover:text-white transition-colors"
              aria-label="Search products"
              title="Search"
            >
              <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* Customer Account Trigger */}
            <button
              onClick={onOpenAccount}
              className="p-2 text-neutral-300 hover:text-white transition-colors"
              title="Customer Account & Orders"
              aria-label="Customer Account"
            >
              <User className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* Bag Button with Dynamic Counter */}
            <button
              onClick={() => setIsOpen(true)}
              className="relative p-2 text-white hover:text-[#e11d48] transition-colors"
              aria-label={`Shopping bag with ${totalItems} items`}
              title="Bag"
            >
              <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#e11d48] text-white text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-white md:hidden"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[70px] z-30 bg-[#0a0a0c] p-6 flex flex-col justify-between md:hidden border-t border-neutral-800 overflow-y-auto animate-fadeIn">
          <div className="space-y-4 pt-2">
            <button
              onClick={() => {
                onNavigate('home');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left font-display font-extrabold text-2xl uppercase tracking-wider py-1.5 transition-colors ${
                currentRoute === 'home' ? 'text-[#e11d48]' : 'text-white'
              }`}
            >
              HOME
            </button>

            <button
              onClick={() => {
                onNavigate('shop');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left font-display font-extrabold text-2xl uppercase tracking-wider py-1.5 transition-colors ${
                currentRoute === 'shop' ? 'text-[#e11d48]' : 'text-white'
              }`}
            >
              SHOP
            </button>

            <button
              onClick={() => {
                onNavigate('new-drops');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left font-display font-extrabold text-2xl uppercase tracking-wider py-1.5 transition-colors ${
                currentRoute === 'new-drops' ? 'text-[#e11d48]' : 'text-white'
              }`}
            >
              NEW DROPS
            </button>

            {/* Categories Collapsible on Mobile */}
            <div>
              <button
                onClick={() => setMobileCatOpen(!mobileCatOpen)}
                className="w-full text-left font-display font-extrabold text-2xl uppercase tracking-wider py-1.5 text-white flex items-center justify-between"
              >
                <span>CATEGORIES</span>
                <ChevronDown className={`w-5 h-5 transition-transform ${mobileCatOpen ? 'rotate-180 text-[#e11d48]' : 'text-neutral-500'}`} />
              </button>

              {mobileCatOpen && (
                <div className="pl-4 py-2 space-y-2 border-l border-neutral-800 my-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onNavigate(`category/${cat.slug}`);
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left font-display font-bold text-base uppercase tracking-wider text-neutral-300 hover:text-white py-1"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                onNavigate('about');
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left font-display font-extrabold text-2xl uppercase tracking-wider py-1.5 transition-colors ${
                currentRoute === 'about' ? 'text-[#e11d48]' : 'text-white'
              }`}
            >
              ABOUT
            </button>

            <div className="pt-4 border-t border-neutral-800/80 space-y-1">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAccount();
                }}
                className="flex items-center gap-2 text-neutral-300 hover:text-white font-tech text-sm uppercase tracking-wider py-2"
              >
                <User className="w-4 h-4 text-[#e11d48]" />
                MY ACCOUNT & ORDERS
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('track');
                }}
                className="flex items-center gap-2 text-neutral-300 hover:text-white font-tech text-sm uppercase tracking-wider py-2"
              >
                <Package className="w-4 h-4 text-[#e11d48]" />
                TRACK CONSIGNMENT
              </button>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-6 space-y-4">
            <div className="text-xs text-neutral-400 space-y-1 font-mono">
              <p className="text-white font-bold">CLIENT ASSISTANCE · EST. 2025</p>
              <p>+8801879665602 • +8801303080934</p>
              <p>Dhaka, Bangladesh</p>
            </div>
            <a
              href={settings.instagramUrl || 'https://www.instagram.com/highstreetsoociety?stkn=bGt3MmE3MTZ2ZzB1'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                const targetUrl = settings.instagramUrl || 'https://www.instagram.com/highstreetsoociety?stkn=bGt3MmE3MTZ2ZzB1';
                try {
                  const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
                  if (win) e.preventDefault();
                } catch {
                  // fallback
                }
              }}
              className="block text-center py-3 bg-neutral-900 border border-neutral-700 text-white font-tech text-xs uppercase tracking-widest hover:bg-[#e11d48] hover:border-[#e11d48] transition-colors"
            >
              INSTAGRAM @highstreetsoociety →
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
