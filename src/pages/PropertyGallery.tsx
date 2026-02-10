import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PropertyGalleryForm, PropertyFormData } from '@/components/automation/PropertyGalleryForm';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';

export default function PropertyGallery() {
  const { t } = useLanguage();
  const g = t.galleryForm;
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (data: PropertyFormData) => {
    console.log('Submitting property:', data);
    
    // Store the property data for automation
    localStorage.setItem('pendingPropertyListing', JSON.stringify(data));
    
    toast.success(g.saved);
    
    // Navigate to automation page
    navigate('/create-listing');
  };

  const handleSave = async (data: PropertyFormData) => {
    setIsSaving(true);
    
    // Simulate saving
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Store as draft
    const drafts = JSON.parse(localStorage.getItem('propertyDrafts') || '[]');
    drafts.push({ ...data, savedAt: new Date().toISOString() });
    localStorage.setItem('propertyDrafts', JSON.stringify(drafts));
    
    toast.success(g.saved);
    setIsSaving(false);
  };

  return (
    <DashboardLayout title={g.galleryTitle}>
      <div className="p-6 bg-gray-50 min-h-screen">
        <PropertyGalleryForm 
          onSubmit={handleSubmit}
          onSave={handleSave}
        />
      </div>
    </DashboardLayout>
  );
}
