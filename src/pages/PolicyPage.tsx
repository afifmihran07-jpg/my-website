import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/dataService';
import { HssStarIcon } from '../components/HssLogo';
import { Phone, Mail, MapPin, Truck, RefreshCw, FileText, ChevronDown, ChevronUp, Send, CheckCircle } from 'lucide-react';
import { SiteContent } from '../types';

interface PolicyPageProps {
  pageType: 'shipping' | 'returns' | 'contact' | 'faq' | 'privacy' | 'terms';
  onNavigate: (route: string) => void;
}

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

export const PolicyPage: React.FC<PolicyPageProps> = ({ pageType, onNavigate }) => {
  const settings = DatabaseService.getSettings();
  const [content, setContent] = useState<SiteContent>(() => DatabaseService.getSiteContent(false));
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    setContent(DatabaseService.getSiteContent(false));
  }, [pageType]);

  const ct = content.contact;

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactPhone || !contactMessage) return;
    setContactSent(true);
    setContactName('');
    setContactPhone('');
    setContactMessage('');
    setTimeout(() => setContactSent(false), 5000);
  };

  const instagramTargetUrl =
    settings.instagramUrl || 'https://www.instagram.com/highstreetsoociety?stkn=bGt3MmE3MTZ2ZzB1';

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-16 sm:py-24 text-neutral-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Page Top Header */}
        <div className="text-center pb-8 border-b border-neutral-900 space-y-3">
          <div className="inline-flex items-center gap-2 text-[#e11d48]">
            <HssStarIcon className="w-4 h-4" />
            <span className="font-mono text-xs tracking-widest uppercase font-bold">
              CLIENT SERVICES
            </span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight">
            {pageType === 'shipping' && 'SHIPPING & DISPATCH'}
            {pageType === 'returns' && 'RETURNS & EXCHANGES'}
            {pageType === 'contact' && (ct.title || 'CONTACT THE SOCIETY')}
            {pageType === 'faq' && 'FREQUENTLY ASKED QUESTIONS'}
            {pageType === 'privacy' && 'PRIVACY POLICY'}
            {pageType === 'terms' && 'TERMS & CONDITIONS'}
          </h1>
          {pageType === 'contact' && ct.subtitle && (
            <p className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
              {ct.subtitle}
            </p>
          )}
        </div>

        {/* 1. SHIPPING PAGE */}
        {pageType === 'shipping' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Inside Dhaka */}
              <div className="p-6 bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-extrabold text-sm uppercase text-white">
                    INSIDE DHAKA
                  </span>
                  <span className="font-tech text-lg font-bold text-[#e11d48]">
                    ৳{settings.deliveryInsideDhaka}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Fast doorstep delivery within 24 to 48 hours via express courier. SMS tracking and delivery agent call on arrival.
                </p>
              </div>

              {/* Outside Dhaka */}
              <div className="p-6 bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-extrabold text-sm uppercase text-white">
                    OUTSIDE DHAKA (ALL DISTRICTS)
                  </span>
                  <span className="font-tech text-lg font-bold text-[#e11d48]">
                    ৳{settings.deliveryOutsideDhaka}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Nationwide coverage across all 64 districts in Bangladesh within 48 to 72 hours. Protective water-resistant packaging.
                </p>
              </div>
            </div>

            <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4 text-xs font-sans leading-relaxed">
              <h3 className="font-display font-bold text-sm text-white uppercase flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#e11d48]" />
                PACKAGING & PROTECTION
              </h3>
              <p className="text-neutral-400 whitespace-pre-line leading-relaxed font-mono">
                {settings.shippingPolicy}
              </p>
            </div>
          </div>
        )}

        {/* 2. RETURNS PAGE */}
        {pageType === 'returns' && (
          <div className="bg-neutral-950 border border-neutral-900 p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 text-white">
              <RefreshCw className="w-6 h-6 text-[#e11d48]" />
              <h2 className="font-display font-extrabold text-lg uppercase">
                4-DAY HASSLE-FREE EXCHANGE POLICY
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-neutral-400 space-y-4 font-sans leading-relaxed whitespace-pre-line">
              {settings.returnPolicy}
            </div>
            <div className="pt-4 border-t border-neutral-900 flex flex-wrap gap-4 text-xs font-mono">
              <span className="text-white font-bold">CLIENT CONCIERGE:</span>
              <span>{ct.phonePrimary || '+8801879665602'} • {ct.phoneSecondary || '+8801303080934'}</span>
            </div>
          </div>
        )}

        {/* 3. CONTACT PAGE */}
        {pageType === 'contact' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Contact Details */}
            <div className="bg-neutral-950 border border-neutral-900 p-6 sm:p-8 space-y-6">
              <h2 className="font-display font-bold text-lg text-white uppercase">
                {ct.subtitle || 'HEADQUARTERS & CONCIERGE'}
              </h2>
              <div className="space-y-4 text-xs font-mono text-neutral-400">
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-[#e11d48] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-bold">TELEPHONE / WHATSAPP</p>
                    <p className="mt-0.5">{ct.phonePrimary || '+8801879665602'}</p>
                    <p>{ct.phoneSecondary || '+8801303080934'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#e11d48] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-bold">EMAIL INQUIRIES</p>
                    <p className="mt-0.5">{ct.email || settings.businessEmail}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#e11d48] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-bold">DISPATCH BASE</p>
                    <p className="mt-0.5">{ct.location || settings.address || 'Dhaka, Bangladesh'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <InstagramIcon className="w-4 h-4 text-[#e11d48] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-bold">INSTAGRAM</p>
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
                      className="mt-0.5 text-[#e11d48] hover:underline block font-mono"
                    >
                      {settings.instagramHandle || '@highstreetsoociety'}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Message Form */}
            <div className="bg-neutral-950 border border-neutral-900 p-6 sm:p-8">
              <h2 className="font-display font-bold text-lg text-white uppercase mb-4">
                {ct.formHeading || 'SEND A MESSAGE'}
              </h2>
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Shakib Al Hasan"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Message / Inquiry
                  </label>
                  <textarea
                    rows={3}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Your question or order inquiry..."
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48] resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  SUBMIT INQUIRY
                </button>
                {contactSent && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5 mt-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {ct.formSuccess || 'Thank you. A High Street Society concierge will contact you shortly.'}
                  </p>
                )}
              </form>
            </div>
          </div>
        )}

        {/* 4. FAQ PAGE */}
        {pageType === 'faq' && (
          <div className="space-y-3">
            {settings.faqList.map((faq, idx) => (
              <div key={idx} className="border border-neutral-900 bg-neutral-950">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-4 flex items-center justify-between text-left font-display font-bold text-sm text-white uppercase hover:text-[#e11d48] transition-colors"
                >
                  <span>{faq.question}</span>
                  {openFaq === idx ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />}
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 pt-1 text-xs text-neutral-400 border-t border-neutral-900 font-sans leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 5. PRIVACY POLICY */}
        {pageType === 'privacy' && (
          <div className="bg-neutral-950 border border-neutral-900 p-6 sm:p-8 space-y-4 text-xs sm:text-sm font-sans leading-relaxed">
            <h2 className="font-display font-bold text-lg text-white uppercase flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#e11d48]" />
              PRIVACY POLICY
            </h2>
            <p className="whitespace-pre-line text-neutral-400 font-mono text-xs leading-relaxed">
              {settings.privacyPolicy}
            </p>
          </div>
        )}

        {/* 6. TERMS & CONDITIONS */}
        {pageType === 'terms' && (
          <div className="bg-neutral-950 border border-neutral-900 p-6 sm:p-8 space-y-4 text-xs sm:text-sm font-sans leading-relaxed">
            <h2 className="font-display font-bold text-lg text-white uppercase flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#e11d48]" />
              TERMS OF SERVICE
            </h2>
            <p className="whitespace-pre-line text-neutral-400 font-mono text-xs leading-relaxed">
              {settings.termsPolicy}
            </p>
          </div>
        )}

        {/* Return Button */}
        <div className="pt-8 text-center">
          <button
            onClick={() => onNavigate('shop')}
            className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-tech text-xs uppercase tracking-widest border border-neutral-800 transition-colors"
          >
            RETURN TO SHOP
          </button>
        </div>
      </div>
    </div>
  );
};
