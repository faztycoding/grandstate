import { useState, useCallback } from 'react';
import { Property } from '@/types/property';
import { apiFetch } from '@/lib/config';

export interface PostingHistoryItem {
  propertyId: string;
  groupId: string;
  groupName: string;
  timestamp: string;
}

export interface AutomationStatus {
  isRunning: boolean;
  currentStep: string;
  progress: number;
}

export function useAutomation() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<AutomationStatus>({
    isRunning: false,
    currentStep: '',
    progress: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const apiCall = async (endpoint: string, method: string = 'POST', body?: any) => {
    try {
      const response = await apiFetch(`/api${endpoint}`, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
      return data;
    } catch (err: any) {
      throw new Error(err.message || 'Connection failed');
    }
  };

  // Start automation (opens browser)
  const startAutomation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await apiCall('/automation/start');
      setIsConnected(true);
      setStatus({ isRunning: true, currentStep: 'Browser opened', progress: 10 });
    } catch (err: any) {
      setError(err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stop automation
  const stopAutomation = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiCall('/automation/stop');
      setIsConnected(false);
      setStatus({ isRunning: false, currentStep: '', progress: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Navigate to Marketplace
  const navigateToMarketplace = useCallback(async () => {
    setStatus(prev => ({ ...prev, currentStep: 'Navigating to Marketplace...', progress: 20 }));
    try {
      await apiCall('/automation/navigate-marketplace');
      setStatus(prev => ({ ...prev, currentStep: 'At Marketplace', progress: 30 }));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Create property listing
  const createPropertyListing = useCallback(async () => {
    setStatus(prev => ({ ...prev, currentStep: 'Creating property listing...', progress: 40 }));
    try {
      await apiCall('/automation/create-property-listing');
      setStatus(prev => ({ ...prev, currentStep: 'Property type selected', progress: 50 }));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Fill property form
  const fillPropertyForm = useCallback(async (property: Property, images: string[]) => {
    setStatus(prev => ({ ...prev, currentStep: 'Filling form...', progress: 60 }));
    try {
      await apiCall('/automation/fill-form', 'POST', { property, images });
      setStatus(prev => ({ ...prev, currentStep: 'Form filled', progress: 70 }));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Click Next
  const clickNext = useCallback(async () => {
    setStatus(prev => ({ ...prev, currentStep: 'Proceeding to next step...', progress: 75 }));
    try {
      await apiCall('/automation/click-next');
      setStatus(prev => ({ ...prev, currentStep: 'Ready to select groups', progress: 80 }));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Get available groups
  const getAvailableGroups = useCallback(async () => {
    try {
      const data = await apiCall('/automation/get-groups');
      return data.groups || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, []);

  // Select groups with duplicate prevention
  const selectGroups = useCallback(async (
    propertyId: string, 
    groupIds: number[], 
    excludeRecentlyPosted: boolean = true
  ) => {
    setStatus(prev => ({ ...prev, currentStep: 'Selecting groups...', progress: 85 }));
    try {
      const data = await apiCall('/automation/select-groups', 'POST', {
        propertyId,
        groupIds,
        excludeRecentlyPosted,
      });
      setStatus(prev => ({ ...prev, currentStep: `Selected ${data.selectedGroups?.length || 0} groups`, progress: 90 }));
      return data.selectedGroups || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, []);

  // Submit post
  const submitPost = useCallback(async (propertyId: string, groupIds: string[]) => {
    setStatus(prev => ({ ...prev, currentStep: 'Posting...', progress: 95 }));
    try {
      await apiCall('/automation/post', 'POST', { propertyId, groupIds });
      setStatus(prev => ({ ...prev, currentStep: 'Posted successfully!', progress: 100 }));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Full automation flow
  const runFullAutomation = useCallback(async (
    property: Property,
    images: string[],
    groupSelection: {
      groupIds: string[];
      preventDuplicates: boolean;
      cooldownHours: number;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    setStatus({ isRunning: true, currentStep: 'Starting automation...', progress: 5 });

    try {
      const data = await apiCall('/automation/full-flow', 'POST', {
        property,
        images,
        groupSelection,
      });

      setStatus({
        isRunning: false,
        currentStep: data.message || 'Completed',
        progress: 100,
      });

      return data;
    } catch (err: any) {
      setError(err.message);
      setStatus(prev => ({ ...prev, isRunning: false, currentStep: 'Failed' }));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get posting history
  const getPostingHistory = useCallback(async (propertyId?: string) => {
    try {
      const endpoint = propertyId 
        ? `/posting-history/${propertyId}`
        : '/posting-history';
      const data = await apiCall(endpoint, 'GET');
      return data.history;
    } catch (err: any) {
      console.error('Failed to get posting history:', err);
      return null;
    }
  }, []);

  // Get available groups for property (excluding recently posted)
  const getAvailableGroupsForProperty = useCallback(async (
    propertyId: string,
    groupIds: string[],
    cooldownHours: number = 24
  ) => {
    try {
      const params = new URLSearchParams({
        groupIds: groupIds.join(','),
        cooldownHours: cooldownHours.toString(),
      });
      const data = await apiCall(`/available-groups/${propertyId}?${params}`, 'GET');
      return data.availableGroups || [];
    } catch (err: any) {
      console.error('Failed to get available groups:', err);
      return groupIds; // Return all if error
    }
  }, []);

  return {
    // State
    isConnected,
    isLoading,
    status,
    error,

    // Actions
    startAutomation,
    stopAutomation,
    navigateToMarketplace,
    createPropertyListing,
    fillPropertyForm,
    clickNext,
    getAvailableGroups,
    selectGroups,
    submitPost,
    runFullAutomation,

    // History
    getPostingHistory,
    getAvailableGroupsForProperty,

    // Utilities
    clearError: () => setError(null),
  };
}
