import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseService } from '../services/dataService';
import { ProductCard } from '../components/ProductCard';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { HssStarIcon } from '../components/HssLogo';
import { CategoryItem } from '../types';

interface ShopPageProps {
  initialCategory?: string;
  onSelectProduct: (slug: string) => void;
  onNavigate?: (route: string) => void;
}

export const ShopPage: React.FC<ShopPageProps> = ({ initialCategory = 'all', onSelectProduct, onNavigate }) => {
  const [selectedFilter, setSelectedFilter] = useState<string>(initialCategory);
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc' | 'featured'>('newest');
  const [inStockOnly, setInStockOnly] = useState(false);

  const allProducts = useMemo(() => DatabaseService.getProducts(), []);
  const [categories, setCategories] = useState<CategoryItem[]>(() => DatabaseService.getCategories(false));

  // Sync when initialCategory prop changes
  useEffect(() => {
    if (initialCategory) {
      setSelectedFilter(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    setCategories(DatabaseService.getCategories(false));
  }, []);

  const matchingCategory = useMemo(() => {
    return categories.find(
      c => c.slug.toLowerCase() === selectedFilter.toLowerCase() || c.name.toLowerCase() === selectedFilter.toLowerCase()
    );
  }, [selectedFilter, categories]);

  const filteredProducts = useMemo(() => {
    let list = [...allProducts];

    // Filter by Dynamic Category or Drop status
    if (selectedFilter === 'new-drops') {
      list = list.filter(p => p.isNewDrop);
    } else if (selectedFilter === 'featured') {
      list = list.filter(p => p.isFeatured);
    } else if (selectedFilter !== 'all') {
      const target = selectedFilter.toLowerCase();
      list = list.filter(p => {
        const cat = p.category.toLowerCase();
        if (cat === target) return true;
        if (target === 'hoodies' && cat === 'clothing' && p.name.toLowerCase().includes('hoodie')) return true;
        if (target === 't-shirts' && cat === 'clothing' && (p.name.toLowerCase().includes('tee') || p.name.toLowerCase().includes('t-shirt'))) return true;
        if (target === 'clothing' && (cat === 'hoodies' || cat === 't-shirts' || cat === 'jackets')) return true;
        return false;
      });
    }

    // Availability filter
    if (inStockOnly) {
      list = list.filter(p => p.stock > 0);
    }

    // Sorting
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'featured') {
      list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
    } else {
      // Newest
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [allProducts, selectedFilter, inStockOnly, sortBy]);

  // Dynamic Title Determination
  const pageTitle = useMemo(() => {
    if (selectedFilter === 'new-drops') return 'NEW DROPS';
    if (selectedFilter === 'featured') return 'FEATURED PIECES';
    if (selectedFilter === 'all') return 'ALL COLLECTIONS';

    if (matchingCategory) {
      return matchingCategory.name.toUpperCase();
    }
    return selectedFilter.replace('-', ' ').toUpperCase();
  }, [selectedFilter, matchingCategory]);

  // Dynamic Tabs: ALL, then active categories from Admin database, then NEW DROPS, FEATURED
  const filterTabs = useMemo(() => {
    const tabs = [
      { id: 'all', label: 'ALL RELEASES' },
      ...categories.map(cat => ({
        id: cat.slug,
        label: cat.name.toUpperCase()
      })),
      { id: 'new-drops', label: 'NEW DROPS' },
      { id: 'featured', label: 'FEATURED' }
    ];
    return tabs;
  }, [categories]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-14 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Title & Category Header */}
        <div className="mb-12 pb-6 border-b border-neutral-900">
          <div className="flex items-center gap-2 text-[#e11d48] mb-1.5">
            <HssStarIcon className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] font-bold">
              {matchingCategory ? 'DEPARTMENT CATALOG' : 'CATALOGUE'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl text-white uppercase tracking-tight">
                {pageTitle}
              </h1>

              {/* Optional short category description */}
              {matchingCategory?.description ? (
                <p className="text-xs sm:text-sm text-neutral-400 mt-2 font-mono max-w-xl">
                  {matchingCategory.description}
                </p>
              ) : (
                <p className="text-xs text-neutral-500 mt-1 font-mono">
                  SHOWING {filteredProducts.length} ITEMS • 100% AUTHENTIC HIGH STREET SOCIETY
                </p>
              )}
            </div>

            {/* In stock toggle */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-mono text-neutral-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded-none bg-neutral-900 border-neutral-700 text-[#e11d48] focus:ring-0 w-3.5 h-3.5"
                />
                IN STOCK ONLY
              </label>
            </div>
          </div>
        </div>

        {/* Dynamic Filter & Sort Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-10 bg-neutral-950 p-3 border border-neutral-900">
          {/* Dynamic Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-tech font-bold uppercase tracking-wider transition-colors ${
                  selectedFilter.toLowerCase() === tab.id.toLowerCase()
                    ? 'bg-[#e11d48] text-white'
                    : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-xs font-mono uppercase text-neutral-500">SORT:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-neutral-900 text-xs font-tech text-white border border-neutral-800 px-3 py-1.5 focus:outline-none focus:border-[#e11d48]"
            >
              <option value="newest">NEWEST FIRST</option>
              <option value="price-asc">PRICE: LOW → HIGH</option>
              <option value="price-desc">PRICE: HIGH → LOW</option>
              <option value="featured">FEATURED</option>
            </select>
          </div>
        </div>

        {/* Product Grid with Generous Spacing */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 border border-neutral-900 bg-neutral-950/40 p-8">
            <p className="font-display font-bold text-lg text-white uppercase tracking-wider mb-2">
              No products found
            </p>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-6 font-mono">
              There are no products currently matching the category &ldquo;{pageTitle}&rdquo;.
            </p>
            <button
              onClick={() => {
                setSelectedFilter('all');
                setInStockOnly(false);
                setSortBy('newest');
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-800 text-white font-tech text-xs uppercase tracking-wider hover:bg-[#e11d48] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              RESET FILTERS
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={onSelectProduct}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
