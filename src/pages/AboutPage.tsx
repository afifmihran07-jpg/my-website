import React, { useState, useEffect } from 'react';
import { HssStarIcon, HssLogo } from '../components/HssLogo';
import { ArrowRight } from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { DatabaseService } from '../services/dataService';
import { SiteContent } from '../types';

interface AboutPageProps {
  onNavigate: (route: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  const [content, setContent] = useState<SiteContent>(() => DatabaseService.getSiteContent(false));

  useEffect(() => {
    setContent(DatabaseService.getSiteContent(false));
  }, []);

  const ab = content.about;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-300 py-16 sm:py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 sm:space-y-24">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 text-[#e11d48]">
            <HssStarIcon className="w-5 h-5" />
            <span className="font-mono text-xs tracking-widest uppercase font-bold">
              {ab.heroEyebrow || 'THE SOCIETY MANIFESTO'}
            </span>
          </div>
          <h1 className="font-display font-black text-4xl sm:text-6xl text-white uppercase tracking-tight">
            {ab.heroTitle || 'WEAR YOUR WORLD.'}
          </h1>
          <p className="font-tech text-xs sm:text-sm tracking-widest text-neutral-400 max-w-xl mx-auto uppercase">
            {ab.heroSubtitle || 'CONTEMPORARY STREETWEAR & ARCHIVAL ART PRINTS FROM DHAKA, BANGLADESH.'}
          </p>
        </div>

        {/* Hero Visual */}
        <div className="relative border border-neutral-800 bg-neutral-950 overflow-hidden aspect-[16/9]">
          <SafeImage
            src={ab.heroImage || '/images/hss-hero-campaign.jpg'}
            alt="High Street Society Collective"
            containerClassName="w-full h-full"
            aspectRatio="auto"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
            <span className="font-mono text-xs text-white/80 bg-black/60 px-3 py-1 border border-neutral-700">
              DHAKA ARCHIVE · EST. 2025
            </span>
            <HssLogo variant="emblem" size="md" />
          </div>
        </div>

        {/* Philosophy Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 pt-4">
          <div className="space-y-4">
            <h2 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
              {ab.genesisHeading || '01 • THE GENESIS'}
            </h2>
            <p className="text-sm leading-relaxed font-sans text-neutral-300">
              {ab.genesisPara1 ||
                'High Street Society (HSS) emerged in the vibrant streets of Dhaka to challenge the monotony of fast-fashion and generic merchandise. We set out to design clothing and physical artwork with unmistakable gravity—garments that feel substantial, confident, and rooted in contemporary urban expression.'}
            </p>
            <p className="text-sm leading-relaxed font-sans text-neutral-400">
              {ab.genesisPara2 ||
                'Every drop is conceived as a limited capsule release. We meticulously control our textiles, specializing in 420–450 GSM combed cotton French Terry with custom vintage washes and boxy architectural cuts.'}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
              {ab.dualMediumHeading || '02 • THE DUAL MEDIUM'}
            </h2>
            <p className="text-sm leading-relaxed font-sans text-neutral-300">
              {ab.dualMediumPara1 ||
                'We believe great graphic design belongs both on the body and on your walls. Alongside our apparel, High Street Society curates archival museum-grade art posters, produced with giclée pigment printing in precise physical dimensions (A4, A3, A2, and A1).'}
            </p>
            <p className="text-sm leading-relaxed font-sans text-neutral-400">
              {ab.dualMediumPara2 ||
                'Whether you are wearing our heavyweight hoodies on the city pavement or hanging our typography posters in your space, you are part of the Society.'}
            </p>
          </div>
        </div>

        {/* Brand Star Feature */}
        <div className="p-8 sm:p-12 border border-neutral-900 bg-neutral-950 text-center space-y-6">
          <HssStarIcon className="w-12 h-12 text-[#e11d48] mx-auto" />
          <h3 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            {ab.starHeading || 'THE SIGNATURE STAR'}
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-lg mx-auto font-sans leading-relaxed">
            {ab.starText ||
              'Our four-pointed halftone star represents the intersection of four creative pillars: brutalist typography, streetwear craftsmanship, subcultural dialogue, and unapologetic self-expression.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('shop')}
              className="px-8 py-3.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-bold text-xs uppercase tracking-widest transition-colors inline-flex items-center gap-2"
            >
              {ab.starCtaText || 'EXPLORE THE CURRENT DROP'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
