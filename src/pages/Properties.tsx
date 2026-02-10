import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PropertyCard } from '@/components/property/PropertyCard';
import { PropertyForm } from '@/components/property/PropertyForm';
import { PropertyPreviewModal } from '@/components/property/PropertyPreviewModal';
import { DeletePropertyDialog } from '@/components/property/DeletePropertyDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSupabaseProperties } from '@/hooks/useSupabaseProperties';
import { Property } from '@/types/property';
import { Plus, Search, SlidersHorizontal, Building2, LayoutGrid, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';
import { canAddProperty, getUserPackage, getPackageLimits } from '@/hooks/usePackageLimits';

export default function Properties() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { properties, loading, addProperty, updateProperty, deleteProperty } = useSupabaseProperties();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterListing, setFilterListing] = useState<string>('all');
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [previewProperty, setPreviewProperty] = useState<Property | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handlePreview = (property: Property) => {
    setPreviewProperty(property);
    setIsPreviewOpen(true);
  };

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || property.type === filterType;
    const matchesListing = filterListing === 'all' || property.listingType === filterListing;
    return matchesSearch && matchesType && matchesListing;
  });

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setIsFormOpen(true);
  };

  const handleDelete = (property: Property) => {
    setDeletingProperty(property);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (deletingProperty) {
      try {
        await deleteProperty(deletingProperty.id);
        toast.success(t.properties.deleteSuccess);
      } catch (err: any) {
        toast.error('ลบไม่สำเร็จ: ' + (err.message || 'Unknown error'));
      }
      setIsDeleteOpen(false);
      setDeletingProperty(null);
    }
  };

  const handlePost = (property: Property) => {
    navigate('/automation', { state: { propertyId: property.id } });
  };

  const handleFormSubmit = async (data: Partial<Property>) => {
    try {
      if (editingProperty) {
        await updateProperty(editingProperty.id, data);
        toast.success(t.properties.updateSuccess);
      } else {
        await addProperty(data);
        toast.success(t.properties.addSuccess);
      }
      setIsFormOpen(false);
      setEditingProperty(null);
    } catch (err: any) {
      toast.error('บันทึกไม่สำเร็จ: ' + (err.message || 'Unknown error'));
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setFilterListing('all');
  };

  const userPkg = getUserPackage();
  const propCheck = canAddProperty(properties.length, userPkg);
  const pkgLimits = getPackageLimits(userPkg);

  const openAddForm = () => {
    if (!propCheck.allowed) {
      toast.error(
        pkgLimits.maxProperties === Infinity
          ? 'เกิดข้อผิดพลาด'
          : `แพ็คเกจ ${userPkg.toUpperCase()} เพิ่มสินทรัพย์ได้สูงสุด ${pkgLimits.maxProperties} รายการ`,
        { description: 'อัพเกรดแพ็คเกจเพื่อเพิ่มสินทรัพย์ได้มากขึ้น' }
      );
      return;
    }
    setEditingProperty(null);
    setIsFormOpen(true);
  };

  return (
    <DashboardLayout
      title={t.properties.title}
      subtitle={t.properties.subtitle}
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-1 gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t.common.searchProperties}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] hidden sm:flex">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t.properties.propertyType} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.allTypes}</SelectItem>
                <SelectItem value="condo">{t.properties.condo || 'คอนโด'}</SelectItem>
                <SelectItem value="house">{t.properties.house || 'บ้าน'}</SelectItem>
                <SelectItem value="townhouse">{t.properties.townhouse || 'ทาวน์เฮาส์'}</SelectItem>
                <SelectItem value="apartment">{t.properties.apartment || 'อพาร์ทเมนต์'}</SelectItem>
                <SelectItem value="land">{t.properties.land || 'ที่ดิน'}</SelectItem>
                <SelectItem value="commercial">{t.properties.commercial || 'พาณิชย์'}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterListing} onValueChange={setFilterListing}>
              <SelectTrigger className="w-[140px] hidden sm:flex">
                <SelectValue placeholder={t.properties.listingType} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all}</SelectItem>
                <SelectItem value="sale">{t.properties.forSale}</SelectItem>
                <SelectItem value="rent">{t.properties.forRent}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {pkgLimits.maxProperties !== Infinity && (
              <span className="text-xs text-muted-foreground">
                {properties.length}/{pkgLimits.maxProperties}
              </span>
            )}
            <Button variant="accent" onClick={openAddForm} disabled={!propCheck.allowed}>
              {!propCheck.allowed ? <Lock className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {t.properties.addProperty}
            </Button>
          </div>
        </div>

        {/* Properties Grid */}
        {/* Loading State */}
        {loading && properties.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-accent mb-4" />
            <p className="text-muted-foreground">กำลังโหลดสินทรัพย์...</p>
          </div>
        )}

        {filteredProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProperties.map((property, index) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <PropertyCard
                  property={property}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPost={handlePost}
                  onPreview={handlePreview}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-accent/10 flex items-center justify-center">
              {searchQuery || filterType !== 'all' || filterListing !== 'all' ? (
                <Search className="w-10 h-10 text-accent" />
              ) : (
                <Building2 className="w-10 h-10 text-accent" />
              )}
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery || filterType !== 'all' || filterListing !== 'all'
                ? (t.properties.noResults || 'No results')
                : (t.properties.noProperties || 'No properties')}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {searchQuery || filterType !== 'all' || filterListing !== 'all'
                ? (t.properties.tryAdjustFilter || 'Try adjusting your search or filters')
                : (t.properties.addPropertyFirst || 'Add your first property to get started')}
            </p>
            {searchQuery || filterType !== 'all' || filterListing !== 'all' ? (
              <Button variant="outline" onClick={clearFilters}>
                {t.properties.clearFilters || 'Clear Filters'}
              </Button>
            ) : (
              <Button variant="accent" onClick={() => navigate('/gallery')}>
                <Plus className="w-4 h-4 mr-2" />
                {t.common.addFirst}
              </Button>
            )}
          </motion.div>
        )}

        {/* Stats */}
        {properties.length > 0 && (
          <div className="flex items-center justify-center gap-6 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LayoutGrid className="w-4 h-4" />
              <span>{t.common.total} {properties.length}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t.common.showing} {filteredProperties.length} {t.common.items}</span>
            </div>
          </div>
        )}
      </div>

      {/* Property Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent" />
              {editingProperty ? t.properties.editProperty : t.properties.addProperty}
            </DialogTitle>
            <DialogDescription>
              {editingProperty
                ? t.properties.updateDesc
                : t.properties.addDesc}
            </DialogDescription>
          </DialogHeader>
          <PropertyForm
            initialData={editingProperty || undefined}
            onSubmit={handleFormSubmit}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Property Preview Modal */}
      <PropertyPreviewModal
        property={previewProperty}
        open={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setPreviewProperty(null); }}
        onEdit={handleEdit}
        onPost={handlePost}
      />

      {/* Delete Confirmation Dialog */}
      <DeletePropertyDialog
        property={deletingProperty}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={confirmDelete}
      />
    </DashboardLayout>
  );
}
