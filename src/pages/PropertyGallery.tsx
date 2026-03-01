import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PropertyGalleryForm, PropertyFormData } from '@/components/automation/PropertyGalleryForm';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/lib/supabase';

export default function PropertyGallery() {
  const { t } = useLanguage();
  const g = t.galleryForm;
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (data: PropertyFormData) => {
    // Store the property data for automation
    localStorage.setItem('pendingPropertyListing', JSON.stringify(data));
    
    toast.success(g.saved);
    
    // Navigate to automation page
    navigate('/create-listing');
  };

  const handleSave = async (data: PropertyFormData) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('กรุณาเข้าสู่ระบบก่อน'); return; }

      const { error } = await supabase.from('properties').insert({
        user_id: user.id,
        title: data.title || 'Draft Property',
        description: data.description || '',
        price: parseFloat(data.price) || 0,
        property_type: data.propertyType || 'house',
        listing_type: data.listingType || 'sale',
        location: data.location || '',
        bedrooms: parseInt(data.bedrooms) || 0,
        bathrooms: parseInt(data.bathrooms) || 0,
        area_sqm: parseFloat(data.squareMeters) || 0,
        images: data.images || [],
        is_sold: false,
      });

      if (error) throw error;
      toast.success(g.saved);
    } catch (err) {
      console.error('Save draft error:', err);
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout title={g.galleryTitle}>
      <div className="space-y-4">
        <PropertyGalleryForm 
          onSubmit={handleSubmit}
          onSave={handleSave}
        />
      </div>
    </DashboardLayout>
  );
}
