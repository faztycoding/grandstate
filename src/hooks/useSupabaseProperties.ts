import { useState, useEffect, useCallback } from 'react';
import { supabase, DbProperty } from '@/lib/supabase';
import { Property, PropertyType } from '@/types/property';

// Convert DB format to App format
function dbToProperty(db: DbProperty): Property {
  return {
    id: db.id,
    userId: db.user_id,
    title: db.title,
    listingType: db.listing_type,
    type: db.property_type as PropertyType,
    price: db.price,
    size: db.area_size || 0,
    bedrooms: db.bedrooms || 0,
    bathrooms: db.bathrooms || 0,
    location: db.location,
    province: db.province || '',
    district: db.district || '',
    description: db.description || '',
    amenities: db.features || [],
    images: db.images || [],
    contactName: '',
    contactPhone: '',
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

// Convert App format to DB format
function propertyToDb(property: Partial<Property>, userId: string): Partial<DbProperty> {
  return {
    user_id: userId,
    title: property.title,
    listing_type: property.listingType,
    property_type: property.type,
    price: property.price,
    area_size: property.size || null,
    bedrooms: property.bedrooms || null,
    bathrooms: property.bathrooms || null,
    location: property.location,
    province: property.province || null,
    district: property.district || null,
    description: property.description || null,
    features: property.amenities || [],
    images: property.images || [],
    status: 'active',
  };
}

export function useSupabaseProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all properties for current user
  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Fallback to localStorage if not logged in
        const stored = localStorage.getItem('properties');
        if (stored) {
          setProperties(JSON.parse(stored));
        }
        return;
      }

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProperties((data || []).map(dbToProperty));
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add new property
  const addProperty = useCallback(async (propertyData: Partial<Property>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Fallback to localStorage if not logged in
        const newProperty: Property = {
          id: Date.now().toString(),
          userId: 'temp',
          title: propertyData.title || '',
          listingType: propertyData.listingType || 'sale',
          type: propertyData.type || 'condo',
          price: propertyData.price || 0,
          size: propertyData.size || 0,
          bedrooms: propertyData.bedrooms || 0,
          bathrooms: propertyData.bathrooms || 0,
          location: propertyData.location || '',
          province: propertyData.province || '',
          district: propertyData.district || '',
          description: propertyData.description || '',
          amenities: propertyData.amenities || [],
          images: propertyData.images || [],
          contactName: '',
          contactPhone: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const stored = localStorage.getItem('properties');
        const properties = stored ? JSON.parse(stored) : [];
        properties.unshift(newProperty);
        localStorage.setItem('properties', JSON.stringify(properties));
        setProperties(properties);
        return newProperty;
      }

      const dbData = propertyToDb(propertyData, user.id);
      
      const { data, error } = await supabase
        .from('properties')
        .insert([dbData])
        .select()
        .single();

      if (error) throw error;

      const newProperty = dbToProperty(data);
      setProperties(prev => [newProperty, ...prev]);
      return newProperty;
    } catch (err: any) {
      console.error('Error adding property:', err);
      throw err;
    }
  }, []);

  // Update property
  const updateProperty = useCallback(async (id: string, updates: Partial<Property>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Fallback to localStorage if not logged in
        const stored = localStorage.getItem('properties');
        if (stored) {
          const properties: Property[] = JSON.parse(stored);
          const updatedProperties = properties.map(p => {
            if (p.id !== id) return p;
            return {
              ...p,
              ...updates,
              updatedAt: new Date(),
            };
          });
          localStorage.setItem('properties', JSON.stringify(updatedProperties));
          setProperties(updatedProperties);
          const updated = updatedProperties.find(p => p.id === id);
          return updated || null;
        }
        throw new Error('Property not found');
      }

      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.listingType !== undefined) dbUpdates.listing_type = updates.listingType;
      if (updates.type !== undefined) dbUpdates.property_type = updates.type;
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.size !== undefined) dbUpdates.area_size = updates.size;
      if (updates.bedrooms !== undefined) dbUpdates.bedrooms = updates.bedrooms;
      if (updates.bathrooms !== undefined) dbUpdates.bathrooms = updates.bathrooms;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.province !== undefined) dbUpdates.province = updates.province;
      if (updates.district !== undefined) dbUpdates.district = updates.district;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.amenities !== undefined) dbUpdates.features = updates.amenities;
      if (updates.images !== undefined) dbUpdates.images = updates.images;

      const { data, error } = await supabase
        .from('properties')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      const updatedProperty = dbToProperty(data);
      setProperties(prev => prev.map(p => p.id === id ? updatedProperty : p));
      return updatedProperty;
    } catch (err: any) {
      console.error('Error updating property:', err);
      throw err;
    }
  }, []);

  // Delete property
  const deleteProperty = useCallback(async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Fallback to localStorage if not logged in
        const stored = localStorage.getItem('properties');
        if (stored) {
          const properties = JSON.parse(stored);
          const filtered = properties.filter((p: Property) => p.id !== id);
          localStorage.setItem('properties', JSON.stringify(filtered));
          setProperties(filtered);
        }
        return;
      }

      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setProperties(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      console.error('Error deleting property:', err);
      throw err;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProperties();
    });

    return () => subscription.unsubscribe();
  }, [fetchProperties]);

  return {
    properties,
    loading,
    error,
    addProperty,
    updateProperty,
    deleteProperty,
    refetch: fetchProperties,
  };
}
