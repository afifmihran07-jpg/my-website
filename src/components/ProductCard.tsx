import React, { useState } from 'react';
import { Product } from '../types';
import { SafeImage } from './SafeImage';
import { ArrowUpRight } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick: (slug: string) => void;
  onNavigate?: (route: string) => void;
  showQuickActions?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onClick
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const primaryImage = product.images[0];
  const hoverImage = product.images[1] || primaryImage;
  const isOutOfStock = product.stock <= 0;

  return (
    <div
      onClick={() => onClick(product.slug)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group cursor-pointer flex flex-col h-full bg-[#0d0d0f] border border-neutral-900 hover:border-neutral-700/80 transition-all duration-300 relative"
    >
      {/* Visual Canvas */}
      <div className="relative overflow-hidden bg-neutral-950 aspect-[3/4]">
        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 items-start">
          {product.isNewDrop && !isOutOfStock && (
            <span className="bg-[#e11d48] text-white font-tech text-[9.5px] font-black px-2 py-0.5 tracking-widest uppercase">
              NEW DROP
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-neutral-900 text-neutral-400 font-tech text-[9.5px] font-bold px-2 py-0.5 tracking-wider uppercase border border-neutral-800">
              OUT OF STOCK
            </span>
          )}
        </div>

        {/* Category & Discreet Wishlist Tag */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              import('../services/dataService').then(({ DatabaseService }) => {
                DatabaseService.toggleWishlist(product.id);
                setIsWishlisted(!isWishlisted);
              });
            }}
            className="p-1.5 bg-black/60 backdrop-blur-md border border-neutral-800/80 text-neutral-400 hover:text-[#e11d48] transition-colors"
            title="Save Piece"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5 fill-current"
              style={{ color: isWishlisted ? '#e11d48' : 'currentColor' }}
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
          <span className="text-[9.5px] font-mono tracking-widest uppercase text-neutral-400 bg-black/60 backdrop-blur-md px-2 py-0.5 border border-neutral-800/80">
            {product.category}
          </span>
        </div>

        {/* Product Images with Hover Transition */}
        <SafeImage
          src={isHovered && hoverImage ? hoverImage : primaryImage}
          alt={product.name}
          fallbackTitle={product.name}
          containerClassName="w-full h-full"
          className="transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {/* Quick View Hover Strip */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
          <span className="font-display text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-1">
            VIEW PIECE <ArrowUpRight className="w-3 h-3 text-[#e11d48]" />
          </span>
          <span className="text-[9.5px] font-mono text-neutral-400">
            {product.sku}
          </span>
        </div>
      </div>

      {/* Product Meta - Clean, pristine, editorial presentation */}
      <div className="p-3.5 sm:p-4 flex flex-col justify-between flex-1 border-t border-neutral-900 bg-black/40 space-y-2.5">
        <div>
          <h3 className="font-display font-black text-sm text-white uppercase tracking-tight group-hover:text-[#e11d48] transition-colors line-clamp-1">
            {product.name}
          </h3>
          <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5 font-sans">
            {product.tagline}
          </p>
        </div>

        {/* Pricing & Stock Indicator */}
        <div className="pt-2 border-t border-neutral-900/80 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-tech text-base font-bold text-white">
              ৳{product.price.toLocaleString()}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="font-tech text-xs text-neutral-500 line-through">
                ৳{product.compareAtPrice.toLocaleString()}
              </span>
            )}
          </div>
          <span className={`text-[9.5px] font-mono uppercase tracking-wider ${product.stock > 5 ? 'text-neutral-500' : product.stock > 0 ? 'text-amber-500 font-semibold' : 'text-neutral-600'}`}>
            {product.stock > 5 ? 'IN STOCK' : product.stock > 0 ? `${product.stock} LEFT` : 'SOLD OUT'}
          </span>
        </div>
      </div>
    </div>
  );
};
