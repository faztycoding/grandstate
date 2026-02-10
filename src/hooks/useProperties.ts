import { useState, useCallback, useEffect } from 'react';
import { Property } from '@/types/property';

const STORAGE_KEY = 'savedProperties';

// Load from localStorage and convert to Property format
const loadFromStorage = (): Property[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((item: any) => ({
        id: item.id || `prop-${Date.now()}-${Math.random()}`,
        title: item.title || 'ไม่มีชื่อ',
        type: item.propertyType || item.type || 'condo',
        listingType: item.listingType || 'sale',
        price: parseInt(item.price) || 0,
        location: item.location || '',
        district: item.district || '',
        province: item.province || '',
        bedrooms: parseInt(item.bedrooms) || 0,
        bathrooms: parseInt(item.bathrooms) || 0,
        size: parseInt(item.squareMeters) || parseInt(item.size) || 0,
        description: item.description || '',
        images: item.images || [],
        contactName: item.contactName || '',
        contactPhone: item.contactPhone || '',
        amenities: item.amenities || [],
        userId: 'user-1',
        createdAt: new Date(item.savedAt || item.createdAt || Date.now()),
        updatedAt: new Date(),
      }));
    }
  } catch (e) {
    console.error('Error loading properties:', e);
  }
  return [];
};

// Save to localStorage
const saveToStorage = (properties: Property[]) => {
  try {
    const toSave = properties.map(p => ({
      id: p.id,
      title: p.title,
      propertyType: p.type,
      listingType: p.listingType,
      price: p.price?.toString(),
      location: p.location,
      bedrooms: p.bedrooms?.toString(),
      bathrooms: p.bathrooms?.toString(),
      squareMeters: p.size?.toString(),
      description: p.description,
      images: p.images,
      savedAt: p.createdAt,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Error saving properties:', e);
  }
};

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load on mount and when refreshKey changes
  useEffect(() => {
    const loaded = loadFromStorage();
    setProperties(loaded);
  }, [refreshKey]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorage = () => {
      setRefreshKey(k => k + 1);
    };
    window.addEventListener('storage', handleStorage);
    
    // Also check periodically for same-tab updates (every 2 seconds)
    const interval = setInterval(() => {
      const loaded = loadFromStorage();
      setProperties(loaded);
    }, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const addProperty = useCallback((data: Partial<Property>) => {
    const current = loadFromStorage();
    const newProperty: Property = {
      ...data,
      id: `prop-${Date.now()}`,
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Property;
    const updated = [newProperty, ...current];
    saveToStorage(updated);
    setProperties(updated);
    return newProperty;
  }, []);

  const updateProperty = useCallback((id: string, data: Partial<Property>) => {
    const current = loadFromStorage();
    const updated = current.map(p =>
      p.id === id ? { ...p, ...data, updatedAt: new Date() } as Property : p
    );
    saveToStorage(updated);
    setProperties(updated);
  }, []);

  const deleteProperty = useCallback((id: string) => {
    const current = loadFromStorage();
    const updated = current.filter(p => p.id !== id);
    saveToStorage(updated);
    setProperties(updated);
  }, []);

  const getProperty = useCallback((id: string) => {
    const current = loadFromStorage();
    return current.find(p => p.id === id);
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return {
    properties,
    addProperty,
    updateProperty,
    deleteProperty,
    getProperty,
    refresh,
  };
}
