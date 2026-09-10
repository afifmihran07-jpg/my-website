import React, { useState, useEffect, useMemo } from 'react';
import { DatabaseService } from '../services/dataService';
import { Product, PosterDimensionVariant, ProductReview } from '../types';
import { useCart } from '../context/CartContext';
import { SafeImage } from '../components/SafeImage';
import { HssStarIcon } from '../components/HssLogo';
import { ProductCard } from '../components/ProductCard';
import {
  ShoppingBag,
  Check,
  Truck,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  AlertCircle,
  Ruler,
  Share2,
  Heart,
  Copy,
  Star,
  MessageSquarePlus,
  CheckCircle2,
  X
} from 'lucide-react';
import { SizeGuideModal } from '../components/SizeGuideModal';

interface ProductDetailPageProps {
  slug: string;
  onNavigate: (route: string) => void;
  onSelectProduct: (slug: string) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  slug,
  onNavigate,
  onSelectProduct
}) => {
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Clothing Variants
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');

  // Poster Variants (Physical Dimensions)
  const [selectedPosterVariant, setSelectedPosterVariant] = useState<PosterDimensionVariant | undefined>(undefined);

  // Quantity
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Accordion state
  const [activeTab, setActiveTab] = useState<'details' | 'shipping' | 'returns'>('details');

  // Modals & Share State
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Reviews State
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newEmailOrPhone, setNewEmailOrPhone] = useState('');
  const [newComment, setNewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const settings = DatabaseService.getSettings();

  const loadProductReviews = (prodId: string) => {
    const list = DatabaseService.getReviews(prodId, false);
    setReviews(list);
  };

  const handleLoveReview = async (reviewId: string) => {
    await DatabaseService.toggleReviewLove(reviewId);
    if (product) {
      loadProductReviews(product.id);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setReviewError(null);
    setReviewSubmitting(true);

    const isEmail = newEmailOrPhone.includes('@');
    const res = await DatabaseService.submitReview({
      productId: product.id,
      productName: product.name,
      customerName: newCustomerName,
      customerEmail: isEmail ? newEmailOrPhone.trim() : undefined,
      customerPhone: !isEmail && newEmailOrPhone ? newEmailOrPhone.trim() : undefined,
      rating: newRating,
      comment: newComment
    });

    setReviewSubmitting(false);

    if (res.success && res.review) {
      setReviewFeedback(
        res.review.isVerifiedPurchase
          ? 'Thank you! Your verified purchase review is live.'
          : 'Thank you! Your review has been submitted to the Society.'
      );
      setNewComment('');
      loadProductReviews(product.id);
      setTimeout(() => {
        setReviewFeedback(null);
        setIsReviewModalOpen(false);
      }, 2000);
    } else {
      setReviewError(res.error || 'Failed to submit review');
    }
  };

  useEffect(() => {
    const p = DatabaseService.getProductBySlug(slug);
    setProduct(p);
    setSelectedImageIndex(0);
    setQuantity(1);
    setValidationError(null);
    setAddedSuccess(false);

    if (p) {
      if (p.category === 'clothing') {
        if (p.clothingSizes && p.clothingSizes.length > 0) {
          setSelectedSize(p.clothingSizes[0]);
        }
        if (p.clothingColors && p.clothingColors.length > 0) {
          setSelectedColor(p.clothingColors[0].name);
        }
      } else if (p.category === 'posters' && p.posterDimensions && p.posterDimensions.length > 0) {
        setSelectedPosterVariant(p.posterDimensions[0]);
      }
      const currentWishlist = DatabaseService.getWishlist();
      setIsWishlisted(currentWishlist.includes(p.id));

      loadProductReviews(p.id);
      const session = DatabaseService.getActiveSession();
      if (session) {
        setNewCustomerName(session.fullName);
        setNewEmailOrPhone(session.email || session.phone);
      }
    }
  }, [slug]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Number((sum / reviews.length).toFixed(1));
  }, [reviews]);

  // Current active price based on variant
  const currentPrice = useMemo(() => {
    if (!product) return 0;
    if (product.category === 'posters' && selectedPosterVariant) {
      return selectedPosterVariant.price;
    }
    return product.price;
  }, [product, selectedPosterVariant]);

  // Current stock based on category
  const availableStock = useMemo(() => {
    if (!product) return 0;
    if (product.category === 'posters' && selectedPosterVariant) {
      return selectedPosterVariant.stock;
    }
    return product.stock;
  }, [product, selectedPosterVariant]);

  const isOutOfStock = availableStock <= 0;

  // Recommendations
  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return DatabaseService.getProducts()
      .filter(p => p.id !== product.id && p.category === product.category)
      .slice(0, 4);
  }, [product]);

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0a]">
        <HssStarIcon className="w-10 h-10 text-neutral-700 mb-4 animate-spin" />
        <h2 className="font-display font-black text-2xl text-white uppercase">Product Not Found</h2>
        <p className="text-xs text-neutral-400 mt-2 mb-6">This archive release may have been retired or moved.</p>
        <button
          onClick={() => onNavigate('shop')}
          className="px-6 py-3 bg-[#e11d48] text-white font-tech font-bold text-xs uppercase tracking-widest hover:bg-[#be123c] transition-colors"
        >
          RETURN TO SHOP
        </button>
      </div>
    );
  }

  const handleAddToCart = () => {
    setValidationError(null);

    // Validate selections
    if (product.category === 'clothing') {
      if (product.clothingSizes && product.clothingSizes.length > 0 && !selectedSize) {
        setValidationError('Please select a clothing size before adding to bag');
        return;
      }
    } else if (product.category === 'posters') {
      if (!selectedPosterVariant) {
        setValidationError('Please select a poster dimension before adding to bag');
        return;
      }
    }

    if (availableStock <= 0) {
      setValidationError('This product is currently out of stock');
      return;
    }

    addToCart(
      {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        category: product.category,
        image: product.images[selectedImageIndex] || product.images[0] || '/images/hss-hero-campaign.jpg',
        price: currentPrice,
        selectedSize: product.category === 'clothing' ? selectedSize : undefined,
        selectedColor: product.category === 'clothing' ? selectedColor : undefined,
        selectedPosterSize: product.category === 'posters' ? selectedPosterVariant?.name : undefined,
        posterDimensions:
          product.category === 'posters' && selectedPosterVariant
            ? `${selectedPosterVariant.width} × ${selectedPosterVariant.height} ${selectedPosterVariant.unit}`
            : undefined,
        stockAvailable: availableStock
      },
      quantity
    );

    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <button
          onClick={() => onNavigate('shop')}
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          BACK TO ALL DROPS
        </button>

        {/* Main Product Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">
          {/* Left Column: Gallery (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Primary Featured Image */}
            <div className="relative bg-neutral-950 border border-neutral-800 overflow-hidden aspect-[3/4]">
              {product.isNewDrop && (
                <div className="absolute top-4 left-4 z-20">
                  <span className="bg-[#e11d48] text-white font-tech text-xs font-black px-3 py-1 tracking-widest uppercase">
                    NEW DROP
                  </span>
                </div>
              )}
              <SafeImage
                src={product.images[selectedImageIndex] || product.images[0]}
                alt={product.name}
                fallbackTitle={product.name}
                containerClassName="w-full h-full"
                aspectRatio="auto"
                className="w-full h-full object-cover transition-all duration-300"
              />
            </div>

            {/* Thumbnail Navigation */}
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative w-20 h-24 flex-shrink-0 bg-neutral-900 border transition-all overflow-hidden ${
                      selectedImageIndex === idx
                        ? 'border-[#e11d48] ring-1 ring-[#e11d48]'
                        : 'border-neutral-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <SafeImage
                      src={img}
                      alt={`${product.name} preview ${idx + 1}`}
                      containerClassName="w-full h-full"
                      aspectRatio="auto"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Product Buy Box & Variants (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <div>
              {/* Category & SKU */}
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500 uppercase tracking-widest pb-2 border-b border-neutral-900">
                <span>{product.category} ARCHIVE</span>
                <span>SKU: {product.sku}</span>
              </div>

              {/* Title & Tagline */}
              <div className="mt-4 space-y-2">
                <h1 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight leading-tight">
                  {product.name}
                </h1>
                <p className="text-xs sm:text-sm font-tech text-[#e11d48] font-semibold tracking-wide">
                  {product.tagline}
                </p>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= Math.round(averageRating)
                              ? 'fill-current text-amber-400'
                              : 'text-neutral-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-mono text-neutral-400">
                      {averageRating} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>
                )}
              </div>

              {/* Price & Stock */}
              <div className="mt-4 py-4 border-y border-neutral-900 flex items-baseline justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="font-tech font-extrabold text-2xl sm:text-3xl text-white">
                    ৳{currentPrice.toLocaleString()}
                  </span>
                  {product.compareAtPrice && product.compareAtPrice > currentPrice && (
                    <span className="font-tech text-base text-neutral-500 line-through">
                      ৳{product.compareAtPrice.toLocaleString()}
                    </span>
                  )}
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 ${
                      isOutOfStock
                        ? 'bg-neutral-900 text-neutral-500 border border-neutral-800'
                        : availableStock <= 5
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-900/60'
                        : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? 'bg-neutral-600' : availableStock <= 5 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    {isOutOfStock ? 'OUT OF STOCK' : availableStock <= 5 ? `ONLY ${availableStock} LEFT` : 'IN STOCK'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="mt-4 text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
                {product.description}
              </p>

              {/* 1. CLOTHING VARIANTS SELECTOR */}
              {product.category === 'clothing' && (
                <div className="mt-6 space-y-5">
                  {/* Color Selector */}
                  {product.clothingColors && product.clothingColors.length > 0 && (
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-widest text-neutral-400 mb-2">
                        COLOR: <span className="text-white font-bold">{selectedColor}</span>
                      </label>
                      <div className="flex items-center gap-3">
                        {product.clothingColors.map(col => (
                          <button
                            key={col.name}
                            type="button"
                            onClick={() => setSelectedColor(col.name)}
                            className={`group relative flex items-center gap-2 px-3 py-2 border transition-all ${
                              selectedColor === col.name
                                ? 'border-[#e11d48] bg-neutral-900 text-white'
                                : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-neutral-700 shadow-inner"
                              style={{ backgroundColor: col.hex }}
                            />
                            <span className="text-xs font-tech uppercase">{col.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Size Selector (S, M, L, XL, XXL) */}
                  {product.clothingSizes && product.clothingSizes.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-mono uppercase tracking-widest text-neutral-400">
                          CLOTHING SIZE: <span className="text-white font-bold">{selectedSize}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsSizeGuideOpen(true)}
                          className="text-[11px] font-mono text-[#e11d48] hover:underline flex items-center gap-1 font-bold"
                        >
                          <Ruler className="w-3.5 h-3.5" />
                          SIZE GUIDE
                        </button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {product.clothingSizes.map(sz => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setSelectedSize(sz)}
                            className={`py-3 text-xs font-tech font-bold uppercase tracking-wider transition-all border ${
                              selectedSize === sz
                                ? 'bg-white text-black border-white'
                                : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-600'
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. POSTER VARIANTS (PHYSICAL DIMENSIONS — WIDTH × HEIGHT IN) */}
              {product.category === 'posters' && product.posterDimensions && product.posterDimensions.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase tracking-widest text-neutral-400">
                      SELECT PHYSICAL DIMENSIONS:
                    </label>
                    <span className="text-[11px] font-mono text-[#e11d48]">
                      GALLERY ARCHIVAL 300 GSM
                    </span>
                  </div>

                  <div className="space-y-2">
                    {product.posterDimensions.map(dim => {
                      const isSelected = selectedPosterVariant?.id === dim.id;
                      return (
                        <button
                          key={dim.id}
                          type="button"
                          onClick={() => setSelectedPosterVariant(dim)}
                          className={`w-full p-3.5 flex items-center justify-between border transition-all text-left ${
                            isSelected
                              ? 'border-[#e11d48] bg-neutral-900/90 text-white shadow-md'
                              : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-[#e11d48] bg-[#e11d48]' : 'border-neutral-600'
                              }`}
                            >
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </span>
                            <div>
                              <span className="font-display font-black text-sm uppercase">
                                {dim.name}
                              </span>
                              <span className="font-mono text-xs text-neutral-400 ml-2">
                                ({dim.width} × {dim.height} {dim.unit})
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-tech font-bold text-sm text-white">
                              ৳{dim.price.toLocaleString()}
                            </span>
                            <span className="block text-[10px] font-mono text-neutral-500">
                              {dim.stock > 0 ? `${dim.stock} in stock` : 'Out of stock'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity Selector & Add To Bag */}
              <div className="mt-8 space-y-3">
                {validationError && (
                  <div className="p-3 bg-red-950/50 border border-red-900/80 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {/* Quantity input */}
                  <div className="flex items-center border border-neutral-800 bg-neutral-950 h-13 px-2">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1 || isOutOfStock}
                      className="px-2 text-neutral-400 hover:text-white transition-colors disabled:opacity-30"
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-mono font-bold text-sm text-white">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                      disabled={quantity >= availableStock || isOutOfStock}
                      className="px-2 text-neutral-400 hover:text-white transition-colors disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>

                  {/* Add to Bag Button */}
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    className={`flex-1 h-13 font-display font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                      isOutOfStock
                        ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                        : addedSuccess
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#e11d48] hover:bg-[#be123c] text-white shadow-xl shadow-red-950/40'
                    }`}
                  >
                    {addedSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        ADDED TO BAG
                      </>
                    ) : isOutOfStock ? (
                      'OUT OF STOCK'
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        ADD TO BAG • ৳{(currentPrice * quantity).toLocaleString()}
                      </>
                    )}
                  </button>

                  {/* Discreet Wishlist Button */}
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = await DatabaseService.toggleWishlist(product.id);
                      setIsWishlisted(updated.includes(product.id));
                    }}
                    className={`w-13 h-13 flex items-center justify-center border transition-colors ${
                      isWishlisted
                        ? 'bg-[#e11d48]/10 border-[#e11d48] text-[#e11d48]'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                    title={isWishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}
                  >
                    <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
                  </button>

                  {/* Discreet Share Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsShareOpen(!isShareOpen)}
                      className="w-13 h-13 flex items-center justify-center border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
                      title="Share Piece"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>

                    {/* Share Popover */}
                    {isShareOpen && (
                      <div className="absolute right-0 bottom-full mb-2 w-52 bg-[#0e0e11] border border-neutral-800 p-2 shadow-2xl z-30 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            setCopiedLink(true);
                            setTimeout(() => {
                              setCopiedLink(false);
                              setIsShareOpen(false);
                            }, 2000);
                          }}
                          className="w-full flex items-center gap-2 p-2 text-xs font-mono text-neutral-300 hover:bg-neutral-900 hover:text-white text-left"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#e11d48]" />
                          <span>{copiedLink ? 'COPIED LINK!' : 'COPY DIRECT LINK'}</span>
                        </button>
                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                            `Check out ${product.name} on High Street Society: ${window.location.href}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center gap-2 p-2 text-xs font-mono text-neutral-300 hover:bg-neutral-900 hover:text-white text-left"
                        >
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block" />
                          <span>WHATSAPP SHARE</span>
                        </a>
                        <a
                          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center gap-2 p-2 text-xs font-mono text-neutral-300 hover:bg-neutral-900 hover:text-white text-left"
                        >
                          <span className="w-3.5 h-3.5 rounded-full bg-blue-500 inline-block" />
                          <span>FACEBOOK SHARE</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery Assurance */}
              <div className="mt-6 pt-6 border-t border-neutral-900 grid grid-cols-2 gap-3 text-xs font-mono text-neutral-400">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#e11d48]" />
                  <span>Dhaka ৳{settings.deliveryInsideDhaka} (24-48h)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#e11d48]" />
                  <span>bKash / COD Secured</span>
                </div>
              </div>
            </div>

            {/* Accordion Tabs for Details, Shipping, Returns */}
            <div className="border-t border-neutral-900 pt-6 space-y-2">
              {/* Details Tab */}
              <div className="border border-neutral-900 bg-neutral-950/60">
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'details' ? ('' as any) : 'details')}
                  className="w-full p-4 flex items-center justify-between text-left font-display font-bold text-xs uppercase tracking-wider text-white"
                >
                  <span>SPECIFICATIONS & CRAFTSMANSHIP</span>
                  {activeTab === 'details' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {activeTab === 'details' && (
                  <div className="px-4 pb-4 pt-1 text-xs text-neutral-400 space-y-2 font-sans border-t border-neutral-900/60">
                    {product.fabric && (
                      <p>
                        <strong className="text-white">Fabrication:</strong> {product.fabric}
                      </p>
                    )}
                    <ul className="list-disc pl-4 space-y-1">
                      {product.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Shipping Tab */}
              <div className="border border-neutral-900 bg-neutral-950/60">
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'shipping' ? ('' as any) : 'shipping')}
                  className="w-full p-4 flex items-center justify-between text-left font-display font-bold text-xs uppercase tracking-wider text-white"
                >
                  <span>DELIVERY INFORMATION</span>
                  {activeTab === 'shipping' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {activeTab === 'shipping' && (
                  <div className="px-4 pb-4 pt-1 text-xs text-neutral-400 space-y-2 font-sans border-t border-neutral-900/60">
                    <p>
                      <strong>Inside Dhaka:</strong> Delivery charge is ৳{settings.deliveryInsideDhaka}. Dispatched within 24–48 hours via express courier.
                    </p>
                    <p>
                      <strong>Outside Dhaka:</strong> Delivery charge is ৳{settings.deliveryOutsideDhaka}. Dispatched within 48–72 hours across all districts in Bangladesh.
                    </p>
                  </div>
                )}
              </div>

              {/* Returns Tab */}
              <div className="border border-neutral-900 bg-neutral-950/60">
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'returns' ? ('' as any) : 'returns')}
                  className="w-full p-4 flex items-center justify-between text-left font-display font-bold text-xs uppercase tracking-wider text-white"
                >
                  <span>4-DAY EXCHANGE POLICY</span>
                  {activeTab === 'returns' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {activeTab === 'returns' && (
                  <div className="px-4 pb-4 pt-1 text-xs text-neutral-400 space-y-2 font-sans border-t border-neutral-900/60">
                    <p>
                      We accept size exchanges within 4 days of delivery. Items must be unworn, unwashed with original packaging. Contact our concierge at +8801879665602 or Instagram @highstreetsoociety.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CUSTOMER REVIEWS & REACTIONS */}
        <div className="mt-20 pt-12 border-t border-neutral-900 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-neutral-900">
            <div>
              <div className="flex items-center gap-2 text-[#e11d48] mb-1">
                <HssStarIcon className="w-4 h-4" />
                <span className="text-xs font-mono uppercase tracking-widest font-bold">
                  CLIENT PERSPECTIVE
                </span>
              </div>
              <h3 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                REVIEWS & LOVE ({reviews.length})
              </h3>
              {reviews.length > 0 && (
                <div className="flex items-center gap-3 mt-2 text-xs font-mono">
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= Math.round(averageRating)
                            ? 'fill-current text-amber-400'
                            : 'text-neutral-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-white font-bold">{averageRating} OUT OF 5.0</span>
                  <span className="text-neutral-500">•</span>
                  <span className="text-neutral-400">
                    {reviews.length} {reviews.length === 1 ? 'verified voice' : 'verified voices'}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="px-5 py-2.5 bg-neutral-900 hover:bg-[#e11d48] text-white border border-neutral-700 hover:border-[#e11d48] font-tech font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 self-start sm:self-auto"
            >
              <MessageSquarePlus className="w-4 h-4" />
              WRITE A REVIEW
            </button>
          </div>

          {/* Reviews Grid */}
          {reviews.length === 0 ? (
            <div className="p-8 text-center bg-neutral-950/40 border border-neutral-900 space-y-2">
              <p className="font-display font-bold text-sm uppercase text-white">No reviews yet for this piece</p>
              <p className="text-xs font-mono text-neutral-400">
                Be the first in the Society to share your experience with the cut, fabric, or dimensions.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  className="px-4 py-2 bg-neutral-800 text-xs font-tech font-bold uppercase text-white hover:bg-[#e11d48] transition-colors"
                >
                  BE THE FIRST TO REVIEW
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {reviews.map((rev) => {
                const lovedByMe = DatabaseService.isReviewLovedByMe(rev.id);
                return (
                  <div
                    key={rev.id}
                    className="p-5 sm:p-6 bg-neutral-950 border border-neutral-900/90 flex flex-col justify-between space-y-4 hover:border-neutral-800 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= rev.rating ? 'fill-current text-amber-400' : 'text-neutral-700'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                    </div>

                    <div className="pt-3 border-t border-neutral-900/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-xs uppercase text-white">
                          — {rev.customerName}
                        </span>
                        {rev.isVerifiedPurchase && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 border border-emerald-900/60">
                            <CheckCircle2 className="w-3 h-3" /> VERIFIED PURCHASE
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLoveReview(rev.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-xs font-mono transition-colors ${
                          lovedByMe
                            ? 'bg-[#e11d48]/15 border-[#e11d48] text-[#e11d48] font-bold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                        }`}
                        title={lovedByMe ? 'You loved this review' : 'Love this review'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${lovedByMe ? 'fill-current' : ''}`} />
                        <span>{rev.loveCount || 0}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* You May Also Like */}
        {relatedProducts.length > 0 && (
          <div className="mt-24 pt-12 border-t border-neutral-900">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-xs font-mono uppercase text-[#e11d48] tracking-widest font-bold">
                  CURATED RECOMMENDATIONS
                </span>
                <h3 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight mt-1">
                  YOU MAY ALSO LIKE
                </h3>
              </div>
              <button
                onClick={() => onNavigate('shop')}
                className="text-xs font-mono uppercase text-neutral-400 hover:text-white"
              >
                VIEW ARCHIVE →
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map(rel => (
                <ProductCard
                  key={rel.id}
                  product={rel}
                  onClick={onSelectProduct}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* WRITE A REVIEW MODAL */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 p-6 sm:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
              <div className="flex items-center gap-2 text-white">
                <HssStarIcon className="w-4 h-4 text-[#e11d48]" />
                <h3 className="font-display font-black text-base uppercase">
                  WRITE A REVIEW • {product.name}
                </h3>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-neutral-500 hover:text-white font-mono p-1"
                aria-label="Close review modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewFeedback && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{reviewFeedback}</span>
              </div>
            )}

            {reviewError && (
              <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{reviewError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-neutral-400 mb-1.5 uppercase font-bold">
                  YOUR RATING: {newRating} OF 5 STARS
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1 text-neutral-600 hover:text-amber-400 transition-colors"
                      aria-label={`${star} star rating`}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= newRating ? 'fill-current text-amber-400' : 'text-neutral-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 uppercase font-bold">
                  YOUR NAME *
                </label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="e.g. Tanvir Ahmed"
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 uppercase font-bold">
                  PHONE OR EMAIL (FOR VERIFIED PURCHASE MATCH)
                </label>
                <input
                  type="text"
                  value={newEmailOrPhone}
                  onChange={(e) => setNewEmailOrPhone(e.target.value)}
                  placeholder="Used to check your past order for a Verified Purchase badge"
                  className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 uppercase font-bold">
                  WRITTEN REVIEW *
                </label>
                <textarea
                  rows={4}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Describe the fabric weight, GSM feel, fit accuracy, print quality, or packaging..."
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48] resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2.5 bg-neutral-900 text-neutral-400 hover:text-white"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="px-6 py-2.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-tech font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  SUBMIT REVIEW
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Size Guide Modal */}
      <SizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
      />
    </div>
  );
};
