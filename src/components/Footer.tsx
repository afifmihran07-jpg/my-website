import React, { useState, useEffect } from 'react';
import { ArrowRight, Phone, Mail, CheckCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { HssLogo, HssStarIcon } from './HssLogo';
import { DatabaseService } from '../services/dataService';

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

interface FooterProps {
  onNavigate: (route: string) => void;
  onOpenAccount?: () => void;
  onOpenSizeGuide?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenAccount, onOpenSizeGuide }) => {
  const [email, setEmail] = useState('');
  const [subStatus, setSubStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const settings = DatabaseService.getSettings();
  const [content, setContent] = useState(() => DatabaseService.getSiteContent(false));

  useEffect(() => {
    setContent(DatabaseService.getSiteContent(false));
  }, []);

  const ft = content.footer;
  const hp = content.homepage;

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const res = DatabaseService.addSubscriber(email);
    if (res.success) {
      setSubStatus({ type: 'success', message: res.message });
      setEmail('');
    } else {
      setSubStatus({ type: 'error', message: res.message });
    }
    setTimeout(() => setSubStatus(null), 5000);
  };

  const instagramTargetUrl =
    settings.instagramUrl || 'https://www.instagram.com/highstreetsoociety?stkn=bGt3MmE3MTZ2ZzB1';

  return (
    <footer className="bg-black border-t border-neutral-900 text-neutral-400 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Top Newsletter Strip */}
        {hp.showNewsletter !== false && (
          <div className="pb-14 border-b border-neutral-900 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-md">
              <div className="flex items-center gap-2 text-[#e11d48] mb-1.5">
                <HssStarIcon className="w-3.5 h-3.5" />
                <span className="text-[11px] font-mono tracking-widest uppercase font-bold">
                  {hp.newsletterEyebrow || 'THE SOCIETY CIRCLE'}
                </span>
              </div>
              <h3 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                {hp.newsletterTitle || 'JOIN HIGH STREET SOCIETY'}
              </h3>
              <p className="text-xs text-neutral-400 mt-1 font-sans leading-relaxed">
                {hp.newsletterText || 'Private notifications for limited capsule releases, secret drops, and archival artwork.'}
              </p>
            </div>

            <form onSubmit={handleSubscribe} className="w-full lg:w-auto max-w-md flex-1">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ENTER YOUR EMAIL..."
                  className="flex-1 bg-neutral-950 border border-neutral-800 px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#e11d48] font-mono transition-colors"
                  required
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#e11d48] hover:bg-[#be123c] text-white font-tech font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {hp.newsletterCtaText || 'JOIN THE DROP'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {subStatus && (
                <p
                  className={`text-xs mt-2 flex items-center gap-1.5 ${
                    subStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {subStatus.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {subStatus.message}
                </p>
              )}
            </form>
          </div>
        )}

        {/* Refined 4-Column Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 py-4 border-b border-neutral-900 pb-14">
          {/* Brand Info & EST. 2025 */}
          <div className="col-span-2 space-y-4">
            <div onClick={() => onNavigate('home')} className="cursor-pointer">
              <HssLogo variant="full" size="md" />
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed font-sans max-w-sm">
              {ft.brandDescription ||
                'Contemporary Gen-Z fashion house and print studio based in Dhaka. Heavyweight 450 GSM French Terry streetwear, architectural graphics, and physical dimension art prints.'}
            </p>
            <div className="text-[11px] font-mono text-neutral-500 tracking-wider uppercase">
              {ft.estText || 'HIGH STREET SOCIETY · EST. 2025 · DHAKA'}
            </div>
            <div className="pt-1">
              <a
                href={instagramTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  try {
                    const win = window.open(instagramTargetUrl, '_blank', 'noopener,noreferrer');
                    if (win) e.preventDefault();
                  } catch {
                    // fallback
                  }
                }}
                className="inline-flex items-center gap-2 text-xs font-mono text-white hover:text-[#e11d48] transition-colors border border-neutral-800 px-3 py-1.5 bg-neutral-950"
              >
                <InstagramIcon className="w-4 h-4 text-[#e11d48]" />
                <span>{settings.instagramHandle || '@highstreetsoociety'}</span>
                <ArrowUpRight className="w-3 h-3 text-neutral-500" />
              </a>
            </div>
          </div>

          {/* Col 1: SHOP */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-widest text-white">
              {ft.shopHeading || 'SHOP'}
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <button onClick={() => onNavigate('new-drops')} className="hover:text-[#e11d48] transition-colors">
                  New Drops
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('clothing')} className="hover:text-white transition-colors">
                  Clothing
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('posters')} className="hover:text-white transition-colors">
                  Posters
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('shop')} className="hover:text-white transition-colors">
                  Categories
                </button>
              </li>
            </ul>
          </div>

          {/* Col 2: HELP */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-widest text-white">
              {ft.helpHeading || 'HELP'}
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <button onClick={() => onNavigate('shipping')} className="hover:text-white transition-colors">
                  Shipping
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('returns')} className="hover:text-white transition-colors">
                  Returns
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('returns')} className="hover:text-white transition-colors">
                  Exchange (4-Day)
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    if (onOpenSizeGuide) onOpenSizeGuide();
                    else onNavigate('about');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Size Guide
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                  Contact
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: ACCOUNT & DIRECT DISPATCH */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-widest text-white">
              {ft.accountHeading || 'ACCOUNT'}
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <button
                  onClick={() => {
                    if (onOpenAccount) onOpenAccount();
                    else onNavigate('track');
                  }}
                  className="hover:text-white transition-colors"
                >
                  My Account
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('track')} className="hover:text-white transition-colors">
                  Orders & Tracking
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    if (onOpenAccount) onOpenAccount();
                    else onNavigate('shop');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Wishlist
                </button>
              </li>
            </ul>

            <div className="pt-2 text-xs font-mono space-y-1 text-neutral-400">
              <div className="flex items-center gap-2">
                <Phone className="w-3 h-3 text-[#e11d48]" />
                <span className="text-white">+8801879665602</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3 h-3 text-neutral-500" />
                <span>{settings.businessEmail}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar with Legal Links */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-4 font-mono">
          <p>{ft.copyrightText || '© 2026 HIGH STREET SOCIETY. EST. 2025. WEAR YOUR WORLD.'}</p>
          <div className="flex items-center gap-6">
            <button onClick={() => onNavigate('privacy')} className="hover:text-white transition-colors">
              Privacy Policy
            </button>
            <button onClick={() => onNavigate('terms')} className="hover:text-white transition-colors">
              Terms & Conditions
            </button>
            <button onClick={() => onNavigate('faq')} className="hover:text-white transition-colors">
              FAQ
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
