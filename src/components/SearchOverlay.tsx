import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, ArrowUpRight } from 'lucide-react';
import { DatabaseService } from '../services/dataService';
import { Product } from '../types';
import { SafeImage } from './SafeImage';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (slug: string) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  isOpen,
  onClose,
  onSelectProduct
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const allProducts = useMemo(() => DatabaseService.getProducts(), [isOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return allProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.tagline.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }, [allProducts, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 sm:p-8 animate-fadeIn">
      {/* Top Bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-neutral-800">
        <span className="font-display font-extrabold text-sm uppercase tracking-widest text-[#e11d48]">
          SEARCH ARCHIVE
        </span>
        <button
          onClick={onClose}
          className="p-2 text-neutral-400 hover:text-white transition-colors"
          aria-label="Close search"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Search Input */}
      <div className="max-w-4xl w-full mx-auto my-6">
        <div className="relative">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hoodies, tees, posters, A2 prints, SKUs..."
            className="w-full bg-transparent pl-10 pr-4 py-3 text-xl sm:text-2xl font-display font-bold text-white placeholder-neutral-600 focus:outline-none border-b border-neutral-800 focus:border-[#e11d48] transition-colors"
          />
        </div>
      </div>

      {/* Results */}
      <div className="max-w-4xl w-full mx-auto flex-1 overflow-y-auto">
        {query.trim() === '' ? (
          <div className="py-8">
            <h4 className="text-xs font-mono uppercase text-neutral-500 tracking-wider mb-4">
              POPULAR SEARCHES
            </h4>
            <div className="flex flex-wrap gap-2">
              {['Tokyo Cyber Hoodie', 'Luxury Campaign Poster', 'Heavyweight French Terry', 'Posters A2', 'Rebel Angel'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-tech text-neutral-300 transition-colors uppercase tracking-wider"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-display text-lg text-neutral-400 uppercase tracking-wider">
              No drops matching &ldquo;{query}&rdquo;
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              Try searching for &apos;Hoodie&apos;, &apos;Poster&apos;, or &apos;Tokyo&apos;
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-12">
            {results.map((product: Product) => (
              <div
                key={product.id}
                onClick={() => {
                  onClose();
                  onSelectProduct(product.slug);
                }}
                className="group flex gap-4 p-3 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 transition-all cursor-pointer"
              >
                <div className="w-16 h-20 flex-shrink-0 bg-neutral-900 border border-neutral-800 overflow-hidden">
                  <SafeImage
                    src={product.images[0]}
                    alt={product.name}
                    containerClassName="w-full h-full"
                    aspectRatio="auto"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#e11d48] tracking-widest font-semibold">
                      {product.category}
                    </span>
                    <h4 className="font-display font-bold text-sm text-white group-hover:text-[#e11d48] transition-colors truncate uppercase">
                      {product.name}
                    </h4>
                    <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">
                      {product.tagline}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-tech text-sm font-bold text-white">
                      ৳{product.price.toLocaleString()}
                    </span>
                    <span className="text-xs font-mono text-neutral-500 flex items-center gap-1 group-hover:text-white transition-colors">
                      VIEW <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
