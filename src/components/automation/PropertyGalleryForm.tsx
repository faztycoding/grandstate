import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSupabaseProperties } from '@/hooks/useSupabaseProperties';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  X,
  Upload,
  Building2,
  Home,
  Building,
  MapPin,
  Warehouse,
  Store,
  BedDouble,
  Bath,
  Maximize2,
  DollarSign,
  FileText,
  Eye,
  Sparkles,
  Image as ImageIcon,
  GripVertical,
  Phone,
  MessageSquare,
  ExternalLink,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LocationPicker } from './LocationPicker';
import { GoogleMapsPicker } from './GoogleMapsPicker';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/i18n/LanguageContext';

export interface ContactInfo {
  id: string;
  name: string;
  phone: string;
  lineId: string;
}

export interface PropertyFormData {
  images: string[];
  listingType: 'sale' | 'rent';
  propertyType: string;
  title: string;
  bedrooms: string;
  bathrooms: string;
  price: string;
  location: string;
  district: string;
  province: string;
  googleMapsLink: string;
  description: string;
  squareMeters: string;
  contacts: ContactInfo[];
}

interface PropertyGalleryFormProps {
  onSubmit?: (data: PropertyFormData) => void;
  onSave?: (data: PropertyFormData) => void;
}

const PROPERTY_TYPE_IDS = ['condo', 'house', 'townhouse', 'apartment', 'land', 'commercial'] as const;
const PROPERTY_TYPE_ICONS = {
  condo: { icon: Building2, color: 'bg-blue-100 text-blue-600 border-blue-200' },
  house: { icon: Home, color: 'bg-orange-100 text-orange-600 border-orange-200' },
  townhouse: { icon: Building, color: 'bg-green-100 text-green-600 border-green-200' },
  apartment: { icon: Warehouse, color: 'bg-purple-100 text-purple-600 border-purple-200' },
  land: { icon: MapPin, color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
  commercial: { icon: Store, color: 'bg-rose-100 text-rose-600 border-rose-200' },
} as const;

export function PropertyGalleryForm({ onSubmit, onSave }: PropertyGalleryFormProps) {
  const { t } = useLanguage();
  const g = t.galleryForm;
  const navigate = useNavigate();
  const { properties, addProperty } = useSupabaseProperties();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState<PropertyFormData>({
    images: [],
    listingType: 'sale',
    propertyType: 'condo',
    title: '',
    bedrooms: '',
    bathrooms: '',
    price: '',
    location: '',
    district: '',
    province: 'กรุงเทพมหานคร',
    googleMapsLink: '',
    description: '',
    squareMeters: '',
    contacts: [{ id: '1', name: '', phone: '', lineId: '' }],
  });
  const [imageUrlInput, setImageUrlInput] = useState('');
  const addImageInputRef = useRef<HTMLInputElement>(null);

  const addContact = () => {
    setFormData(prev => ({
      ...prev,
      contacts: [...prev.contacts, { id: Date.now().toString(), name: '', phone: '', lineId: '' }]
    }));
  };

  const removeContact = (id: string) => {
    if (formData.contacts.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.filter(c => c.id !== id)
    }));
  };

  const updateContact = (id: string, field: keyof ContactInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const updateField = <K extends keyof PropertyFormData>(
    field: K,
    value: PropertyFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Validate
    if (!formData.title && !formData.price && formData.images.length === 0) {
      toast.error(g.fillAtLeastOne);
      return;
    }

    // Build contact info footer to append to description
    const contactLines: string[] = [];
    formData.contacts.forEach((c, i) => {
      const parts: string[] = [];
      if (c.name) parts.push(c.name);
      if (c.phone) parts.push(`📞 ${c.phone}`);
      if (c.lineId) parts.push(`LINE: ${c.lineId}`);
      if (parts.length > 0) {
        contactLines.push(parts.join(' | '));
      }
    });
    const contactFooter = contactLines.length > 0
      ? `\n\n📱 ${g.contact}:\n${contactLines.join('\n')}`
      : '';

    // Append Google Maps link to description if available
    const mapsFooter = formData.googleMapsLink
      ? `\n📍 ${g.map}: ${formData.googleMapsLink}`
      : '';

    const fullDescription = (formData.description || '') + contactFooter + mapsFooter;

    // Save using useProperties hook
    const primaryContact = formData.contacts[0] || { name: '', phone: '', lineId: '' };
    addProperty({
      title: formData.title || g.noTitle,
      type: formData.propertyType as any,
      listingType: formData.listingType,
      price: parseInt(formData.price) || 0,
      location: formData.location + (formData.googleMapsLink ? ` | ${formData.googleMapsLink}` : ''),
      district: formData.district,
      province: formData.province,
      bedrooms: parseInt(formData.bedrooms) || 0,
      bathrooms: parseInt(formData.bathrooms) || 0,
      size: parseInt(formData.squareMeters) || 0,
      description: fullDescription,
      images: formData.images,
      contactName: primaryContact.name,
      contactPhone: primaryContact.phone,
      contactLine: primaryContact.lineId,
      contacts: formData.contacts,
      amenities: [],
    });

    toast.success(g.saved, {
      description: `${formData.title || g.property} ${g.savedDesc}`,
    });

    onSave?.(formData);
    
    // Navigate to properties page
    setTimeout(() => navigate('/properties'), 500);
  };

  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, base64]
        }));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageUpload(e.dataTransfer.files);
  }, [handleImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const getPropertyTypeLabel = () => {
    return (g as any)[formData.propertyType] || formData.propertyType;
  };

  const formatPrice = (price: string) => {
    if (!price) return '฿0';
    return `฿${parseInt(price).toLocaleString()}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {/* Left Side - Form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header Card */}
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-r from-amber-500 to-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{g.addNewProperty}</h2>
                <p className="text-white/80 text-sm">{g.addNewPropertyDesc}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Type Selection */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {g.propertyType}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {PROPERTY_TYPE_IDS.map((typeId) => {
                const typeInfo = PROPERTY_TYPE_ICONS[typeId];
                const Icon = typeInfo.icon;
                const isSelected = formData.propertyType === typeId;
                return (
                  <motion.button
                    key={typeId}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => updateField('propertyType', typeId)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      isSelected
                        ? "border-amber-500 bg-amber-50 shadow-md"
                        : "border-gray-100 hover:border-gray-200 bg-white"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      isSelected ? "bg-amber-500 text-white" : typeInfo.color
                    )}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={cn(
                      "text-xs font-medium",
                      isSelected ? "text-amber-700" : "text-gray-600"
                    )}>
                      {(g as any)[typeId]}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Listing Type Toggle */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{g.listingType}</h3>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => updateField('listingType', 'sale')}
                className={cn(
                  "py-4 px-6 rounded-xl font-semibold text-base transition-all",
                  formData.listingType === 'sale'
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {g.sale}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => updateField('listingType', 'rent')}
                className={cn(
                  "py-4 px-6 rounded-xl font-semibold text-base transition-all",
                  formData.listingType === 'rent'
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {g.rent}
              </motion.button>
            </div>
          </CardContent>
        </Card>

        {/* Image Upload */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-amber-500" />
                {g.images}
              </h3>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                {formData.images.length} / 50 {g.imagesCount}
              </Badge>
            </div>

            {/* Add Image Button */}
            <div className="flex gap-2 mb-4">
              <Input
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder={g.pasteImageUrl}
                className="h-10 border-gray-200 focus:border-amber-500 flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && imageUrlInput.trim()) {
                    e.preventDefault();
                    setFormData(prev => ({
                      ...prev,
                      images: [...prev.images, imageUrlInput.trim()]
                    }));
                    setImageUrlInput('');
                    toast.success(g.imageAdded);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 px-4"
                onClick={() => addImageInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4 mr-1" />
                {g.add}
              </Button>
              <input
                ref={addImageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleImageUpload(e.target.files)}
              />
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer",
                isDragging
                  ? "border-amber-500 bg-amber-50"
                  : "border-gray-200 hover:border-amber-300 bg-gray-50"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              {formData.images.length === 0 ? (
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={{ y: isDragging ? -5 : 0 }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-lg"
                  >
                    <Upload className="w-8 h-8 text-white" />
                  </motion.div>
                  <p className="font-semibold text-gray-900 mb-1">{g.addImages}</p>
                  <p className="text-sm text-gray-500">{g.dragOrClick}</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  <AnimatePresence>
                    {formData.images.map((img, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="relative aspect-square group"
                      >
                        <img
                          src={img}
                          alt={`Property ${idx + 1}`}
                          className="w-full h-full object-cover rounded-xl"
                        />
                        {idx === 0 && (
                          <Badge className="absolute top-1 left-1 bg-amber-500 text-white text-xs">
                            {g.mainImage}
                          </Badge>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                        <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="aspect-square border-2 border-dashed border-amber-300 rounded-xl flex items-center justify-center bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <Plus className="w-8 h-8 text-amber-500" />
                  </motion.div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />
          </CardContent>
        </Card>

        {/* Main Details */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 space-y-5">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Home className="w-5 h-5 text-amber-500" />
              {g.mainDetails}
            </h3>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{g.title}</label>
              <Input
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder={g.titlePlaceholder}
                className="h-12 border-gray-200 focus:border-amber-500 focus:ring-amber-500"
              />
            </div>

            {/* Price & Size Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  {g.priceBaht}
                </label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  placeholder="0"
                  className="h-12 border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Maximize2 className="w-4 h-4 text-amber-500" />
                  {g.areaSqm}
                </label>
                <Input
                  type="number"
                  value={formData.squareMeters}
                  onChange={(e) => updateField('squareMeters', e.target.value)}
                  placeholder="0"
                  className="h-12 border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Bedrooms & Bathrooms */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <BedDouble className="w-4 h-4 text-amber-500" />
                  {g.bedrooms}
                </label>
                <Select
                  value={formData.bedrooms}
                  onValueChange={(v) => updateField('bedrooms', v)}
                >
                  <SelectTrigger className="h-12 border-gray-200 focus:border-amber-500 focus:ring-amber-500">
                    <SelectValue placeholder={g.selectCount} />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {g.bedroomUnit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Bath className="w-4 h-4 text-amber-500" />
                  {g.bathrooms}
                </label>
                <Select
                  value={formData.bathrooms}
                  onValueChange={(v) => updateField('bathrooms', v)}
                >
                  <SelectTrigger className="h-12 border-gray-200 focus:border-amber-500 focus:ring-amber-500">
                    <SelectValue placeholder={g.selectCount} />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {g.bathroomUnit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-amber-500" />
                {g.location}
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{g.addressSoi}</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => updateField('location', e.target.value)}
                    placeholder="Bangkok"
                    className="h-10 border-gray-200 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{g.district}</label>
                  <Input
                    value={formData.district}
                    onChange={(e) => updateField('district', e.target.value)}
                    placeholder="Klong Toey"
                    className="h-10 border-gray-200 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{g.province}</label>
                  <Input
                    value={formData.province}
                    onChange={(e) => updateField('province', e.target.value)}
                    placeholder="Bangkok"
                    className="h-10 border-gray-200 focus:border-amber-500"
                  />
                </div>
              </div>
              
              {/* Google Maps Picker */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">{g.googleMapsPin}</label>
                <GoogleMapsPicker
                  value={formData.googleMapsLink}
                  onChange={(value) => updateField('googleMapsLink', value)}
                  onLocationSelect={(loc) => {
                    setFormData(prev => ({
                      ...prev,
                      googleMapsLink: `https://www.google.com/maps?q=${loc.lat},${loc.lng}`,
                      location: loc.address || prev.location,
                      district: loc.district || prev.district,
                      province: loc.province || prev.province,
                    }));
                  }}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <FileText className="w-4 h-4 text-amber-500" />
                {g.description}
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder={g.descPlaceholder}
                className="min-h-[120px] border-gray-200 focus:border-amber-500 focus:ring-amber-500 resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Phone className="w-5 h-5 text-amber-500" />
                {g.contactInfo}
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContact}
                className="text-amber-600 border-amber-300 hover:bg-amber-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                {g.addContact}
              </Button>
            </div>
            
            <AnimatePresence>
              {formData.contacts.map((contact, index) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-12 gap-3 items-end p-3 bg-gray-50 rounded-lg"
                >
                  <div className="col-span-4">
                    <label className="block text-xs text-gray-500 mb-1">{g.contactName} {index + 1}</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={contact.name}
                        onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                        placeholder={g.contactNamePlaceholder}
                        className="h-10 pl-10 border-gray-200 focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">{g.phone}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={contact.phone}
                        onChange={(e) => updateContact(contact.id, 'phone', e.target.value)}
                        placeholder="081-234-5678"
                        className="h-10 pl-10 border-gray-200 focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs text-gray-500 mb-1">{g.lineId}</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={contact.lineId}
                        onChange={(e) => updateContact(contact.id, 'lineId', e.target.value)}
                        placeholder="@yourlineid"
                        className="h-10 pl-10 border-gray-200 focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="col-span-1">
                    {formData.contacts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeContact(contact.id)}
                        className="h-10 w-10 text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="flex gap-3">
          <Button
            className="flex-1 h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
            onClick={handleSave}
          >
            {g.saveProperty}
          </Button>
        </div>
      </div>

      {/* Right Side - Preview */}
      <div className="lg:col-span-1">
        <div className="sticky top-6">
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4">
              <div className="flex items-center gap-2 text-white">
                <Eye className="w-5 h-5" />
                <span className="font-semibold">{g.preview}</span>
              </div>
            </div>
            
            <CardContent className="p-0">
              {/* Preview Image */}
              <div className="aspect-video bg-gray-100 relative">
                {formData.images.length > 0 ? (
                  <img
                    src={formData.images[0]}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <p className="text-sm">{g.noImages}</p>
                  </div>
                )}
                {formData.images.length > 1 && (
                  <Badge className="absolute bottom-2 right-2 bg-black/70 text-white">
                    +{formData.images.length - 1} {g.photos}
                  </Badge>
                )}
              </div>

              {/* Preview Details */}
              <div className="p-4 space-y-3">
                <div>
                  <h4 className="text-lg font-bold text-gray-900">
                    {formData.title || g.untitled}
                  </h4>
                  <p className="text-xl font-bold text-amber-600">
                    {formatPrice(formData.price)}
                    {formData.listingType === 'rent' && <span className="text-sm font-normal text-gray-500">{g.perMonth}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>{formData.location || g.locationLabel}</span>
                </div>

                <div className="flex items-center gap-4 py-3 border-t border-b">
                  <div className="flex items-center gap-1">
                    <BedDouble className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{formData.bedrooms || '-'} {g.bedroomUnit}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{formData.bathrooms || '-'} {g.bathroomUnit}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Maximize2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{formData.squareMeters || '-'} {g.sqm}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                    {getPropertyTypeLabel()}
                  </Badge>
                  <Badge variant="secondary" className={cn(
                    formData.listingType === 'sale' 
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  )}>
                    {formData.listingType === 'sale' ? g.sale : g.rent}
                  </Badge>
                </div>

                {formData.description && (
                  <div className="pt-2">
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {formData.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Facebook Style Info */}
              <div className="bg-gray-50 p-4 border-t">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    f
                  </div>
                  <span>{g.readyToPost}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips Card */}
          <Card className="border-0 shadow-lg mt-4 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="p-4">
              <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {g.tips}
              </h4>
              <ul className="space-y-2 text-sm text-amber-700">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  {g.tip1}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  {g.tip2}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  {g.tip3}
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Saved Properties */}
          {properties.length > 0 && (
            <Card className="border-0 shadow-lg mt-4">
              <CardContent className="p-4">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    {g.savedProperties} ({properties.length})
                  </span>
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {properties.slice(0, 5).map((prop) => (
                    <motion.div
                      key={prop.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => {
                        const contacts = prop.contacts || [{ 
                          id: '1', 
                          name: prop.contactName || '', 
                          phone: prop.contactPhone || '', 
                          lineId: prop.contactLine || '' 
                        }];
                        setFormData({
                          images: prop.images || [],
                          listingType: prop.listingType,
                          propertyType: prop.type,
                          title: prop.title,
                          bedrooms: prop.bedrooms?.toString() || '',
                          bathrooms: prop.bathrooms?.toString() || '',
                          price: prop.price?.toString() || '',
                          location: prop.location?.split(' | ')[0] || '',
                          district: prop.district || '',
                          province: prop.province || 'กรุงเทพมหานคร',
                          googleMapsLink: prop.location?.includes(' | ') ? prop.location.split(' | ')[1] : '',
                          description: prop.description || '',
                          squareMeters: prop.size?.toString() || '',
                          contacts: contacts,
                        });
                        toast.info(g.dataLoaded);
                      }}
                    >
                      {prop.images && prop.images.length > 0 ? (
                        <img src={prop.images[0]} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {prop.title || g.noTitle}
                        </p>
                        <p className="text-xs text-gray-500">
                          {prop.price ? `฿${prop.price.toLocaleString()}` : g.noPrice}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
