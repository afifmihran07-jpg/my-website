import React, { useState } from 'react';
import { HssStarIcon } from './HssLogo';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallbackTitle?: string;
  aspectRatio?: 'square' | 'portrait' | 'wide' | 'auto';
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  containerClassName = '',
  fallbackTitle,
  aspectRatio = 'portrait',
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const aspectClasses = {
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
    wide: 'aspect-[16/9]',
    auto: ''
  };

  const showFallback = !src || hasError;

  return (
    <div className={`relative overflow-hidden bg-neutral-900 ${aspectClasses[aspectRatio]} ${containerClassName}`}>
      {/* Loading Skeleton */}
      {isLoading && !showFallback && (
        <div className="absolute inset-0 bg-neutral-900 animate-pulse flex items-center justify-center z-10">
          <HssStarIcon className="w-6 h-6 text-neutral-700 animate-spin" />
        </div>
      )}

      {/* Main Image */}
      {!showFallback ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          className={`w-full h-full object-cover transition-all duration-500 ${isLoading ? 'opacity-0 scale-98' : 'opacity-100 scale-100'} ${className}`}
          {...props}
        />
      ) : (
        /* Branded Fallback Placeholder - Never broken, always stylish HSS aesthetic */
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black flex flex-col items-center justify-center p-6 text-center select-none border border-neutral-800/60">
          <div className="w-14 h-14 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 mb-3 shadow-inner">
            <HssStarIcon className="w-7 h-7 text-[#e11d48]" />
          </div>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-neutral-400 max-w-[80%] line-clamp-2">
            {fallbackTitle || alt || 'HIGH STREET SOCIETY'}
          </p>
          <span className="text-[10px] font-mono tracking-widest text-neutral-600 mt-1 uppercase">
            HSS • ARCHIVAL
          </span>
        </div>
      )}
    </div>
  );
};
