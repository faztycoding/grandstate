# Grand$tate — เอกสารอธิบายระบบครบวงจร
### Real Estate Posting Automation Platform
> เอกสารนี้จัดทำเพื่ออธิบายภาพรวม สถาปัตยกรรม และรายละเอียดเชิงลึกของระบบ Grand$tate
> เวอร์ชัน 1.1.0 | อัปเดตล่าสุด: มีนาคม 2026

---

## สารบัญ
1. [ภาพรวมทั่วไป — Grand$tate คืออะไร?](#1-ภาพรวมทั่วไป)
2. [ปัญหาที่แก้ — ทำไมต้องมี Grand$tate?](#2-ปัญหาที่แก้)
3. [ฟีเจอร์หลัก](#3-ฟีเจอร์หลัก)
4. [Tech Stack — เทคโนโลยีที่ใช้](#4-tech-stack)
5. [สถาปัตยกรรมระบบ (Architecture)](#5-สถาปัตยกรรมระบบ)
6. [Frontend — หน้าบ้าน](#6-frontend)
7. [Backend — หลังบ้าน](#7-backend)
8. [Database — ฐานข้อมูล](#8-database)
9. [ระบบ Automation — หัวใจของแอป](#9-ระบบ-automation)
10. [ระบบ Authentication & License](#10-ระบบ-authentication--license)
11. [Admin Dashboard — ห้องควบคุม](#11-admin-dashboard)
12. [ระบบชำระเงิน (Payment)](#12-ระบบชำระเงิน)
13. [Infrastructure & Deployment](#13-infrastructure--deployment)
14. [ความปลอดภัย (Security)](#14-ความปลอดภัย)
15. [PWA & Offline Support](#15-pwa--offline-support)
16. [Internationalization (i18n)](#16-internationalization)
17. [Package System — ระบบแพ็คเกจ](#17-package-system)
18. [คำศัพท์สำคัญ (Glossary)](#18-คำศัพท์สำคัญ)

---

## 1. ภาพรวมทั่วไป

**Grand$tate** คือ Web Application สำหรับ **นายหน้าอสังหาริมทรัพย์** ที่ช่วย **โพสต์ประกาศอสังหาฯ ลง Facebook Groups อัตโนมัติ** — ลดเวลาทำงานจากหลายชั่วโมงเหลือไม่กี่นาที

### แนวคิดหลัก
นายหน้าอสังหาฯ ต้องโพสต์ประกาศขาย/เช่า ลงกลุ่ม Facebook หลายสิบกลุ่มต่อวัน ซึ่งเป็นงานที่:
- ❌ ใช้เวลามาก (copy-paste ทีละกลุ่ม)
- ❌ น่าเบื่อ ซ้ำซาก
- ❌ เสี่ยงโดน Facebook บล็อค (โพสต์เร็วเกินไป)
- ❌ จัดการข้อมูลทรัพย์สินยาก

Grand$tate แก้ปัญหาเหล่านี้ด้วย **ระบบ Automation ที่เลียนแบบพฤติกรรมมนุษย์** เพื่อหลีกเลี่ยงการตรวจจับของ Facebook

### เว็บไซต์
- 🌐 Production: **https://grandstate.io**
- 🔧 API Server: **https://api.grandstate.io**

---

## 2. ปัญหาที่แก้

### ก่อนมี Grand$tate (ปัญหาของนายหน้า)
```
เช้า 8:00   → เปิด Facebook เลือกกลุ่ม 1
            → Copy ข้อความ + อัปรูป + กด Post
            → ย้ายไปกลุ่ม 2... ทำซ้ำ 30-50 กลุ่ม
เที่ยง 12:00 → เพิ่งโพสต์เสร็จ เหนื่อยมาก
            → บางกลุ่มโดนลบโพสต์เพราะ Facebook ตรวจจับว่าเป็น spam
```

### หลังมี Grand$tate
```
เช้า 8:00   → เปิด Grand$tate เลือกทรัพย์สิน + เลือกกลุ่ม
            → กด "เริ่ม Automation"
            → ระบบโพสต์ให้อัตโนมัติ หน่วงเวลาเหมือนคนจริง
8:30        → เสร็จแล้ว! โพสต์ 50 กลุ่ม + มี caption ไม่ซ้ำกัน
```

---

## 3. ฟีเจอร์หลัก

### 🏠 Property Management (จัดการทรัพย์สิน)
- เพิ่ม/แก้ไข/ลบ ประกาศอสังหาริมทรัพย์
- รองรับ ขาย + เช่า
- อัปโหลดรูปภาพหลายรูป
- ปักหมุดบนแผนที่ (Google Maps / Leaflet)
- กรอกข้อมูล: ราคา, จำนวนห้องนอน/น้ำ, พื้นที่, จังหวัด, อำเภอ

### 👥 Group Management (จัดการกลุ่ม Facebook)
- เพิ่มกลุ่ม Facebook ที่ต้องการโพสต์
- ดึงข้อมูลกลุ่มอัตโนมัติ (ชื่อ, จำนวนสมาชิก, โพสต์/วัน)
- เปิด/ปิด กลุ่มที่ต้องการใช้
- เพิ่มกลุ่มทีละหลายร้อยกลุ่ม (Bulk Add)

### 🤖 Automation Engine
- โพสต์อัตโนมัติลงหลายกลุ่มพร้อมกัน
- **Anti-Detection**: หน่วงเวลาสุ่ม + เลียนแบบพฤติกรรมมนุษย์
- **Smart Caption**: สร้าง caption ที่ไม่ซ้ำกันในแต่ละกลุ่ม
- **Duplicate Prevention**: ป้องกันโพสต์ซ้ำในกลุ่มเดิม
- **Daily Limit**: จำกัดโพสต์/วัน ตามแพ็คเกจ (reset 05:00 AM)
- **Queue System**: จัดคิวการโพสต์ ไม่ล้นระบบ

### 📊 Analytics & Reporting
- สถิติการโพสต์รายวัน/รายเดือน
- กราฟรายงาน (7 วัน, เดือนนี้, 3 เดือน, 6 เดือน, 1 ปี)
- ประวัติการโพสต์ทั้งหมด
- Export ข้อมูลเป็น JSON/CSV

### 🛡️ Admin Dashboard
- ดูสถิติผู้ใช้ทั้งหมด
- จัดการ License Keys
- ดู Worker Slots (engine status)
- Real-time monitoring ผ่าน SSE
- จัดการ Support Tickets
- เปลี่ยนแพ็คเกจผู้ใช้

### 🎨 UX/UI
- Dark Mode / Light Mode / หลายธีม
- Responsive Design (มือถือ + เดสก์ท็อป)
- Animations (Framer Motion)
- รองรับ 2 ภาษา (ไทย + อังกฤษ)
- PWA — ติดตั้งบนมือถือเหมือน Native App

---

## 4. Tech Stack

### Frontend (หน้าบ้าน — สิ่งที่ผู้ใช้เห็น)
| เทคโนโลยี | เวอร์ชัน | ทำหน้าที่ | ทำไมถึงเลือก |
|-----------|---------|----------|-------------|
| **React** | 18 | UI Framework หลัก | Component-based, Virtual DOM ทำให้ UI อัปเดตเร็ว |
| **TypeScript** | 5.x | ภาษาที่ใช้เขียน | เพิ่ม Type Safety จับ bug ตั้งแต่ตอนเขียน |
| **Vite** | 5.x | Build Tool | เร็วกว่า Webpack 10-100x ใช้ ESBuild |
| **TailwindCSS** | 3.x | CSS Framework | Utility-first เขียน style ใน HTML ไม่ต้องสร้างไฟล์ CSS แยก |
| **shadcn/ui** | - | UI Components | Component สวยๆ พร้อมใช้ แก้ custom ได้ 100% |
| **Framer Motion** | - | Animation Library | สร้าง animation แบบ declarative สำหรับ React |
| **React Router** | 6 | Routing | จัดการ URL paths (/settings, /groups, /automation) |
| **TanStack Query** | 5 | Data Fetching | Cache, retry, background refresh อัตโนมัติ |
| **Lucide** | - | Icons | Icon library น้ำหนักเบา 1000+ ไอคอน |
| **Sonner** | - | Toast Notifications | แจ้งเตือนสวยๆ มุมล่างขวา |
| **Recharts** | - | Charts | สร้างกราฟ สถิติ |
| **React Leaflet** | 4.x | Map | แผนที่ interactive ปักหมุดพิกัด |

### Backend (หลังบ้าน — สิ่งที่ผู้ใช้ไม่เห็น)
| เทคโนโลยี | ทำหน้าที่ | ทำไมถึงเลือก |
|-----------|----------|-------------|
| **Node.js** | Runtime | รัน JavaScript บน server ได้ รองรับ async I/O |
| **Express.js** | Web Framework | สร้าง API endpoints ง่าย เบา |
| **Puppeteer** | Browser Automation | ควบคุม Chrome ผ่าน code สำหรับโพสต์ Facebook |
| **PM2** | Process Manager | Auto-restart เมื่อ crash, monitoring, log management |
| **Nginx** | Reverse Proxy | รับ traffic จาก internet → forward ไปยัง Node.js |

### Database & Auth
| เทคโนโลยี | ทำหน้าที่ | ทำไมถึงเลือก |
|-----------|----------|-------------|
| **Supabase** | Database + Auth + Realtime | Open-source alternative ของ Firebase, มี PostgreSQL จริง |
| **PostgreSQL** | Relational Database (ผ่าน Supabase) | เสถียร รองรับ JSON, Full-text search |

### Infrastructure
| เทคโนโลยี | ทำหน้าที่ |
|-----------|----------|
| **Vercel** | Frontend hosting + CDN |
| **VPS (Linux)** | Backend server |
| **GitHub** | Source code repository |
| **Omise** | Payment gateway (ชำระเงิน) |

---

## 5. สถาปัตยกรรมระบบ

### ภาพรวม Architecture

```
                         ┌─────────────────────┐
                         │    USER'S BROWSER    │
                         │  (React SPA on CDN)  │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │   Vercel CDN      │           │   VPS Server      │
        │   (Frontend)      │           │   (Backend)       │
        │                   │           │                   │
        │  grandstate.io    │  ──API──▶ │ api.grandstate.io │
        │                   │           │                   │
        │  • HTML/CSS/JS    │           │  • Express.js     │
        │  • Static Assets  │           │  • Puppeteer      │
        │  • Service Worker │           │  • Queue System   │
        └───────────────────┘           └────────┬──────────┘
                                                 │
                                    ┌────────────┼────────────┐
                                    ▼            ▼            ▼
                            ┌──────────┐  ┌──────────┐ ┌──────────┐
                            │ Supabase │  │ Facebook  │ │  Omise   │
                            │ (DB+Auth)│  │ (Target)  │ │(Payment) │
                            └──────────┘  └──────────┘ └──────────┘
```

### การสื่อสารระหว่างส่วนต่างๆ

```
1. ผู้ใช้เปิดเว็บ grandstate.io
   → Vercel CDN ส่ง React App (HTML/CSS/JS) มา

2. ผู้ใช้ Login
   → React App ส่ง request ไปยัง Supabase Auth
   → Supabase ส่ง JWT Token กลับมา

3. ผู้ใช้กดเริ่ม Automation
   → React App ส่ง request + JWT Token ไปยัง api.grandstate.io
   → Backend ตรวจ Token → สร้าง Automation Job
   → Puppeteer เปิด Chrome → เข้า Facebook → โพสต์ทีละกลุ่ม
   → ส่ง Progress กลับมาผ่าน SSE (Server-Sent Events)

4. ผู้ใช้ชำระเงิน
   → React App ส่งข้อมูลบัตร → Omise
   → Omise ส่ง Webhook → Payment Server (port 3002)
   → Server อัปเดตแพ็คเกจใน Supabase
```

### แนวคิดสถาปัตยกรรม

**Separation of Concerns** — แยกความรับผิดชอบชัดเจน:

| ส่วน | ความรับผิดชอบ | ตั้งอยู่ที่ |
|------|-------------|-----------|
| Frontend | UI + User Interaction | Vercel CDN (ทั่วโลก) |
| Main Backend | API + Automation + Queue | VPS (port 3001) |
| Payment Server | Charge + Webhook | VPS (port 3002) |
| Database | Data Storage + Auth | Supabase Cloud |

---

## 6. Frontend — หน้าบ้าน

### โครงสร้างไฟล์
```
src/
├── components/          ← UI Components ย่อยๆ
│   ├── ui/              ← shadcn/ui base components (Button, Input, Dialog...)
│   ├── layout/          ← Layout components (DashboardLayout, Sidebar)
│   ├── groups/          ← GroupCard, BulkAddGroupDialog
│   ├── property/        ← PropertyCard, PropertyForm
│   └── automation/      ← AutomationControls, PropertyGalleryForm
├── pages/               ← หน้าเว็บแต่ละหน้า
│   ├── Auth.tsx          ← หน้า Login / Register
│   ├── Properties.tsx    ← หน้าจัดการทรัพย์สิน
│   ├── Groups.tsx        ← หน้าจัดการกลุ่ม Facebook
│   ├── Automation.tsx    ← หน้าสั่ง Automation
│   ├── Analytics.tsx     ← หน้าสถิติ
│   ├── Settings.tsx      ← หน้าตั้งค่า
│   ├── UserProfile.tsx   ← หน้าโปรไฟล์
│   ├── Pricing.tsx       ← หน้าราคาแพ็คเกจ
│   ├── AdminDashboard.tsx ← หน้า Admin (เฉพาะ admin)
│   └── ...
├── hooks/               ← Custom React Hooks
│   ├── useTheme.ts       ← Theme management (dark/light/custom)
│   ├── useLicenseAuth.ts ← License + Auth logic
│   ├── usePackageLimits.ts ← Package feature limits
│   ├── useFacebookConnection.ts ← FB session management
│   └── useSupabaseGroups.ts ← Groups CRUD with Supabase
├── i18n/                ← Internationalization (ภาษา)
│   ├── LanguageContext.tsx ← Language Provider
│   ├── en.ts             ← ข้อความภาษาอังกฤษ
│   └── th.ts             ← ข้อความภาษาไทย
├── lib/                 ← Utility functions
│   ├── supabase.ts       ← Supabase client instance
│   ├── config.ts         ← API URL + apiFetch wrapper
│   ├── version.ts        ← App version constant
│   └── utils.ts          ← Helper functions
└── App.tsx              ← Root component + Routes
```

### Routing (เส้นทาง URL)
| URL | หน้า | Protected? |
|-----|------|-----------|
| `/` | Landing Page | ❌ Public |
| `/auth` | Login / Register | ❌ Public |
| `/pricing` | ราคาแพ็คเกจ | ❌ Public |
| `/properties` | จัดการทรัพย์สิน | ✅ ต้อง Login |
| `/groups` | จัดการกลุ่ม | ✅ ต้อง Login |
| `/automation` | สั่ง Automation | ✅ ต้อง Login |
| `/analytics` | สถิติ | ✅ ต้อง Login |
| `/settings` | ตั้งค่า | ✅ ต้อง Login |
| `/profile` | โปรไฟล์ | ✅ ต้อง Login |
| `/adminfaz` | Admin Dashboard | ✅ ต้องเป็น Admin |

### State Management
ไม่ใช้ Redux หรือ Zustand — ใช้วิธีที่เบากว่า:

- **React Context** → สำหรับ global state (Theme, Language, Auth)
- **TanStack Query** → สำหรับ server state (data fetching + caching)
- **useState/useReducer** → สำหรับ local component state
- **localStorage** → สำหรับ persist user preferences (theme, language)

### Component Design Pattern
ใช้ **Composition Pattern** — ประกอบ component เล็กๆ เข้าด้วยกัน:

```tsx
// ตัวอย่าง: PropertyCard ใช้ components หลายตัวประกอบกัน
<Card>
  <CardContent>
    <Badge>ขาย</Badge>           ← จาก shadcn/ui
    <DropdownMenu>               ← จาก shadcn/ui
      <DropdownMenuItem>แก้ไข</DropdownMenuItem>
      <DropdownMenuItem>ลบ</DropdownMenuItem>
    </DropdownMenu>
    <motion.div>                 ← จาก Framer Motion
      <img src={...} />
    </motion.div>
  </CardContent>
</Card>
```

---

## 7. Backend — หลังบ้าน

### โครงสร้างไฟล์
```
backend/
├── src/
│   ├── index.js              ← Entry point + Express routes (40+ endpoints)
│   └── services/
│       ├── postingTracker.js  ← ติดตามการโพสต์ + daily limit
│       ├── userSessionManager.js ← จัดการ session + presence
│       └── marketplaceWorker.js  ← Facebook Marketplace automation
server/
└── payment.js                ← Payment server แยกต่างหาก (port 3002)
```

### API Endpoints หลักๆ
```
Authentication:
  POST   /api/auth/verify-token     ← ตรวจสอบ JWT token

Properties:
  GET    /api/properties             ← ดึงรายการทรัพย์สิน
  POST   /api/properties             ← เพิ่มทรัพย์สิน
  PUT    /api/properties/:id         ← แก้ไขทรัพย์สิน
  DELETE /api/properties/:id         ← ลบทรัพย์สิน

Groups:
  GET    /api/groups                 ← ดึงรายการกลุ่ม
  POST   /api/groups/fetch-info      ← ดึงข้อมูลกลุ่มจาก Facebook

Automation:
  POST   /api/automation/start       ← เริ่มโพสต์อัตโนมัติ
  POST   /api/automation/stop        ← หยุดโพสต์
  GET    /api/automation/status      ← ดูสถานะ
  GET    /api/automation/stream      ← SSE stream (real-time progress)

Analytics:
  GET    /api/analytics              ← สถิติภาพรวม
  GET    /api/posting-history        ← ประวัติการโพสต์
  GET    /api/user/real-stats        ← สถิติผู้ใช้แบบ real-time

Admin:
  GET    /api/admin/users            ← รายชื่อผู้ใช้ทั้งหมด
  POST   /api/admin/change-package   ← เปลี่ยนแพ็คเกจ
  GET    /api/admin/engine-status    ← สถานะ engine
  POST   /api/admin/clear-history    ← ล้างประวัติ

Session/Presence:
  POST   /api/session/presence       ← heartbeat (ฉันยังออนไลน์)
  GET    /api/session/active-users   ← จำนวนผู้ใช้ออนไลน์
```

### Middleware Chain
ทุก request ผ่าน middleware เหล่านี้ตามลำดับ:

```
Request → CORS → JSON Parser → Auth Middleware → Rate Limit → Route Handler → Response
```

1. **CORS** — อนุญาตให้ frontend (grandstate.io) เรียก API ได้
2. **JSON Parser** — แปลง request body เป็น JavaScript object
3. **Auth Middleware** — ตรวจสอบ JWT token ว่าเป็นผู้ใช้จริง
4. **Rate Limit** — จำกัด request/นาที ป้องกัน abuse
5. **Route Handler** — ทำงานตาม logic ของ endpoint นั้นๆ

---

## 8. Database — ฐานข้อมูล

### Supabase (PostgreSQL)

ใช้ **Supabase** ซึ่งเป็น Backend-as-a-Service ที่ให้:
- **PostgreSQL Database** — ฐานข้อมูล relational เต็มรูปแบบ
- **Authentication** — ระบบ login/register + JWT
- **Row Level Security (RLS)** — กำหนดสิทธิ์ระดับแถว
- **Realtime** — subscribe การเปลี่ยนแปลงแบบ real-time

### Tables หลัก
```sql
-- ผู้ใช้ (สร้างโดย Supabase Auth อัตโนมัติ)
auth.users
  id, email, encrypted_password, created_at

-- ทรัพย์สิน
properties
  id, user_id, title, listing_type, property_type,
  price, bedrooms, bathrooms, square_meters,
  location, district, province, google_maps_link,
  description, images[], contacts[], is_sold, created_at

-- กลุ่ม Facebook
facebook_groups
  id, user_id, name, url, member_count,
  posts_today, posts_last_month, is_active, created_at

-- License Keys
license_keys
  id, key, user_id, package, is_active,
  activated_at, expires_at

-- Support Tickets
support_tickets
  id, user_id, subject, message, status, created_at

-- Facebook Sessions
fb_sessions
  id, user_id, cookies, access_token, created_at
```

### Row Level Security (RLS)
Supabase ใช้ PostgreSQL RLS เพื่อให้แต่ละ user เห็นเฉพาะ data ของตัวเอง:

```sql
-- ตัวอย่าง: user เห็นแค่ properties ของตัวเอง
CREATE POLICY "Users can only see own properties"
ON properties FOR SELECT
USING (auth.uid() = user_id);
```

---

## 9. ระบบ Automation — หัวใจของแอป

### Flow การทำงาน

```
                ผู้ใช้กด "เริ่ม Automation"
                         │
                         ▼
              ┌─────────────────────┐
              │  Pre-flight Check   │ ← ตรวจสอบ: limit เหลือ? กลุ่มไหนโพสต์ได้?
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Queue Job Created  │ ← สร้าง job เข้าคิว
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Worker Picks Job   │ ← Worker slot ว่างรับ job
              └──────────┬──────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │     Puppeteer Chrome         │
          │                              │
          │  1. เปิด Facebook            │
          │  2. ใส่ Cookie / Login       │
          │  3. ไปที่กลุ่ม #1            │
          │  4. สร้าง caption (ไม่ซ้ำ)   │
          │  5. อัปโหลดรูป               │
          │  6. กด Post                  │
          │  7. รอ 15-45 วินาที (สุ่ม)   │ ← Anti-Detection
          │  8. ไปกลุ่ม #2... ทำซ้ำ      │
          │                              │
          │  Progress → SSE → Frontend   │ ← Real-time update
          └──────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  PostingTracker     │ ← บันทึกประวัติ + อัปเดตสถิติ
              └─────────────────────┘
```

### Anti-Detection (หลบการตรวจจับ)
Facebook มีระบบตรวจจับ bot/spam ดังนี้:

| Facebook ตรวจจับ | Grand$tate แก้ยังไง |
|-----------------|-------------------|
| โพสต์เร็วเกินไป | หน่วงเวลาสุ่ม 15-45 วินาที ระหว่างกลุ่ม |
| ข้อความซ้ำทุกกลุ่ม | สร้าง caption ไม่ซ้ำกัน (สุ่มลำดับข้อมูล, เปลี่ยน emoji) |
| พิมพ์เร็วผิดปกติ | จำลองการพิมพ์ทีละตัวอักษร (typing simulation) |
| เปิดหลาย tab พร้อมกัน | ทำทีละกลุ่ม sequential |
| IP เดียวโพสต์หลายบัญชี | แต่ละ user ใช้ session ของตัวเอง |

### PostingTracker — ระบบติดตามการโพสต์

```javascript
class PostingTracker {
  // Daily cycle reset ทุก 05:00 AM
  // ป้องกันโพสต์ซ้ำ — เช็ค property+group cooldown
  // บันทึกประวัติ + สถิติรายวัน
  // Package limit enforcement
  // รองรับ automation run tracking

  // เก็บข้อมูลใน: data/{userId}/posting-history.json
  // Archive สถิติย้อนหลัง 30 วัน
}
```

### Queue System
ระบบคิวป้องกันไม่ให้มี automation หลาย job ทำงานพร้อมกัน:

```
Job Queue: [Job#1 (running)] → [Job#2 (waiting)] → [Job#3 (waiting)]

Worker Slots:
  Slot 001: 🟢 Active — User A posting to 30 groups
  Slot 002: 🔴 Standby — No user
  Slot 003: 🔴 Standby — No user
  ...
```

---

## 10. ระบบ Authentication & License

### Authentication Flow
```
1. User กรอก email + password → กด Register/Login
2. Supabase Auth ตรวจสอบ → ส่ง JWT Token กลับ
3. Frontend เก็บ Token ใน memory
4. ทุก API request → แนบ Token ใน Authorization header
5. Backend ตรวจ Token กับ Supabase → อนุญาต/ปฏิเสธ
```

### JWT Token คืออะไร?
> **JSON Web Token** — เหมือน "บัตรพนักงาน" ดิจิทัล
> มี 3 ส่วน: Header.Payload.Signature
> Payload บอกว่า "ฉันคือ user_id: xxx, email: yyy, หมดอายุ: zzz"
> ปลอมแปลงไม่ได้เพราะมี Signature ที่สร้างด้วย secret key

### License System
ระบบ License Key สำหรับเปิดใช้งานแพ็คเกจ:

```
License Key: GS-AGENT-XXXX-XXXX-XXXX
  ↓
ผู้ใช้กรอกใน Settings → ระบบตรวจสอบใน Supabase
  ↓
ถ้า valid → อัปเดต package เป็น "agent" + ตั้งวันหมดอายุ
  ↓
ผู้ใช้ได้สิทธิ์ตามแพ็คเกจ (โพสต์ 300/วัน, กลุ่ม 300 กลุ่ม, ฯลฯ)
```

### Password Security
- รหัสผ่านถูก hash ด้วย **bcrypt** ใน Supabase
- เปลี่ยนรหัสผ่านต้อง **ยืนยันรหัสเก่าก่อน** (re-authentication)
- Supabase ไม่เก็บรหัสผ่านเป็น plain text เด็ดขาด

---

## 11. Admin Dashboard — ห้องควบคุม

### เข้าถึงได้เฉพาะ Admin
URL: `grandstate.io/adminfaz`

### Features
- **ภาพรวม**: จำนวนผู้ใช้, รายได้, สถิติโพสต์
- **จัดการผู้ใช้**: ดูรายชื่อ, เปลี่ยนแพ็คเกจ, ดูประวัติ
- **License Keys**: สร้าง/จัดการ keys
- **Engine Monitor**: ดู Worker Slots แบบ real-time
- **Queue Monitor**: ดูคิว automation ที่กำลังทำงาน
- **Support Tickets**: ตอบปัญหาผู้ใช้

### Real-time Monitoring (SSE)
Admin Dashboard ใช้ **Server-Sent Events (SSE)** เพื่อรับข้อมูลแบบ real-time:

```
Server ────────────────────▶ Browser
         event: engine-status
         data: {"slot": 1, "status": "active", "user": "xxx"}

         event: job-progress
         data: {"jobId": 1, "progress": 45, "group": "บ้านมือสอง"}

         event: presence-update
         data: {"activeUsers": 5, "adminOnline": true}
```

ต่างจาก WebSocket ตรงที่ SSE เป็น **one-way** (server → client เท่านั้น) เหมาะกับ monitoring

### Active Users Presence
ระบบติดตามว่าใครออนไลน์อยู่:
- Frontend ส่ง **heartbeat** ทุก 5 วินาที
- Backend timeout **12 วินาที** — ถ้าไม่ได้ยิน heartbeat = offline
- แสดงจำนวน "ออนไลน์", "ใช้ automation", มี crown icon เมื่อ admin ออนไลน์

---

## 12. ระบบชำระเงิน

### Payment Flow
```
1. ผู้ใช้เลือกแพ็คเกจที่ต้องการ
2. กรอกข้อมูลบัตร/QR
3. ข้อมูลส่งไปยัง Omise (Payment Gateway)
4. Omise charge เงิน
5. Omise ส่ง Webhook กลับมา: "ชำระสำเร็จ!"
6. Payment Server (port 3002) รับ Webhook
7. ตรวจสอบ signature → อัปเดตแพ็คเกจใน Supabase
8. ส่ง email ยืนยัน
```

### Omise คืออะไร?
> **Omise** (ปัจจุบันชื่อ **Opn Payments**) — Payment Gateway สัญชาติไทย
> รองรับ: บัตรเครดิต, PromptPay QR, TrueMoney Wallet
> ค่าธรรมเนียม: ~3.65% ต่อรายการ

### Rate Limiting (ป้องกัน abuse)
```
Charge Endpoint:  10 requests / 15 นาที / IP
Webhook Endpoint: 60 requests / 1 นาที / IP
```

---

## 13. Infrastructure & Deployment

### Vercel (Frontend)
```
                    ┌──── CDN Edge Locations ────┐
                    │ 🌍 70+ locations worldwide  │
Developer           │                             │    Users
   │                │  Bangkok  │ Tokyo  │ US     │      │
   │ git push       │     ▼     │   ▼    │  ▼     │      │
   ▼                │  [cache]  │[cache] │[cache] │      │
GitHub ──webhook──▶ Vercel Build ──deploy──▶ CDN ◀─── requests
                    │                             │
                    └─────────────────────────────┘
```

**ทำไมใช้ CDN?**
- ผู้ใช้ในไทยจะดึง file จาก server ที่ใกล้ที่สุด (เช่น Singapore/Bangkok)
- ไม่ต้องข้ามมหาสมุทรไปดึงจาก US → เว็บเปิด **เร็วขึ้น 2-5 เท่า**

### VPS (Backend)
```
VPS: 76.13.185.83 (Linux)
  │
  ├── Nginx (port 80/443)
  │     ├── api.grandstate.io → localhost:3001 (Main Backend)
  │     └── payment.grandstate.io → localhost:3002 (Payment)
  │
  ├── PM2 (Process Manager)
  │     ├── backend (Node.js) — port 3001
  │     └── payment (Node.js) — port 3002
  │
  └── SSL Certificate (Let's Encrypt)
        └── Auto-renew ทุก 90 วัน
```

### CI/CD Pipeline
```
                    Continuous Integration / Continuous Deployment
                    ─────────────────────────────────────────────

Developer ──(code)──▶ git commit ──▶ git push ──▶ GitHub
                                                     │
                                         ┌───────────┼───────────┐
                                         ▼                       ▼
                                   Vercel (auto)            VPS (manual)
                                   • npm run build          • git pull
                                   • Deploy to CDN          • npm install
                                   • ~20 seconds            • pm2 restart
                                         │                       │
                                         ▼                       ▼
                                   grandstate.io         api.grandstate.io
                                    (Frontend)              (Backend)
```

---

## 14. ความปลอดภัย

### มาตรการที่ใช้

| ด้าน | มาตรการ |
|------|---------|
| **Authentication** | JWT Token + Supabase Auth |
| **Password** | bcrypt hash + re-auth ก่อนเปลี่ยน |
| **API Protection** | Token verification ทุก request |
| **Rate Limiting** | express-rate-limit บน payment endpoints |
| **CORS** | อนุญาตเฉพาะ grandstate.io |
| **RLS** | Row Level Security — user เห็นแค่ data ของตัวเอง |
| **SSL/TLS** | HTTPS ทุก connection (Let's Encrypt) |
| **Admin Route** | AdminRoute component ตรวจสอบก่อนเข้า |
| **Webhook Signature** | ตรวจ Omise signature ก่อนประมวลผล |
| **Cookie Consent** | PDPA/GDPR compliance |

### HTTPS ทำงานยังไง?
```
Browser ←──── TLS Encrypted ────▶ Nginx ←── plain ──▶ Node.js
  (User)    (คนกลางอ่านไม่ได้)    (SSL)     (internal)  (Backend)
```

---

## 15. PWA & Offline Support

### Progressive Web App (PWA)
Grand$tate สามารถ "ติดตั้ง" บนมือถือเหมือน native app:

- **manifest.json** — กำหนดชื่อ, ไอคอน, สีพื้นหลัง
- **Service Worker (sw.js)** — cache ไฟล์ + offline fallback

### Service Worker Strategy
```
Network First (เน้นข้อมูลล่าสุด):
  Request → ลองดึงจาก Internet ก่อน
           → ถ้าสำเร็จ → ส่งกลับ + เก็บ cache
           → ถ้าไม่มี Internet → ใช้จาก cache

เหมาะกับ web app ที่ข้อมูลเปลี่ยนบ่อย แต่ยังอยากให้ใช้ offline ได้บ้าง
```

---

## 16. Internationalization

### รองรับ 2 ภาษา
- 🇹🇭 **ภาษาไทย** (default)
- 🇬🇧 **English**

### วิธีการ
```tsx
// LanguageContext ให้ทุก component เข้าถึงภาษาปัจจุบัน
const { t, language } = useLanguage();

// ใช้งาน:
<h1>{t.properties.title}</h1>
// ไทย: "ทรัพย์สิน"
// EN: "Properties"
```

### Typography
- ภาษาไทย → **IBM Plex Sans Thai**
- ภาษาอังกฤษ → **IBM Plex Sans**
- Code/ตัวเลข → **IBM Plex Mono**

ระบบจะเปลี่ยน font อัตโนมัติตาม `<html lang="th">` หรือ `<html lang="en">`

---

## 17. Package System

### 3 แพ็คเกจ

| Feature | 🆓 Free (Rookie) | ⭐ Agent (Top Agent) | 👑 Elite |
|---------|-----------------|---------------------|---------|
| โพสต์/วัน | 10 | 300 | 750 |
| กลุ่ม Facebook | 10 | 300 | ไม่จำกัด |
| ทรัพย์สิน | 5 | 50 | ไม่จำกัด |
| FB Accounts | 1 | 3 | 10 |
| Smart Caption | ❌ | ✅ | ✅ |
| Priority Queue | ❌ | ✅ | ✅ |
| Analytics | Basic | Full | Full + Export |

### Daily Reset
- ทุก 05:00 AM เคาน์เตอร์ "โพสต์วันนี้" รีเซ็ตเป็น 0
- ผู้ใช้เริ่มโพสต์ใหม่ได้ตามจำนวน limit ของแพ็คเกจ
- สถิติวันก่อนหน้าถูก archive ไว้ (เก็บย้อนหลัง 30 วัน)

---

## 18. คำศัพท์สำคัญ (Glossary)

| คำ | ความหมาย |
|----|---------|
| **SPA** | Single Page Application — เว็บที่โหลด HTML ครั้งเดียว แล้วเปลี่ยนหน้าด้วย JavaScript |
| **API** | Application Programming Interface — ช่องทางให้ software คุยกัน |
| **REST API** | API ที่ใช้ HTTP methods (GET/POST/PUT/DELETE) ตาม convention |
| **JWT** | JSON Web Token — ตั๋ว digital พิสูจน์ตัวตน |
| **CDN** | Content Delivery Network — กระจาย file ไป server ทั่วโลก |
| **CI/CD** | Continuous Integration / Continuous Deployment — push → deploy อัตโนมัติ |
| **SSE** | Server-Sent Events — server ส่งข้อมูล real-time ไปยัง browser (ทางเดียว) |
| **WebSocket** | สื่อสาร 2 ทาง real-time ระหว่าง server และ browser |
| **Rate Limiting** | จำกัด request/เวลา ป้องกัน abuse |
| **PWA** | Progressive Web App — เว็บที่ install เหมือน native app |
| **Service Worker** | Script รันใน background ของ browser ทำ caching/offline |
| **Webhook** | URL ที่ service อื่นส่ง request มาเมื่อเกิด event |
| **ORM** | Object-Relational Mapping — เข้าถึง DB ด้วย code แทน SQL ตรงๆ |
| **Middleware** | ฟังก์ชันที่รันระหว่าง request กับ response |
| **RLS** | Row Level Security — กำหนดสิทธิ์ระดับแถวใน database |
| **CORS** | Cross-Origin Resource Sharing — อนุญาตให้เว็บ domain หนึ่งเรียก API ของ domain อื่น |
| **SSL/TLS** | เข้ารหัส connection ระหว่าง browser กับ server (HTTPS) |
| **PDPA** | พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (กฎหมายไทย) |
| **GDPR** | General Data Protection Regulation (กฎหมายยุโรปเรื่อง privacy) |
| **Puppeteer** | Library ควบคุม Chrome browser ผ่าน code |
| **Reverse Proxy** | ตัวกลางรับ traffic แล้ว forward ไปยัง server จริง |
| **Hash** | แปลงข้อมูลเป็นรหัสทางเดียว (เช่น password → hash ย้อนกลับไม่ได้) |
| **Virtual DOM** | สำเนาของ DOM จริง ใน memory — React ใช้เปรียบเทียบก่อน update จริง |
| **Component** | ชิ้นส่วน UI ที่ reuse ได้ (เช่น Button, Card, Dialog) |
| **Hook** | ฟังก์ชันพิเศษใน React ที่ให้ component มี state/lifecycle |
| **Build** | กระบวนการแปลง source code → file ที่ browser อ่านได้ |
| **Bundle** | ไฟล์ JS ที่ถูกรวมจากหลายไฟล์เป็นไฟล์เดียว (หรือไม่กี่ไฟล์) |
| **Tree Shaking** | ตัด code ที่ไม่ได้ใช้ออกจาก bundle |
| **Code Splitting** | แบ่ง bundle เป็นชิ้นเล็กๆ โหลดเฉพาะที่ต้องใช้ |
| **Lazy Loading** | โหลด component เมื่อต้องใช้จริงเท่านั้น |
| **Edge Network** | Server ที่อยู่ใกล้ผู้ใช้ (ขอบของ network) |
| **Immutable Deployment** | ทุก deploy เก็บถาวร rollback ได้ทุกเมื่อ |

---

> 📝 **เอกสารนี้เป็นส่วนหนึ่งของ Grand$tate v1.1.0**
> สร้างเมื่อ: มีนาคม 2026
> ผู้จัดทำ: Grand$tate Development Team
