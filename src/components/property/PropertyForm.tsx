import { useState, useRef, useCallback, useEffect } from 'react';
import { Property, PropertyType, ListingType, ContactInfo } from '@/types/property';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImagePlus, X, Building2, MapPin, Phone, MessageSquare, Home, DollarSign, Plus, User, Navigation, ExternalLink, Upload, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';

interface PropertyFormProps {
  initialData?: Partial<Property>;
  onSubmit: (data: Partial<Property>) => void;
  onCancel?: () => void;
}

const PROPERTY_TYPE_ICONS: Record<PropertyType, string> = {
  condo: '🏢', house: '🏠', townhouse: '🏘️', apartment: '🏬', land: '🏞️', commercial: '�',
};
const PROPERTY_TYPE_KEYS: PropertyType[] = ['condo', 'house', 'townhouse', 'apartment', 'land', 'commercial'];
const LISTING_TYPE_KEYS: ListingType[] = ['sale', 'rent'];
const AMENITY_KEYS = [
  'pool', 'fitness', 'security24h', 'parking', 'garden', 'petFriendly',
  'balcony', 'furniture', 'aircon', 'nearBTS', 'nearSchool', 'niceView',
] as const;

export function PropertyForm({ initialData, onSubmit, onCancel }: PropertyFormProps) {
  const { t } = useLanguage();
  const f = t.propertyForm;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<ContactInfo[]>(
    initialData?.contacts || [{ id: '1', name: initialData?.contactName || '', phone: initialData?.contactPhone || '', lineId: initialData?.contactLine || '' }]
  );
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showPlaceResults, setShowPlaceResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const placeContainerRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState<Partial<Property>>({
    type: 'condo',
    listingType: 'sale',
    title: '',
    price: 0,
    location: '',
    district: '',
    province: 'กรุงเทพมหานคร',
    size: 0,
    bedrooms: 1,
    bathrooms: 1,
    description: '',
    images: [],
    contactName: '',
    contactPhone: '',
    contactLine: '',
    amenities: [],
    ...initialData,
  });

  const [imageUrls, setImageUrls] = useState<string[]>(initialData?.images || []);

  const addContact = () => {
    setContacts(prev => [...prev, { id: Date.now().toString(), name: '', phone: '', lineId: '' }]);
  };

  const removeContact = (id: string) => {
    if (contacts.length <= 1) return;
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const updateContact = (id: string, field: keyof ContactInfo, value: string) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImageUrls(prev => {
          const updated = [...prev, base64];
          handleChange('images', updated);
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Extract lat/lng from Google Maps URL
  const extractCoordsFromUrl = (url: string): { lat: number; lng: number } | null => {
    // Pattern: @lat,lng or ?q=lat,lng or /place/.../@lat,lng
    const patterns = [
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /center=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
      }
    }
    return null;
  };

  // Reverse geocode using Nominatim (free, no API key needed)
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=th&addressdetails=1`
      );
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        // Thai address structure
        const location = addr.road || addr.hamlet || addr.village || addr.suburb || '';
        const district = addr.city_district || addr.county || addr.town || addr.city || '';
        const province = addr.state || addr.province || '';

        if (location) handleChange('location', location);
        if (district) handleChange('district', district);
        if (province) handleChange('province', province);

        toast.success(f.locationSuccess, {
          description: `${district} ${province}`.trim(),
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Reverse geocode error:', err);
      return false;
    }
  };

  // Handle Google Maps link paste/change
  const handleMapsLinkChange = async (url: string) => {
    setGoogleMapsLink(url);
    if (!url || url.length < 10) return;

    // Try to extract coordinates
    const coords = extractCoordsFromUrl(url);
    if (coords) {
      toast.loading(f.locationLoading);
      const success = await reverseGeocode(coords.lat, coords.lng);
      if (!success) {
        toast.error(f.locationFailed);
      }
    }
  };

  // Current location button
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error(f.gpsNotSupported);
      return;
    }
    toast.loading(f.gpsLoading);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const link = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setGoogleMapsLink(link);
        await reverseGeocode(latitude, longitude);
      },
      () => toast.error(f.gpsFailed)
    );
  };

  // Place search with Nominatim
  const searchPlaces = async (query: string) => {
    if (query.length < 2) { setPlaceResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Thailand')}&limit=6&addressdetails=1&accept-language=th`
      );
      const data = await res.json();
      setPlaceResults(data);
      setShowPlaceResults(true);
    } catch (err) {
      console.error('Place search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlaceQueryChange = (value: string) => {
    setPlaceQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchPlaces(value), 500);
  };

  const handlePlaceSelect = (place: any) => {
    const addr = place.address || {};
    const loc = addr.road || addr.hamlet || addr.village || addr.suburb || addr.neighbourhood || '';
    const dist = addr.city_district || addr.county || addr.town || addr.city || '';
    const prov = addr.state || addr.province || '';

    if (loc) handleChange('location', loc);
    if (dist) handleChange('district', dist);
    if (prov) handleChange('province', prov);

    setPlaceQuery(place.display_name?.split(',').slice(0, 2).join(',') || '');
    setShowPlaceResults(false);

    toast.success(f.locationSuccess, { description: `${dist} ${prov}`.trim() });
  };

  // Close place results on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (placeContainerRef.current && !placeContainerRef.current.contains(e.target as Node)) {
        setShowPlaceResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (field: keyof Property, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleAmenity = (amenity: string) => {
    const current = formData.amenities || [];
    const updated = current.includes(amenity)
      ? current.filter(a => a !== amenity)
      : [...current, amenity];
    handleChange('amenities', updated);
  };

  const addImageUrl = (url: string) => {
    if (url && !imageUrls.includes(url)) {
      const updated = [...imageUrls, url];
      setImageUrls(updated);
      handleChange('images', updated);
    }
  };

  const removeImage = (index: number) => {
    const updated = imageUrls.filter((_, i) => i !== index);
    setImageUrls(updated);
    handleChange('images', updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const primaryContact = contacts[0] || { name: '', phone: '', lineId: '' };
    onSubmit({ 
      ...formData, 
      images: imageUrls,
      location: formData.location,
      district: formData.district,
      province: formData.province,
      description: formData.description + (googleMapsLink ? `\n📍 ${googleMapsLink}` : ''),
      contactName: primaryContact.name,
      contactPhone: primaryContact.phone,
      contactLine: primaryContact.lineId,
      contacts: contacts,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Property Type Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">{f.propertyType}</Label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {PROPERTY_TYPE_KEYS.map(typeKey => (
            <button
              key={typeKey}
              type="button"
              onClick={() => handleChange('type', typeKey)}
              className={cn(
                'p-3 rounded-xl border-2 transition-all text-center',
                formData.type === typeKey
                  ? 'border-accent bg-accent/10 shadow-glow'
                  : 'border-border hover:border-accent/50'
              )}
            >
              <span className="text-2xl block mb-1">{PROPERTY_TYPE_ICONS[typeKey]}</span>
              <span className="text-xs font-medium">{f[typeKey]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Listing Type */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">{f.listingType}</Label>
        <div className="flex gap-3">
          {LISTING_TYPE_KEYS.map(ltKey => (
            <button
              key={ltKey}
              type="button"
              onClick={() => handleChange('listingType', ltKey)}
              className={cn(
                'flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all',
                formData.listingType === ltKey
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border hover:border-accent/50'
              )}
            >
              {f[ltKey]}
            </button>
          ))}
        </div>
      </div>

      {/* Title & Price */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Home className="w-5 h-5 text-accent" />
            {f.mainDetails}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>{f.title}</Label>
            <Input
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder={f.titlePlaceholder}
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-accent" />
              {f.price}{formData.listingType === 'rent' ? f.pricePerMonth : ''}
            </Label>
            <Input
              type="number"
              value={formData.price || ''}
              onChange={(e) => handleChange('price', Number(e.target.value))}
              placeholder="0"
              className="text-lg font-semibold"
            />
          </div>

          <div className="space-y-2">
            <Label>{f.size}</Label>
            <Input
              type="number"
              value={formData.size || ''}
              onChange={(e) => handleChange('size', Number(e.target.value))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>{f.bedrooms}</Label>
            <Select
              value={String(formData.bedrooms)}
              onValueChange={(value) => handleChange('bedrooms', Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                  <SelectItem key={num} value={String(num)}>
                    {num === 0 ? f.studio : f.bedroomCount.replace('{n}', String(num))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{f.bathrooms}</Label>
            <Select
              value={String(formData.bathrooms)}
              onValueChange={(value) => handleChange('bathrooms', Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <SelectItem key={num} value={String(num)}>
                    {f.bathroomCount.replace('{n}', String(num))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>{f.description}</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={f.descPlaceholder}
              rows={4}
            />
          </div>

          {/* Contact Info — embedded */}
          <div className="md:col-span-2 pt-4 border-t space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <Phone className="w-4 h-4 text-accent" />
                {f.contactInfo}
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addContact}>
                <Plus className="w-4 h-4 mr-1" />
                {f.addContact}
              </Button>
            </div>
            <AnimatePresence>
              {contacts.map((contact, index) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-12 gap-3 items-end p-3 bg-muted/50 rounded-lg"
                >
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">{f.contactName} {index + 1}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={contact.name}
                        onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                        placeholder={f.contactNamePlaceholder}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">{f.phone}</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={contact.phone}
                        onChange={(e) => updateContact(contact.id, 'phone', e.target.value)}
                        placeholder="081-234-5678"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">{f.lineId}</Label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={contact.lineId}
                        onChange={(e) => updateContact(contact.id, 'lineId', e.target.value)}
                        placeholder="@yourlineid"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="col-span-1">
                    {contacts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeContact(contact.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="w-5 h-5 text-accent" />
            {f.location}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Place Search */}
          <div className="space-y-2" ref={placeContainerRef}>
            <Label className="flex items-center gap-2">
              <Search className="w-4 h-4 text-accent" />
              {f.searchPlace}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={placeQuery}
                onChange={(e) => handlePlaceQueryChange(e.target.value)}
                onFocus={() => placeResults.length > 0 && setShowPlaceResults(true)}
                placeholder={f.searchPlacePlaceholder}
                className="pl-10 pr-10"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
              {showPlaceResults && placeResults.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-background border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {placeResults.map((place, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handlePlaceSelect(place)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b last:border-b-0 flex items-start gap-2"
                    >
                      <MapPin className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium line-clamp-1">{place.display_name?.split(',').slice(0, 2).join(',')}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{place.display_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showPlaceResults && placeResults.length === 0 && placeQuery.length >= 2 && !isSearching && (
                <div className="absolute z-50 top-full mt-1 w-full bg-background border rounded-lg shadow-lg p-3 text-center text-sm text-muted-foreground">
                  {f.searchNoResults}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{f.searchHint}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{f.address}</Label>
              <Input
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder={f.addressPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{f.district}</Label>
              <Input
                value={formData.district}
                onChange={(e) => handleChange('district', e.target.value)}
                placeholder={f.districtPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{f.province}</Label>
              <Input
                value={formData.province}
                onChange={(e) => handleChange('province', e.target.value)}
                placeholder={f.provincePlaceholder}
              />
            </div>
          </div>
          
          {/* Google Maps Link */}
          <div className="space-y-2">
            <Label>{f.orPasteLink}</Label>
            <div className="flex gap-2">
              <Input
                value={googleMapsLink}
                onChange={(e) => handleMapsLinkChange(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted) {
                    e.preventDefault();
                    handleMapsLinkChange(pasted);
                  }
                }}
                placeholder={f.mapsLinkPlaceholder}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={getCurrentLocation}>
                <Navigation className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" onClick={() => window.open('https://www.google.com/maps', '_blank')}>
                <ExternalLink className="w-4 h-4 mr-1" />
                {f.openMaps}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImagePlus className="w-5 h-5 text-accent" />
            {f.images}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder={f.imageUrlPlaceholder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addImageUrl((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="w-4 h-4 mr-2" />
              {f.addImage}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AnimatePresence>
              {imageUrls.map((url, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative aspect-square rounded-xl overflow-hidden group border-2 border-border"
                >
                  <img
                    src={url}
                    alt={f.imageAlt.replace('{n}', String(index + 1))}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {index === 0 && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 text-xs font-semibold bg-accent text-accent-foreground rounded-md">
                      {f.mainImage}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {imageUrls.length === 0 && (
            <div 
              className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground cursor-pointer hover:border-accent/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>{f.clickToUpload}</p>
              <p className="text-sm">{f.orPasteUrl}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Amenities */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{f.amenities}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {AMENITY_KEYS.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => toggleAmenity(f[key])}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all',
                  formData.amenities?.includes(f[key])
                    ? 'bg-accent text-accent-foreground shadow-glow'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                )}
              >
                {f[key]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" size="lg" onClick={onCancel}>
            {f.cancel}
          </Button>
        )}
        <Button type="submit" variant="accent" size="lg">
          <Building2 className="w-4 h-4 mr-2" />
          {initialData?.id ? f.updateProperty : f.saveProperty}
        </Button>
      </div>
    </form>
  );
}
