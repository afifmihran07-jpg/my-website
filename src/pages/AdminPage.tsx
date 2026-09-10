import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DatabaseService } from '../services/dataService';
import {
  Product,
  Order,
  BusinessSettings,
  PosterDimensionVariant,
  OrderStatus,
  PaymentStatus,
  Coupon,
  CustomerUser,
  AbandonedCart,
  CategoryItem,
  CategoryVariantType,
  ProductReview,
  ReviewStatus,
  SiteContent
} from '../types';
import { SecurityService, SecurityCredentials } from '../services/authClient';
import { SafeImage } from '../components/SafeImage';
import { HssStarIcon, HssLogo } from '../components/HssLogo';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Sliders,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Upload,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Eye,
  LogOut,
  Save,
  Search,
  Lock,
  Phone,
  FileText,
  BarChart3,
  Tag,
  Users,
  Download,
  Truck,
  ShoppingCart,
  FolderTree,
  Bell,
  AlertTriangle,
  X,
  Star,
  Heart,
  MessageSquarePlus,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ExternalLink,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

interface AdminPageProps {
  onNavigateCustomer: (route: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigateCustomer }) => {
  // Authentication & Security State
  const [securityCreds, setSecurityCreds] = useState<SecurityCredentials>(() =>
    SecurityService.getStoredCredentials()
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<
    'login' | 'forced_setup' | 'setup_success' | 'forgot_password' | 'enter_reset_token' | 'emergency_code'
  >('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState<number | null>(null);

  // Forced First-Time Setup State
  const [setupUsername, setSetupUsername] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupConfirmEmail, setSetupConfirmEmail] = useState('');
  const [setupError, setSetupError] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  // Password Recovery State
  const [recoveryEmailInput, setRecoveryEmailInput] = useState('');
  const [recoveryFeedback, setRecoveryFeedback] = useState('');
  const [recoveryTokenPreview, setRecoveryTokenPreview] = useState<string | null>(null);
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetError, setResetError] = useState('');

  // Emergency Recovery State
  const [emergencyCodeInput, setEmergencyCodeInput] = useState('');
  const [newEmergencyPassword, setNewEmergencyPassword] = useState('');
  const [confirmEmergencyPassword, setConfirmEmergencyPassword] = useState('');
  const [emergencyError, setEmergencyError] = useState('');

  // Settings Tab Security Credentials State
  const [secCurPassForUser, setSecCurPassForUser] = useState('');
  const [secNewUsername, setSecNewUsername] = useState('');
  const [secUserFeedback, setSecUserFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [secCurPassForPass, setSecCurPassForPass] = useState('');
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secConfirmPassword, setSecConfirmPassword] = useState('');
  const [secPassFeedback, setSecPassFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [secCurPassForEmail, setSecCurPassForEmail] = useState('');
  const [secNewEmail, setSecNewEmail] = useState('');
  const [secConfirmEmail, setSecConfirmEmail] = useState('');
  const [secEmailFeedback, setSecEmailFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [secCurPassForCode, setSecCurPassForCode] = useState('');
  const [newGeneratedEmergencyCode, setNewGeneratedEmergencyCode] = useState<string | null>(null);
  const [secCodeFeedback, setSecCodeFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasCopiedNewCode, setHasCopiedNewCode] = useState(false);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'analytics' | 'products' | 'categories' | 'orders' | 'inventory' | 'reviews' | 'coupons' | 'customers' | 'abandoned' | 'cms' | 'settings'
  >('dashboard');

  // Database Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminReviews, setAdminReviews] = useState<ProductReview[]>([]);
  const [reviewFilterTab, setReviewFilterTab] = useState<'all' | 'featured' | 'pending' | 'approved' | 'rejected'>('all');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(DatabaseService.getSettings());

  // Analytics Timeframe
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'today' | '7days' | '30days' | 'all'>('all');

  // Product Form Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Bulk Operations State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Form Fields for Product
  const [pName, setPName] = useState('');
  const [pSlug, setPSlug] = useState('');
  const [pTagline, setPTagline] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pCategory, setPCategory] = useState<string>('clothing');
  const [pPrice, setPPrice] = useState<number>(2500);
  const [pCompareAt, setPCompareAt] = useState<number | undefined>(undefined);
  const [pSku, setPSku] = useState('');
  const [pStock, setPStock] = useState<number>(20);
  const [pIsNewDrop, setPIsNewDrop] = useState(true);
  const [pIsFeatured, setPIsFeatured] = useState(false);
  const [pFabric, setPFabric] = useState('');
  const [pImages, setPImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  // Clothing Variants
  const [pClothingSizes, setPClothingSizes] = useState<string[]>(['S', 'M', 'L', 'XL']);
  const [pClothingColors, setPClothingColors] = useState<{ name: string; hex: string }[]>([
    { name: 'Washed Black', hex: '#141414' },
    { name: 'Chalk White', hex: '#f0f0f0' }
  ]);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');

  // Poster Physical Dimensions
  const [pPosterDimensions, setPPosterDimensions] = useState<PosterDimensionVariant[]>([
    { id: 'dim-1', name: 'A4', width: 8.3, height: 11.7, unit: 'IN', price: 450, stock: 30 },
    { id: 'dim-2', name: 'A3', width: 11.7, height: 16.5, unit: 'IN', price: 650, stock: 25 },
    { id: 'dim-3', name: 'A2', width: 16.5, height: 23.4, unit: 'IN', price: 850, stock: 15 },
    { id: 'dim-4', name: 'A1', width: 23.4, height: 33.1, unit: 'IN', price: 1250, stock: 8 }
  ]);

  // Order Details Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [courierNameInput, setCourierNameInput] = useState('Steadfast Courier');
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [trackingUrlInput, setTrackingUrlInput] = useState('');

  // Coupon Form Modal State
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [cpnCode, setCpnCode] = useState('');
  const [cpnType, setCpnType] = useState<'percentage' | 'fixed'>('percentage');
  const [cpnValue, setCpnValue] = useState<number>(10);
  const [cpnMinOrder, setCpnMinOrder] = useState<number>(2000);
  const [cpnMaxDiscount, setCpnMaxDiscount] = useState<number | undefined>(500);
  const [cpnUsageLimit, setCpnUsageLimit] = useState<number | undefined>(100);
  const [cpnFirstOrder, setCpnFirstOrder] = useState(false);

  // Category Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catVariantType, setCatVariantType] = useState<CategoryVariantType>('standard');
  const [catIsActive, setCatIsActive] = useState<boolean>(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Verification & Notifications State
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [orderFilterTab, setOrderFilterTab] = useState<'all' | 'pending_verification' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'>('all');
  const [verificationNote, setVerificationNote] = useState('Transaction verified against merchant account.');
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Content / CMS State
  const [cmsSubTab, setCmsSubTab] = useState<
    'homepage' | 'navigation' | 'footer' | 'about' | 'policies' | 'sizeGuide' | 'contact' | 'checkout' | 'emptyStates'
  >('homepage');
  const [cmsContent, setCmsContent] = useState<SiteContent>(() => DatabaseService.getDraftSiteContent());
  const [cmsFeedback, setCmsFeedback] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // Settings Feedback
  const [settingsSaved, setSettingsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupImportRef = useRef<HTMLInputElement>(null);

  // Search in Products
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');

  // Load Data
  const refreshData = () => {
    setProducts(DatabaseService.getProducts());
    setCategories(DatabaseService.getCategories());
    setOrders(DatabaseService.getOrders());
    setAdminReviews(DatabaseService.getReviews(undefined, true));
    setAdminNotifications(DatabaseService.getAdminNotifications());
    setCoupons(DatabaseService.getCoupons());
    setCustomers(DatabaseService.getCustomers());
    setAbandonedCarts(DatabaseService.getAbandonedCarts());
    setSettings(DatabaseService.getSettings());
    setCmsContent(DatabaseService.getDraftSiteContent());
  };

  const handleSaveDraftCms = () => {
    DatabaseService.saveDraftSiteContent(cmsContent);
    setCmsFeedback({ type: 'info', text: 'Draft saved safely. Click "Publish to Live Site" to activate changes.' });
    setTimeout(() => setCmsFeedback(null), 4000);
  };

  const handlePublishCms = () => {
    DatabaseService.publishSiteContent(cmsContent);
    setCmsFeedback({ type: 'success', text: 'Published! All updates are now live on the customer website.' });
    setTimeout(() => setCmsFeedback(null), 4000);
    refreshData();
  };

  const handleResetCmsToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all site copy, labels, and policies to default brand presets?')) {
      const def = DatabaseService.resetSiteContentToDefault();
      setCmsContent(def);
      setCmsFeedback({ type: 'info', text: 'Content reset to default High Street Society brand presets.' });
      setTimeout(() => setCmsFeedback(null), 4000);
      refreshData();
    }
  };

  const filteredAdminReviews = useMemo(() => {
    if (reviewFilterTab === 'featured') return adminReviews.filter(r => r.featuredOnHomepage);
    if (reviewFilterTab === 'pending') return adminReviews.filter(r => r.status === 'pending');
    if (reviewFilterTab === 'approved') return adminReviews.filter(r => r.status === 'approved');
    if (reviewFilterTab === 'rejected') return adminReviews.filter(r => r.status === 'rejected');
    return adminReviews;
  }, [adminReviews, reviewFilterTab]);

  const handleToggleReviewFeatured = (id: string) => {
    DatabaseService.toggleReviewHomepage(id);
    refreshData();
  };

  const handleUpdateReviewStatus = (id: string, status: ReviewStatus) => {
    DatabaseService.updateReviewStatus(id, status);
    refreshData();
  };

  const handleDeleteReview = (id: string, customerName: string) => {
    if (window.confirm(`Delete review from "${customerName}"?`)) {
      DatabaseService.deleteReview(id);
      refreshData();
    }
  };

  // Payment Verification Actions
  const handleConfirmPaymentAction = () => {
    if (!selectedOrder) return;
    const res = DatabaseService.verifyPayment(
      selectedOrder.id,
      authUsername || 'Admin',
      verificationNote || 'Transaction verified against merchant account.'
    );
    if (res.success && res.order) {
      setSelectedOrder(res.order);
      setVerificationFeedback('Payment verified and order confirmed successfully. Customer notification logged.');
      setTimeout(() => setVerificationFeedback(null), 4000);
      refreshData();
    }
  };

  const handleRejectPaymentAction = () => {
    if (!selectedOrder) return;
    const reason = prompt('Enter rejection note for audit and customer notification:', 'Transaction ID could not be verified against statement.');
    if (reason === null) return;
    const res = DatabaseService.rejectPayment(
      selectedOrder.id,
      authUsername || 'Admin',
      reason.trim() || 'Transaction ID could not be verified against statement.'
    );
    if (res.success && res.order) {
      setSelectedOrder(res.order);
      setVerificationFeedback('Payment marked as rejected. Customer SMS notification logged.');
      setTimeout(() => setVerificationFeedback(null), 4000);
      refreshData();
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void DatabaseService.hydrateAdmin().then(refreshData).catch(() => {
        setAuthError('Unable to load protected Admin data from the server.');
      });
    } else {
      refreshData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;
    const tokenFromUrl = new URLSearchParams(window.location.search).get('resetToken');
    if (tokenFromUrl) {
      setResetTokenInput(tokenFromUrl);
      setRecoveryTokenPreview(tokenFromUrl);
      setAuthView('enter_reset_token');
    }
    void SecurityService.initialize()
      .then(async (credentials) => {
        if (!active) return;
        setSecurityCreds(credentials);
        const valid = await SecurityService.verifySession();
        if (active) setIsAuthenticated(valid);
      })
      .catch(() => {
        if (active) setAuthError('Admin service is unavailable. Check the server and database configuration.');
      });
    return () => {
      active = false;
    };
  }, []);

  // Lockout Countdown Timer Effect
  useEffect(() => {
    if (securityCreds.lockedUntil && securityCreds.lockedUntil > Date.now()) {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.ceil((securityCreds.lockedUntil! - Date.now()) / 1000));
        setLockoutCountdown(remaining);
        if (remaining <= 0) {
          setLockoutCountdown(null);
          setAuthError('');
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setLockoutCountdown(null);
    }
  }, [securityCreds.lockedUntil]);

  // Secure Admin Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    setIsAuthSubmitting(true);

    try {
      const res = await SecurityService.login(authUsername, authPassword);
      setIsAuthSubmitting(false);

      if (res.requireSetup) {
        // Initial bootstrap login success: Force administrator to create new private credentials
        setAuthView('forced_setup');
        setSetupError('');
        setSecurityCreds(SecurityService.getStoredCredentials());
        return;
      }

      if (res.success) {
        setIsAuthenticated(true);
        setSecurityCreds(SecurityService.getStoredCredentials());
        refreshData();
      } else {
        setAuthError(res.error || 'Invalid credentials.');
        setSecurityCreds(SecurityService.getStoredCredentials());
      }
    } catch {
      setIsAuthSubmitting(false);
      setAuthError('Authentication error. Please try again.');
    }
  };

  // Mandatory First-Time Security Setup Handler (Atomic Save)
  const handleForcedSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    setIsAuthSubmitting(true);

    try {
      const res = await SecurityService.completeFirstTimeSetup({
        newUsername: setupUsername,
        newPassword: setupPassword,
        confirmPassword: setupConfirmPassword,
        recoveryEmail: setupEmail,
        confirmRecoveryEmail: setupConfirmEmail
      });

      setIsAuthSubmitting(false);

      if (res.success && res.recoveryCode) {
        setGeneratedCode(res.recoveryCode);
        setAuthView('setup_success');
        setSecurityCreds(SecurityService.getStoredCredentials());
      } else {
        setSetupError(res.error || "We couldn't save your security settings. Please try again.");
      }
    } catch {
      setIsAuthSubmitting(false);
      setSetupError("We couldn't save your security settings. Please try again.");
    }
  };

  // Acknowledge Recovery Code & Enter Dashboard
  const handleSetupAcknowledge = () => {
    setIsAuthenticated(true);
    setAuthView('login');
    setAuthUsername('');
    setAuthPassword('');
    refreshData();
  };

  // Password Recovery via Email
  const handleInitiateReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryFeedback('');
    setIsAuthSubmitting(true);
    const res = await SecurityService.initiatePasswordReset(recoveryEmailInput);
    setIsAuthSubmitting(false);
    setRecoveryFeedback(res.message);
  };

  // Complete Password Reset via Token
  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (newResetPassword !== confirmResetPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setIsAuthSubmitting(true);
    const res = await SecurityService.completePasswordReset(resetTokenInput, newResetPassword);
    setIsAuthSubmitting(false);
    if (res.success) {
      setAuthView('login');
      setAuthSuccessMsg('Password updated successfully. Please log in with your new password.');
      setResetTokenInput('');
      setNewResetPassword('');
      setConfirmResetPassword('');
      setRecoveryTokenPreview(null);
    } else {
      setResetError(res.error || 'Password reset link is invalid or has expired.');
    }
  };

  // Emergency Recovery via Code
  const handleEmergencyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmergencyError('');
    if (newEmergencyPassword !== confirmEmergencyPassword) {
      setEmergencyError('Passwords do not match.');
      return;
    }
    setIsAuthSubmitting(true);
    const res = await SecurityService.recoverWithEmergencyCode(emergencyCodeInput, newEmergencyPassword);
    setIsAuthSubmitting(false);
    if (res.success) {
      setAuthView('login');
      setAuthSuccessMsg('Emergency recovery verified! Your password has been updated. Please log in.');
      setEmergencyCodeInput('');
      setNewEmergencyPassword('');
      setConfirmEmergencyPassword('');
    } else {
      setEmergencyError(res.error || 'Emergency code recovery failed. Verify code format.');
    }
  };

  // Settings Security: Change Username
  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecUserFeedback(null);
    const res = await SecurityService.changeUsername(secCurPassForUser, secNewUsername);
    if (res.success) {
      setSecUserFeedback({ type: 'success', text: 'Username updated successfully.' });
      setSecCurPassForUser('');
      setSecNewUsername('');
      setSecurityCreds(SecurityService.getStoredCredentials());
    } else {
      setSecUserFeedback({ type: 'error', text: res.error || 'Failed to update username.' });
    }
  };

  // Settings Security: Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecPassFeedback(null);
    if (secNewPassword !== secConfirmPassword) {
      setSecPassFeedback({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    const res = await SecurityService.changePassword(secCurPassForPass, secNewPassword);
    if (res.success) {
      setSecPassFeedback({ type: 'success', text: 'Password updated. Invalidation of active sessions executed.' });
      setSecCurPassForPass('');
      setSecNewPassword('');
      setSecConfirmPassword('');
      setTimeout(() => {
        handleLogout();
      }, 2000);
    } else {
      setSecPassFeedback({ type: 'error', text: res.error || 'Failed to update password.' });
    }
  };

  // Settings Security: Change Recovery Email
  const handleChangeRecoveryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecEmailFeedback(null);
    if (secNewEmail !== secConfirmEmail) {
      setSecEmailFeedback({ type: 'error', text: 'Recovery emails do not match.' });
      return;
    }
    const res = await SecurityService.changeRecoveryEmail(secCurPassForEmail, secNewEmail);
    if (res.success) {
      setSecEmailFeedback({ type: 'success', text: 'Recovery email updated successfully.' });
      setSecCurPassForEmail('');
      setSecNewEmail('');
      setSecConfirmEmail('');
      setSecurityCreds(SecurityService.getStoredCredentials());
    } else {
      setSecEmailFeedback({ type: 'error', text: res.error || 'Failed to update recovery email.' });
    }
  };

  // Settings Security: Generate New Emergency Code
  const handleGenerateNewEmergencyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecCodeFeedback(null);
    const res = await SecurityService.generateNewEmergencyCode(secCurPassForCode);
    if (res.success && res.code) {
      setNewGeneratedEmergencyCode(res.code);
      setSecCodeFeedback({ type: 'success', text: 'New emergency recovery code generated. Previous code invalidated.' });
      setSecCurPassForCode('');
      setSecurityCreds(SecurityService.getStoredCredentials());
    } else {
      setSecCodeFeedback({ type: 'error', text: res.error || 'Current password incorrect.' });
    }
  };

  // Secure Logout
  const handleLogout = () => {
    SecurityService.logout();
    setIsAuthenticated(false);
    setAuthView('login');
    setAuthUsername('');
    setAuthPassword('');
    setAuthError('');
    setAuthSuccessMsg('');
  };

  // Category Management Handlers
  const openAddCategoryModal = () => {
    setEditingCategoryId(null);
    setCatName('');
    setCatSlug('');
    setCatDescription('');
    setCatVariantType('standard');
    setCatIsActive(true);
    setCategoryError(null);
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: CategoryItem) => {
    setEditingCategoryId(cat.id);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatDescription(cat.description || '');
    setCatVariantType(cat.variantType);
    setCatIsActive(cat.isActive !== false);
    setCategoryError(null);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(null);
    if (!catName.trim()) {
      setCategoryError('Category name is required');
      return;
    }
    DatabaseService.saveCategory({
      id: editingCategoryId || undefined,
      name: catName.trim(),
      slug: catSlug.trim() || undefined,
      description: catDescription.trim(),
      variantType: catVariantType,
      isActive: catIsActive
    });
    setIsCategoryModalOpen(false);
    refreshData();
  };

  const handleToggleCategoryActive = (cat: CategoryItem) => {
    DatabaseService.toggleCategoryActive(cat.id);
    refreshData();
  };

  const handleMoveCategoryUp = (index: number) => {
    if (index <= 0) return;
    const newCats = [...categories];
    const [moved] = newCats.splice(index, 1);
    newCats.splice(index - 1, 0, moved);
    DatabaseService.reorderCategories(newCats.map(c => c.id));
    refreshData();
  };

  const handleMoveCategoryDown = (index: number) => {
    if (index >= categories.length - 1) return;
    const newCats = [...categories];
    const [moved] = newCats.splice(index, 1);
    newCats.splice(index + 1, 0, moved);
    DatabaseService.reorderCategories(newCats.map(c => c.id));
    refreshData();
  };

  const handleDeleteCategory = (cat: CategoryItem) => {
    setCategoryError(null);
    if (window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
      const res = DatabaseService.deleteCategory(cat.id);
      if (!res.success) {
        alert(res.error);
        setCategoryError(res.error || 'Failed to delete category');
      } else {
        refreshData();
      }
    }
  };

  // Open Create Product Modal
  const openAddProductModal = () => {
    setEditingProductId(null);
    setPName('');
    setPSlug('');
    setPTagline('');
    setPDescription('');
    const currentCats = DatabaseService.getCategories();
    setPCategory(currentCats[0]?.slug || 'clothing');
    setPPrice(2650);
    setPCompareAt(3200);
    setPSku(`HSS-CL-${Math.floor(100 + Math.random() * 900)}`);
    setPStock(25);
    setPIsNewDrop(true);
    setPIsFeatured(true);
    setPFabric('450 GSM Heavyweight 100% Combed Cotton');
    setPImages(['/images/hss-hero-campaign.jpg']);
    setPClothingSizes(['S', 'M', 'L', 'XL']);
    setPClothingColors([
      { name: 'Washed Black', hex: '#141414' },
      { name: 'Chalk White', hex: '#f0f0f0' }
    ]);
    setPPosterDimensions([
      { id: 'dim-1', name: 'A4', width: 8.3, height: 11.7, unit: 'IN', price: 450, stock: 30 },
      { id: 'dim-2', name: 'A3', width: 11.7, height: 16.5, unit: 'IN', price: 650, stock: 25 },
      { id: 'dim-3', name: 'A2', width: 16.5, height: 23.4, unit: 'IN', price: 850, stock: 15 },
      { id: 'dim-4', name: 'A1', width: 23.4, height: 33.1, unit: 'IN', price: 1250, stock: 8 }
    ]);
    setIsProductModalOpen(true);
  };

  // Open Edit Product Modal
  const openEditProductModal = (prod: Product) => {
    setEditingProductId(prod.id);
    setPName(prod.name);
    setPSlug(prod.slug);
    setPTagline(prod.tagline || '');
    setPDescription(prod.description || '');
    setPCategory(prod.category);
    setPPrice(prod.price);
    setPCompareAt(prod.compareAtPrice);
    setPSku(prod.sku);
    setPStock(prod.stock);
    setPIsNewDrop(prod.isNewDrop);
    setPIsFeatured(prod.isFeatured);
    setPFabric(prod.fabric || '');
    setPImages(prod.images || []);
    setPClothingSizes(prod.clothingSizes || ['S', 'M', 'L', 'XL']);
    setPClothingColors(prod.clothingColors || [{ name: 'Black', hex: '#000000' }]);
    setPPosterDimensions(prod.posterDimensions || [
      { id: 'dim-1', name: 'A3', width: 11.7, height: 16.5, unit: 'IN', price: 650, stock: 20 },
      { id: 'dim-2', name: 'A2', width: 16.5, height: 23.4, unit: 'IN', price: 850, stock: 15 }
    ]);
    setIsProductModalOpen(true);
  };

  // Save Product Handler
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) return;

    const activeCatObj = categories.find(c => c.slug.toLowerCase() === pCategory.toLowerCase());
    const isClothingType = activeCatObj ? activeCatObj.variantType === 'clothing' : pCategory === 'clothing';
    const isPosterType = activeCatObj ? activeCatObj.variantType === 'posters' : pCategory === 'posters';

    await DatabaseService.saveProduct({
      id: editingProductId || undefined,
      name: pName.trim(),
      slug: pSlug.trim() || pName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      tagline: pTagline.trim(),
      description: pDescription.trim(),
      category: pCategory,
      price: Number(pPrice) || 0,
      compareAtPrice: pCompareAt ? Number(pCompareAt) : undefined,
      sku: pSku.trim(),
      stock: Number(pStock) || 0,
      isNewDrop: pIsNewDrop,
      isFeatured: pIsFeatured,
      isPublished: true,
      fabric: isClothingType ? pFabric.trim() : undefined,
      images: pImages.length > 0 ? pImages : ['/images/hss-hero-campaign.jpg'],
      clothingSizes: isClothingType ? pClothingSizes : undefined,
      clothingColors: isClothingType ? pClothingColors : (pClothingColors.length > 0 ? pClothingColors : undefined),
      posterDimensions: isPosterType ? pPosterDimensions : undefined
    });

    await DatabaseService.hydrateAdmin();
    refreshData();
    setIsProductModalOpen(false);
  };

  // Delete Product
  const handleDeleteProduct = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}" from High Street Society archive?`)) {
      DatabaseService.deleteProduct(id);
      refreshData();
    }
  };

  // Duplicate Product
  const handleDuplicateProduct = (id: string) => {
    DatabaseService.duplicateProduct(id);
    refreshData();
  };

  // Bulk Product Actions
  const handleToggleSelectProduct = (id: string) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter(i => i !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  const handleSelectAllProducts = () => {
    if (selectedProductIds.length === adminFilteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(adminFilteredProducts.map(p => p.id));
    }
  };

  const handleBulkPublish = (publish: boolean) => {
    DatabaseService.bulkUpdateProducts(selectedProductIds, { isPublished: publish });
    setSelectedProductIds([]);
    refreshData();
  };

  const handleBulkNewDrop = (isNew: boolean) => {
    DatabaseService.bulkUpdateProducts(selectedProductIds, { isNewDrop: isNew });
    setSelectedProductIds([]);
    refreshData();
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedProductIds.length} selected products?`)) {
      DatabaseService.bulkDeleteProducts(selectedProductIds);
      setSelectedProductIds([]);
      refreshData();
    }
  };

  // Export CSV
  const handleExportProductsCSV = () => {
    const prods = DatabaseService.getProducts();
    const headers = ['ID', 'Name', 'Category', 'SKU', 'Price', 'Stock', 'IsNew', 'IsFeatured'];
    const rows = prods.map(p => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      p.sku,
      p.price,
      p.stock,
      p.isNewDrop,
      p.isFeatured
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hss-products-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // File Upload Handler (Computer or Phone)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        if (base64) {
          setPImages(prev => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Add External Image URL
  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    setPImages(prev => [...prev, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  // Remove Image from array
  const handleRemoveImage = (index: number) => {
    setPImages(prev => prev.filter((_, i) => i !== index));
  };

  // Make Image Primary (move to index 0)
  const handleMakePrimaryImage = (index: number) => {
    if (index === 0) return;
    setPImages(prev => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.unshift(item);
      return next;
    });
  };

  // Poster Dimension Row Helpers
  const handleAddPosterDimension = () => {
    const newDim: PosterDimensionVariant = {
      id: 'dim-' + Date.now().toString(36),
      name: 'Custom',
      width: 18,
      height: 24,
      unit: 'IN',
      price: 950,
      stock: 15
    };
    setPPosterDimensions(prev => [...prev, newDim]);
  };

  const handleUpdatePosterDimension = (id: string, updates: Partial<PosterDimensionVariant>) => {
    setPPosterDimensions(prev =>
      prev.map(dim => (dim.id === id ? { ...dim, ...updates } : dim))
    );
  };

  const handleRemovePosterDimension = (id: string) => {
    setPPosterDimensions(prev => prev.filter(dim => dim.id !== id));
  };

  // Courier Dispatch Assignment
  const handleAssignCourier = () => {
    if (!selectedOrder || !trackingNumberInput.trim()) return;
    DatabaseService.updateOrderCourier(
      selectedOrder.id,
      courierNameInput,
      trackingNumberInput.trim(),
      trackingUrlInput.trim() || undefined
    );
    const updated = DatabaseService.getOrderById(selectedOrder.id);
    if (updated) setSelectedOrder(updated);
    refreshData();
  };

  // Coupon Creation
  const handleSaveCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpnCode.trim()) return;
    DatabaseService.saveCoupon({
      code: cpnCode.trim().toUpperCase(),
      type: cpnType,
      value: cpnValue,
      minOrderValue: cpnMinOrder,
      maxDiscount: cpnMaxDiscount,
      usageLimit: cpnUsageLimit,
      firstOrderOnly: cpnFirstOrder,
      isActive: true
    });
    setIsCouponModalOpen(false);
    refreshData();
  };

  // Database Backup & Restore
  const handleDownloadBackup = () => {
    const json = DatabaseService.exportDatabase();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hss-database-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = DatabaseService.importDatabase(content);
        if (res.success) {
          alert('Database restored successfully.');
          refreshData();
        } else {
          alert(`Restore failed: ${res.error}`);
        }
      }
    };
    reader.readAsText(file);
  };

  // Settings Save Handler
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    DatabaseService.saveSettings(settings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  // Filtered Products for Admin
  const adminFilteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase());
      const matchCat =
        productCategoryFilter === 'all' || p.category === productCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, productSearch, productCategoryFilter]);

  // Analytics Metrics
  const analyticsData = useMemo(() => {
    return DatabaseService.getAnalytics(analyticsTimeframe);
  }, [orders, products, analyticsTimeframe]);

  const metrics = useMemo(() => {
    const totalRev = orders
      .filter(o => o.paymentStatus === 'paid' || o.orderStatus === 'delivered')
      .reduce((acc, o) => acc + o.total, 0);
    const pendingVerificationCount = orders.filter(o => o.paymentStatus === 'pending_verification').length;
    const pendingOrders = orders.filter(o => o.orderStatus === 'pending').length;
    const lowStockCount = products.filter(p => p.stock <= 5).length;
    return {
      totalOrders: orders.length,
      totalRevenue: totalRev,
      pendingVerificationCount,
      pendingOrders,
      lowStockCount,
      totalProducts: products.length
    };
  }, [orders, products]);

  const unreadNotifsCount = useMemo(() => {
    return adminNotifications.filter(n => !n.read).length;
  }, [adminNotifications]);

  const adminFilteredOrders = useMemo(() => {
    if (orderFilterTab === 'all') return orders;
    if (orderFilterTab === 'pending_verification') {
      return orders.filter(o => o.paymentStatus === 'pending_verification');
    }
    return orders.filter(o => o.orderStatus === orderFilterTab);
  }, [orders, orderFilterTab]);

  // 1. AUTHENTICATION & RECOVERY VIEWS (IF NOT AUTHENTICATED)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 p-8 space-y-6 shadow-2xl relative">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-2">
              <HssLogo variant="emblem" size="lg" />
            </div>
            <h1 className="font-display font-black text-2xl text-white uppercase tracking-tight">
              ADMIN CONTROL ROOM
            </h1>
            <p className="text-xs font-mono text-neutral-400">
              HIGH STREET SOCIETY SECURED MANAGEMENT
            </p>
          </div>

          {/* Alert messages */}
          {authSuccessMsg && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 font-mono">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{authSuccessMsg}</span>
            </div>
          )}

          {authError && (
            <div className="p-3 bg-red-950/70 border border-red-800 text-red-200 text-xs flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{authError}</span>
            </div>
          )}

          {lockoutCountdown !== null && (
            <div className="p-3 bg-amber-950/70 border border-amber-800 text-amber-200 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400 animate-pulse" />
              <span>Account locked. Retry available in {lockoutCountdown} seconds.</span>
            </div>
          )}

          {/* VIEW A: NORMAL LOGIN VIEW */}
          {authView === 'login' && (
            <>
              {securityCreds.setupState !== 'INITIAL_SETUP_COMPLETED' ? (
                <div className="p-3.5 bg-neutral-900/90 border border-amber-900/60 text-xs font-mono space-y-1 text-amber-200">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                    <KeyRound className="w-3.5 h-3.5" /> FIRST-TIME SETUP REQUIRED
                  </span>
                  <p className="text-neutral-300 text-[11px] leading-relaxed">
                    Enter the initial bootstrap setup credentials to configure your private administrator username, password, recovery email, and emergency recovery code.
                  </p>
                </div>
              ) : null}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Admin Username
                  </label>
                  <input
                    type="text"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    placeholder={securityCreds.setupState === 'INITIAL_SETUP_COMPLETED' ? 'Enter username' : 'admin'}
                    required
                    disabled={lockoutCountdown !== null || isAuthSubmitting}
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#e11d48] disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    disabled={lockoutCountdown !== null || isAuthSubmitting}
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#e11d48] disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={lockoutCountdown !== null || isAuthSubmitting}
                  className="w-full py-3 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                >
                  <Lock className="w-4 h-4" />
                  {isAuthSubmitting ? 'VERIFYING CREDENTIALS...' : 'AUTHENTICATE ACCESS'}
                </button>
              </form>

              {/* Recovery Navigation - Only visible once setup has been established */}
              {securityCreds.setupState === 'INITIAL_SETUP_COMPLETED' && (
                <div className="pt-4 border-t border-neutral-900/90 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-neutral-400 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthView('forgot_password');
                      setAuthError('');
                      setAuthSuccessMsg('');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Forgot Password?
                  </button>
                  <span className="hidden sm:inline text-neutral-700">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthView('emergency_code');
                      setAuthError('');
                      setAuthSuccessMsg('');
                    }}
                    className="hover:text-white transition-colors text-[11px]"
                  >
                    Emergency Recovery Code
                  </button>
                </div>
              )}
            </>
          )}

          {/* VIEW B: MANDATORY FIRST-TIME SECURITY SETUP */}
          {authView === 'forced_setup' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-3.5 bg-neutral-900 border border-[#e11d48] text-xs font-mono space-y-1">
                <span className="font-bold text-[#e11d48] flex items-center gap-1.5 uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4" /> MANDATORY SECURITY INITIALIZATION
                </span>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  The initial bootstrap credentials will be permanently disabled upon completion. You must create private administrator credentials and configure recovery options.
                </p>
              </div>

              {setupError && (
                <div className="p-3 bg-red-950/70 border border-red-800 text-red-200 text-xs font-mono">
                  {setupError}
                </div>
              )}

              <form onSubmit={handleForcedSetup} className="space-y-3.5 text-xs font-mono">
                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    NEW PRIVATE USERNAME *
                  </label>
                  <input
                    type="text"
                    value={setupUsername}
                    onChange={(e) => setSetupUsername(e.target.value)}
                    placeholder="e.g. hss_director"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white focus:outline-none focus:border-[#e11d48]"
                  />
                  <p className="text-[10px] text-neutral-500 mt-0.5">Cannot be &apos;admin&apos;. Min 3 characters.</p>
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    NEW STRONG PASSWORD *
                  </label>
                  <input
                    type="password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number, 1 symbol"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white focus:outline-none focus:border-[#e11d48]"
                  />
                  <div className="text-[10px] text-neutral-500 mt-1 flex flex-wrap gap-2">
                    <span className={setupPassword.length >= 8 ? 'text-emerald-400' : 'text-neutral-500'}>✓ 8+ Chars</span>
                    <span className={/[A-Z]/.test(setupPassword) ? 'text-emerald-400' : 'text-neutral-500'}>✓ Upper</span>
                    <span className={/[0-9]/.test(setupPassword) ? 'text-emerald-400' : 'text-neutral-500'}>✓ Number</span>
                    <span className={/[!@#$%^&*(),.?":{}|<>\-_=+]/.test(setupPassword) ? 'text-emerald-400' : 'text-neutral-500'}>✓ Symbol</span>
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    CONFIRM NEW PASSWORD *
                  </label>
                  <input
                    type="password"
                    value={setupConfirmPassword}
                    onChange={(e) => setSetupConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white focus:outline-none focus:border-[#e11d48]"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    RECOVERY EMAIL ADDRESS *
                  </label>
                  <input
                    type="email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    placeholder="owner@yourdomain.com"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white focus:outline-none focus:border-[#e11d48]"
                  />
                  <p className="text-[10px] text-neutral-500 mt-0.5">Used for single-use password reset verification.</p>
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    CONFIRM RECOVERY EMAIL *
                  </label>
                  <input
                    type="email"
                    value={setupConfirmEmail}
                    onChange={(e) => setSetupConfirmEmail(e.target.value)}
                    placeholder="Re-enter recovery email"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white focus:outline-none focus:border-[#e11d48]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full py-3.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  {isAuthSubmitting ? 'GENERATING SECURE HASHES...' : 'SAVE & LOCK CREDENTIALS ATOMICALLY'}
                </button>
              </form>
            </div>
          )}

          {/* VIEW C: SETUP SUCCESS & EMERGENCY RECOVERY CODE DISPLAY */}
          {authView === 'setup_success' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-xs font-mono space-y-1">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
                  <CheckCircle2 className="w-4 h-4" /> SECURITY SETUP COMPLETED SUCCESSFULLY
                </span>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  Default bootstrap credentials are now permanently disabled. Copy and safely store your One-Time Emergency Recovery Code below.
                </p>
              </div>

              {/* Emergency Recovery Code Callout */}
              <div className="p-4 bg-neutral-900 border border-neutral-700 space-y-2">
                <span className="block text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                  ONE-TIME EMERGENCY RECOVERY CODE
                </span>
                <div className="flex items-center justify-between bg-black p-3 border border-neutral-800">
                  <code className="font-mono text-base font-bold text-amber-400 tracking-widest">
                    {generatedCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCode);
                      setHasCopiedCode(true);
                      setTimeout(() => setHasCopiedCode(false), 3000);
                    }}
                    className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-white uppercase border border-neutral-700"
                  >
                    {hasCopiedCode ? 'COPIED!' : 'COPY'}
                  </button>
                </div>
                <p className="text-[11px] font-mono text-neutral-400 pt-1 leading-relaxed">
                  <strong className="text-white">CRITICAL:</strong> Store this code in an encrypted password manager or secure vault. It will never be displayed again. This is your emergency key if your recovery email becomes inaccessible.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSetupAcknowledge}
                className="w-full py-3.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                I HAVE SECURED MY EMERGENCY CODE — ENTER ADMIN DASHBOARD
              </button>
            </div>
          )}

          {/* VIEW D: FORGOT PASSWORD (VIA RECOVERY EMAIL) */}
          {authView === 'forgot_password' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-left space-y-1">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  ACCOUNT PASSWORD RECOVERY
                </h3>
                <p className="text-xs font-mono text-neutral-400 leading-relaxed">
                  Enter your configured recovery email address. If verified, password reset instructions will be generated.
                </p>
              </div>

              {recoveryFeedback && (
                <div className="p-3 bg-neutral-900 border border-neutral-700 text-xs font-mono text-neutral-300 space-y-2">
                  <p>{recoveryFeedback}</p>
                  {recoveryTokenPreview && (
                    <div className="pt-2 border-t border-neutral-800 space-y-1">
                      <span className="text-[10px] text-amber-400 font-bold uppercase block">
                        DISPATCHED RESET TOKEN (15-MIN EXPIRY):
                      </span>
                      <code className="block bg-black p-2 font-mono text-[11px] text-white break-all border border-neutral-800">
                        {recoveryTokenPreview}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthView('enter_reset_token');
                          setResetTokenInput(recoveryTokenPreview);
                        }}
                        className="w-full py-2 bg-[#e11d48] text-white font-tech text-xs uppercase font-bold mt-2"
                      >
                        PROCEED TO ENTER NEW PASSWORD →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!recoveryTokenPreview && (
                <form onSubmit={handleInitiateReset} className="space-y-3 font-mono text-xs">
                  <div>
                    <label className="block text-neutral-400 mb-1 uppercase font-bold">
                      RECOVERY EMAIL ADDRESS
                    </label>
                    <input
                      type="email"
                      value={recoveryEmailInput}
                      onChange={(e) => setRecoveryEmailInput(e.target.value)}
                      placeholder="owner@yourdomain.com"
                      required
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2.5 text-white focus:outline-none focus:border-[#e11d48]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthSubmitting}
                    className="w-full py-3 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
                  >
                    {isAuthSubmitting ? 'DISPATCHING TOKEN...' : 'DISPATCH RESET INSTRUCTIONS'}
                  </button>
                </form>
              )}

              <div className="pt-3 border-t border-neutral-900 flex justify-between text-xs font-mono text-neutral-500">
                <button
                  type="button"
                  onClick={() => setAuthView('login')}
                  className="hover:text-white"
                >
                  ← Back to Login
                </button>
                <button
                  type="button"
                  onClick={() => setAuthView('emergency_code')}
                  className="hover:text-amber-400"
                >
                  Use Emergency Code →
                </button>
              </div>
            </div>
          )}

          {/* VIEW E: ENTER RESET TOKEN & SET NEW PASSWORD */}
          {authView === 'enter_reset_token' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-left space-y-1">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  SET NEW PASSWORD VIA TOKEN
                </h3>
                <p className="text-xs font-mono text-neutral-400">
                  Single-use reset verification in progress.
                </p>
              </div>

              {resetError && (
                <div className="p-3 bg-red-950/70 border border-red-800 text-red-200 text-xs font-mono">
                  {resetError}
                </div>
              )}

              <form onSubmit={handleCompleteReset} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    RESET TOKEN
                  </label>
                  <input
                    type="text"
                    value={resetTokenInput}
                    onChange={(e) => setResetTokenInput(e.target.value)}
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    NEW STRONG PASSWORD
                  </label>
                  <input
                    type="password"
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number, 1 symbol"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    CONFIRM NEW PASSWORD
                  </label>
                  <input
                    type="password"
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full py-3 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  {isAuthSubmitting ? 'UPDATING...' : 'UPDATE PASSWORD & INVALIDATE TOKENS'}
                </button>
              </form>

              <div className="pt-2 text-center text-xs font-mono text-neutral-500">
                <button
                  type="button"
                  onClick={() => setAuthView('login')}
                  className="hover:text-white"
                >
                  ← Return to Login
                </button>
              </div>
            </div>
          )}

          {/* VIEW F: EMERGENCY ONE-TIME CODE RECOVERY */}
          {authView === 'emergency_code' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-left space-y-1">
                <h3 className="font-display font-bold text-sm uppercase text-amber-400 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> EMERGENCY CODE RECOVERY
                </h3>
                <p className="text-xs font-mono text-neutral-400">
                  Enter your one-time emergency recovery code generated during initial setup.
                </p>
              </div>

              {emergencyError && (
                <div className="p-3 bg-red-950/70 border border-red-800 text-red-200 text-xs font-mono">
                  {emergencyError}
                </div>
              )}

              <form onSubmit={handleEmergencyRecovery} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    ONE-TIME RECOVERY CODE *
                  </label>
                  <input
                    type="text"
                    value={emergencyCodeInput}
                    onChange={(e) => setEmergencyCodeInput(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white uppercase font-mono tracking-wider font-bold"
                  />
                  <p className="text-[10px] text-neutral-500 mt-0.5">Single-use code. Will be invalidated upon successful verification.</p>
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    NEW STRONG PASSWORD *
                  </label>
                  <input
                    type="password"
                    value={newEmergencyPassword}
                    onChange={(e) => setNewEmergencyPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number, 1 symbol"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1 uppercase font-bold">
                    CONFIRM NEW PASSWORD *
                  </label>
                  <input
                    type="password"
                    value={confirmEmergencyPassword}
                    onChange={(e) => setConfirmEmergencyPassword(e.target.value)}
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full py-3 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-black text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  {isAuthSubmitting ? 'VERIFYING CODE...' : 'RECOVER ACCESS & RESET PASSWORD'}
                </button>
              </form>

              <div className="pt-2 text-center text-xs font-mono text-neutral-500">
                <button
                  type="button"
                  onClick={() => setAuthView('login')}
                  className="hover:text-white"
                >
                  ← Return to Login
                </button>
              </div>
            </div>
          )}

          {/* Bottom link to Live store */}
          <div className="pt-4 border-t border-neutral-900 flex justify-between text-xs font-mono text-neutral-500">
            <span>HIGH STREET SOCIETY · ARCHIVAL SECURITY</span>
            <button
              onClick={() => onNavigateCustomer('home')}
              className="hover:text-white transition-colors"
            >
              Live Store →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. MAIN ADMIN DASHBOARD
  return (
    <div className="min-h-screen bg-[#070709] text-neutral-300 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-neutral-950 border-r border-neutral-900 flex flex-col justify-between p-4 sm:p-6 flex-shrink-0">
        <div className="space-y-6">
          {/* Logo & Status */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-900">
            <HssLogo variant="full" size="sm" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Online" />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-tech font-bold uppercase tracking-wider">
            {[
              { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
              { id: 'analytics', label: 'ANALYTICS', icon: BarChart3 },
              { id: 'products', label: 'PRODUCTS', icon: Package },
              { id: 'categories', label: 'CATEGORIES', icon: FolderTree, count: categories.length },
              { id: 'orders', label: 'ORDERS', icon: ShoppingBag, count: metrics.pendingOrders },
              { id: 'inventory', label: 'INVENTORY', icon: Sliders, count: metrics.lowStockCount },
              { id: 'reviews', label: 'REVIEWS', icon: MessageSquarePlus, count: adminReviews.filter(r => r.status === 'pending').length || adminReviews.filter(r => r.featuredOnHomepage).length },
              { id: 'coupons', label: 'COUPONS', icon: Tag, count: coupons.length },
              { id: 'customers', label: 'CUSTOMERS', icon: Users, count: customers.length },
              { id: 'abandoned', label: 'ABANDONED CARTS', icon: ShoppingCart, count: abandonedCarts.length },
              { id: 'cms', label: 'CONTENT / CMS', icon: FileText },
              { id: 'settings', label: 'STORE SETTINGS', icon: Settings }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#e11d48] text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="px-1.5 py-0.2 bg-black/60 text-white text-[10px] rounded-full font-mono">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 border-t border-neutral-900 space-y-2">
          <button
            onClick={() => onNavigateCustomer('home')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-tech text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>VIEW LIVE STORE</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-tech text-red-400 hover:text-red-300 hover:bg-neutral-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>LOGOUT ADMIN</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        {/* TOP STATUS & VERIFICATION NOTIFICATION BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-neutral-900 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase text-neutral-400">
              STORE STATUS: <span className="text-emerald-400 font-bold">LIVE ONLINE</span>
            </span>
            <span className="text-neutral-700">•</span>
            <span className="text-xs font-mono text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              PAYMENT WORKFLOW: <strong>MANUAL VERIFICATION MODE</strong>
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className={`px-3 py-1.5 border text-xs font-mono uppercase flex items-center gap-2 transition-colors ${
                unreadNotifsCount > 0
                  ? 'bg-amber-950/80 border-amber-800 text-amber-300 hover:bg-amber-900/80 shadow-md'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>PAYMENT ALERTS</span>
              {unreadNotifsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-black font-bold text-[10px] rounded-full animate-bounce">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-neutral-950 border border-neutral-800 shadow-2xl p-4 z-40 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-900 text-xs font-mono">
                  <span className="font-bold text-white uppercase">MANUAL PAYMENT ALERTS ({unreadNotifsCount})</span>
                  {unreadNotifsCount > 0 && (
                    <button
                      onClick={() => {
                        DatabaseService.markAllAdminNotificationsRead();
                        refreshData();
                      }}
                      className="text-[10px] text-neutral-500 hover:text-white"
                    >
                      MARK ALL READ
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {adminNotifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        DatabaseService.markAdminNotificationRead(notif.id);
                        const ord = DatabaseService.getOrderById(notif.orderId);
                        if (ord) {
                          setSelectedOrder(ord);
                          setCourierNameInput(ord.courierName || 'Steadfast Courier');
                          setTrackingNumberInput(ord.courierTrackingNumber || '');
                          setTrackingUrlInput(ord.courierTrackingUrl || '');
                          setVerificationNote(ord.verificationNote || 'Transaction verified against merchant account.');
                        }
                        setShowNotifDropdown(false);
                      }}
                      className={`p-2.5 border text-xs font-mono cursor-pointer transition-colors ${
                        notif.read
                          ? 'bg-neutral-900/40 border-neutral-900 text-neutral-400 hover:bg-neutral-900'
                          : 'bg-amber-950/40 border-amber-900/60 text-amber-200 hover:bg-amber-950/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase text-white">ORDER #{notif.orderId}</span>
                        <span className="text-[10px] text-neutral-500">
                          {new Date(notif.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-neutral-300 mt-0.5 text-[11px]">{notif.message}</p>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-500">
                        <span>TRX: {notif.transactionId || 'N/A'}</span>
                        <span className="text-[#e11d48] font-bold">REVIEW & VERIFY →</span>
                      </div>
                    </div>
                  ))}
                  {adminNotifications.length === 0 && (
                    <p className="text-xs font-mono text-neutral-500 text-center py-4">
                      No payment alerts at this moment.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-900">
              <div>
                <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  SOCIETY EXECUTIVE DASHBOARD
                </h1>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  OVERVIEW OF ORDERS, REAL-TIME REVENUE & INVENTORY HEALTH
                </p>
              </div>
              <button
                onClick={openAddProductModal}
                className="px-5 py-2.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-tech font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 self-start"
              >
                <Plus className="w-4 h-4" />
                ADD NEW PRODUCT
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-neutral-950 border border-neutral-900 p-5 space-y-1">
                <span className="text-xs font-mono text-neutral-400 uppercase">TOTAL REVENUE</span>
                <p className="font-tech text-2xl font-bold text-white">৳{metrics.totalRevenue.toLocaleString()}</p>
                <span className="text-[10px] font-mono text-emerald-400">CONFIRMED / PAID ORDERS</span>
              </div>

              <div className="bg-neutral-950 border border-neutral-900 p-5 space-y-1">
                <span className="text-xs font-mono text-neutral-400 uppercase">PENDING ORDERS</span>
                <p className="font-tech text-2xl font-bold text-[#e11d48]">{metrics.pendingOrders}</p>
                <span className="text-[10px] font-mono text-neutral-500">AWAITING SHIPMENT</span>
              </div>

              <div className="bg-neutral-950 border border-neutral-900 p-5 space-y-1">
                <span className="text-xs font-mono text-neutral-400 uppercase">CATALOG ITEMS</span>
                <p className="font-tech text-2xl font-bold text-white">{metrics.totalProducts}</p>
                <span className="text-[10px] font-mono text-neutral-500">CLOTHING & POSTERS</span>
              </div>

              <div className="bg-neutral-950 border border-neutral-900 p-5 space-y-1">
                <span className="text-xs font-mono text-neutral-400 uppercase">LOW STOCK ALERTS</span>
                <p className="font-tech text-2xl font-bold text-amber-400">{metrics.lowStockCount}</p>
                <span className="text-[10px] font-mono text-amber-500">≤ 5 UNITS REMAINING</span>
              </div>
            </div>

            {/* Recent Orders Overview */}
            <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  RECENT CUSTOMER ORDERS
                </h3>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-mono text-[#e11d48] hover:underline"
                >
                  VIEW ALL ORDERS ({orders.length}) →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-900 text-neutral-400 uppercase">
                    <tr>
                      <th className="p-3">ORDER ID</th>
                      <th className="p-3">CUSTOMER</th>
                      <th className="p-3">PAYMENT</th>
                      <th className="p-3">TOTAL</th>
                      <th className="p-3">STATUS</th>
                      <th className="p-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {orders.slice(0, 5).map(ord => (
                      <tr key={ord.id} className="hover:bg-neutral-900/50">
                        <td className="p-3 font-bold text-white">{ord.id}</td>
                        <td className="p-3">
                          <p className="text-white font-semibold">{ord.customerName}</p>
                          <p className="text-neutral-500 text-[11px]">{ord.phone}</p>
                        </td>
                        <td className="p-3 uppercase">
                          <span className={ord.paymentMethod === 'bkash' ? 'text-pink-400' : 'text-neutral-400'}>
                            {ord.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3 font-tech font-bold text-white">৳{ord.total.toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-none ${
                            ord.orderStatus === 'confirmed' || ord.orderStatus === 'delivered'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : ord.orderStatus === 'pending'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}>
                            {ord.orderStatus}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setCourierNameInput(ord.courierName || 'Steadfast Courier');
                              setTrackingNumberInput(ord.courierTrackingNumber || '');
                              setTrackingUrlInput(ord.courierTrackingUrl || '');
                            }}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[10px] uppercase"
                          >
                            DETAILS
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS (REAL DATABASE REVENUE & BEST SELLERS) */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-900">
              <div>
                <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  EXECUTIVE ANALYTICS
                </h1>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  REVENUE RECONCILIATION, AOV, PAYMENT RATIOS & SIZE DEMAND
                </p>
              </div>

              {/* Timeframe selector */}
              <div className="flex gap-1.5 bg-neutral-950 p-1 border border-neutral-800 self-start">
                {[
                  { id: 'today', label: 'TODAY' },
                  { id: '7days', label: '7 DAYS' },
                  { id: '30days', label: '30 DAYS' },
                  { id: 'all', label: 'ALL TIME' }
                ].map(tf => (
                  <button
                    key={tf.id}
                    onClick={() => setAnalyticsTimeframe(tf.id as any)}
                    className={`px-3 py-1 text-xs font-tech font-bold uppercase transition-colors ${
                      analyticsTimeframe === tf.id ? 'bg-[#e11d48] text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Analytics Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-neutral-950 border border-neutral-900 p-5 space-y-1">
                <span className="text-xs font-mono text-neutral-400 uppercase">PERIOD REVENUE</span>
                <p className="font-tech text-2xl font-bold text-white">৳{analyticsData.totalRevenue.toLocaleString()}</p>
                <span className="text-[10px] font-mono text-emerald-400">NET REALIZED</span>
              </div>
              <div className="bg-neutral-950 border border-neutral-900 p-5 space-y-1">
                <span className="text-xs font-mono text-neutral-400 uppercase">ORDERS PROCESSED</span>
                <p className="font-tech text-2xl font-bold text-white">{analyticsData.totalOrderCount}</p>
                <span className="text-[10px] font-mono text-neutral-500">PLACED & CONFIRMED</span>
              </div>
              <div className="bg-neutral-950 border border-neutral-900 p-5 space-y-1">
                <span className="text-xs font-mono text-neutral-400 uppercase">AVERAGE ORDER (AOV)</span>
                <p className="font-tech text-2xl font-bold text-[#e11d48]">৳{analyticsData.averageOrderValue.toLocaleString()}</p>
                <span className="text-[10px] font-mono text-neutral-500">PER CONVERSION</span>
              </div>
              <div className="bg-neutral-950 border border-neutral-900 p-5 space-y-1">
                <span className="text-xs font-mono text-neutral-400 uppercase">BKASH SHARE</span>
                <p className="font-tech text-2xl font-bold text-pink-400">
                  {analyticsData.totalOrderCount > 0
                    ? Math.round((analyticsData.paymentBreakdown.bkashCount / analyticsData.totalOrderCount) * 100)
                    : 0}%
                </p>
                <span className="text-[10px] font-mono text-neutral-500">
                  ৳{analyticsData.paymentBreakdown.bkashRevenue.toLocaleString()} DIGITAL
                </span>
              </div>
            </div>

            {/* Best Sellers & Payment Split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Best Selling Products */}
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  TOP-PERFORMING PIECES
                </h3>
                <div className="divide-y divide-neutral-900 text-xs font-mono">
                  {analyticsData.topProducts.map((p: { name: string; category: string; revenue: number; quantity: number }, i: number) => (
                    <div key={i} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold uppercase truncate max-w-xs">{p.name}</p>
                        <span className="text-[10px] text-neutral-500 uppercase">{p.category}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-tech font-bold">৳{p.revenue.toLocaleString()}</p>
                        <p className="text-neutral-500 text-[10px]">{p.quantity} units sold</p>
                      </div>
                    </div>
                  ))}
                  {analyticsData.topProducts.length === 0 && (
                    <p className="text-xs text-neutral-500 py-4">No sales recorded in this period.</p>
                  )}
                </div>
              </div>

              {/* Size & Color Volume */}
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  SIZE & VARIANT DEMAND DISTRIBUTION
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono text-neutral-400 uppercase">CLOTHING SIZES:</span>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(analyticsData.sizeSalesMap as Record<string, number>).map(([sz, count]) => (
                        <div key={sz} className="px-3 py-1 bg-neutral-900 border border-neutral-800 text-xs font-mono">
                          <strong className="text-white">{sz}</strong>: <span className="text-[#e11d48]">{count} units</span>
                        </div>
                      ))}
                      {Object.keys(analyticsData.sizeSalesMap).length === 0 && (
                        <span className="text-xs text-neutral-500 font-mono">No size data</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <span className="text-xs font-mono text-neutral-400 uppercase">POSTER PHYSICAL DIMENSIONS:</span>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(analyticsData.posterDimMap as Record<string, number>).map(([dim, count]) => (
                        <div key={dim} className="px-3 py-1 bg-neutral-900 border border-neutral-800 text-xs font-mono">
                          <strong className="text-white">{dim}</strong>: <span className="text-[#e11d48]">{count} prints</span>
                        </div>
                      ))}
                      {Object.keys(analyticsData.posterDimMap).length === 0 && (
                        <span className="text-xs text-neutral-500 font-mono">No poster dimension data</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRODUCTS MANAGER (WITH BULK ACTIONS & CSV) */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-900">
              <div>
                <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  ARCHIVAL PRODUCTS
                </h1>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  MANAGE HOODIES, TEES, POSTER PHYSICAL DIMENSIONS, PRICES & IMAGES
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportProductsCSV}
                  className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-tech text-xs uppercase tracking-wider border border-neutral-800 flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> EXPORT CSV
                </button>
                <button
                  onClick={openAddProductModal}
                  className="px-5 py-2.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-tech font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  + ADD PRODUCT
                </button>
              </div>
            </div>

            {/* Filters Bar & Bulk Action Bar */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 bg-neutral-950 p-3 border border-neutral-900">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products by name or SKU..."
                    className="w-full bg-neutral-900 border border-neutral-800 pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {['all', ...categories.map(c => c.slug)].map(cat => {
                    const catLabel = cat === 'all' ? 'ALL' : (categories.find(c => c.slug === cat)?.name || cat).toUpperCase();
                    return (
                      <button
                        key={cat}
                        onClick={() => setProductCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-xs font-tech uppercase font-bold transition-colors ${
                          productCategoryFilter === cat
                            ? 'bg-[#e11d48] text-white'
                            : 'bg-neutral-900 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {catLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bulk Action Controls */}
              {selectedProductIds.length > 0 && (
                <div className="p-3 bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs font-mono">
                  <span>
                    SELECTED: <strong className="text-white">{selectedProductIds.length}</strong> PRODUCTS
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkPublish(true)}
                      className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white uppercase text-[11px]"
                    >
                      PUBLISH
                    </button>
                    <button
                      onClick={() => handleBulkPublish(false)}
                      className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white uppercase text-[11px]"
                    >
                      UNPUBLISH
                    </button>
                    <button
                      onClick={() => handleBulkNewDrop(true)}
                      className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white uppercase text-[11px]"
                    >
                      MARK NEW DROP
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="px-3 py-1 bg-red-950 hover:bg-red-900 text-red-300 uppercase text-[11px]"
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Product Table */}
            <div className="bg-neutral-950 border border-neutral-900 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-900 text-neutral-400 uppercase">
                  <tr>
                    <th className="p-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.length === adminFilteredProducts.length && adminFilteredProducts.length > 0}
                        onChange={handleSelectAllProducts}
                      />
                    </th>
                    <th className="p-3">PIECE</th>
                    <th className="p-3">CATEGORY</th>
                    <th className="p-3">PRICE</th>
                    <th className="p-3">STOCK</th>
                    <th className="p-3">FLAGS</th>
                    <th className="p-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {adminFilteredProducts.map(prod => (
                    <tr key={prod.id} className="hover:bg-neutral-900/40">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(prod.id)}
                          onChange={() => handleToggleSelectProduct(prod.id)}
                        />
                      </td>
                      <td className="p-3 flex items-center gap-3">
                        <div className="w-12 h-14 bg-neutral-900 border border-neutral-800 flex-shrink-0 overflow-hidden">
                          <SafeImage
                            src={prod.images[0]}
                            alt={prod.name}
                            containerClassName="w-full h-full"
                            aspectRatio="auto"
                          />
                        </div>
                        <div>
                          <p className="font-display font-bold text-sm text-white uppercase">{prod.name}</p>
                          <p className="text-neutral-500 text-[11px]">SKU: {prod.sku}</p>
                        </div>
                      </td>
                      <td className="p-3 uppercase">
                        <span className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 text-[10px]">
                          {categories.find(c => c.slug.toLowerCase() === prod.category.toLowerCase())?.name || prod.category}
                        </span>
                      </td>
                      <td className="p-3 font-tech font-bold text-white">
                        {prod.category === 'posters' ? 'From ' : ''}৳{prod.price.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className={`font-bold ${prod.stock <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {prod.stock} units
                        </span>
                      </td>
                      <td className="p-3 space-x-1">
                        {prod.isNewDrop && (
                          <span className="px-1.5 py-0.5 bg-red-950 text-red-400 text-[10px] font-bold">
                            NEW
                          </span>
                        )}
                        {prod.isFeatured && (
                          <span className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] font-bold">
                            FEAT
                          </span>
                        )}
                        {prod.isPublished === false && (
                          <span className="px-1.5 py-0.5 bg-neutral-800 text-neutral-500 text-[10px]">
                            UNPUBLISHED
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openEditProductModal(prod)}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-white"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicateProduct(prod.id)}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                          title="Duplicate Product"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id, prod.name)}
                          className="p-1.5 bg-neutral-800 hover:bg-red-900 text-red-400"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: CATEGORIES MANAGEMENT */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-900">
              <div>
                <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  DYNAMIC CATEGORIES
                </h1>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  MANAGE PRODUCT TAXONOMY, SLUGS & VARIANT ARCHITECTURES (CLOTHING, POSTERS, STANDARD)
                </p>
              </div>
              <button
                onClick={openAddCategoryModal}
                className="px-5 py-2.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-tech font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 self-start"
              >
                <Plus className="w-4 h-4" />
                CREATE CATEGORY
              </button>
            </div>

            {categoryError && (
              <div className="p-4 bg-red-950/60 border border-red-900 text-red-200 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{categoryError}</span>
              </div>
            )}

            <div className="bg-neutral-950 border border-neutral-900 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-900 text-neutral-400 uppercase">
                  <tr>
                    <th className="p-3 w-16 text-center">ORDER</th>
                    <th className="p-3">CATEGORY NAME</th>
                    <th className="p-3">SLUG / URL</th>
                    <th className="p-3">ARCHITECTURE</th>
                    <th className="p-3">ACTIVE PIECES</th>
                    <th className="p-3 text-center">STATUS</th>
                    <th className="p-3">DESCRIPTION</th>
                    <th className="p-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {categories.map((cat, idx) => {
                    const prodCount = DatabaseService.getCategoryProductCount(cat.slug);
                    return (
                      <tr key={cat.id} className="hover:bg-neutral-900/50">
                        {/* Reordering Controls */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveCategoryUp(idx)}
                              disabled={idx === 0}
                              className="p-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-20"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveCategoryDown(idx)}
                              disabled={idx === categories.length - 1}
                              className="p-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-20"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="p-3">
                          <p className="font-bold text-white font-tech text-sm uppercase">{cat.name}</p>
                          <span className="text-[10px] text-neutral-500 font-mono">ID: {cat.id}</span>
                        </td>
                        <td className="p-3 text-neutral-300">
                          <code className="text-[#e11d48] bg-neutral-900 px-1.5 py-0.5 border border-neutral-800">
                            #{cat.slug}
                          </code>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                            cat.variantType === 'clothing'
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                              : cat.variantType === 'posters'
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-800'
                              : 'bg-neutral-900 text-neutral-300 border border-neutral-800'
                          }`}>
                            {cat.variantType === 'clothing'
                              ? 'Clothing (Sizes & Colors)'
                              : cat.variantType === 'posters'
                              ? 'Posters (Physical Dims)'
                              : 'Standard Catalog'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`font-bold ${prodCount > 0 ? 'text-white' : 'text-neutral-500'}`}>
                            {prodCount} piece{prodCount === 1 ? '' : 's'}
                          </span>
                        </td>

                        {/* Enable/Disable Toggle */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryActive(cat)}
                            className={`px-3 py-1 text-[11px] font-mono font-bold uppercase border transition-colors ${
                              cat.isActive !== false
                                ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                            }`}
                            title="Toggle public visibility in customer menu"
                          >
                            {cat.isActive !== false ? 'ACTIVE' : 'DISABLED'}
                          </button>
                        </td>

                        <td className="p-3 text-neutral-400 max-w-xs truncate">
                          {cat.description || '—'}
                        </td>
                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => openEditCategoryModal(cat)}
                            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-white"
                            title="Edit Category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 bg-neutral-800 hover:bg-red-950 text-red-400"
                            title="Delete Category (Requires 0 products)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ORDERS MANAGEMENT (WITH COURIER FULFILLMENT & NOTIFICATIONS) */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-neutral-900">
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                ORDERS FULFILLMENT
              </h1>
              <p className="text-xs font-mono text-neutral-400 mt-1">
                VIEW CUSTOMER DETAILS, ASSIGN COURIER WAYBILLS & NOTIFY CUSTOMER
              </p>
            </div>

            {/* Order Filter Pills */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-950 border border-neutral-900">
              {[
                { id: 'all', label: 'ALL ORDERS', count: orders.length },
                { id: 'pending_verification', label: 'PENDING VERIFICATION', count: metrics.pendingVerificationCount, isAlert: metrics.pendingVerificationCount > 0 },
                { id: 'pending', label: 'PENDING (COD)', count: orders.filter(o => o.orderStatus === 'pending' && o.paymentStatus !== 'pending_verification').length },
                { id: 'confirmed', label: 'CONFIRMED', count: orders.filter(o => o.orderStatus === 'confirmed').length },
                { id: 'shipped', label: 'SHIPPED', count: orders.filter(o => o.orderStatus === 'shipped').length },
                { id: 'delivered', label: 'DELIVERED', count: orders.filter(o => o.orderStatus === 'delivered').length },
                { id: 'cancelled', label: 'CANCELLED', count: orders.filter(o => o.orderStatus === 'cancelled').length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setOrderFilterTab(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors flex items-center gap-1.5 ${
                    orderFilterTab === tab.id
                      ? 'bg-[#e11d48] text-white'
                      : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      (tab as any).isAlert ? 'bg-amber-400 text-black font-bold animate-pulse' : 'bg-black/50 text-neutral-300'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="bg-neutral-950 border border-neutral-900 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-900 text-neutral-400 uppercase">
                  <tr>
                    <th className="p-3">ORDER</th>
                    <th className="p-3">CUSTOMER & PHONE</th>
                    <th className="p-3">LOCATION</th>
                    <th className="p-3">PAYMENT STATUS & TRX</th>
                    <th className="p-3">TOTAL</th>
                    <th className="p-3">ORDER STATUS</th>
                    <th className="p-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {adminFilteredOrders.map(ord => (
                    <tr key={ord.id} className={`hover:bg-neutral-900/50 ${ord.paymentStatus === 'pending_verification' ? 'bg-amber-950/15' : ''}`}>
                      <td className="p-3">
                        <span className="font-bold text-white block">{ord.id}</span>
                        <span className="text-[10px] text-neutral-500">{new Date(ord.createdAt).toLocaleDateString()}</span>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-white">{ord.customerName}</p>
                        <p className="text-neutral-400">{ord.phone}</p>
                      </td>
                      <td className="p-3">
                        <span className="uppercase text-[11px] text-neutral-300">
                          {ord.district} • {ord.deliveryLocation === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="uppercase font-bold text-white flex items-center gap-1.5">
                          {ord.paymentMethod}
                          {ord.paymentMethod === 'bkash' && <span className="w-1.5 h-1.5 rounded-full bg-[#e2136e]" />}
                          {ord.paymentMethod === 'nagad' && <span className="w-1.5 h-1.5 rounded-full bg-[#f7931e]" />}
                        </p>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase block w-fit mt-1 ${
                          ord.paymentStatus === 'paid'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : ord.paymentStatus === 'pending_verification'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                            : ord.paymentStatus === 'rejected'
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : 'bg-neutral-900 text-neutral-300 border border-neutral-800'
                        }`}>
                          {ord.paymentStatus === 'pending_verification' ? 'PENDING VERIFICATION' : ord.paymentStatus.toUpperCase()}
                        </span>
                        {ord.paymentReferenceId && (
                          <p className="text-[10px] text-neutral-400 font-mono mt-1">
                            TRX: <strong className="text-white">{ord.paymentReferenceId}</strong>
                          </p>
                        )}
                        {ord.isDuplicateTrx && (
                          <span className="text-[9px] text-red-400 font-bold uppercase block mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            DUPLICATE TRX
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-tech font-bold text-white text-sm">৳{ord.total.toLocaleString()}</td>
                      <td className="p-3">
                        <select
                          value={ord.orderStatus}
                          onChange={(e) => {
                            DatabaseService.updateOrderStatus(ord.id, e.target.value as OrderStatus);
                            refreshData();
                          }}
                          className="bg-neutral-900 text-xs font-mono text-white border border-neutral-800 px-2 py-1 focus:outline-none"
                        >
                          <option value="pending">PENDING</option>
                          <option value="confirmed">CONFIRMED</option>
                          <option value="processing">PROCESSING</option>
                          <option value="shipped">SHIPPED</option>
                          <option value="delivered">DELIVERED</option>
                          <option value="cancelled">CANCELLED</option>
                          <option value="refund_requested">EXCHANGE REQ</option>
                          <option value="refunded">REFUNDED</option>
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedOrder(ord);
                            setCourierNameInput(ord.courierName || 'Steadfast Courier');
                            setTrackingNumberInput(ord.courierTrackingNumber || '');
                            setTrackingUrlInput(ord.courierTrackingUrl || '');
                            setVerificationNote(ord.verificationNote || 'Transaction verified against merchant account.');
                          }}
                          className={`px-3 py-1 font-bold text-[10px] uppercase transition-colors ${
                            ord.paymentStatus === 'pending_verification'
                              ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg font-tech font-black tracking-wider'
                              : 'bg-neutral-800 hover:bg-[#e11d48] text-white'
                          }`}
                        >
                          {ord.paymentStatus === 'pending_verification' ? 'VERIFY PAYMENT' : 'DETAILS'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {adminFilteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-neutral-500 font-mono">
                        No orders matching filter &quot;{orderFilterTab.replace('_', ' ').toUpperCase()}&quot;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: INVENTORY CONTROLLER */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-neutral-900">
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                INVENTORY CONTROLLER
              </h1>
              <p className="text-xs font-mono text-neutral-400 mt-1">
                INSTANT STOCK UPDATES PER PIECE & VARIANT
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(prod => (
                <div key={prod.id} className="bg-neutral-950 border border-neutral-900 p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-14 h-16 bg-neutral-900 border border-neutral-800 overflow-hidden flex-shrink-0">
                      <SafeImage
                        src={prod.images[0]}
                        alt={prod.name}
                        containerClassName="w-full h-full"
                        aspectRatio="auto"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-bold text-xs uppercase text-white truncate">
                        {prod.name}
                      </h4>
                      <p className="text-[11px] font-mono text-neutral-500">{prod.sku}</p>
                      <span className={`inline-block mt-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 ${
                        prod.stock <= 0
                          ? 'bg-neutral-900 text-neutral-500 border border-neutral-800'
                          : prod.stock <= 5
                          ? 'bg-amber-950 text-amber-400 border border-amber-900'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                      }`}>
                        {prod.stock <= 0 ? 'OUT OF STOCK' : prod.stock <= 5 ? 'LOW STOCK' : 'IN STOCK'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Stock Updater */}
                  <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
                    <span className="text-xs font-mono text-neutral-400">STOCK UNITS:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        defaultValue={prod.stock}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            DatabaseService.updateProductStock(prod.id, val);
                            refreshData();
                          }
                        }}
                        className="w-16 bg-neutral-900 border border-neutral-800 text-center text-xs font-mono text-white py-1 focus:outline-none focus:border-[#e11d48]"
                      />
                      <span className="text-[10px] font-mono text-neutral-500">Auto-saves</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: REVIEWS MANAGEMENT & HOMEPAGE CURATION */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-900">
              <div>
                <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  CUSTOMER REVIEWS & HOMEPAGE CURATION
                </h1>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  MODERATE SUBMITTED VOICES & TOGGLE EDITORIAL DISPLAY ON HOMEPAGE
                </p>
              </div>
              <div className="text-xs font-mono text-neutral-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e11d48]" />
                <span>
                  HOMEPAGE FEATURED:{' '}
                  <strong className="text-white">
                    {adminReviews.filter(r => r.featuredOnHomepage).length}
                  </strong>{' '}
                  {adminReviews.filter(r => r.featuredOnHomepage).length > 1
                    ? '(CAROUSEL ACTIVE)'
                    : adminReviews.filter(r => r.featuredOnHomepage).length === 1
                    ? '(SINGLE CARD)'
                    : '(HIDDEN)'}
                </span>
              </div>
            </div>

            {/* Explanation card */}
            <div className="p-4 bg-neutral-950 border border-neutral-800/80 text-xs font-mono text-neutral-300 space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold">
                <HssStarIcon className="w-4 h-4 text-[#e11d48]" />
                <span>HOMEPAGE CAROUSEL CONTROL RULE</span>
              </div>
              <p className="text-neutral-400 font-sans">
                Only reviews explicitly toggled to <strong className="text-emerald-400">ON HOMEPAGE</strong> appear on the public storefront. When 2 or more reviews are selected, they automatically transform into an editorial carousel with smooth navigation. You can select or change featured reviews at any time.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 p-2 bg-neutral-950 border border-neutral-900">
              {[
                { id: 'all', label: 'ALL REVIEWS', count: adminReviews.length },
                { id: 'featured', label: '★ FEATURED ON HOMEPAGE', count: adminReviews.filter(r => r.featuredOnHomepage).length, isSpecial: true },
                { id: 'pending', label: 'PENDING MODERATION', count: adminReviews.filter(r => r.status === 'pending').length, isAlert: adminReviews.filter(r => r.status === 'pending').length > 0 },
                { id: 'approved', label: 'APPROVED', count: adminReviews.filter(r => r.status === 'approved').length },
                { id: 'rejected', label: 'REJECTED', count: adminReviews.filter(r => r.status === 'rejected').length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setReviewFilterTab(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors flex items-center gap-1.5 ${
                    reviewFilterTab === tab.id
                      ? 'bg-[#e11d48] text-white'
                      : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      (tab as any).isAlert
                        ? 'bg-amber-400 text-black font-bold animate-pulse'
                        : (tab as any).isSpecial
                        ? 'bg-emerald-500 text-black font-bold'
                        : 'bg-black/50 text-neutral-300'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Reviews List / Table */}
            <div className="bg-neutral-950 border border-neutral-900 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-900 text-neutral-400 uppercase">
                  <tr>
                    <th className="p-3">PIECE & RATING</th>
                    <th className="p-3">CUSTOMER</th>
                    <th className="p-3">REVIEW COMMENT</th>
                    <th className="p-3">REACTIONS</th>
                    <th className="p-3 text-center">FEATURE ON HOMEPAGE</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {filteredAdminReviews.map(rev => (
                    <tr key={rev.id} className="hover:bg-neutral-900/40">
                      <td className="p-3">
                        <p className="font-bold text-white uppercase text-xs truncate max-w-[180px]">
                          {rev.productName}
                        </p>
                        <div className="flex items-center gap-1 text-amber-400 mt-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${s <= rev.rating ? 'fill-current text-amber-400' : 'text-neutral-700'}`}
                            />
                          ))}
                          <span className="text-[10px] text-neutral-400 ml-1">({rev.rating}/5)</span>
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <p className="font-semibold text-white">{rev.customerName}</p>
                        {rev.isVerifiedPurchase && (
                          <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-bold uppercase mt-0.5">
                            <CheckCircle2 className="w-3 h-3" /> VERIFIED PURCHASE
                          </span>
                        )}
                        <span className="block text-[10px] text-neutral-500 mt-0.5">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="p-3 max-w-xs sm:max-w-sm">
                        <p className="text-neutral-300 font-sans line-clamp-2 text-xs italic">
                          &ldquo;{rev.comment}&rdquo;
                        </p>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-300 font-mono">
                          <Heart className="w-3.5 h-3.5 text-[#e11d48] fill-current" />
                          <span>{rev.loveCount || 0}</span>
                        </span>
                      </td>

                      {/* FEATURE ON HOMEPAGE TOGGLE */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleReviewFeatured(rev.id)}
                          className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all border ${
                            rev.featuredOnHomepage
                              ? 'bg-emerald-950 border-emerald-700 text-emerald-300 shadow-md ring-1 ring-emerald-500/50'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                          }`}
                        >
                          {rev.featuredOnHomepage ? '★ ON HOMEPAGE' : '☆ HOMEPAGE OFF'}
                        </button>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <select
                          value={rev.status}
                          onChange={(e) => handleUpdateReviewStatus(rev.id, e.target.value as ReviewStatus)}
                          className={`bg-neutral-900 border text-xs font-mono p-1.5 focus:outline-none ${
                            rev.status === 'approved'
                              ? 'border-emerald-800 text-emerald-400'
                              : rev.status === 'rejected'
                              ? 'border-red-800 text-red-400'
                              : 'border-amber-800 text-amber-300'
                          }`}
                        >
                          <option value="approved">APPROVED</option>
                          <option value="pending">PENDING</option>
                          <option value="rejected">REJECTED / HIDDEN</option>
                        </select>
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(rev.id, rev.customerName)}
                          className="p-1.5 bg-neutral-900 hover:bg-red-950 text-red-400 border border-neutral-800"
                          title="Delete Review"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAdminReviews.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-neutral-500 font-mono">
                        No reviews matching filter &quot;{reviewFilterTab.toUpperCase()}&quot;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: COUPONS & PROMOTIONS */}
        {activeTab === 'coupons' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-900">
              <div>
                <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  COUPONS & PROMOTIONS
                </h1>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  SERVER-SIDE VALIDATED DISCOUNT CODES & USAGE LIMITS
                </p>
              </div>
              <button
                onClick={() => setIsCouponModalOpen(true)}
                className="px-5 py-2.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-tech font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                CREATE COUPON
              </button>
            </div>

            <div className="bg-neutral-950 border border-neutral-900 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-900 text-neutral-400 uppercase">
                  <tr>
                    <th className="p-3">PROMO CODE</th>
                    <th className="p-3">DISCOUNT VALUE</th>
                    <th className="p-3">MIN ORDER</th>
                    <th className="p-3">USAGE (USED / LIMIT)</th>
                    <th className="p-3">FIRST ORDER ONLY</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {coupons.map(cpn => (
                    <tr key={cpn.id} className="hover:bg-neutral-900/50">
                      <td className="p-3 font-bold text-white font-tech text-sm">{cpn.code}</td>
                      <td className="p-3 text-emerald-400 font-bold">
                        {cpn.type === 'percentage' ? `${cpn.value}% OFF` : `৳${cpn.value} FLAT`}
                      </td>
                      <td className="p-3">
                        {cpn.minOrderValue ? `৳${cpn.minOrderValue.toLocaleString()}` : 'None'}
                      </td>
                      <td className="p-3">
                        {cpn.usedCount} / {cpn.usageLimit || '∞'}
                      </td>
                      <td className="p-3">
                        {cpn.firstOrderOnly ? 'YES' : 'NO'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                          cpn.isActive ? 'bg-emerald-950 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                        }`}>
                          {cpn.isActive ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            DatabaseService.saveCoupon({ ...cpn, isActive: !cpn.isActive });
                            refreshData();
                          }}
                          className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px]"
                        >
                          TOGGLE
                        </button>
                        <button
                          onClick={() => {
                            DatabaseService.deleteCoupon(cpn.id);
                            refreshData();
                          }}
                          className="px-2 py-1 bg-red-950 hover:bg-red-900 text-red-300 text-[10px]"
                        >
                          DELETE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: CUSTOMERS MANAGEMENT */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-neutral-900">
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                CUSTOMER DIRECTORY
              </h1>
              <p className="text-xs font-mono text-neutral-400 mt-1">
                REGISTERED CLIENTS, GUEST PROFILES & LIFETIME VALUE
              </p>
            </div>

            <div className="bg-neutral-950 border border-neutral-900 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-900 text-neutral-400 uppercase">
                  <tr>
                    <th className="p-3">NAME & EMAIL</th>
                    <th className="p-3">PHONE</th>
                    <th className="p-3">SAVED ADDRESSES</th>
                    <th className="p-3">WISHLIST</th>
                    <th className="p-3">JOINED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {customers.map(cust => (
                    <tr key={cust.id} className="hover:bg-neutral-900/50">
                      <td className="p-3">
                        <p className="font-bold text-white">{cust.fullName}</p>
                        <p className="text-neutral-500">{cust.email}</p>
                      </td>
                      <td className="p-3 text-white">{cust.phone}</td>
                      <td className="p-3 text-neutral-300">
                        {cust.savedAddresses.length} saved
                      </td>
                      <td className="p-3 text-[#e11d48] font-bold">
                        {cust.wishlist.length} pieces
                      </td>
                      <td className="p-3 text-neutral-500">
                        {new Date(cust.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-neutral-500">
                        No registered customers yet. Guest orders are visible in Orders.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: ABANDONED CARTS */}
        {activeTab === 'abandoned' && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-neutral-900">
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                ABANDONED SHOPPING CARTS
              </h1>
              <p className="text-xs font-mono text-neutral-400 mt-1">
                INSPECT UNCONVERTED BAGS FOR RECOVERY & INVENTORY PLANNING
              </p>
            </div>

            <div className="bg-neutral-950 border border-neutral-900 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-900 text-neutral-400 uppercase">
                  <tr>
                    <th className="p-3">SESSION ID</th>
                    <th className="p-3">ITEMS IN BAG</th>
                    <th className="p-3">BAG VALUE</th>
                    <th className="p-3">LAST ACTIVITY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {abandonedCarts.map(cart => (
                    <tr key={cart.id} className="hover:bg-neutral-900/50">
                      <td className="p-3 font-bold text-white">{cart.sessionId}</td>
                      <td className="p-3">
                        {cart.items.map((i, idx) => (
                          <span key={idx} className="block text-neutral-300">
                            {i.name} ({i.quantity})
                          </span>
                        ))}
                      </td>
                      <td className="p-3 font-tech font-bold text-[#e11d48]">
                        ৳{cart.subtotal.toLocaleString()}
                      </td>
                      <td className="p-3 text-neutral-500">
                        {new Date(cart.updatedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                  {abandonedCarts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-neutral-500">
                        No active abandoned carts recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: CONTENT / CMS (TOTAL STOREFRONT CONTENT CONTROL) */}
        {activeTab === 'cms' && (
          <div className="space-y-6 max-w-5xl">
            {/* Top CMS Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-900">
              <div>
                <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  WEBSITE CONTENT / CMS
                </h1>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  MANAGE ALL STOREFRONT COPY, HERO CAMPAIGN, POLICIES & NOTICES WITHOUT TOUCHING CODE
                </p>
              </div>

              {/* Action Buttons: Save Draft, Preview, Publish, Reset */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraftCms}
                  className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white font-tech text-xs uppercase tracking-wider transition-colors"
                >
                  SAVE DRAFT
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateCustomer('home')}
                  className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white font-tech text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  PREVIEW STORE
                </button>
                <button
                  type="button"
                  onClick={handlePublishCms}
                  className="px-5 py-2 bg-[#e11d48] hover:bg-[#be123c] text-white font-tech font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-1.5 shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  PUBLISH TO LIVE SITE
                </button>
                <button
                  type="button"
                  onClick={handleResetCmsToDefaults}
                  className="p-2 text-neutral-500 hover:text-neutral-300"
                  title="Reset to default brand content"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CMS Feedback Banner */}
            {cmsFeedback && (
              <div className={`p-3.5 border text-xs font-mono flex items-center gap-2 ${
                cmsFeedback.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-300'
              }`}>
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{cmsFeedback.text}</span>
              </div>
            )}

            {/* Organized Sub-Navigation Tabs */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-950 border border-neutral-900">
              {[
                { id: 'homepage', label: 'HOMEPAGE' },
                { id: 'navigation', label: 'NAVIGATION' },
                { id: 'footer', label: 'FOOTER' },
                { id: 'about', label: 'ABOUT PAGE' },
                { id: 'policies', label: 'POLICIES & LEGAL' },
                { id: 'sizeGuide', label: 'SIZE GUIDE' },
                { id: 'contact', label: 'CONTACT PAGE' },
                { id: 'checkout', label: 'CHECKOUT & NOTICES' },
                { id: 'emptyStates', label: 'EMPTY & ERROR STATES' }
              ].map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setCmsSubTab(sub.id as any)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors ${
                    cmsSubTab === sub.id
                      ? 'bg-[#e11d48] text-white shadow-sm'
                      : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* SUBTAB 1: HOMEPAGE CMS */}
            {cmsSubTab === 'homepage' && (
              <div className="space-y-6">
                {/* Announcement Bar */}
                <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-sm uppercase text-white">
                      TOP ANNOUNCEMENT BAR
                    </h3>
                    <label className="flex items-center gap-2 text-xs font-mono text-neutral-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cmsContent.homepage.showAnnouncement}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, showAnnouncement: e.target.checked }
                          })
                        }
                        className="rounded-none bg-neutral-900 border-neutral-700 text-[#e11d48]"
                      />
                      ACTIVE
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      Announcement Banner Copy
                    </label>
                    <input
                      type="text"
                      value={cmsContent.homepage.announcementText}
                      onChange={(e) =>
                        setCmsContent({
                          ...cmsContent,
                          homepage: { ...cmsContent.homepage, announcementText: e.target.value }
                        })
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                    />
                  </div>
                </div>

                {/* Hero Campaign */}
                <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-sm uppercase text-white">
                      HERO SECTION COPY & CTAS
                    </h3>
                    <label className="flex items-center gap-2 text-xs font-mono text-neutral-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cmsContent.homepage.showHero}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, showHero: e.target.checked }
                          })
                        }
                        className="rounded-none bg-neutral-900 border-neutral-700 text-[#e11d48]"
                      />
                      SHOW HERO
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Hero Eyebrow / Label
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.heroEyebrow}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, heroEyebrow: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Hero Main Heading
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.heroTitle}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, heroTitle: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Hero Subtitle
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.heroSubtitle}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, heroSubtitle: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Hero Campaign Image URL
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.heroImage}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, heroImage: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Hero Description Paragraph
                      </label>
                      <textarea
                        rows={2}
                        value={cmsContent.homepage.heroDescription}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, heroDescription: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Primary CTA Label
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.heroCtaText}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, heroCtaText: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Secondary CTA Label
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.heroSecondaryCtaText}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, heroSecondaryCtaText: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* New Drops & Featured Headings */}
                <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                  <h3 className="font-display font-bold text-sm uppercase text-white">
                    PRODUCT SECTIONS HEADINGS
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        New Drops Eyebrow
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.newDropsEyebrow}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, newDropsEyebrow: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        New Drops Title
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.newDropsTitle}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, newDropsTitle: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Featured Section Eyebrow
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.featuredEyebrow}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, featuredEyebrow: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Featured Section Title
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.featuredTitle}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, featuredTitle: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Editorial Lookbook Banner */}
                <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-sm uppercase text-white">
                      EDITORIAL LOOKBOOK BANNER
                    </h3>
                    <label className="flex items-center gap-2 text-xs font-mono text-neutral-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cmsContent.homepage.showEditorial}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, showEditorial: e.target.checked }
                          })
                        }
                        className="rounded-none bg-neutral-900 border-neutral-700 text-[#e11d48]"
                      />
                      SHOW EDITORIAL BANNER
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                          Heading Line 1
                        </label>
                        <input
                          type="text"
                          value={cmsContent.homepage.editorialTitle}
                          onChange={(e) =>
                            setCmsContent({
                              ...cmsContent,
                              homepage: { ...cmsContent.homepage, editorialTitle: e.target.value }
                            })
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                          Heading Highlight (Red Accent)
                        </label>
                        <input
                          type="text"
                          value={cmsContent.homepage.editorialHighlight}
                          onChange={(e) =>
                            setCmsContent({
                              ...cmsContent,
                              homepage: { ...cmsContent.homepage, editorialHighlight: e.target.value }
                            })
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Editorial Manifesto Text
                      </label>
                      <textarea
                        rows={3}
                        value={cmsContent.homepage.editorialText}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, editorialText: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Newsletter & Instagram Section */}
                <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                  <h3 className="font-display font-bold text-sm uppercase text-white">
                    NEWSLETTER & SOCIAL SECTION
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Newsletter Title
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.newsletterTitle}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, newsletterTitle: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                        Newsletter Button CTA
                      </label>
                      <input
                        type="text"
                        value={cmsContent.homepage.newsletterCtaText}
                        onChange={(e) =>
                          setCmsContent({
                            ...cmsContent,
                            homepage: { ...cmsContent.homepage, newsletterCtaText: e.target.value }
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 2: NAVIGATION */}
            {cmsSubTab === 'navigation' && (
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  NAVIGATION MENU LABELS
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Home Menu Label</label>
                    <input
                      type="text"
                      value={cmsContent.navigation.menuHome}
                      onChange={e => setCmsContent({ ...cmsContent, navigation: { ...cmsContent.navigation, menuHome: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Shop Menu Label</label>
                    <input
                      type="text"
                      value={cmsContent.navigation.menuShop}
                      onChange={e => setCmsContent({ ...cmsContent, navigation: { ...cmsContent.navigation, menuShop: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">New Drops Menu Label</label>
                    <input
                      type="text"
                      value={cmsContent.navigation.menuNewDrops}
                      onChange={e => setCmsContent({ ...cmsContent, navigation: { ...cmsContent.navigation, menuNewDrops: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Categories Menu Label</label>
                    <input
                      type="text"
                      value={cmsContent.navigation.menuCategories}
                      onChange={e => setCmsContent({ ...cmsContent, navigation: { ...cmsContent.navigation, menuCategories: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">About Menu Label</label>
                    <input
                      type="text"
                      value={cmsContent.navigation.menuAbout}
                      onChange={e => setCmsContent({ ...cmsContent, navigation: { ...cmsContent.navigation, menuAbout: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 3: FOOTER */}
            {cmsSubTab === 'footer' && (
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  FOOTER BRANDING & LABELS
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Brand Name</label>
                    <input
                      type="text"
                      value={cmsContent.footer.brandName}
                      onChange={e => setCmsContent({ ...cmsContent, footer: { ...cmsContent.footer, brandName: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Brand Narrative / Statement</label>
                    <textarea
                      rows={2}
                      value={cmsContent.footer.brandDescription}
                      onChange={e => setCmsContent({ ...cmsContent, footer: { ...cmsContent.footer, brandDescription: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">EST Detail Text</label>
                      <input
                        type="text"
                        value={cmsContent.footer.estText}
                        onChange={e => setCmsContent({ ...cmsContent, footer: { ...cmsContent.footer, estText: e.target.value } })}
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Copyright Text</label>
                      <input
                        type="text"
                        value={cmsContent.footer.copyrightText}
                        onChange={e => setCmsContent({ ...cmsContent, footer: { ...cmsContent.footer, copyrightText: e.target.value } })}
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 4: ABOUT PAGE */}
            {cmsSubTab === 'about' && (
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  ABOUT PAGE STORY & MANIFESTO
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Hero Title</label>
                      <input
                        type="text"
                        value={cmsContent.about.heroTitle}
                        onChange={e => setCmsContent({ ...cmsContent, about: { ...cmsContent.about, heroTitle: e.target.value } })}
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Hero Eyebrow</label>
                      <input
                        type="text"
                        value={cmsContent.about.heroEyebrow}
                        onChange={e => setCmsContent({ ...cmsContent, about: { ...cmsContent.about, heroEyebrow: e.target.value } })}
                        className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">01 • The Genesis (Story Paragraph 1)</label>
                    <textarea
                      rows={3}
                      value={cmsContent.about.genesisPara1}
                      onChange={e => setCmsContent({ ...cmsContent, about: { ...cmsContent.about, genesisPara1: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">02 • The Dual Medium (Story Paragraph 2)</label>
                    <textarea
                      rows={3}
                      value={cmsContent.about.dualMediumPara1}
                      onChange={e => setCmsContent({ ...cmsContent, about: { ...cmsContent.about, dualMediumPara1: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">The Signature Star Manifesto Text</label>
                    <textarea
                      rows={2}
                      value={cmsContent.about.starText}
                      onChange={e => setCmsContent({ ...cmsContent, about: { ...cmsContent.about, starText: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 5: POLICIES */}
            {cmsSubTab === 'policies' && (
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  STORE POLICIES & LEGAL
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Shipping & Packaging Policy</label>
                    <textarea
                      rows={4}
                      value={settings.shippingPolicy}
                      onChange={e => setSettings({ ...settings, shippingPolicy: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Return & 4-Day Exchange Policy</label>
                    <textarea
                      rows={4}
                      value={settings.returnPolicy}
                      onChange={e => setSettings({ ...settings, returnPolicy: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Privacy Policy</label>
                    <textarea
                      rows={3}
                      value={settings.privacyPolicy}
                      onChange={e => setSettings({ ...settings, privacyPolicy: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 6: SIZE GUIDE */}
            {cmsSubTab === 'sizeGuide' && (
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  SIZE GUIDE MODAL CONTENT
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Modal Title</label>
                    <input
                      type="text"
                      value={cmsContent.sizeGuide.title}
                      onChange={e => setCmsContent({ ...cmsContent, sizeGuide: { ...cmsContent.sizeGuide, title: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Instructions Paragraph</label>
                    <textarea
                      rows={2}
                      value={cmsContent.sizeGuide.instructions}
                      onChange={e => setCmsContent({ ...cmsContent, sizeGuide: { ...cmsContent.sizeGuide, instructions: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Editorial Fit Guide Note</label>
                    <textarea
                      rows={2}
                      value={cmsContent.sizeGuide.fitNote}
                      onChange={e => setCmsContent({ ...cmsContent, sizeGuide: { ...cmsContent.sizeGuide, fitNote: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Fabric Care Instructions</label>
                    <textarea
                      rows={2}
                      value={cmsContent.sizeGuide.careNote}
                      onChange={e => setCmsContent({ ...cmsContent, sizeGuide: { ...cmsContent.sizeGuide, careNote: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 7: CONTACT PAGE */}
            {cmsSubTab === 'contact' && (
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  CONTACT PAGE INFORMATION & FORM
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Page Title</label>
                    <input
                      type="text"
                      value={cmsContent.contact.title}
                      onChange={e => setCmsContent({ ...cmsContent, contact: { ...cmsContent.contact, title: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={cmsContent.contact.subtitle}
                      onChange={e => setCmsContent({ ...cmsContent, contact: { ...cmsContent.contact, subtitle: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Primary Hotline</label>
                    <input
                      type="text"
                      value={cmsContent.contact.phonePrimary}
                      onChange={e => setCmsContent({ ...cmsContent, contact: { ...cmsContent.contact, phonePrimary: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Secondary Hotline</label>
                    <input
                      type="text"
                      value={cmsContent.contact.phoneSecondary}
                      onChange={e => setCmsContent({ ...cmsContent, contact: { ...cmsContent.contact, phoneSecondary: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 8: CHECKOUT & NOTICES */}
            {cmsSubTab === 'checkout' && (
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  CHECKOUT HEADINGS & VERIFICATION NOTICES
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Manual Verification Warning Notice</label>
                    <textarea
                      rows={2}
                      value={cmsContent.checkout.manualVerificationNotice}
                      onChange={e => setCmsContent({ ...cmsContent, checkout: { ...cmsContent.checkout, manualVerificationNotice: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Next Steps Confirmation Message</label>
                    <textarea
                      rows={2}
                      value={cmsContent.checkout.nextStepsMessage}
                      onChange={e => setCmsContent({ ...cmsContent, checkout: { ...cmsContent.checkout, nextStepsMessage: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 9: EMPTY & ERROR STATES */}
            {cmsSubTab === 'emptyStates' && (
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  EMPTY & ERROR STATES MESSAGES
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Empty Bag Title</label>
                    <input
                      type="text"
                      value={cmsContent.emptyStates.emptyBagTitle}
                      onChange={e => setCmsContent({ ...cmsContent, emptyStates: { ...cmsContent.emptyStates, emptyBagTitle: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">No Products Title</label>
                    <input
                      type="text"
                      value={cmsContent.emptyStates.noProductsTitle}
                      onChange={e => setCmsContent({ ...cmsContent, emptyStates: { ...cmsContent.emptyStates, noProductsTitle: e.target.value } })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 10: BUSINESS & STORE SETTINGS + BACKUP */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-4xl">
            <div className="pb-4 border-b border-neutral-900">
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                BUSINESS & STORE SETTINGS
              </h1>
              <p className="text-xs font-mono text-neutral-400 mt-1">
                CENTRALIZED CONTROLS FOR DELIVERY CHARGES, BKASH GATEWAY, DISASTER RECOVERY & POLICIES
              </p>
            </div>

            {/* Disaster Recovery / Backup Section */}
            <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
              <h3 className="font-display font-bold text-sm uppercase text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-[#e11d48]" />
                BACKUP & DISASTER RECOVERY
              </h3>
              <p className="text-xs text-neutral-400 font-sans">
                Export complete database records (products, variants, orders, coupons, settings) as a verified JSON archive, or restore an earlier snapshot.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-tech text-xs uppercase tracking-wider flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-[#e11d48]" />
                  DOWNLOAD DATABASE BACKUP (.JSON)
                </button>

                <input
                  type="file"
                  ref={backupImportRef}
                  onChange={handleRestoreBackup}
                  accept=".json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => backupImportRef.current?.click()}
                  className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-tech text-xs uppercase tracking-wider flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  RESTORE FROM BACKUP (.JSON)
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Delivery Rates */}
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#e11d48]" />
                  DELIVERY CHARGES (BANGLADESH)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      Inside Dhaka Delivery Charge (BDT)
                    </label>
                    <input
                      type="number"
                      value={settings.deliveryInsideDhaka}
                      onChange={(e) => setSettings({ ...settings, deliveryInsideDhaka: Number(e.target.value) })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#e11d48]"
                      required
                    />
                    <p className="text-[10px] font-mono text-neutral-500 mt-1">Current Default: ৳80</p>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      Outside Dhaka Delivery Charge (BDT)
                    </label>
                    <input
                      type="number"
                      value={settings.deliveryOutsideDhaka}
                      onChange={(e) => setSettings({ ...settings, deliveryOutsideDhaka: Number(e.target.value) })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#e11d48]"
                      required
                    />
                    <p className="text-[10px] font-mono text-neutral-500 mt-1">Current Default: ৳120</p>
                  </div>
                </div>
              </div>

              {/* Payment Methods Configuration — Manual Verification Mode & Gateways */}
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#e11d48] text-white flex items-center justify-center text-[10px] font-bold">
                      ৳
                    </span>
                    <h3 className="font-display font-bold text-sm uppercase text-white">
                      PAYMENT METHODS & VERIFICATION NUMBERS
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-2.5 py-1 border border-amber-900/60">
                    MANUAL VERIFICATION MODE ACTIVE
                  </span>
                </div>

                <div className="p-3 bg-neutral-900/60 border border-neutral-800 text-xs font-mono text-neutral-400 space-y-1">
                  <p className="text-white font-bold">TEMPORARY MANUAL VERIFICATION WORKFLOW:</p>
                  <p>
                    Because official payment gateways are pending live merchant approval, customers send payment to your configured numbers and enter their Transaction ID. Orders remain in <strong>PENDING_VERIFICATION</strong> status until you verify them.
                  </p>
                </div>

                {/* Enable/Disable Toggles for Payment Methods */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <label className="flex items-center gap-2 text-xs font-mono text-neutral-300 p-3 bg-neutral-900/50 border border-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableCod !== false}
                      onChange={e => setSettings({ ...settings, enableCod: e.target.checked })}
                      className="rounded-none bg-neutral-950 border-neutral-700 text-[#e11d48]"
                    />
                    <span>ENABLE CASH ON DELIVERY</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-mono text-neutral-300 p-3 bg-neutral-900/50 border border-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableBkash !== false}
                      onChange={e => setSettings({ ...settings, enableBkash: e.target.checked })}
                      className="rounded-none bg-neutral-950 border-neutral-700 text-[#e11d48]"
                    />
                    <span>ENABLE BKASH MANUAL</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-mono text-neutral-300 p-3 bg-neutral-900/50 border border-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableNagad !== false}
                      onChange={e => setSettings({ ...settings, enableNagad: e.target.checked })}
                      className="rounded-none bg-neutral-950 border-neutral-700 text-[#e11d48]"
                    />
                    <span>ENABLE NAGAD MANUAL</span>
                  </label>
                </div>

                {/* bKash & Nagad Account Configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      bKash Payment / Destination Number *
                    </label>
                    <input
                      type="text"
                      value={settings.bKashMerchantNumber}
                      onChange={(e) => setSettings({ ...settings, bKashMerchantNumber: e.target.value })}
                      placeholder="0187966502"
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#e11d48]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      bKash Account Type
                    </label>
                    <select
                      value={settings.bKashAccountType || 'Merchant'}
                      onChange={e => setSettings({ ...settings, bKashAccountType: e.target.value as any })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#e11d48]"
                    >
                      <option value="Merchant">Merchant Account (Payment / Merchant Pay)</option>
                      <option value="Personal">Personal Account (Send Money)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      Nagad Payment / Destination Number *
                    </label>
                    <input
                      type="text"
                      value={settings.nagadMerchantNumber}
                      onChange={(e) => setSettings({ ...settings, nagadMerchantNumber: e.target.value })}
                      placeholder="0187966502"
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#e11d48]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      Nagad Account Type
                    </label>
                    <select
                      value={settings.nagadAccountType || 'Merchant'}
                      onChange={e => setSettings({ ...settings, nagadAccountType: e.target.value as any })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#e11d48]"
                    >
                      <option value="Merchant">Merchant Account (Payment)</option>
                      <option value="Personal">Personal Account (Send Money)</option>
                    </select>
                  </div>
                </div>

                {/* SMS Notification Gateway Configuration */}
                <div className="pt-4 border-t border-neutral-900 space-y-3">
                  <h4 className="font-display font-bold text-xs uppercase text-white flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#e11d48]" />
                    MANDATORY CUSTOMER MOBILE SMS GATEWAY INTEGRATION
                  </h4>
                  <p className="text-[11px] font-mono text-neutral-400">
                    Transactional SMS notifications are sent to the customer&apos;s mobile number on order submission, manual verification approval, payment rejection, and shipping.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 mb-1">GATEWAY PROVIDER</label>
                      <select
                        value={settings.smsGatewayProvider || 'GreenWeb SMS Gateway (BD)'}
                        onChange={e => setSettings({ ...settings, smsGatewayProvider: e.target.value })}
                        className="w-full bg-neutral-900 border border-neutral-800 p-2 text-xs text-white"
                      >
                        <option value="GreenWeb SMS Gateway (BD)">GreenWeb SMS Gateway (BD)</option>
                        <option value="Reve SMS Gateway">Reve SMS Gateway</option>
                        <option value="BulkSMSBD">BulkSMSBD</option>
                        <option value="Twilio / InfoBip">Twilio / InfoBip</option>
                        <option value="Simulation / Local Audit">Development Logger / Audit Log</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 mb-1">SMS API KEY / TOKEN</label>
                      <input
                        type="password"
                        value={settings.smsApiKey || ''}
                        onChange={e => setSettings({ ...settings, smsApiKey: e.target.value })}
                        placeholder="••••••••••••"
                        className="w-full bg-neutral-900 border border-neutral-800 p-2 text-xs font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 mb-1">SENDER SENDER ID (MASKING)</label>
                      <input
                        type="text"
                        value={settings.smsSenderId || 'HSS'}
                        onChange={e => setSettings({ ...settings, smsSenderId: e.target.value })}
                        placeholder="HSS"
                        className="w-full bg-neutral-900 border border-neutral-800 p-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Identity & Contact */}
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  BUSINESS IDENTITY & SOCIALS
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={settings.businessName}
                      onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      Business Email
                    </label>
                    <input
                      type="email"
                      value={settings.businessEmail}
                      onChange={(e) => setSettings({ ...settings, businessEmail: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      Official Instagram URL
                    </label>
                    <input
                      type="url"
                      value={settings.instagramUrl}
                      onChange={(e) => setSettings({ ...settings, instagramUrl: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                    />
                  </div>
                </div>
              </div>

              {/* SECURITY & ADMINISTRATOR CREDENTIALS */}
              <div className="bg-neutral-950 border border-neutral-900 p-6 space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#e11d48]" />
                    <h3 className="font-display font-bold text-sm uppercase text-white">
                      SECURITY & ADMINISTRATOR CREDENTIALS
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 border border-emerald-900/60">
                    PBKDF2-SHA256 HASHED
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 1. Change Username */}
                  <div className="p-4 bg-neutral-900/60 border border-neutral-800 space-y-3">
                    <span className="font-display font-bold text-xs uppercase text-white block">
                      CHANGE ADMIN USERNAME
                    </span>
                    {secUserFeedback && (
                      <p className={`text-xs font-mono ${secUserFeedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {secUserFeedback.text}
                      </p>
                    )}
                    <div className="space-y-2 text-xs font-mono">
                      <div>
                        <label className="block text-neutral-400 mb-1">CURRENT PASSWORD</label>
                        <input
                          type="password"
                          value={secCurPassForUser}
                          onChange={e => setSecCurPassForUser(e.target.value)}
                          placeholder="Verify current password"
                          className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">NEW USERNAME</label>
                        <input
                          type="text"
                          value={secNewUsername}
                          onChange={e => setSecNewUsername(e.target.value)}
                          placeholder="Enter new username"
                          className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleChangeUsername}
                        className="w-full py-2 bg-neutral-800 hover:bg-[#e11d48] text-white text-xs font-tech font-bold uppercase tracking-wider transition-colors"
                      >
                        UPDATE USERNAME
                      </button>
                    </div>
                  </div>

                  {/* 2. Change Password */}
                  <div className="p-4 bg-neutral-900/60 border border-neutral-800 space-y-3">
                    <span className="font-display font-bold text-xs uppercase text-white block">
                      CHANGE ADMIN PASSWORD
                    </span>
                    {secPassFeedback && (
                      <p className={`text-xs font-mono ${secPassFeedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {secPassFeedback.text}
                      </p>
                    )}
                    <div className="space-y-2 text-xs font-mono">
                      <div>
                        <label className="block text-neutral-400 mb-1">CURRENT PASSWORD</label>
                        <input
                          type="password"
                          value={secCurPassForPass}
                          onChange={e => setSecCurPassForPass(e.target.value)}
                          placeholder="Current password"
                          className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">NEW STRONG PASSWORD</label>
                        <input
                          type="password"
                          value={secNewPassword}
                          onChange={e => setSecNewPassword(e.target.value)}
                          placeholder="Min 8 chars, upper, number, symbol"
                          className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">CONFIRM NEW PASSWORD</label>
                        <input
                          type="password"
                          value={secConfirmPassword}
                          onChange={e => setSecConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleChangePassword}
                        className="w-full py-2 bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-tech font-bold uppercase tracking-wider transition-colors"
                      >
                        UPDATE PASSWORD & RE-LOGIN
                      </button>
                    </div>
                  </div>

                  {/* 3. Change Recovery Email */}
                  <div className="p-4 bg-neutral-900/60 border border-neutral-800 space-y-3">
                    <span className="font-display font-bold text-xs uppercase text-white block">
                      CHANGE RECOVERY EMAIL
                    </span>
                    {secEmailFeedback && (
                      <p className={`text-xs font-mono ${secEmailFeedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {secEmailFeedback.text}
                      </p>
                    )}
                    <div className="space-y-2 text-xs font-mono">
                      <div>
                        <label className="block text-neutral-400 mb-1">CURRENT PASSWORD</label>
                        <input
                          type="password"
                          value={secCurPassForEmail}
                          onChange={e => setSecCurPassForEmail(e.target.value)}
                          placeholder="Current password"
                          className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">NEW RECOVERY EMAIL</label>
                        <input
                          type="email"
                          value={secNewEmail}
                          onChange={e => setSecNewEmail(e.target.value)}
                          placeholder="owner@yourdomain.com"
                          className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">CONFIRM RECOVERY EMAIL</label>
                        <input
                          type="email"
                          value={secConfirmEmail}
                          onChange={e => setSecConfirmEmail(e.target.value)}
                          placeholder="Re-enter new recovery email"
                          className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleChangeRecoveryEmail}
                        className="w-full py-2 bg-neutral-800 hover:bg-[#e11d48] text-white text-xs font-tech font-bold uppercase tracking-wider transition-colors"
                      >
                        UPDATE RECOVERY EMAIL
                      </button>
                    </div>
                  </div>

                  {/* 4. Emergency Recovery Code */}
                  <div className="p-4 bg-neutral-900/60 border border-neutral-800 space-y-3">
                    <span className="font-display font-bold text-xs uppercase text-white block">
                      EMERGENCY RECOVERY CODE
                    </span>
                    <p className="text-[11px] font-mono text-neutral-400 leading-relaxed">
                      Status: <strong className="text-emerald-400">Configured (Cryptographically Hashed)</strong>. You can generate a new one-time emergency code below. This will immediately invalidate any previous emergency code.
                    </p>
                    {secCodeFeedback && (
                      <p className={`text-xs font-mono ${secCodeFeedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {secCodeFeedback.text}
                      </p>
                    )}
                    {newGeneratedEmergencyCode ? (
                      <div className="p-3 bg-black border border-amber-800 space-y-2">
                        <span className="text-[10px] font-mono text-amber-400 font-bold block uppercase">
                          NEW ONE-TIME EMERGENCY CODE:
                        </span>
                        <div className="flex items-center justify-between">
                          <code className="font-mono text-sm font-bold text-white">
                            {newGeneratedEmergencyCode}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(newGeneratedEmergencyCode);
                              setHasCopiedNewCode(true);
                              setTimeout(() => setHasCopiedNewCode(false), 2500);
                            }}
                            className="px-2.5 py-1 bg-neutral-800 text-xs font-mono text-white"
                          >
                            {hasCopiedNewCode ? 'COPIED!' : 'COPY'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs font-mono">
                        <div>
                          <label className="block text-neutral-400 mb-1">VERIFY CURRENT PASSWORD</label>
                          <input
                            type="password"
                            value={secCurPassForCode}
                            onChange={e => setSecCurPassForCode(e.target.value)}
                            placeholder="Current password"
                            className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateNewEmergencyCode}
                          className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-tech font-bold uppercase tracking-wider transition-colors"
                        >
                          GENERATE NEW EMERGENCY CODE
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  SAVE STORE SETTINGS
                </button>
                {settingsSaved && (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Settings updated
                  </span>
                )}
              </div>
            </form>
          </div>
        )}
      </main>

      {/* 3. PRODUCT CREATE / EDIT DYNAMIC MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-3xl my-8 bg-neutral-950 border border-neutral-800 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-900">
              <div className="flex items-center gap-2 text-white">
                <HssStarIcon className="w-5 h-5 text-[#e11d48]" />
                <h2 className="font-display font-black text-xl uppercase tracking-tight">
                  {editingProductId ? 'EDIT PRODUCT PIECE' : 'ADD NEW ARCHIVAL PIECE'}
                </h2>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-neutral-500 hover:text-white p-1 font-mono text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6">
              {/* Category Selector */}
              <div className="p-4 bg-neutral-900/60 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono uppercase font-bold text-white tracking-widest">
                    PRODUCT CATEGORY: <span className="text-[#e11d48] uppercase">{categories.find(c => c.slug.toLowerCase() === pCategory.toLowerCase())?.name || pCategory}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProductModalOpen(false);
                      setActiveTab('categories');
                    }}
                    className="text-[11px] font-mono text-[#e11d48] hover:underline"
                  >
                    + MANAGE CATEGORIES
                  </button>
                </div>

                {/* Dropdown Category Selector */}
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">
                    CHOOSE DEPARTMENT CATEGORY:
                  </label>
                  <select
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-xs font-mono font-bold uppercase text-white focus:outline-none focus:border-[#e11d48]"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.slug}>
                        {cat.name.toUpperCase()} ({cat.variantType === 'clothing' ? 'Clothing Sizes & Colors' : cat.variantType === 'posters' ? 'Poster Dimensions' : 'Standard Catalog'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {categories.map(cat => {
                    const isSelected = pCategory.toLowerCase() === cat.slug.toLowerCase();
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setPCategory(cat.slug)}
                        className={`p-3 text-xs font-tech font-bold uppercase tracking-wider border transition-all text-left flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#e11d48] text-white border-[#e11d48] shadow-md'
                            : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                        }`}
                      >
                        <span className="font-bold truncate">{cat.name}</span>
                        <span className="text-[10px] font-mono opacity-80 mt-1">
                          {cat.variantType === 'clothing'
                            ? 'Sizes & Colors'
                            : cat.variantType === 'posters'
                            ? 'Physical Dimensions'
                            : 'Standard Catalog'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="e.g. Tokyo Cyber Luxury Hoodie"
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Tagline / Subheading
                  </label>
                  <input
                    type="text"
                    value={pTagline}
                    onChange={(e) => setPTagline(e.target.value)}
                    placeholder="e.g. 450 GSM Heavyweight French Terry"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={pSku}
                    onChange={(e) => setPSku(e.target.value)}
                    placeholder="e.g. HSS-CL-HD-001"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Base Price (BDT) *
                  </label>
                  <input
                    type="number"
                    value={pPrice}
                    onChange={(e) => setPPrice(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Compare-At Price (BDT, Optional strikethrough)
                  </label>
                  <input
                    type="number"
                    value={pCompareAt || ''}
                    onChange={(e) => setPCompareAt(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 3400"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Base Available Stock *
                  </label>
                  <input
                    type="number"
                    value={pStock}
                    onChange={(e) => setPStock(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                  />
                </div>

                {pCategory === 'clothing' && (
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                      Fabrication / Material
                    </label>
                    <input
                      type="text"
                      value={pFabric}
                      onChange={(e) => setPFabric(e.target.value)}
                      placeholder="e.g. 450 GSM Combed Cotton French Terry"
                      className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                    Detailed Product Description
                  </label>
                  <textarea
                    rows={3}
                    value={pDescription}
                    onChange={(e) => setPDescription(e.target.value)}
                    placeholder="Enter editorial piece narrative..."
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e11d48] resize-none"
                  />
                </div>
              </div>

              {/* REAL IMAGE UPLOADER */}
              <div className="p-4 bg-neutral-900/60 border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-xs uppercase text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#e11d48]" />
                    PRODUCT IMAGES (COMPUTER / PHONE UPLOAD & URL)
                  </h3>
                  <span className="text-[10px] font-mono text-neutral-400">
                    First image is Primary cover
                  </span>
                </div>

                {/* Upload Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-tech text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-neutral-700"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#e11d48]" />
                    UPLOAD FROM PC / PHONE
                  </button>

                  <div className="flex-1 flex gap-2">
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Or paste Cloudinary / external Image URL..."
                      className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#e11d48]"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-mono uppercase text-white"
                    >
                      ADD
                    </button>
                  </div>
                </div>

                {/* Images Preview List */}
                {pImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 pt-2">
                    {pImages.map((img, idx) => (
                      <div key={idx} className="relative group border border-neutral-800 bg-black aspect-[3/4] overflow-hidden">
                        <SafeImage
                          src={img}
                          alt={`Thumbnail ${idx}`}
                          containerClassName="w-full h-full"
                          aspectRatio="auto"
                        />
                        {idx === 0 && (
                          <span className="absolute top-1 left-1 bg-[#e11d48] text-white text-[9px] font-tech font-bold px-1.5 py-0.5 tracking-wider uppercase z-20">
                            PRIMARY
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 z-20">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => handleMakePrimaryImage(idx)}
                              className="px-2 py-0.5 bg-neutral-800 text-white text-[9px] font-mono hover:bg-[#e11d48]"
                            >
                              MAKE PRIMARY
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DYNAMIC VARIANT CONFIGURATION */}
              {/* IF CLOTHING: Show sizes & colors */}
              {(categories.find(c => c.slug.toLowerCase() === pCategory.toLowerCase())?.variantType === 'clothing' || pCategory === 'clothing') && (
                <div className="p-4 bg-neutral-900/60 border border-neutral-800 space-y-4">
                  <h3 className="font-display font-bold text-xs uppercase text-white">
                    CLOTHING SIZES & COLORS
                  </h3>

                  {/* Sizes */}
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-2">
                      Available Sizes (Check to enable)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map(sz => {
                        const isSelected = pClothingSizes.includes(sz);
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setPClothingSizes(pClothingSizes.filter(s => s !== sz));
                              } else {
                                setPClothingSizes([...pClothingSizes, sz]);
                              }
                            }}
                            className={`w-12 h-10 text-xs font-mono font-bold uppercase border transition-all ${
                              isSelected
                                ? 'bg-white text-black border-white'
                                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-600'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Colors */}
                  <div>
                    <label className="block text-xs font-mono uppercase text-neutral-400 mb-2">
                      Available Colors
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {pClothingColors.map((col, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-950 border border-neutral-800 text-xs text-white"
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-neutral-700"
                            style={{ backgroundColor: col.hex }}
                          />
                          <span>{col.name}</span>
                          <button
                            type="button"
                            onClick={() => setPClothingColors(pClothingColors.filter((_, i) => i !== idx))}
                            className="text-neutral-500 hover:text-red-400 ml-1 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newColorName}
                        onChange={(e) => setNewColorName(e.target.value)}
                        placeholder="Color name (e.g. Jet Black)"
                        className="bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-xs text-white"
                      />
                      <input
                        type="color"
                        value={newColorHex}
                        onChange={(e) => setNewColorHex(e.target.value)}
                        className="w-10 h-8 bg-transparent cursor-pointer border border-neutral-800 p-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newColorName.trim()) {
                            setPClothingColors([...pClothingColors, { name: newColorName.trim(), hex: newColorHex }]);
                            setNewColorName('');
                          }
                        }}
                        className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs font-tech text-white uppercase"
                      >
                        + ADD COLOR
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* IF POSTERS: PHYSICAL DIMENSIONS SYSTEM */}
              {(categories.find(c => c.slug.toLowerCase() === pCategory.toLowerCase())?.variantType === 'posters' || pCategory === 'posters') && (
                <div className="p-4 bg-neutral-900/60 border border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-bold text-xs uppercase text-white">
                        POSTER PHYSICAL DIMENSIONS (WIDTH × HEIGHT INCHES)
                      </h3>
                      <p className="text-[10px] font-mono text-neutral-400">
                        Posters do NOT use S/M/L. Each physical dimension has its own Price & Stock.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPosterDimension}
                      className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white font-tech text-xs uppercase"
                    >
                      + ADD DIMENSION
                    </button>
                  </div>

                  <div className="space-y-3">
                    {pPosterDimensions.map(dim => (
                      <div
                        key={dim.id}
                        className="p-3 bg-neutral-950 border border-neutral-800 grid grid-cols-2 sm:grid-cols-6 gap-2 items-center"
                      >
                        <div>
                          <label className="block text-[10px] font-mono text-neutral-400">NAME (e.g. A3)</label>
                          <input
                            type="text"
                            value={dim.name}
                            onChange={(e) => handleUpdatePosterDimension(dim.id, { name: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-neutral-400">WIDTH (IN)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={dim.width}
                            onChange={(e) => handleUpdatePosterDimension(dim.id, { width: Number(e.target.value) })}
                            className="w-full bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-neutral-400">HEIGHT (IN)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={dim.height}
                            onChange={(e) => handleUpdatePosterDimension(dim.id, { height: Number(e.target.value) })}
                            className="w-full bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-neutral-400">PRICE (BDT)</label>
                          <input
                            type="number"
                            value={dim.price}
                            onChange={(e) => handleUpdatePosterDimension(dim.id, { price: Number(e.target.value) })}
                            className="w-full bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-neutral-400">STOCK</label>
                          <input
                            type="number"
                            value={dim.stock}
                            onChange={(e) => handleUpdatePosterDimension(dim.id, { stock: Number(e.target.value) })}
                            className="w-full bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-white"
                          />
                        </div>

                        <div className="flex justify-end pt-3 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => handleRemovePosterDimension(dim.id)}
                            className="p-1.5 text-neutral-500 hover:text-red-400"
                            title="Remove dimension"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* IF STANDARD: GENERAL PRODUCT OPTIONS */}
              {categories.find(c => c.slug.toLowerCase() === pCategory.toLowerCase())?.variantType === 'standard' &&
                pCategory !== 'clothing' &&
                pCategory !== 'posters' && (
                  <div className="p-4 bg-neutral-900/60 border border-neutral-800 space-y-4">
                    <h3 className="font-display font-bold text-xs uppercase text-white">
                      STANDARD PRODUCT OPTIONS
                    </h3>
                    <p className="text-[11px] font-mono text-neutral-400">
                      Standard pieces use base price (৳{pPrice.toLocaleString()}) and stock ({pStock} units). You can optionally configure colorways below.
                    </p>

                    <div>
                      <label className="block text-xs font-mono uppercase text-neutral-400 mb-2">
                        Available Colorways (Optional)
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {pClothingColors.map((col, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-950 border border-neutral-800 text-xs text-white"
                          >
                            <span
                              className="w-3 h-3 rounded-full border border-neutral-700"
                              style={{ backgroundColor: col.hex }}
                            />
                            <span>{col.name}</span>
                            <button
                              type="button"
                              onClick={() => setPClothingColors(pClothingColors.filter((_, i) => i !== idx))}
                              className="text-neutral-500 hover:text-red-400 ml-1 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newColorName}
                          onChange={(e) => setNewColorName(e.target.value)}
                          placeholder="Color name (e.g. Matte Black)"
                          className="bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-xs text-white"
                        />
                        <input
                          type="color"
                          value={newColorHex}
                          onChange={(e) => setNewColorHex(e.target.value)}
                          className="w-10 h-8 bg-transparent cursor-pointer border border-neutral-800 p-0.5"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newColorName.trim()) {
                              setPClothingColors([...pClothingColors, { name: newColorName.trim(), hex: newColorHex }]);
                              setNewColorName('');
                            }
                          }}
                          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs font-tech text-white uppercase"
                        >
                          + ADD COLOR
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {/* Toggles */}
              <div className="flex gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-mono text-neutral-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pIsNewDrop}
                    onChange={(e) => setPIsNewDrop(e.target.checked)}
                    className="rounded-none bg-neutral-900 border-neutral-700 text-[#e11d48] focus:ring-0"
                  />
                  MARK AS NEW DROP
                </label>
                <label className="flex items-center gap-2 text-xs font-mono text-neutral-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pIsFeatured}
                    onChange={(e) => setPIsFeatured(e.target.checked)}
                    className="rounded-none bg-neutral-900 border-neutral-700 text-[#e11d48] focus:ring-0"
                  />
                  MARK AS FEATURED
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-neutral-900 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-tech text-xs uppercase"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-display font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  SAVE PRODUCT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. COUPON CREATION MODAL */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
              <h3 className="font-display font-black text-base text-white uppercase">Create Promo Coupon</h3>
              <button onClick={() => setIsCouponModalOpen(false)} className="text-neutral-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveCoupon} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-neutral-400 mb-1">PROMO CODE *</label>
                <input
                  type="text"
                  value={cpnCode}
                  onChange={e => setCpnCode(e.target.value.toUpperCase())}
                  placeholder="e.g. VIP2026"
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 p-2 text-white uppercase font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">DISCOUNT TYPE</label>
                  <select
                    value={cpnType}
                    onChange={e => setCpnType(e.target.value as any)}
                    className="w-full bg-neutral-900 border border-neutral-800 p-2 text-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed BDT (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">DISCOUNT VALUE</label>
                  <input
                    type="number"
                    value={cpnValue}
                    onChange={e => setCpnValue(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-900 border border-neutral-800 p-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">MIN ORDER (BDT)</label>
                  <input
                    type="number"
                    value={cpnMinOrder}
                    onChange={e => setCpnMinOrder(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">MAX DISCOUNT (BDT)</label>
                  <input
                    type="number"
                    value={cpnMaxDiscount || ''}
                    onChange={e => setCpnMaxDiscount(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Optional cap"
                    className="w-full bg-neutral-900 border border-neutral-800 p-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">TOTAL USAGE LIMIT</label>
                  <input
                    type="number"
                    value={cpnUsageLimit || ''}
                    onChange={e => setCpnUsageLimit(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 100"
                    className="w-full bg-neutral-900 border border-neutral-800 p-2 text-white"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="first-order-toggle"
                    checked={cpnFirstOrder}
                    onChange={e => setCpnFirstOrder(e.target.checked)}
                  />
                  <label htmlFor="first-order-toggle" className="text-neutral-400 cursor-pointer">
                    First Order Only
                  </label>
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-4 py-2 bg-neutral-900 text-neutral-400"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#e11d48] text-white font-bold"
                >
                  SAVE COUPON
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. ORDER DETAILS & COURIER FULFILLMENT MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-900">
              <div>
                <span className="text-[10px] font-mono text-[#e11d48] uppercase font-bold">CLIENT ORDER</span>
                <h3 className="font-display font-black text-xl text-white uppercase">{selectedOrder.id}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-neutral-500 hover:text-white p-1 font-mono text-lg"
              >
                ✕
              </button>
            </div>

            {/* Customer Information */}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-neutral-900/60 p-4 border border-neutral-800">
              <div>
                <span className="text-neutral-500 uppercase block">Customer Name:</span>
                <p className="text-white font-bold">{selectedOrder.customerName}</p>
                <p className="text-neutral-300 mt-1">Phone: {selectedOrder.phone}</p>
                {selectedOrder.email && <p className="text-neutral-400">Email: {selectedOrder.email}</p>}
              </div>
              <div>
                <span className="text-neutral-500 uppercase block">Delivery Address:</span>
                <p className="text-white">{selectedOrder.address}</p>
                <p className="text-neutral-400">District: {selectedOrder.district} {selectedOrder.area ? `(${selectedOrder.area})` : ''}</p>
                <p className="text-[#e11d48] font-bold mt-1 uppercase">
                  {selectedOrder.deliveryLocation === 'inside_dhaka' ? 'Inside Dhaka (৳' + selectedOrder.deliveryCharge + ')' : 'Outside Dhaka (৳' + selectedOrder.deliveryCharge + ')'}
                </p>
              </div>
            </div>

            {/* Verification Alert Banner if active */}
            {verificationFeedback && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{verificationFeedback}</span>
              </div>
            )}

            {/* MANUAL TRANSACTION VERIFICATION PANEL (FOR BKASH / NAGAD / MANUAL PAYMENT) */}
            {(selectedOrder.paymentMethod === 'bkash' || selectedOrder.paymentMethod === 'nagad') && (
              <div className={`p-4 border space-y-3.5 ${
                selectedOrder.paymentStatus === 'pending_verification'
                  ? 'bg-amber-950/30 border-amber-800/80'
                  : selectedOrder.paymentStatus === 'paid'
                  ? 'bg-emerald-950/20 border-emerald-800/70'
                  : 'bg-red-950/20 border-red-800/70'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-extrabold text-xs uppercase text-white flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${selectedOrder.paymentMethod === 'bkash' ? 'bg-[#e2136e]' : 'bg-[#f7931e]'}`} />
                      MANUAL PAYMENT VERIFICATION — {selectedOrder.paymentMethod.toUpperCase()}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                    selectedOrder.paymentStatus === 'paid'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : selectedOrder.paymentStatus === 'rejected'
                      ? 'bg-red-950 text-red-400 border border-red-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                  }`}>
                    {selectedOrder.paymentStatus === 'pending_verification' ? 'PENDING VERIFICATION' : selectedOrder.paymentStatus.toUpperCase()}
                  </span>
                </div>

                {/* Duplicate TRX ID warning banner if detected */}
                {selectedOrder.isDuplicateTrx && (
                  <div className="p-3 bg-red-950/70 border border-red-800 text-red-200 text-xs font-mono space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-red-300">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      POSSIBLE DUPLICATE TRANSACTION ID DETECTED
                    </p>
                    <p>
                      This Transaction ID (<strong>{selectedOrder.paymentReferenceId}</strong>) was already submitted in Order #{selectedOrder.duplicateWithOrderId}. Verify merchant bank statements carefully before confirming.
                    </p>
                  </div>
                )}

                {/* Amount verification: Order Total vs Customer Claim */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono bg-neutral-950 p-3 border border-neutral-800">
                  <div>
                    <span className="text-neutral-500 block text-[10px]">CUSTOMER CLAIMED TRX ID:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-white font-bold text-sm tracking-wider font-mono">
                        {selectedOrder.paymentReferenceId || 'NOT ENTERED'}
                      </span>
                      {selectedOrder.paymentReferenceId && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedOrder.paymentReferenceId!);
                            alert('Copied TRX ID: ' + selectedOrder.paymentReferenceId);
                          }}
                          className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-300 hover:text-white"
                        >
                          COPY
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">ORDER TOTAL (SERVER VERIFIED):</span>
                    <span className="text-[#e11d48] font-bold text-sm font-tech">
                      ৳{selectedOrder.total.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">DESTINATION NUMBER:</span>
                    <span className="text-white font-mono">
                      {selectedOrder.paymentMethod === 'bkash' ? settings.bKashMerchantNumber : settings.nagadMerchantNumber}
                    </span>
                  </div>
                </div>

                {/* Verification Actions for Pending State */}
                {selectedOrder.paymentStatus === 'pending_verification' ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 mb-1">
                        INTERNAL AUDIT NOTE (STORED WITH VERIFICATION LOG):
                      </label>
                      <input
                        type="text"
                        value={verificationNote}
                        onChange={e => setVerificationNote(e.target.value)}
                        placeholder="e.g. Transaction verified against merchant statement."
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleConfirmPaymentAction}
                        className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-tech font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-lg"
                      >
                        <Check className="w-4 h-4" />
                        VERIFY & CONFIRM PAYMENT
                      </button>
                      <button
                        type="button"
                        onClick={handleRejectPaymentAction}
                        className="px-4 py-2.5 bg-red-800 hover:bg-red-700 text-white font-tech font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-lg"
                      >
                        <X className="w-4 h-4" />
                        REJECT PAYMENT
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Audit trail if already verified or rejected */
                  <div className="text-[11px] font-mono text-neutral-400 space-y-1 bg-neutral-950 p-2.5 border border-neutral-900">
                    <p>
                      <strong className="text-white">Verification Record:</strong> {selectedOrder.paymentStatus.toUpperCase()} by {selectedOrder.verificationAdmin || 'Admin'} on {new Date(selectedOrder.verificationTimestamp || selectedOrder.updatedAt).toLocaleString()}
                    </p>
                    <p>
                      <strong className="text-white">Admin Audit Note:</strong> {selectedOrder.verificationNote || 'None'}
                    </p>
                    {selectedOrder.paymentStatus === 'rejected' && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleConfirmPaymentAction}
                          className="px-3 py-1 bg-neutral-800 hover:bg-emerald-700 text-white text-xs uppercase font-tech"
                        >
                          RE-VERIFY & CONFIRM AS PAID
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Courier Tracking Assignment */}
            <div className="p-4 bg-neutral-900 border border-neutral-800 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Truck className="w-4 h-4 text-[#e11d48]" />
                <h4 className="font-display font-bold text-xs uppercase">COURIER DISPATCH & NOTIFICATION</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <label className="block text-[10px] text-neutral-400 mb-1">COURIER NAME</label>
                  <select
                    value={courierNameInput}
                    onChange={e => setCourierNameInput(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                  >
                    <option value="Steadfast Courier">Steadfast Courier</option>
                    <option value="Pathao Express">Pathao Express</option>
                    <option value="RedX">RedX Logistics</option>
                    <option value="Paperfly">Paperfly</option>
                    <option value="Sundarban Courier">Sundarban Courier</option>
                    <option value="eCourier">eCourier</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 mb-1">CONSIGNMENT / WAYBILL #</label>
                  <input
                    type="text"
                    value={trackingNumberInput}
                    onChange={e => setTrackingNumberInput(e.target.value)}
                    placeholder="e.g. SF-99824"
                    className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 mb-1">TRACKING URL (OPTIONAL)</label>
                  <input
                    type="url"
                    value={trackingUrlInput}
                    onChange={e => setTrackingUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-neutral-950 border border-neutral-800 p-2 text-white"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAssignCourier}
                disabled={!trackingNumberInput.trim()}
                className="w-full py-2 bg-[#e11d48] hover:bg-[#be123c] text-white font-tech font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-40"
              >
                DISPATCH COURIER & LOG SMS NOTIFICATION
              </button>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <h4 className="font-display font-bold text-xs uppercase text-neutral-400">
                PURCHASED ITEMS ({selectedOrder.items.length})
              </h4>
              <div className="divide-y divide-neutral-900 border-y border-neutral-900">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-12 bg-neutral-900 overflow-hidden flex-shrink-0">
                        <SafeImage
                          src={item.image}
                          alt={item.name}
                          containerClassName="w-full h-full"
                          aspectRatio="auto"
                        />
                      </div>
                      <div>
                        <p className="font-bold text-white uppercase">{item.name}</p>
                        <p className="text-[11px] font-mono text-neutral-400">
                          {item.selectedSize ? `Size: ${item.selectedSize} ` : ''}
                          {item.selectedColor ? `Color: ${item.selectedColor} ` : ''}
                          {item.posterDimensions ? `Dimensions: ${item.posterDimensions} ` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-white font-tech font-bold">৳{item.lineTotal.toLocaleString()}</p>
                      <p className="text-neutral-500 text-[10px]">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total calculation */}
            <div className="text-xs font-mono space-y-1 text-right max-w-xs ml-auto">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal:</span>
                <span className="text-white">৳{selectedOrder.subtotal.toLocaleString()}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-[#e11d48] font-bold">
                  <span>
                    Discount ({selectedOrder.couponCode || 'Promo'}{selectedOrder.couponDiscountType === 'percentage' ? ` - ${selectedOrder.couponDiscountValue}%` : ''}):
                  </span>
                  <span>-৳{selectedOrder.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-neutral-400">
                <span>Delivery:</span>
                <span className="text-white">৳{selectedOrder.deliveryCharge}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-neutral-900">
                <span>Total:</span>
                <span className="text-[#e11d48]">৳{selectedOrder.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Status Change Controls */}
            <div className="pt-4 border-t border-neutral-900 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                  Update Order Status
                </label>
                <select
                  value={selectedOrder.orderStatus}
                  onChange={(e) => {
                    DatabaseService.updateOrderStatus(selectedOrder.id, e.target.value as OrderStatus);
                    setSelectedOrder({ ...selectedOrder, orderStatus: e.target.value as OrderStatus });
                    refreshData();
                  }}
                  className="w-full bg-neutral-900 border border-neutral-800 p-2 text-xs font-mono text-white"
                >
                  <option value="pending">PENDING</option>
                  <option value="confirmed">CONFIRMED</option>
                  <option value="processing">PROCESSING</option>
                  <option value="shipped">SHIPPED</option>
                  <option value="delivered">DELIVERED</option>
                  <option value="cancelled">CANCELLED</option>
                  <option value="refund_requested">EXCHANGE REQUESTED</option>
                  <option value="refunded">REFUNDED</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                  Update Payment Status
                </label>
                <select
                  value={selectedOrder.paymentStatus}
                  onChange={(e) => {
                    DatabaseService.updateOrderPaymentStatus(selectedOrder.id, e.target.value as PaymentStatus);
                    setSelectedOrder({ ...selectedOrder, paymentStatus: e.target.value as PaymentStatus });
                    refreshData();
                  }}
                  className="w-full bg-neutral-900 border border-neutral-800 p-2 text-xs font-mono text-white"
                >
                  <option value="pending">PENDING</option>
                  <option value="paid">PAID</option>
                  <option value="failed">FAILED</option>
                  <option value="cancelled">CANCELLED</option>
                </select>
              </div>
            </div>

            {/* Transactional Notification Log */}
            {selectedOrder.notificationLog && selectedOrder.notificationLog.length > 0 && (
              <div className="pt-3 border-t border-neutral-900 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-neutral-500">TRANSACTIONAL NOTIFICATION LOG</span>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {selectedOrder.notificationLog.map(log => (
                    <div key={log.id} className="text-[10px] font-mono p-1.5 bg-neutral-900 text-neutral-400 flex items-center justify-between">
                      <span>[{log.channel.toUpperCase()}] {log.message}</span>
                      <span className="text-neutral-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. CATEGORY ADD/EDIT MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
              <div className="flex items-center gap-2 text-white">
                <HssStarIcon className="w-4 h-4 text-[#e11d48]" />
                <h3 className="font-display font-black text-base uppercase">
                  {editingCategoryId ? 'EDIT CATEGORY' : 'CREATE NEW CATEGORY'}
                </h3>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-neutral-500 hover:text-white font-mono"
              >
                ✕
              </button>
            </div>

            {categoryError && (
              <div className="p-3 bg-red-950/60 border border-red-900 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{categoryError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-neutral-400 mb-1 uppercase">CATEGORY NAME *</label>
                <input
                  type="text"
                  value={catName}
                  onChange={e => {
                    setCatName(e.target.value);
                    if (!editingCategoryId) {
                      setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                    }
                  }}
                  placeholder="e.g. Accessories, Footwear, Bags, Jackets"
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-[#e11d48]"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 uppercase">URL SLUG (IDENTIFIER) *</label>
                <input
                  type="text"
                  value={catSlug}
                  onChange={e => setCatSlug(e.target.value.toLowerCase())}
                  placeholder="e.g. accessories"
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-white font-mono focus:outline-none focus:border-[#e11d48]"
                />
                <p className="text-[10px] text-neutral-500 mt-1">Used in URL and filters (e.g. #{catSlug || 'category'})</p>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 uppercase">VARIANT ARCHITECTURE</label>
                <select
                  value={catVariantType}
                  onChange={e => setCatVariantType(e.target.value as CategoryVariantType)}
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-[#e11d48]"
                >
                  <option value="standard">Standard Catalog (General Product / Base Pricing & Stock)</option>
                  <option value="clothing">Clothing System (XS–3XL Sizing & Color Options)</option>
                  <option value="posters">Poster System (Physical Dimensions: Width × Height IN)</option>
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">
                  Determines the variant options shown when creating products in this category.
                </p>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 uppercase">DESCRIPTION (OPTIONAL)</label>
                <textarea
                  rows={2}
                  value={catDescription}
                  onChange={e => setCatDescription(e.target.value)}
                  placeholder="Short department or collection note..."
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-[#e11d48] resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cat-active-check"
                  checked={catIsActive}
                  onChange={e => setCatIsActive(e.target.checked)}
                  className="rounded-none bg-neutral-900 border-neutral-700 text-[#e11d48]"
                />
                <label htmlFor="cat-active-check" className="text-neutral-300 font-bold uppercase text-[11px] cursor-pointer">
                  ENABLE CATEGORY (SHOW IN CUSTOMER NAVIGATION & FILTERS)
                </label>
              </div>

              <div className="pt-3 border-t border-neutral-900 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-neutral-900 text-neutral-400 hover:text-white"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#e11d48] hover:bg-[#be123c] text-white font-bold tracking-wider uppercase font-tech"
                >
                  SAVE CATEGORY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
