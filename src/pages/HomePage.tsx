import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Truck,
  RefreshCw,
  Star,
  Heart,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { DatabaseService } from '../services/dataService';
import { ProductCard } from '../components/ProductCard';
import { HssStarIcon, HssLogo } from '../components/HssLogo';
import { SafeImage } from '../components/SafeImage';
import { ProductReview, SiteContent } from '../types';

interface HomePageProps {
  onNavigate: (route: string) => void;
  onSelectProduct: (slug: string) => void;
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

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onSelectProduct }) => {
  const settings = DatabaseService.getSettings();
  const [content, setContent] = useState<SiteContent>(() => DatabaseService.getSiteContent(false));
  const products = useMemo(() => DatabaseService.getProducts(), []);

  useEffect(() => {
    setContent(DatabaseService.getSiteContent(false));
  }, []);

  // Filter products for sections
  const newDropProducts = useMemo(() => {
    return products.filter(p => p.isNewDrop).slice(0, 8);
  }, [products]);

  const featuredProducts = useMemo(() => {
    return products.filter(p => p.isFeatured).slice(0, 4);
  }, [products]);

  // Featured reviews for Homepage carousel
  const [featuredReviews, setFeaturedReviews] = useState<ProductReview[]>(() => {
    return DatabaseService.getHomepageFeaturedReviews();
  });
  const [activeReviewIdx, setActiveReviewIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setFeaturedReviews(DatabaseService.getHomepageFeaturedReviews());
  }, []);

  useEffect(() => {
    if (featuredReviews.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setActiveReviewIdx((prev) => (prev + 1) % featuredReviews.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [featuredReviews.length, isPaused]);

  const handleLoveReview = (reviewId: string) => {
    DatabaseService.toggleReviewLove(reviewId);
    setFeaturedReviews(DatabaseService.getHomepageFeaturedReviews());
  };

  const instagramTargetUrl =
    settings.instagramUrl || 'https://www.instagram.com/highstreetsoociety?stkn=bGt3MmE3MTZ2ZzB1';

  const hp = content.homepage;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      {/* 1. REFINED EDITORIAL HERO — MANAGED VIA CMS */}
      {hp.showHero !== false && (
        <section className="relative overflow-hidden border-b border-neutral-900 bg-neutral-950">
          <div className="relative min-h-[500px] sm:min-h-[580px] lg:min-h-[640px] flex items-center">
            {/* Hero Background Image — Crisp & Visible with Sophisticated Overlay */}
            <div className="absolute inset-0 z-0">
              <SafeImage
                src={hp.heroImage || settings.heroImage || '/images/hss-hero-campaign.jpg'}
                alt="High Street Society Campaign"
                containerClassName="w-full h-full"
                aspectRatio="auto"
                className="w-full h-full object-cover object-center opacity-65 brightness-90 transition-transform duration-1000 ease-out"
              />
              {/* Sophisticated Vignette Gradient (Editorial Fashion Atmosphere) */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/25 z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-black/40 z-10" />
            </div>

            {/* Hero Content with Generous Whitespace */}
            <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 w-full">
              <div className="max-w-xl lg:max-w-2xl space-y-7">
                {/* Understated Brand Badge Detail */}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/60 border border-neutral-800 text-neutral-300 backdrop-blur-md">
                  <HssStarIcon className="w-3.5 h-3.5 text-[#e11d48]" />
                  <span className="font-mono text-[11px] tracking-[0.25em] uppercase font-semibold text-neutral-300">
                    {hp.heroEyebrow || 'HSS · EST. 2025 · DHAKA ARCHIVE'}
                  </span>
                </div>

                {/* Refined Headline with Breathing Room */}
                <div className="space-y-3">
                  <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl uppercase tracking-tight text-white leading-[1.05]">
                    {hp.heroTitle || 'HIGH STREET SOCIETY'}
                  </h1>
                  <p className="font-tech text-xs sm:text-sm tracking-[0.2em] uppercase text-[#e11d48] font-bold">
                    {hp.heroSubtitle || settings.heroSubtitle || 'CONTEMPORARY STREETWEAR & EDITORIAL ART • NEW SEASON 2026'}
                  </p>
                </div>

                {/* Tagline Description */}
                <p className="text-xs sm:text-sm text-neutral-300 font-sans max-w-lg leading-relaxed">
                  {hp.heroDescription ||
                    'Engineered heavyweight 450 GSM French Terry hoodies and museum-grade physical dimension graphic posters. Designed for those who wear their world.'}
                </p>

                {/* Balanced CTAs */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={() => onNavigate(hp.heroCtaLink || 'shop')}
                    className="px-8 py-4 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center gap-2 shadow-xl shadow-red-950/40"
                  >
                    {hp.heroCtaText || 'SHOP THE DROP'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNavigate(hp.heroSecondaryCtaLink || 'posters')}
                    className="px-6 py-4 bg-transparent border border-neutral-700/80 hover:border-white text-neutral-300 hover:text-white font-display font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
                  >
                    {hp.heroSecondaryCtaText || 'EXPLORE POSTERS'}
                    <ArrowUpRight className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. NEW DROPS — EDITORIAL PRESENTATION (PURE CARD PRESENTATION) */}
      {hp.showNewDrops !== false && (
        <section className="py-20 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 pb-4 border-b border-neutral-900 gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#e11d48] mb-1">
                <HssStarIcon className="w-4 h-4" />
                <span className="text-[11px] font-mono tracking-widest uppercase font-bold">
                  {hp.newDropsEyebrow || 'LATEST RELEASES'}
                </span>
              </div>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
                {hp.newDropsTitle || 'NEW DROPS'}
              </h2>
              {hp.newDropsDescription && (
                <p className="text-xs text-neutral-400 font-sans mt-1">
                  {hp.newDropsDescription}
                </p>
              )}
            </div>
            <button
              onClick={() => onNavigate('new-drops')}
              className="group flex items-center gap-2 text-xs font-display font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
            >
              VIEW ALL DROPS ({newDropProducts.length})
              <ArrowRight className="w-4 h-4 text-[#e11d48] group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Product Grid with Generous Whitespace & Clean Product Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {newDropProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={onSelectProduct}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. SHOP BY CATEGORY: CLOTHING & POSTERS */}
      {hp.showCategories !== false && (
        <section className="border-t border-b border-neutral-900 bg-neutral-950/60 py-20 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#e11d48] font-bold">
                {hp.categoriesEyebrow || 'DEPARTMENTS'}
              </span>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
                {hp.categoriesTitle || 'EXPLORE ARCHIVES'}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Category 1: CLOTHING */}
              <div
                onClick={() => onNavigate('clothing')}
                className="group relative cursor-pointer overflow-hidden border border-neutral-900 hover:border-neutral-700 bg-black aspect-[16/10] sm:aspect-[16/9] flex items-end p-8 transition-all"
              >
                <div className="absolute inset-0">
                  <SafeImage
                    src="https://images.pexels.com/photos/15127546/pexels-photo-15127546.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800"
                    alt="HSS Clothing Collection"
                    containerClassName="w-full h-full"
                    aspectRatio="auto"
                    className="object-cover w-full h-full opacity-60 group-hover:scale-105 group-hover:opacity-75 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                </div>

                <div className="relative z-10 w-full flex items-end justify-between">
                  <div>
                    <span className="font-tech text-xs tracking-widest uppercase font-bold text-[#e11d48]">
                      01 • APPAREL
                    </span>
                    <h3 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
                      CLOTHING
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                      420–450 GSM Heavyweight Hoodies, Graphic Tees & Drop Shoulder Boxy Cuts.
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 group-hover:bg-[#e11d48] text-white flex items-center justify-center transition-colors">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Category 2: POSTERS */}
              <div
                onClick={() => onNavigate('posters')}
                className="group relative cursor-pointer overflow-hidden border border-neutral-900 hover:border-neutral-700 bg-black aspect-[16/10] sm:aspect-[16/9] flex items-end p-8 transition-all"
              >
                <div className="absolute inset-0">
                  <SafeImage
                    src="/images/hss-luxury-poster.jpg"
                    alt="HSS Poster Collection"
                    containerClassName="w-full h-full"
                    aspectRatio="auto"
                    className="object-cover w-full h-full opacity-60 group-hover:scale-105 group-hover:opacity-75 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                </div>

                <div className="relative z-10 w-full flex items-end justify-between">
                  <div>
                    <span className="font-tech text-xs tracking-widest uppercase font-bold text-[#e11d48]">
                      02 • PRINTS
                    </span>
                    <h3 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
                      POSTERS
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                      Archival 300 GSM Prints in Physical Dimensions: A4, A3, A2, and A1 (Inches).
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 group-hover:bg-[#e11d48] text-white flex items-center justify-center transition-colors">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. EDITORIAL CAMPAIGN SECTION ("LUXURY" LOOKBOOK) */}
      {hp.showEditorial !== false && (
        <section className="py-20 sm:py-28 border-b border-neutral-900 bg-black relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Visual Lookbook Image */}
              <div className="lg:col-span-7 relative">
                <div className="relative border border-neutral-800 bg-neutral-950 overflow-hidden shadow-2xl">
                  <SafeImage
                    src="/images/hss-luxury-poster.jpg"
                    alt="High Street Society Luxury Lookbook"
                    containerClassName="w-full aspect-[4/3] sm:aspect-[16/10]"
                    aspectRatio="auto"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md p-4 border border-neutral-800 flex items-center justify-between">
                    <div>
                      <p className="font-display font-extrabold text-sm text-white uppercase">
                        LUXURY STREETWEAR INITIATIVE
                      </p>
                      <p className="font-mono text-xs text-neutral-400">
                        {hp.editorialBadge || 'Photographed in Dhaka Studio · EST. 2025'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#e11d48] animate-ping" />
                      <span className="text-xs font-mono uppercase text-white font-bold">LIMITED</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Campaign Text / Manifesto */}
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 text-[#e11d48]">
                  <HssStarIcon className="w-4 h-4" />
                  <span className="font-mono text-[11px] tracking-widest uppercase font-extrabold">
                    {hp.editorialEyebrow || 'EDITORIAL STATEMENT'}
                  </span>
                </div>
                <h2 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight leading-tight">
                  {hp.editorialTitle || 'CONTEMPORARY ATTITUDE.'} <br />
                  <span className="text-[#e11d48]">{hp.editorialHighlight || 'UNCOMPROMISING FORM.'}</span>
                </h2>
                <p className="text-sm text-neutral-300 leading-relaxed font-sans">
                  {hp.editorialText ||
                    'High Street Society is forged at the intersection of brutalist Japanese typography, underground Dhaka skate and youth culture, and tailored heavyweight textiles. We do not mass-produce; every drop is curated, numbered, and cut with intention.'}
                </p>
                <div className="pt-2 flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => onNavigate(hp.editorialCtaLink || 'shop')}
                    className="px-6 py-3.5 bg-white hover:bg-[#e11d48] text-black hover:text-white font-display font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    {hp.editorialCtaText || 'EXPLORE DROP'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNavigate('about')}
                    className="px-6 py-3.5 border border-neutral-800 hover:border-neutral-500 text-neutral-300 font-display font-semibold text-xs uppercase tracking-widest transition-colors"
                  >
                    READ OUR STORY
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. FEATURED PRODUCTS SECTION */}
      {hp.showFeatured !== false && featuredProducts.length > 0 && (
        <section className="py-20 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex items-end justify-between mb-10 pb-4 border-b border-neutral-900">
            <div>
              <span className="text-[11px] font-mono tracking-widest uppercase font-bold text-[#e11d48]">
                {hp.featuredEyebrow || 'CURATED SELECTION'}
              </span>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight mt-1">
                {hp.featuredTitle || 'FEATURED PIECES'}
              </h2>
              {hp.featuredDescription && (
                <p className="text-xs text-neutral-400 font-sans mt-1">
                  {hp.featuredDescription}
                </p>
              )}
            </div>
            <button
              onClick={() => onNavigate('shop')}
              className="text-xs font-display font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
            >
              SHOP CATALOG →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {featuredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={onSelectProduct}
              />
            ))}
          </div>
        </section>
      )}

      {/* 5B. FEATURED CLIENT REVIEWS / CAROUSEL (ADMIN-CURATED) */}
      {hp.showReviews !== false && featuredReviews.length > 0 && (
        <section
          className="border-t border-neutral-900 bg-neutral-950/80 py-20 sm:py-24 relative overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 text-[#e11d48]">
              <HssStarIcon className="w-4 h-4" />
              <span className="font-mono text-xs tracking-widest uppercase font-bold">
                {hp.reviewsEyebrow || 'WHAT PEOPLE ARE SAYING'}
              </span>
            </div>

            <h2 className="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight">
              {hp.reviewsTitle || 'CLIENT VOICES'}
            </h2>

            {/* Review Container */}
            <div className="pt-2">
              {(() => {
                const currentReview = featuredReviews[activeReviewIdx] || featuredReviews[0];
                const lovedByMe = DatabaseService.isReviewLovedByMe(currentReview.id);

                return (
                  <div className="p-6 sm:p-10 bg-black/60 border border-neutral-800/80 shadow-2xl space-y-5 transition-all duration-500">
                    {/* Stars */}
                    <div className="flex items-center justify-center gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= currentReview.rating ? 'fill-current text-amber-400' : 'text-neutral-700'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Review Text */}
                    <p className="font-sans text-base sm:text-xl text-neutral-200 font-medium leading-relaxed italic max-w-2xl mx-auto">
                      &ldquo;{currentReview.comment}&rdquo;
                    </p>

                    {/* Meta info & Product link */}
                    <div className="pt-4 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <span className="font-display font-extrabold text-sm text-white uppercase tracking-wider">
                          — {currentReview.customerName}
                        </span>
                        {currentReview.isVerifiedPurchase && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-emerald-400 bg-emerald-950/40 px-2 py-0.5 border border-emerald-900/60">
                            <CheckCircle2 className="w-3 h-3" /> VERIFIED PURCHASE
                          </span>
                        )}
                      </div>

                      {/* Love Reaction Button */}
                      <button
                        type="button"
                        onClick={() => handleLoveReview(currentReview.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-mono transition-colors ${
                          lovedByMe
                            ? 'bg-[#e11d48]/15 border-[#e11d48] text-[#e11d48] font-bold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                        }`}
                        title={lovedByMe ? 'You loved this review' : 'Love this review'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${lovedByMe ? 'fill-current' : ''}`} />
                        <span>♡ {currentReview.loveCount || 0}</span>
                      </button>
                    </div>

                    {/* Piece link */}
                    <div className="pt-1 text-center">
                      <span
                        onClick={() => onSelectProduct(currentReview.productId)}
                        className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 uppercase cursor-pointer tracking-wider"
                      >
                        PIECE: {currentReview.productName} →
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Carousel Controls (If 2+ reviews) */}
            {featuredReviews.length > 1 && (
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  onClick={() =>
                    setActiveReviewIdx(
                      (prev) => (prev - 1 + featuredReviews.length) % featuredReviews.length
                    )
                  }
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 transition-colors"
                  aria-label="Previous review"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5">
                  {featuredReviews.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveReviewIdx(i)}
                      className={`h-1.5 transition-all rounded-full ${
                        activeReviewIdx === i ? 'w-6 bg-[#e11d48]' : 'w-2 bg-neutral-800 hover:bg-neutral-600'
                      }`}
                      aria-label={`Go to review ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() =>
                    setActiveReviewIdx((prev) => (prev + 1) % featuredReviews.length)
                  }
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 transition-colors"
                  aria-label="Next review"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. SOCIETY ASSURANCE PILLARS */}
      {hp.showAssurance !== false && (
        <section className="border-t border-b border-neutral-900 bg-[#0e0e11] py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex items-start gap-4 p-5 border border-neutral-800/60 bg-black/40">
                <div className="p-3 bg-neutral-900 border border-neutral-800 text-[#e11d48]">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-display font-extrabold text-sm uppercase text-white tracking-wide">
                    {hp.assurancePillar1Title || 'NATIONWIDE DELIVERY'}
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 font-sans">
                    {hp.assurancePillar1Text || 'Express courier dispatch across all 64 districts in Bangladesh with protective packaging.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-5 border border-neutral-800/60 bg-black/40">
                <div className="p-3 bg-neutral-900 border border-neutral-800 text-[#e11d48]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-display font-extrabold text-sm uppercase text-white tracking-wide">
                    {hp.assurancePillar2Title || 'BKASH & COD SECURED'}
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 font-sans">
                    {hp.assurancePillar2Text || 'bKash Send Money manual reconciliation or Cash on Delivery upon receiving your package.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-5 border border-neutral-800/60 bg-black/40">
                <div className="p-3 bg-neutral-900 border border-neutral-800 text-[#e11d48]">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-display font-extrabold text-sm uppercase text-white tracking-wide">
                    {hp.assurancePillar3Title || '4-DAY SIZE EXCHANGE'}
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 font-sans">
                    {hp.assurancePillar3Text || 'Simple exchanges on unworn clothing. Reach us on WhatsApp or Instagram for quick support.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 7. INSTAGRAM SECTION — CLEAN EXTERNAL LINK */}
      {hp.showInstagram !== false && (
        <section className="py-20 sm:py-24 bg-neutral-950 border-b border-neutral-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-xl mx-auto space-y-4">
              <div className="inline-flex items-center justify-center">
                <HssLogo variant="emblem" size="md" />
              </div>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
                {hp.instagramTitle || 'FOLLOW THE MOVEMENT'}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 font-sans">
                {hp.instagramText || 'Real drops, campaign lookbooks, and Dhaka streetwear culture on our official Instagram channel.'}
              </p>
              <div className="pt-2">
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
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-neutral-900 hover:bg-[#e11d48] border border-neutral-700 hover:border-[#e11d48] text-white font-tech font-bold text-xs uppercase tracking-widest transition-all"
                >
                  <InstagramIcon className="w-4 h-4 text-[#e11d48] group-hover:text-white" />
                  <span>{hp.instagramCtaText || 'FOLLOW @highstreetsoociety'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
