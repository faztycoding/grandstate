export type PropertyType = 'condo' | 'house' | 'townhouse' | 'land' | 'apartment' | 'commercial';

export type ListingType = 'sale' | 'rent';

export interface ContactInfo {
  id: string;
  name: string;
  phone: string;
  lineId: string;
}

export interface Property {
  id: string;
  userId: string;
  type: PropertyType;
  listingType: ListingType;
  title: string;
  price: number;
  location: string;
  district: string;
  province: string;
  size: number; // sq.m.
  bedrooms: number;
  bathrooms: number;
  description: string;
  images: string[];
  contactName: string;
  contactPhone: string;
  contactLine?: string;
  contacts?: ContactInfo[];
  amenities: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FacebookGroup {
  id: string;
  userId: string;
  name: string;
  url: string;
  groupId: string;
  memberCount?: number;
  postsToday?: number;        // โพสต์ใหม่ในวันนี้
  postsLastMonth?: number;    // โพสต์ในเดือนที่ผ่านมา
  isActive: boolean;
  lastPosted?: Date;
  lastUpdated?: Date;         // วันที่อัปเดตข้อมูลล่าสุด
}

export type CaptionStyle = 'friendly' | 'professional' | 'casual';

export interface PostingSchedule {
  id: string;
  propertyId: string;
  groupIds: string[];
  captionStyle: CaptionStyle;
  scheduledFor?: Date;
  delayMinutes: number;
  status: 'pending' | 'approved' | 'posting' | 'completed' | 'failed';
  captions: Record<string, string>; // groupId -> caption
  imageOrder: Record<string, number[]>; // groupId -> image indices
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  dailyPostLimit: number;
  postsToday: number;
}
