/**
 * Package limits utility — single source of truth for all package restrictions
 */

export const PACKAGE_LIMITS = {
  free: {
    postsPerDay: 20,
    maxProperties: 10,
    maxGroups: 20,
    fbAccounts: 1,
    scheduledPosting: false,
    analytics: false,
  },
  agent: {
    postsPerDay: 300,
    maxProperties: Infinity,
    maxGroups: 300,
    fbAccounts: 3,
    scheduledPosting: true,
    analytics: true,
  },
  elite: {
    postsPerDay: 750,
    maxProperties: Infinity,
    maxGroups: 750,
    fbAccounts: 5,
    scheduledPosting: true,
    analytics: true,
  },
} as const;

export type PackageId = keyof typeof PACKAGE_LIMITS;

export function getPackageLimits(pkg: string) {
  return PACKAGE_LIMITS[pkg as PackageId] || PACKAGE_LIMITS.free;
}

export function getUserPackage(): PackageId {
  return (localStorage.getItem('userPackage') as PackageId) || 'free';
}

export function setUserPackage(pkg: PackageId) {
  localStorage.setItem('userPackage', pkg);
}

export function canAddProperty(currentCount: number, pkg?: string): { allowed: boolean; limit: number; remaining: number } {
  const limits = getPackageLimits(pkg || getUserPackage());
  const remaining = limits.maxProperties === Infinity ? Infinity : limits.maxProperties - currentCount;
  return {
    allowed: currentCount < limits.maxProperties,
    limit: limits.maxProperties,
    remaining: Math.max(0, remaining),
  };
}

export function canAddGroup(currentCount: number, pkg?: string): { allowed: boolean; limit: number; remaining: number } {
  const limits = getPackageLimits(pkg || getUserPackage());
  const remaining = limits.maxGroups - currentCount;
  return {
    allowed: currentCount < limits.maxGroups,
    limit: limits.maxGroups,
    remaining: Math.max(0, remaining),
  };
}
