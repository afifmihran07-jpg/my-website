export type ProductCategory = string;

export type CategoryVariantType = 'clothing' | 'posters' | 'standard';

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  variantType: CategoryVariantType;
  isActive: boolean;
  sortOrder?: number;
  createdAt: string;
}

export interface ClothingColor {
  name: string;
  hex: string;
}

export interface PosterDimensionVariant {
  id: string;
  name: string; // e.g., 'A4', 'A3', 'A2', 'A1', 'Custom'
  width: number;
  height: number;
  unit: 'IN';
  price: number;
  stock: number;
  sku?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  details: string[];
  fabric?: string;
  price: number; // Base price (for clothing, or minimum poster price)
  compareAtPrice?: number;
  category: ProductCategory;
  sku: string;
  stock: number; // Overall or base stock
  isNewDrop: boolean;
  isFeatured: boolean;
  isPublished?: boolean;
  images: string[];
  // Category specific variants
  clothingSizes?: string[]; // e.g. ['S', 'M', 'L', 'XL', 'XXL']
  clothingColors?: ClothingColor[];
  posterDimensions?: PosterDimensionVariant[]; // e.g. A3: 11.7 × 16.5 IN (৳650), A2: 16.5 × 23.4 IN (৳850)
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string; // Unique variant key e.g. prod1-M-Black or prod2-A2
  productId: string;
  name: string;
  slug: string;
  category: ProductCategory;
  image: string;
  price: number;
  quantity: number;
  selectedSize?: string; // S, M, L, XL for clothing
  selectedColor?: string; // Name of selected color
  selectedPosterSize?: string; // e.g. 'A2'
  posterDimensions?: string; // e.g. '16.5 × 23.4 IN'
  stockAvailable: number;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded';

export type PaymentMethod = 'cod' | 'bkash' | 'nagad';
export type PaymentStatus = 'pending_verification' | 'pending' | 'paid' | 'rejected' | 'refunded';
export type DeliveryLocation = 'inside_dhaka' | 'outside_dhaka';

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  category: ProductCategory;
  image: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  selectedPosterSize?: string;
  posterDimensions?: string;
  sku?: string;
  lineTotal: number;
}

