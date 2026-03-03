import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/config';

// ── Constants ──
const LICENSE_KEY_REGEX = /^GS[A-Z0-9]{3}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;
const STORAGE_KEY = 'gstate_license';
const LICENSE_CACHE_KEY = 'gstate_license_cache';
const AUTH_UID_KEY = 'gstate_auth_uid';

// All user-scoped localStorage keys that must be cleared on sign-out
// to prevent data leaking between different users in the same browser
const USER_SCOPED_KEYS = [
    STORAGE_KEY,
    LICENSE_CACHE_KEY,
    AUTH_UID_KEY,
    'userPackage',
    'profile_name',
    'profile_display_name',
    'profile_email',
    'profile_line_id',
    'profile_avatar',
    'fb_connected',
    'fb_user_name',
    'fb_user_profilePic',
    'grandstate_is_new_user',
    'isLoggedIn',
];

// ── Types ──
export interface LicenseInfo {
    id: string;
    licenseKey: string;
    package: 'free' | 'agent' | 'elite';
    maxFbSessions: number;
    expiresAt: Date;
    isActive: boolean;
    ownerName?: string;
}

export interface LicenseValidationResult {
    valid: boolean;
    error?: string;
    errorCode?: 'INVALID_FORMAT' | 'NOT_FOUND' | 'EXPIRED' | 'INACTIVE' | 'UNKNOWN';
    license?: LicenseInfo;
}

export interface AuthResult {
    success: boolean;
    error?: string;
}

// ── Helpers ──
function getCachedLicense(currentUserId?: string): LicenseInfo | null {
    try {
        const cached = localStorage.getItem(LICENSE_CACHE_KEY);
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        // If we know the current user, reject cache from a different user
        if (currentUserId && parsed._userId && parsed._userId !== currentUserId) {
            console.log('[Auth] Cached license belongs to a different user — ignoring');
            localStorage.removeItem(LICENSE_CACHE_KEY);
            return null;
        }
        if (parsed && parsed.licenseKey && parsed.package) {
            const expires = new Date(parsed.expiresAt);
            // Return even if expired — UI needs it for expired popup
            return { ...parsed, expiresAt: expires };
        }
    } catch { /* ignore */ }
    return null;
}

/** Clear all user-scoped localStorage keys */
function clearUserScopedStorage() {
    for (const key of USER_SCOPED_KEYS) {
        localStorage.removeItem(key);
    }
}

// ── Package limits ──
const packageLimits = {
    free: { postsPerDay: 10, maxGroups: 10, maxProperties: 10 },
    agent: { postsPerDay: 300, maxGroups: 300, maxProperties: Infinity },
    elite: { postsPerDay: 750, maxGroups: 750, maxProperties: Infinity },
};

// ── Context type ──
interface LicenseAuthContextValue {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    license: LicenseInfo | null;
    isLicenseActive: boolean;
    isValidating: boolean;
    isFullyReady: boolean;
    currentPackage: 'free' | 'agent' | 'elite';
    limits: { postsPerDay: number; maxGroups: number; maxProperties: number };
    daysRemaining: number | null;
    signUp: (email: string, password: string, fullName?: string, displayName?: string) => Promise<AuthResult>;
    signIn: (email: string, password: string) => Promise<AuthResult>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<AuthResult>;
    activateLicense: (key: string) => Promise<LicenseValidationResult>;
    validateKey: (key: string) => Promise<LicenseValidationResult>;
    logout: () => Promise<void>;
    checkStoredLicense: () => Promise<void>;
}

const LicenseAuthContext = createContext<LicenseAuthContextValue | null>(null);

