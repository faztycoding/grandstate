
import { motion } from 'framer-motion';
import { Gavel, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-8"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    ย้อนกลับ
                </Button>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="prose dark:prose-invert max-w-none"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <Gavel className="w-10 h-10 text-primary" />
                        <h1 className="text-4xl font-bold m-0">ข้อตกลงและเงื่อนไขการใช้บริการ (Terms of Service)</h1>
                    </div>

                    <p className="lead text-xl text-muted-foreground">
                        มีผลบังคับใช้ตั้งแต่วันที่ 1 มกราคม 2567
                    </p>

                    <div className="bg-card p-6 rounded-lg border my-8">
                        <h3>1. ข้อตกลงทั่วไป</h3>
                        <p>การเข้าใช้งาน Grand$tate หมายความว่าท่านยอมรับข้อตกลงและเงื่อนไขเหล่านี้ หากท่านไม่ยอมรับ โปรดหยุดการใช้งานทันที</p>
                    </div>

                    <h3>2. การอนุญาตให้ใช้สิทธิ์ (License)</h3>
                    <p>เราอนุญาตให้ท่านใช้ซอฟต์แวร์ตามแพ็คเกจที่ท่านเลือกซื้อ:</p>
                    <ul>
                        <li><strong>Personal Use:</strong> สำหรับใช้งานส่วนตัว หรือธุรกิจขนาดเล็ก</li>
                        <li><strong>Commercial Use:</strong> สำหรับใช้งานในองค์กร หรือธุรกิจขนาดใหญ่</li>
                        <li>ห้ามทำซ้ำ ดัดแปลง หรือจำหน่ายจ่ายแจกซอฟต์แวร์โดยไม่ได้รับอนุญาต</li>
                    </ul>

                    <h3>3. การชำระเงินและการขอคืนเงิน</h3>
                    <ul>
                        <li>การชำระเงินจะถูกดำเนินการผ่านผู้ให้บริการภายนอก (Omise)</li>
                        <li><strong>นโยบายการคืนเงิน:</strong> เรายินดีคืนเงินเต็มจำนวนภายใน 7 วัน หากซอฟต์แวร์ไม่สามารถใช้งานได้ตามที่ระบุ (Money Back Guarantee)</li>
                    </ul>

                    <h3>4. ข้อจำกัดความรับผิด</h3>
                    <p>เราไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดจากการใช้งานซอฟต์แวร์ผิดวิธี หรือเหตุสุดวิสัย</p>

                    <h3>5. การเปลี่ยนแปลงเงื่อนไข</h3>
                    <p>เราสงวนสิทธิ์ในการเปลี่ยนแปลงข้อตกลงและเงื่อนไขได้ตลอดเวลา โดยจะแจ้งให้ท่านทราบล่วงหน้า</p>

                    <hr className="my-8" />

                    <h3>ติดต่อเรา</h3>
                    <p>หากท่านมีคำถามเกี่ยวกับข้อตกลงและเงื่อนไข สามารถติดต่อได้ที่:</p>
                    <ul>
                        <li><strong>Email:</strong> support@grandstate.co</li>
                        <li><strong>Line OA:</strong> @grandstate</li>
                    </ul>
                </motion.div>
            </div>
        </div>
    );
}
