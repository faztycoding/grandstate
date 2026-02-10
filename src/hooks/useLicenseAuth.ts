import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

// ── Constants ──
const LICENSE_KEY_REGEX = /^GS[A-Z0-9]{3}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;
const STORAGE_KEY = 'gstate_license';
const LICENSE_CACHE_KEY = 'gstate_license_cache';

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
function getCachedLicense(): LicenseInfo | null {
    try {
        const cached = localStorage.getItem(LICENSE_CACHE_KEY);
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        if (parsed && parsed.licenseKey && parsed.package && parsed.isActive) {
            const expires = new Date(parsed.expiresAt);
            if (expires > new Date()) {
                return { ...parsed, expiresAt: expires };
            }
        }
    } catch { /* ignore */ }
    return null;
}

// ── Package limits ──
const packageLimits = {
    free: { postsPerDay: 20, maxGroups: 20, maxProperties: 10 },
    agent: { postsPerDay: 300, maxGroups: 300, maxProperties: Infinity },
    elite: { postsPerDay: 750, maxGroups: 750, maxProperties: Infinity },
};

// ══════════════════════════════════════════
//  Main Hook: Supabase Auth + License
// ══════════════════════════════════════════
export function useLicenseAuth() {
    const cachedLicense = getCachedLicense();
    const [user, setUser] = useState<User | null>(null);
    const [license, setLicense] = useState<LicenseInfo | null>(cachedLicense);
    const [isLoading, setIsLoading] = useState(true);
    const [isValidating, setIsValidating] = useState(false);

    // ── 1. Initialize: check Supabase Auth session + license ──
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            // Check existing Supabase session
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                if (mounted) setUser(session.user);

                // 1) Try localStorage first (instant)
                const storedKey = localStorage.getItem(STORAGE_KEY);
                if (storedKey) {
                    const result = await validateLicenseKey(storedKey);
                    if (!result.valid && mounted) {
                        localStorage.removeItem(STORAGE_KEY);
                        localStorage.removeItem(LICENSE_CACHE_KEY);
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
                    }
                }
            } else {
                // No session — clear everything
                if (mounted) {
                    setUser(null);
                    if (!cachedLicense) setLicense(null);
                }
            }

            if (mounted) setIsLoading(false);
        };

        init();

        // Listen for auth state changes (login/logout/token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (mounted) {
                    setUser(session?.user ?? null);
                    if (!session?.user) {
                        setLicense(null);
                        localStorage.removeItem(STORAGE_KEY);
                        localStorage.removeItem(LICENSE_CACHE_KEY);
                        localStorage.removeItem('userPackage');
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
    const signUp = useCallback(async (email: string, password: string, fullName?: string): Promise<AuthResult> => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } },
            });

            if (error) return { success: false, error: error.message };

            // Supabase may require email confirmation
            if (data.user && !data.session) {
                return { success: true, error: 'กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ (ตรวจสอบกล่องจดหมาย)' };
            }

            if (data.user) setUser(data.user);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message || 'สมัครสมาชิกไม่สำเร็จ' };
        }
    }, []);

    // ── 3. Sign In (Email + Password) ──
    const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                if (error.message.includes('Invalid login')) {
                    return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
                }
                if (error.message.includes('Email not confirmed')) {
                    return { success: false, error: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' };
                }
                return { success: false, error: error.message };
            }

            if (data.user) setUser(data.user);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message || 'เข้าสู่ระบบไม่สำเร็จ' };
        }
    }, []);

    // ── 4. Sign Out ──
    const signOut = useCallback(async () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LICENSE_CACHE_KEY);
        localStorage.removeItem('userPackage');
        setLicense(null);
        setUser(null);
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

            localStorage.setItem(STORAGE_KEY, normalizedKey);
            localStorage.setItem('userPackage', licenseData.package);
            localStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify(licenseInfo));
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
    const isFullyReady = isAuthenticated && isLicenseActive;
    const currentPackage = license?.package || 'free';
    const limits = packageLimits[currentPackage];

    // Days remaining helper
    const daysRemaining = license?.expiresAt
        ? Math.max(0, Math.ceil((license.expiresAt.getTime() - Date.now()) / 86400000))
        : null;

    return {
        // Auth state
        user,
        isLoading,
        isAuthenticated,

        // License state
        license,
        isLicenseActive,
        isValidating,
        isFullyReady,

        // Package info
        currentPackage,
        limits,
        daysRemaining,

        // Auth actions
        signUp,
        signIn,
        signOut,
        resetPassword,

        // License actions
        activateLicense,

        // Backward compatibility
        validateKey,
        logout,
        checkStoredLicense,
    };
}