export interface OrderNotificationLog {
  id: string;
  type: 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  channel: 'sms' | 'email';
  message: string;
  timestamp: string;
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string; // e.g. HSS-2026-9281
  customerId?: string;
  customerName: string;
  email?: string;
  phone: string;
  district?: string;
  address: string;
  area?: string;
  deliveryLocation: DeliveryLocation;
  deliveryCharge: number;
  subtotal: number;
  discount: number;
  couponCode?: string;
  couponId?: string;
  couponDiscountType?: 'percentage' | 'fixed';
  couponDiscountValue?: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReferenceId?: string; // Official bKash TRX ID
  bKashPaymentId?: string;
  orderStatus: OrderStatus;
  items: OrderItemSnapshot[];
  notes?: string;
  // Shipping Courier Tracking
  courierName?: string;
  courierTrackingNumber?: string;
  courierTrackingUrl?: string;
  // Manual Payment Verification Audit
  verificationAdmin?: string;
  verificationTimestamp?: string;
  verificationNote?: string;
  isDuplicateTrx?: boolean;
  duplicateWithOrderId?: string;
  statusHistory?: OrderStatusHistoryItem[];
  notificationLog?: OrderNotificationLog[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminNotification {
  id: string;
  orderId: string;
  customerName: string;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  amount: number;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string; // e.g. HSS10, DROP2026
  type: 'percentage' | 'fixed';
  value: number; // e.g. 10 (%) or 200 (BDT)
  minOrderValue?: number;
  maxDiscount?: number;
  startDate?: string;
  endDate?: string;
  usageLimit?: number;
  usedCount: number;
  firstOrderOnly?: boolean;
  categorySpecific?: ProductCategory;
  isActive: boolean;
  createdAt: string;
}

export interface SavedAddress {
  id: string;
  label: string; // e.g. Home, Studio, Office
  fullName: string;
  phone: string;
  district: string;
  area: string;
  address: string;
  deliveryLocation: DeliveryLocation;
  isDefault: boolean;
}

export interface CustomerUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  savedAddresses: SavedAddress[];
  wishlist: string[]; // Product IDs
  createdAt: string;
  updatedAt: string;
}

export interface AbandonedCart {
  id: string;
  sessionId: string;
  customerEmail?: string;
  customerPhone?: string;
  items: CartItem[];
  subtotal: number;
  updatedAt: string;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ProductReview {
  id: string;
  productId: string;
  productName: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  rating: number; // 1 to 5
  comment: string;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  loveCount: number;
  featuredOnHomepage: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SiteContent {
  homepage: {
    announcementText: string;
    showAnnouncement: boolean;
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    heroDescription: string;
    heroCtaText: string;
    heroCtaLink: string;
    heroSecondaryCtaText: string;
    heroSecondaryCtaLink: string;
    heroImage: string;
    showHero: boolean;
    newDropsEyebrow: string;
    newDropsTitle: string;
    newDropsDescription: string;
    showNewDrops: boolean;
    categoriesEyebrow: string;
    categoriesTitle: string;
    showCategories: boolean;
    editorialEyebrow: string;
    editorialTitle: string;
    editorialHighlight: string;
    editorialText: string;
    editorialBadge: string;
    editorialCtaText: string;
    editorialCtaLink: string;
    showEditorial: boolean;
    featuredEyebrow: string;
    featuredTitle: string;
    featuredDescription: string;
    showFeatured: boolean;
    reviewsEyebrow: string;
    reviewsTitle: string;
    showReviews: boolean;
    showAssurance: boolean;
    assurancePillar1Title: string;
    assurancePillar1Text: string;
    assurancePillar2Title: string;
    assurancePillar2Text: string;
    assurancePillar3Title: string;
    assurancePillar3Text: string;
    instagramTitle: string;
    instagramText: string;
    instagramCtaText: string;
    showInstagram: boolean;
    newsletterEyebrow: string;
    newsletterTitle: string;
    newsletterText: string;
    newsletterCtaText: string;
    showNewsletter: boolean;
  };
  navigation: {
    menuHome: string;
    menuShop: string;
    menuNewDrops: string;
    menuCategories: string;
    menuAbout: string;
  };
  footer: {
    brandName: string;
    estText: string;
    brandDescription: string;
    shopHeading: string;
    helpHeading: string;
    accountHeading: string;
    copyrightText: string;
  };
  about: {
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    heroImage: string;
    genesisHeading: string;
    genesisPara1: string;
    genesisPara2: string;
    dualMediumHeading: string;
    dualMediumPara1: string;
    dualMediumPara2: string;
    starHeading: string;
    starText: string;
    starCtaText: string;
  };
  sizeGuide: {
    title: string;
    badge: string;
    instructions: string;
    fitNote: string;
    careNote: string;
  };
  contact: {
    title: string;
    subtitle: string;
    phonePrimary: string;
    phoneSecondary: string;
    email: string;
    location: string;
    formHeading: string;
    formSuccess: string;
  };
  checkout: {
    title: string;
    contactSectionTitle: string;
    deliverySectionTitle: string;
    paymentSectionTitle: string;
    summaryTitle: string;
    manualVerificationNotice: string;
    bkashInstructions: string;
    nagadInstructions: string;
    codInstructions: string;
    orderConfirmedTitle: string;
    orderConfirmedSubtitle: string;
    nextStepsMessage: string;
  };
  emptyStates: {
    emptyBagTitle: string;
    emptyBagSubtitle: string;
    emptyBagCta: string;
    noProductsTitle: string;
    noProductsSubtitle: string;
    searchEmptyTitle: string;
    searchEmptySubtitle: string;
  };
}

export interface BusinessSettings {
  businessName: string;
  businessPhones: string[];
  businessEmail: string;
  address: string;
  instagramUrl: string;
  instagramHandle: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  deliveryInsideDhaka: number; // default: 80
  deliveryOutsideDhaka: number; // default: 120
  freeDeliveryThreshold?: number;
  // Payment Methods Configuration & Manual Verification Numbers
  enableBkash: boolean;
  enableNagad: boolean;
  enableCod: boolean;
  bKashMerchantNumber: string; // default: 0187966502
  bKashAccountType: 'Merchant' | 'Personal';
  bKashAppKey: string;
  bKashAppSecret: string;
  bKashUsername: string;
  bKashLiveMode: boolean;
  nagadMerchantNumber: string;
  nagadAccountType: 'Merchant' | 'Personal';
  // SMS Notification Provider
  smsGatewayProvider: string;
  smsApiKey?: string;
  smsSenderId?: string;
  // Homepage Content
  announcementText: string;
  announcementActive: boolean;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroImage: string;
  heroSize: 'compact' | 'standard';
  // Policies
  shippingPolicy: string;
  returnPolicy: string;
  privacyPolicy: string;
  termsPolicy: string;
  faqList: { question: string; answer: string }[];
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  subscribedAt: string;
}
