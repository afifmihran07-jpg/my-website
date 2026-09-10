import React from 'react';

interface HssLogoProps {
  variant?: 'emblem' | 'mark' | 'full';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  inverted?: boolean;
}

export const HssStarIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* 4-point dynamic flared star with spiky rays & center */}
      <path d="M50 0 C48 30 30 48 0 50 C30 52 48 70 50 100 C52 70 70 52 100 50 C70 48 52 30 50 0 Z" />
      {/* Dynamic secondary diagonal micro rays */}
      <path d="M50 22 L55 45 L78 50 L55 55 L50 78 L45 55 L22 50 L45 45 Z" opacity="0.6" />
      {/* Center core */}
      <circle cx="50" cy="50" r="3.5" fill="#e11d48" />
    </svg>
  );
};

export const HssLogo: React.FC<HssLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  inverted = false
}) => {
  const sizeClasses = {
    sm: 'h-6 text-sm',
    md: 'h-8 text-base',
    lg: 'h-11 text-xl',
    xl: 'h-16 text-3xl'
  };

  const starSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  if (variant === 'mark') {
    return (
      <div className={`inline-flex items-center justify-center text-white ${className}`}>
        <HssStarIcon className={starSizes[size]} />
      </div>
    );
  }

  if (variant === 'emblem') {
    const emblemSizes = {
      sm: 'w-8 h-8',
      md: 'w-11 h-11',
      lg: 'w-16 h-16',
      xl: 'w-24 h-24'
    };

    return (
      <div className={`relative inline-block rounded-full overflow-hidden bg-white shadow-md border border-neutral-800 ${emblemSizes[size]} ${className}`}>
        <img
          src="/images/hss-star-logo.png"
          alt="HIGH STREET SOCIETY"
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            // Fallback SVG if image not found
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 font-display tracking-tight font-black uppercase select-none ${sizeClasses[size]} ${className}`}>
      <div className="relative flex items-center justify-center text-[#e11d48]">
        <HssStarIcon className={starSizes[size]} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`tracking-wider font-extrabold ${inverted ? 'text-black' : 'text-white'}`}>
          HIGH STREET
        </span>
        <span className="text-[0.62em] tracking-[0.24em] font-medium text-neutral-400 flex items-center gap-1.5 font-mono">
          SOCIETY <span className="inline-block w-1 h-1 rounded-full bg-[#e11d48]"></span> EST. 2025
        </span>
      </div>
    </div>
  );
};
