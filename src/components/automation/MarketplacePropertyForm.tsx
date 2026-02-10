import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Plus,
  ChevronDown,
  X,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LocationPicker } from './LocationPicker';

export interface MarketplaceFormData {
  images: string[];
  listingType: 'sale' | 'rent';
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  price: string;
  location: string;
  description: string;
  squareMeters: string;
}

interface MarketplacePropertyFormProps {
  initialData?: Partial<MarketplaceFormData>;
  onChange?: (data: MarketplaceFormData) => void;
  onSubmit?: (data: MarketplaceFormData) => void;
}

export function MarketplacePropertyForm({
  initialData,
  onChange,
  onSubmit,
}: MarketplacePropertyFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<MarketplaceFormData>({
    images: initialData?.images || [],
    listingType: initialData?.listingType || 'sale',
    propertyType: initialData?.propertyType || '',
    bedrooms: initialData?.bedrooms || '',
    bathrooms: initialData?.bathrooms || '',
    price: initialData?.price || '',
    location: initialData?.location || '',
    description: initialData?.description || '',
    squareMeters: initialData?.squareMeters || '',
  });

  const updateField = <K extends keyof MarketplaceFormData>(
    field: K,
    value: MarketplaceFormData[K]
  ) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onChange?.(newData);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateField('images', [...formData.images, base64]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    updateField('images', newImages);
  };

  const handleSubmit = () => {
    onSubmit?.(formData);
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-white rounded-lg shadow-sm border-0">
      <CardContent className="p-0">
        {/* Header - Like Facebook */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-600 font-medium">Marketplace</p>
            <h2 className="text-lg font-bold text-gray-900">รายการบ้านใหม่</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-blue-600 font-medium">
            บันทึกฉบับร่าง
          </Button>
        </div>

        {/* User Info */}
        <div className="p-4 flex items-center gap-3 border-b">
          <Avatar className="w-10 h-10">
            <AvatarImage src="/placeholder-avatar.jpg" />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
              U
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-gray-900">User</p>
            <p className="text-xs text-gray-500">
              ประกาศใน Marketplace · <span className="text-gray-400">🌐</span> สาธารณะ
            </p>
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="p-4 border-b">
          <p className="text-sm text-gray-600 mb-2">
            รูปภาพ · {formData.images.length} / 50 - คุณสามารถเพิ่มรูปภาพได้ถึง 50 รูป
          </p>
          
          {/* Image Grid */}
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 bg-gray-50">
            {formData.images.length === 0 ? (
              <div 
                className="flex flex-col items-center justify-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                  <Plus className="w-6 h-6 text-gray-600" />
                </div>
                <p className="font-medium text-gray-900">เพิ่มรูปภาพ</p>
                <p className="text-sm text-gray-500">หรือลากแล้ววาง</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square">
                    <img
                      src={img}
                      alt={`Upload ${idx + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
                <div
                  className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="w-6 h-6 text-gray-400" />
                </div>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />

          {/* Upload from phone option */}
          <div className="mt-3 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">อัพโหลดรูปภาพจากโทรศัพท์</p>
                <p className="text-xs text-blue-600">โดยตรง เรียนรู้เพิ่มเติม</p>
              </div>
            </div>
            <Button variant="outline" size="sm">ลองใช้ดู</Button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="divide-y">
          {/* Listing Type Dropdown */}
          <div className="p-4">
            <Select
              value={formData.listingType}
              onValueChange={(v) => updateField('listingType', v as 'sale' | 'rent')}
            >
              <SelectTrigger className="w-full border-0 bg-gray-50 h-12 text-left">
                <SelectValue placeholder="บ้านสำหรับขายหรือเช่า" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">บ้านสำหรับขาย</SelectItem>
                <SelectItem value="rent">บ้านสำหรับเช่า</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Property Type Dropdown */}
          <div className="p-4">
            <Select
              value={formData.propertyType}
              onValueChange={(v) => updateField('propertyType', v)}
            >
              <SelectTrigger className="w-full border-0 bg-gray-50 h-12 text-left">
                <SelectValue placeholder="ประเภทอสังหาริมทรัพย์" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="condo">คอนโด</SelectItem>
                <SelectItem value="house">บ้านเดี่ยว</SelectItem>
                <SelectItem value="townhouse">ทาวน์เฮ้าส์</SelectItem>
                <SelectItem value="apartment">อพาร์ตเมนต์</SelectItem>
                <SelectItem value="land">ที่ดิน</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bedrooms */}
          <div className="p-4">
            <Input
              type="number"
              value={formData.bedrooms}
              onChange={(e) => updateField('bedrooms', e.target.value)}
              placeholder="จำนวนห้องนอน"
              className="border-0 bg-gray-50 h-12"
            />
          </div>

          {/* Bathrooms */}
          <div className="p-4">
            <Input
              type="number"
              value={formData.bathrooms}
              onChange={(e) => updateField('bathrooms', e.target.value)}
              placeholder="จำนวนห้องน้ำ"
              className="border-0 bg-gray-50 h-12"
            />
          </div>

          {/* Price */}
          <div className="p-4">
            <Input
              type="number"
              value={formData.price}
              onChange={(e) => updateField('price', e.target.value)}
              placeholder="ราคา"
              className="border-0 bg-gray-50 h-12"
            />
          </div>

          {/* Location */}
          <div className="p-4">
            <LocationPicker
              value={formData.location}
              onChange={(value) => updateField('location', value)}
              placeholder="ที่ตั้ง"
            />
          </div>

          {/* Description */}
          <div className="p-4">
            <Textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="คำอธิบายอสังหาริมทรัพย์"
              className="border-0 bg-gray-50 min-h-[100px] resize-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              ใส่รายละเอียด เช่น สาธารณูปโภค สิ่งอำนวยความสะดวก เงินมัดจำ และความพร้อมให้บริการ
            </p>
          </div>

          {/* Advanced Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium text-gray-900">รายละเอียดขั้นสูง</span>
              <span className="text-sm text-gray-500">ระบุหรือไม่ก็ได้</span>
            </div>
            <Input
              type="number"
              value={formData.squareMeters}
              onChange={(e) => updateField('squareMeters', e.target.value)}
              placeholder="ตารางเมตร"
              className="border-0 bg-gray-50 h-12"
            />
          </div>
        </div>

        {/* Footer Note */}
        <div className="p-4 bg-gray-50 text-xs text-gray-500">
          <p>
            สินค้าใน Marketplace จะแสดงต่อสาธารณะและทุกคนทั้งที่ใช้หรือไม่ใช้ Facebook 
            จะสามารถมองเห็นได้ เราไม่อนุญาตให้แสดงสินค้า เช่น สัตว์ ยาเสพติด อาวุธ 
            สินค้าปลอม และสินค้าอื่นๆ ที่ละเมิดนโยบายทรัพย์สินทางปัญญาใน Marketplace 
            โปรดดู<span className="text-blue-600">นโยบายการค้า</span>ของเรา
          </p>
        </div>

        {/* Submit Button */}
        <div className="p-4 border-t">
          <Button
            variant="accent"
            className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700"
            onClick={handleSubmit}
          >
            ถัดไป
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
