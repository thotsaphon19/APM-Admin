/**
 * Payroll Calculation Engine
 * Module 05: Full payroll with deductions, locking, export
 */

import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

// ─── คำนวณ payroll รายวันของแอดมินคนหนึ่ง ──────────────
/**
 * @param {object} p
 *   adminId, adminName, date,
 *   commissions[]     - commission records ของวันนั้น
 *   backendOrders[]   - backend records ของวันนั้น
 *   cancelledOrders[] - cancelled records ของวันนั้น
 *   commRates         - { manualRate, aiRate, useQuota, dailyQuota, dailySalary, overRate }
 *   absencePenalty    - ค่าหักขาดงาน (฿)
 *   isAbsent          - false/true
 * @returns DailyPayroll object
 */
export function calcDailyPayroll({
  adminId, adminName, date,
  commissions = [],
  backendOrders = [],
  cancelledOrders = [],
  commRates = {},
  absencePenalty = 0,
  isAbsent = false,
}) {
  // 1. รวมออเดอร์ที่แอดมินลง (ทุกเพจ)
  const adminComms = commissions.filter(c => c.adminId === adminId && c.date === date)
  const totalManual     = adminComms.reduce((a,c) => a+(c.manualOrders||0), 0)
  const totalAI         = adminComms.reduce((a,c) => a+(c.aiOrders    ||0), 0)
  const totalAdminOrders= totalManual + totalAI
  const rawManualComm   = adminComms.reduce((a,c) => a+(c.manualTotal ||0), 0)
  const rawAIComm       = adminComms.reduce((a,c) => a+(c.aiTotal     ||0), 0)
  const rawTotal        = rawManualComm + rawAIComm

  // 2. ออเดอร์จริงจาก backend (รวมทุกเพจที่แอดมินดูแล)
  const pageIds        = [...new Set(adminComms.map(c=>c.pageId))]
  const backendTotal   = backendOrders
    .filter(b => b.date === date && pageIds.includes(b.pageId))
    .reduce((a,b) => a+(b.actualCount||0), 0)

  // 3. ออเดอร์หาย (admin - backend) เฉพาะกรณีที่ backend มีข้อมูล
  const hasBackend     = backendOrders.some(b => b.date === date && pageIds.includes(b.pageId))
  const lostOrders     = hasBackend ? Math.max(0, totalAdminOrders - backendTotal) : 0
  const avgRatePerOrder= totalAdminOrders > 0 ? rawTotal / totalAdminOrders : 0
  const lostDeduction  = lostOrders * avgRatePerOrder

  // 4. ออเดอร์ยกเลิก (ที่มีวันตรงกับวันนี้)
  const cancelItems    = cancelledOrders.filter(c => c.originalDate === date && pageIds.includes(c.pageId))
  const cancelOrders   = cancelItems.reduce((a,c) => a+(c.qty||0), 0)
  const cancelDeduction= cancelItems.reduce((a,c) => a+(c.amount||0), 0)

  // 5. ขาดงาน
  const absenceDeduction = isAbsent ? absencePenalty : 0

  // 6. ยอดสุทธิ (ก่อนโควต้า)
  const afterDeductions = rawTotal - lostDeduction - cancelDeduction - absenceDeduction

  // 7. คำนวณโควต้า (ถ้าเปิด)
  let dailySalary = 0, overCommission = 0, finalNet = afterDeductions
  let overOrders = 0, quotaOrders = 0

  if (commRates.useQuota && commRates.dailyQuota > 0 && !isAbsent) {
    dailySalary   = commRates.dailySalary || 0
    quotaOrders   = Math.min(totalAdminOrders, commRates.dailyQuota)
    overOrders    = Math.max(0, totalAdminOrders - commRates.dailyQuota - lostOrders)
    overCommission= overOrders * (commRates.overRate || commRates.manualRate || 0)
    finalNet      = dailySalary + overCommission - cancelDeduction - absenceDeduction
  }

  return {
    adminId, adminName, date,
    // ออเดอร์
    totalManual, totalAI, totalAdminOrders,
    backendTotal: hasBackend ? backendTotal : null,
    hasBackend,
    // ค่าคอมตั้งต้น
    rawManualComm, rawAIComm, rawTotal,
    // รายการหัก
    lostOrders, lostDeduction,
    cancelOrders, cancelDeduction,
    isAbsent, absenceDeduction,
    // โควต้า
    useQuota:       commRates.useQuota || false,
    dailySalary,
    quotaOrders,
    overOrders,
    overCommission,
    // สรุป
    totalDeductions: lostDeduction + cancelDeduction + absenceDeduction,
    finalNet:        Math.max(0, finalNet),
    // เพจ
    pageIds,
    records: adminComms,
  }
}

// ─── สรุปรายเดือน ────────────────────────────────────────
/**
 * รวม dailyPayroll ทุกวันใน month เป็น monthly summary
 * @param {string} adminId
 * @param {string} month  'yyyy-MM'
 * @param {DailyPayroll[]} dailyList
 * @param {number} baseSalary  - เงินเดือนฐาน
 */