// ══════════════════════════════════════════
//  Provider: runs auth logic ONCE for entire app
// ══════════════════════════════════════════
export function LicenseAuthProvider({ children }: { children: ReactNode }) {
    // SECURITY: Never trust cached license as initial state — always start null
    // The init() function will validate and set the correct license after verifying the user
    const [user, setUser] = useState<User | null>(null);
    const [license, setLicense] = useState<LicenseInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isValidating, setIsValidating] = useState(false);
    const prevUserIdRef = React.useRef<string | null>(null);

    // ── 1. Initialize: check Supabase Auth session + license ──
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                // Check existing Supabase session
                console.log('[Auth] init: checking session...');
                const { data: { session } } = await supabase.auth.getSession();
                console.log('[Auth] init: session =', session ? `user=${session.user?.email}` : 'null');

                if (session?.user) {
                    // ── Detect user switch: clear stale data from previous user ──
                    const prevUid = localStorage.getItem(AUTH_UID_KEY);
                    if (prevUid && prevUid !== session.user.id) {
                        console.log('[Auth] User switch detected — clearing stale localStorage');
                        clearUserScopedStorage();
                        if (mounted) setLicense(null);
                    }
                    localStorage.setItem(AUTH_UID_KEY, session.user.id);

                    if (mounted) {
                        setUser(session.user);
                        setIsLoading(false); // Unblock UI immediately — license checks continue in background
                    }

                    // 1) Try localStorage first (instant)
                    const storedKey = localStorage.getItem(STORAGE_KEY);
                    if (storedKey) {
                        const result = await validateLicenseKey(storedKey);
                        if (!result.valid && mounted) {
                            localStorage.removeItem(STORAGE_KEY);
                            localStorage.removeItem(LICENSE_CACHE_KEY);
                            localStorage.removeItem('userPackage');
                            setLicense(null);
                        }
                    }

                    // 2) If no local key, try fetching bound license from DB
                    if (!storedKey || !localStorage.getItem(STORAGE_KEY)) {
                        const boundKey = await fetchBoundLicenseKey(session.user.id);
                        if (boundKey && mounted) {
                            const result = await validateLicenseKey(boundKey);
                            if (!result.valid && mounted) {
                                setLicense(null);
                            }
                        } else if (mounted) {
                            setLicense(null);
                            localStorage.removeItem('userPackage');
                        }
                    }
                } else {
                    // No session — clear everything
                    if (mounted) {
                        setUser(null);
                        setLicense(null);
                        setIsLoading(false);
                    }
                }
            } catch (err) {
                console.error('[Auth] Init failed:', err);
                if (mounted) setIsLoading(false);
            }
        };

        init();

        // Listen for auth state changes (login/logout/token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (mounted) {
                    const newUserId = session?.user?.id || null;
                    const prevUserId = prevUserIdRef.current;

                    // SECURITY: Detect user switch — clear stale license from previous user
                    if (newUserId && prevUserId && newUserId !== prevUserId) {
                        console.log('[Auth] User switch detected in onAuthStateChange — clearing old license');
                        clearUserScopedStorage();
                        setLicense(null);
                    }
                    prevUserIdRef.current = newUserId;

                    setUser(session?.user ?? null);
                    if (session?.user) {
                        setIsLoading(false); // Unblock UI immediately on sign-in
                    } else {
                        setLicense(null);
                    }
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // ── 2. Sign Up (Email + Password) ──
    const signUp = useCallback(async (email: string, password: string, fullName?: string, displayName?: string): Promise<AuthResult> => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName, display_name: displayName || fullName } },
            });

            if (error) return { success: false, error: error.message };

            // Supabase may require email confirmation
            if (data.user && !data.session) {
                return { success: true, error: 'กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ (ตรวจสอบกล่องจดหมาย)' };
            }

            if (data.user) {
                setUser(data.user);
                localStorage.setItem('grandstate_is_new_user', 'true');
            }
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message || 'สมัครสมาชิกไม่สำเร็จ' };
        }
    }, []);

    // ── 3. Sign In (Email + Password) ──
    const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
        try {
            // SECURITY: Clear previous user's license data BEFORE signing in new user
            // This prevents the old user's elite rank from persisting in React state
            setLicense(null);
            clearUserScopedStorage();
            console.log('[Auth] signIn attempt:', email);
            const signInPromise = supabase.auth.signInWithPassword({ email, password });
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT')), 15000)
            );
            const { data, error } = await Promise.race([signInPromise, timeoutPromise]);

            if (error) {
                console.error('[Auth] signIn error:', error.message, error);
                if (error.message.includes('Invalid login')) {
                    return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
                }
                if (error.message.includes('Email not confirmed')) {
                    return { success: false, error: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' };
                }
                return { success: false, error: error.message };
            }

            console.log('[Auth] signIn success, user:', data.user?.email);
            if (data.user) setUser(data.user);
            return { success: true };
        } catch (err: any) {
            console.error('[Auth] signIn exception:', err);
            if (err.message === 'TIMEOUT') {
                return { success: false, error: 'เชื่อมต่อ Server ไม่ได้ — กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' };
            }
            return { success: false, error: err.message || 'เข้าสู่ระบบไม่สำเร็จ' };
        }
    }, []);

    // ── 4. Sign Out ──
    // Clear all user-scoped localStorage to prevent data leaking to the next user
    const signOut = useCallback(async () => {
        setLicense(null);
        setUser(null);
        clearUserScopedStorage();
        await supabase.auth.signOut();
    }, []);

    // ── 5. Reset Password ──
    const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth?reset=true`,
            });
            if (error) return { success: false, error: error.message };
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message || 'ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้' };
        }
    }, []);

    // ── 6. Activate License Key ──
    const activateLicense = useCallback(async (key: string): Promise<LicenseValidationResult> => {
        return validateLicenseKey(key);
    }, []);

    // ── Internal: fetch bound license key from DB ──
    const fetchBoundLicenseKey = async (userId: string): Promise<string | null> => {
        try {
            const { data, error } = await supabase
                .from('license_keys')
                .select('license_key')
                .eq('bound_user_id', userId)
                .eq('is_active', true)
                .order('expires_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error || !data) return null;
            return data.license_key;
        } catch {
            return null;
        }
    };

    // ── Internal: validate license key ──
    const validateLicenseKey = async (key: string): Promise<LicenseValidationResult> => {
        setIsValidating(true);
        try {
            const normalizedKey = key.toUpperCase().trim();
            if (!LICENSE_KEY_REGEX.test(normalizedKey)) {
                return { valid: false, error: 'รูปแบบ License Key ไม่ถูกต้อง', errorCode: 'INVALID_FORMAT' };
            }

            const { data: licenseData, error } = await supabase
                .from('license_keys')
                .select('*')
                .eq('license_key', normalizedKey)
                .single();

            if (error || !licenseData) {
                return { valid: false, error: 'ไม่พบ License Key นี้ในระบบ', errorCode: 'NOT_FOUND' };
            }

            if (!licenseData.is_active) {
                return { valid: false, error: 'License Key นี้ถูกระงับการใช้งาน', errorCode: 'INACTIVE' };
            }

            const expiresAt = new Date(licenseData.expires_at);
            if (expiresAt < new Date()) {
                return { valid: false, error: 'License Key หมดอายุแล้ว', errorCode: 'EXPIRED' };
            }

            // Bind license to current user (if not already bound)
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser && !licenseData.bound_user_id) {
                await supabase
                    .from('license_keys')
                    .update({ bound_user_id: currentUser.id })
                    .eq('id', licenseData.id);
            }

            const licenseInfo: LicenseInfo = {
                id: licenseData.id,
                licenseKey: normalizedKey,
                package: licenseData.package,
                maxFbSessions: licenseData.max_devices || 1,
                expiresAt,
                isActive: licenseData.is_active,
                ownerName: licenseData.owner_name,
            };

            // Store license + embed userId for cross-user cache validation
            const { data: { user: authUserForCache } } = await supabase.auth.getUser();
            localStorage.setItem(STORAGE_KEY, normalizedKey);
            localStorage.setItem('userPackage', licenseData.package);
            localStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify({ ...licenseInfo, _userId: authUserForCache?.id }));
            setLicense(licenseInfo);

            return { valid: true, license: licenseInfo };
        } catch (err) {
            console.error('License validation error:', err);
            return { valid: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบ', errorCode: 'UNKNOWN' };
        } finally {
            setIsValidating(false);
        }
    };

    // ── Backward compatibility aliases ──
    const validateKey = activateLicense;
    const logout = signOut;
    const checkStoredLicense = useCallback(async () => {
        const storedKey = localStorage.getItem(STORAGE_KEY);
        if (storedKey) await validateLicenseKey(storedKey);
    }, []);

    // ── Sync userPackage to localStorage + notify Header on license change ──
    useEffect(() => {
        const pkg = license?.package || 'free';
        localStorage.setItem('userPackage', pkg);
        window.dispatchEvent(new CustomEvent('license-updated', { detail: { package: pkg } }));
    }, [license]);

    // ── License Expiry Warning ──
    useEffect(() => {
        if (!license || !license.expiresAt) return;
        const now = new Date();
        const daysLeft = Math.ceil((license.expiresAt.getTime() - now.getTime()) / 86400000);
        const warningKey = `license_expiry_warned_${license.id}`;

        if (daysLeft <= 0) {
            if (!sessionStorage.getItem(warningKey + '_expired')) {
                sessionStorage.setItem(warningKey + '_expired', 'true');
                console.warn(`[License] License expired!`);
            }
        } else if (daysLeft <= 7) {
            if (!sessionStorage.getItem(warningKey)) {
                sessionStorage.setItem(warningKey, 'true');
                console.warn(`[License] License expires in ${daysLeft} day(s)`);
            }
        }
    }, [license]);

    // ── Derived state ──
    const isAuthenticated = !!user;
    const isLicenseActive = !!license;
    // Free tier: login is enough — license key only needed for paid plans
    const isFullyReady = isAuthenticated;
    const isAdmin = isAdminEmail(user?.email);
    const currentPackage = isAdmin ? 'elite' : (license?.package || 'free');
    const limits = isAdmin
        ? { postsPerDay: 9999, maxGroups: 9999, maxProperties: 9999 }
        : packageLimits[currentPackage];

    // Sync package to localStorage for getUserPackage() used across pages
    useEffect(() => {
        if (isAuthenticated) {
            localStorage.setItem('userPackage', currentPackage);
        }
    }, [isAuthenticated, currentPackage]);

    // Days remaining helper
    const daysRemaining = license?.expiresAt
        ? Math.max(0, Math.ceil((license.expiresAt.getTime() - Date.now()) / 86400000))
        : null;

    const value: LicenseAuthContextValue = {
        user,
        isLoading,
        isAuthenticated,
        license,
        isLicenseActive,
        isValidating,
        isFullyReady,
        currentPackage,
        limits,
        daysRemaining,
        signUp,
        signIn,
        signOut,
        resetPassword,
        activateLicense,
        validateKey,
        logout,
        checkStoredLicense,
    };

    return React.createElement(LicenseAuthContext.Provider, { value }, children);
}

// ══════════════════════════════════════════
//  Hook: reads from the single Provider instance
// ══════════════════════════════════════════
export function useLicenseAuth(): LicenseAuthContextValue {
    const ctx = useContext(LicenseAuthContext);
    if (!ctx) {
        throw new Error('useLicenseAuth must be used within <LicenseAuthProvider>');
    }
    return ctx;
}
