import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { Alert } from '../../components/ui'
import { Settings, HandMetal, Bot, Save, CheckCircle, History, AlertTriangle } from 'lucide-react'

export default function SettingsPage() {
  const { profile, isSuperAdmin } = useAuth()
  const { commRates, saveCommissionRates, getUserName } = useData()

  const [manual,  setManual]  = useState('')
  const [ai,      setAi]      = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [err,     setErr]     = useState('')

  // sync local state เมื่อ commRates โหลดมา
  useEffect(() => {
    setManual(commRates.manualRate ?? 5)
    setAi(commRates.aiRate ?? 2)
  }, [commRates.manualRate, commRates.aiRate])

  if (!isSuperAdmin) {
    return (
      <div className="card flex items-center gap-3 text-orange-400">
        <AlertTriangle size={20} />
        <span>เฉพาะผู้ดูแลสูงสุดเท่านั้นที่สามารถตั้งค่าค่าคอมได้</span>
      </div>
    )
  }

  const handleSave = async () => {
    if (parseFloat(manual) < 0 || parseFloat(ai) < 0) {
      setErr('ค่าคอมต้องไม่ติดลบ'); return
    }
    setSaving(true); setErr('')
    try {
      await saveCommissionRates(manual, ai)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const hasChanged =
    parseFloat(manual) !== parseFloat(commRates.manualRate) ||
    parseFloat(ai)     !== parseFloat(commRates.aiRate)

  const previewManual = parseFloat(manual) || 0
  const previewAi     = parseFloat(ai)     || 0

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-black">ตั้งค่าระบบ</h2>
        <p className="text-xs text-gray-500 mt-0.5">กำหนดอัตราค่าคอมมิชชั่นกลาง</p>
      </div>

      {err    && <Alert type="error">{err}</Alert>}
      {saved  && (
        <Alert type="success">
          <CheckCircle size={15} /> บันทึกค่าคอมเรียบร้อยแล้ว — แอดมินทุกคนจะเห็นค่าใหม่ทันที
        </Alert>
      )}

      {/* Current rates display */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card border-purple-500/30 bg-purple-500/5 text-center">
          <div className="flex items-center justify-center gap-2 text-purple-400 mb-3">
            <HandMetal size={16} />
            <span className="text-sm font-bold">ค่าคอมตอบมือ (ปัจจุบัน)</span>
          </div>
          <div className="text-4xl font-black text-purple-400">
            ฿{commRates.manualRate ?? 5}
          </div>
          <div className="text-xs text-gray-500 mt-1">ต่อ 1 ออเดอร์ (บ้าน)</div>
        </div>
        <div className="card border-emerald-500/30 bg-emerald-500/5 text-center">
          <div className="flex items-center justify-center gap-2 text-emerald-400 mb-3">
            <Bot size={16} />
            <span className="text-sm font-bold">ค่าคอม AI (ปัจจุบัน)</span>
          </div>
          <div className="text-4xl font-black text-emerald-400">
            ฿{commRates.aiRate ?? 2}
          </div>
          <div className="text-xs text-gray-500 mt-1">ต่อ 1 ออเดอร์ (บ้าน)</div>
        </div>
      </div>

      {/* Edit form */}
      <div className="card border-gray-700">
        <div className="flex items-center gap-2 font-bold text-sm mb-5">
          <Settings size={16} className="text-brand-400" />
          ปรับอัตราค่าคอม
        </div>

        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Manual rate */}
          <div>
            <label className="label flex items-center gap-1.5">
              <HandMetal size={12} className="text-purple-400" />
              ค่าคอมตอบมือ (฿ / บ้าน)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">฿</span>
              <input
                type="number" min="0" step="0.5"
                className="input pl-7 text-xl font-black text-purple-400 text-center"
                value={manual}
                onChange={e => setManual(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5 text-center">
              100 บ้าน = ฿{(100 * previewManual).toLocaleString()}
            </p>
          </div>

          {/* AI rate */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Bot size={12} className="text-emerald-400" />
              ค่าคอม AI (฿ / บ้าน)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">฿</span>
              <input
                type="number" min="0" step="0.5"
                className="input pl-7 text-xl font-black text-emerald-400 text-center"
                value={ai}
                onChange={e => setAi(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5 text-center">
              100 บ้าน = ฿{(100 * previewAi).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Preview comparison */}
        {hasChanged && (
          <div className="rounded-xl bg-amber-500/8 border border-amber-500/25 p-4 mb-5">
            <div className="text-xs font-bold text-amber-400 mb-3 flex items-center gap-1.5">
              <AlertTriangle size={13} /> ตัวอย่างผลลัพธ์หลังเปลี่ยน (100 บ้าน)
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div>
                <div className="text-xs text-gray-500 mb-1">ตอบมือ 100 บ้าน</div>
                <div className="font-black text-purple-400">฿{(100 * previewManual).toLocaleString()}</div>
                {parseFloat(manual) !== parseFloat(commRates.manualRate) && (
                  <div className="text-xs text-gray-600 line-through">
                    ฿{(100 * (commRates.manualRate ?? 5)).toLocaleString()}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">AI 100 บ้าน</div>
                <div className="font-black text-emerald-400">฿{(100 * previewAi).toLocaleString()}</div>
                {parseFloat(ai) !== parseFloat(commRates.aiRate) && (
                  <div className="text-xs text-gray-600 line-through">
                    ฿{(100 * (commRates.aiRate ?? 2)).toLocaleString()}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">รวม 200 บ้าน</div>
                <div className="font-black text-brand-400">
                  ฿{(100 * previewManual + 100 * previewAi).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {commRates.updatedAt
              ? <>อัพเดทล่าสุดโดย <strong className="text-gray-400">{getUserName(commRates.updatedBy)}</strong></>
              : 'ยังไม่เคยตั้งค่า — ใช้ค่า default'
            }
          </div>
          <button
            className={`btn ${hasChanged ? 'btn-primary' : 'btn-ghost'}`}
            onClick={handleSave}
            disabled={saving || !hasChanged}>
            {saving
              ? 'กำลังบันทึก...'
              : saved
                ? <><CheckCircle size={15} /> บันทึกแล้ว</>
                : <><Save size={15} /> บันทึกค่าคอม</>
            }
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="card border-brand-500/20 bg-brand-500/5">
        <div className="text-xs font-bold text-brand-400 mb-3 flex items-center gap-1.5">
          <History size={13} /> วิธีการทำงาน
        </div>
        <ul className="text-xs text-gray-400 space-y-1.5">
          <li>• ค่าคอมที่ตั้งที่นี่จะเป็น <strong className="text-gray-200">ค่า default</strong> เมื่อแอดมินเปิดฟอร์มลงข้อมูล</li>
          <li>• แอดมินยังสามารถ <strong className="text-gray-200">แก้ไขค่าคอมต่อรายการ</strong> ได้เองในฟอร์ม (กรณีพิเศษ)</li>
          <li>• การเปลี่ยนค่าที่นี่ <strong className="text-gray-200">ไม่กระทบข้อมูลเก่า</strong> ที่บันทึกไปแล้ว</li>
          <li>• ใช้ได้กับ <strong className="text-gray-200">ทุกเพจ ทุกแอดมิน</strong> พร้อมกัน</li>
        </ul>
      </div>
    </div>
  )
}