export function calcMonthlyPayroll(adminId, adminName, month, dailyList, baseSalary = 0) {
  const days = dailyList.filter(d => d.adminId === adminId && d.date?.startsWith(month))

  const totalGross       = days.reduce((a,d) => a + d.rawTotal, 0)
  const totalLost        = days.reduce((a,d) => a + d.lostDeduction, 0)
  const totalCancel      = days.reduce((a,d) => a + d.cancelDeduction, 0)
  const totalAbsence     = days.reduce((a,d) => a + d.absenceDeduction, 0)
  const totalDailySalary = days.reduce((a,d) => a + (d.dailySalary||0), 0)
  const totalOver        = days.reduce((a,d) => a + (d.overCommission||0), 0)
  const totalNet         = days.reduce((a,d) => a + d.finalNet, 0)
  const workDays         = days.filter(d => !d.isAbsent).length
  const absentDays       = days.filter(d => d.isAbsent).length
  const lostOrdersTotal  = days.reduce((a,d) => a + d.lostOrders, 0)
  const orderTotal       = days.reduce((a,d) => a + d.totalAdminOrders, 0)

  return {
    adminId, adminName, month,
    baseSalary,
    totalGross, totalDailySalary, totalOver,
    totalDeductions: totalLost + totalCancel + totalAbsence,
    totalLost, totalCancel, totalAbsence,
    totalNet,
    grandTotal: baseSalary + totalNet,
    workDays, absentDays,
    orderTotal, lostOrdersTotal,
    lostRate: orderTotal > 0 ? lostOrdersTotal / orderTotal : 0,
    days,
  }
}

// ─── Export Excel ─────────────────────────────────────────
export function exportPayrollExcel(monthlyList, month) {
  const wb = XLSX.utils.book_new()
  const monthLabel = (() => { try { return format(new Date(month+'-01'),'MMMM yyyy',{locale:th}) } catch { return month } })()

  // Sheet 1: สรุปรายเดือนทุกคน
  const summary = [
    [`รายงานเงินเดือน ${monthLabel}`],
    [],
    ['ชื่อ','วันทำงาน','วันขาด','ออเดอร์รวม','ค่าคอมตั้งต้น','เงินรายวัน','ค่าคอมเกิน','หักออเดอร์หาย','หักยกเลิก','หักขาดงาน','รวมหัก','ค่าคอมสุทธิ','เงินเดือนฐาน','ยอดจ่ายสุทธิ','สถานะ'],
    ...monthlyList.map(m => [
      m.adminName,
      m.workDays,
      m.absentDays,
      m.orderTotal,
      m.totalGross,
      m.totalDailySalary,
      m.totalOver,
      m.totalLost,
      m.totalCancel,
      m.totalAbsence,
      m.totalDeductions,
      m.totalNet,
      m.baseSalary,
      m.grandTotal,
      m.locked ? '🔒 ล็อคแล้ว' : '✏️ ยังไม่ล็อค',
    ]),
    [],
    ['รวมทั้งทีม','','','',
      monthlyList.reduce((a,m)=>a+m.totalGross,0),'','',
      monthlyList.reduce((a,m)=>a+m.totalLost,0),
      monthlyList.reduce((a,m)=>a+m.totalCancel,0),
      monthlyList.reduce((a,m)=>a+m.totalAbsence,0),
      monthlyList.reduce((a,m)=>a+m.totalDeductions,0),
      monthlyList.reduce((a,m)=>a+m.totalNet,0),
      monthlyList.reduce((a,m)=>a+m.baseSalary,0),
      monthlyList.reduce((a,m)=>a+m.grandTotal,0),
    ],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'สรุปรายเดือน')

  // Sheet 2+: รายวันแยกแต่ละคน
  for (const m of monthlyList) {
    const rows = [
      [`รายวัน: ${m.adminName} — ${monthLabel}`],
      [],
      ['วันที่','มือ(บ้าน)','AI(บ้าน)','รวม(บ้าน)','Backend','หาย','ค่าคอมตั้งต้น','หักหาย','หักยกเลิก','หักขาด','เงินรายวัน','ค่าคอมเกิน','สุทธิ'],
      ...m.days.map(d => [
        d.date,
        d.totalManual, d.totalAI, d.totalAdminOrders,
        d.hasBackend ? d.backendTotal : '—',
        d.lostOrders || 0,
        d.rawTotal,
        d.lostDeduction.toFixed(2),
        d.cancelDeduction.toFixed(2),
        d.absenceDeduction.toFixed(2),
        d.dailySalary || 0,
        d.overCommission || 0,
        d.finalNet.toFixed(2),
      ]),
      [],
      ['รวม','','',m.orderTotal,'','',m.totalGross,m.totalLost,m.totalCancel,m.totalAbsence,m.totalDailySalary,m.totalOver,m.totalNet],
    ]
    const sheetName = (m.adminName||'admin').slice(0,28)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName)
  }

  XLSX.writeFile(wb, `payroll_${month}.xlsx`)
}
