/**
 * Commission Engine — คำนวณค่าคอมมิชชั่นขั้นสูง
 * รองรับ: หลายแอดมินต่อเพจ, ออเดอร์หาย, ยกเลิก, กะกลางคืนข้ามวัน
 */

// ── Helpers ────────────────────────────────────────────
export function splitNightShiftOrders(orders, shiftStartDate) {
  /**
   * กะกลางคืนข้ามวัน: ออเดอร์ก่อน 00:00 → วันนี้ (shiftStartDate)
   *                   ออเดอร์หลัง 00:00 → วันพรุ่งนี้
   * orders = [{ timestamp, count }]
   * returns { today: N, tomorrow: N }
   */
  let today = 0, tomorrow = 0
  const midnight = new Date(shiftStartDate + 'T00:00:00')
  const nextDay   = new Date(midnight.getTime() + 24*60*60*1000)
  orders.forEach(o => {
    const ts = o.timestamp ? new Date(o.timestamp) : null
    if (!ts) { today += o.count || 0; return }
    if (ts >= nextDay) tomorrow += o.count || 0
    else               today    += o.count || 0
  })
  return { today, tomorrow }
}

export function calcCommissionForAdmin({
  manualOrders, manualRate,
  aiOrders,     aiRate,
  cancelDeduction = 0,
  missingDeduction = 0,
}) {
  /**
   * คำนวณค่าคอมสุทธิสำหรับแอดมิน 1 คน
   */
  const grossManual = (manualOrders || 0) * (manualRate || 0)
  const grossAI     = (aiOrders    || 0) * (aiRate     || 0)
  const gross       = grossManual + grossAI
  const deductions  = (cancelDeduction || 0) + (missingDeduction || 0)
  const net         = Math.max(0, gross - deductions)
  return { grossManual, grossAI, gross, deductions, cancelDeduction, missingDeduction, net }
}

export function splitPageCommission(adminsInPage) {
  /**
   * ถ้ามีหลายแอดมินในเพจเดียวกัน → เฉลี่ยตามสัดส่วนออเดอร์ที่แต่ละคนทำ
   * adminsInPage = [{ adminId, manualOrders, aiOrders, manualRate, aiRate }]
   * returns [{ adminId, ...commission }]
   */
  const totals = adminsInPage.reduce((a, x) => ({
    manual: a.manual + (x.manualOrders || 0),
    ai:     a.ai     + (x.aiOrders    || 0),
  }), { manual: 0, ai: 0 })
  const totalOrders = totals.manual + totals.ai

  return adminsInPage.map(adm => {
    const myOrders = (adm.manualOrders || 0) + (adm.aiOrders || 0)
    const ratio    = totalOrders > 0 ? myOrders / totalOrders : (1 / adminsInPage.length)
    return {
      adminId: adm.adminId,
      ratio:   Math.round(ratio * 10000) / 10000,
      ...calcCommissionForAdmin({
        manualOrders: adm.manualOrders,
        manualRate:   adm.manualRate,
        aiOrders:     adm.aiOrders,
        aiRate:       adm.aiRate,
      }),
    }
  })
}

export function calcMissingDeduction(backendActual, submittedTotal, adminsInPage) {
  /**
   * ออเดอร์หาย = backendActual − submittedTotal
   * ถ้าหาย X → หักเฉลี่ยตามสัดส่วนแต่ละคน
   * returns [{ adminId, deduction }]
   */
  const missing = Math.max(0, backendActual - submittedTotal)
  if (missing === 0) return adminsInPage.map(a => ({ adminId: a.adminId, deduction: 0, missingOrders: 0 }))

  const totalOrders = adminsInPage.reduce((s, a) => s + (a.manualOrders||0) + (a.aiOrders||0), 0)
  return adminsInPage.map(a => {
    const myOrders = (a.manualOrders||0) + (a.aiOrders||0)
    const ratio    = totalOrders > 0 ? myOrders / totalOrders : (1 / adminsInPage.length)
    const missShare = Math.ceil(missing * ratio)  // ปัดขึ้นเพื่อความปลอดภัย
    // หักเป็นค่าคอม: ใช้ rate เฉลี่ย
    const avgRate  = myOrders > 0
      ? ((a.manualOrders||0)*a.manualRate + (a.aiOrders||0)*a.aiRate) / myOrders
      : 0
    return {
      adminId:       a.adminId,
      deduction:     Math.round(missShare * avgRate * 100) / 100,
      missingOrders: missShare,
    }
  })
}

export function calcCancelDeduction(cancelledOrders, commissionsOnDate, commRates) {
  /**
   * ออเดอร์ยกเลิก → หักจากแอดมินที่อยู่เพจนั้น วันนั้น
   * cancelledOrders = [{ originalDate, pageId, amount, cancelType:'manual'|'ai' }]
   * commissionsOnDate = commissions[]  (filtered to that date)
   * returns { [adminId]: totalDeduction }
   */
  const deductions = {}
  cancelledOrders.forEach(co => {
    // หาแอดมินที่ทำเพจนั้น วันนั้น
    const admins = commissionsOnDate.filter(c =>
      c.pageId === co.pageId && c.date === co.originalDate
    )
    if (!admins.length) return

    const totalOrders = admins.reduce((s, a) => s + (a.manualOrders||0) + (a.aiOrders||0), 0)
    const perOrderRate = co.amount || (co.cancelType === 'ai' ? commRates.aiRate : commRates.manualRate) || 0

    admins.forEach(a => {
      const myOrders = (a.manualOrders||0) + (a.aiOrders||0)
      const ratio    = totalOrders > 0 ? myOrders / totalOrders : (1 / admins.length)
      const ded      = Math.round(ratio * perOrderRate * 100) / 100
      deductions[a.adminId] = (deductions[a.adminId] || 0) + ded
    })
  })
  return deductions
}

/**
 * Main function: คำนวณสรุปค่าคอมทั้งหมดสำหรับวันที่กำหนด
 */
export function computeDailyPayroll({
  date,
  commissions,        // จาก Firestore
  backendOrders,      // จาก Firestore
  cancelledOrders,    // จาก Firestore
  commRates,
}) {
  const dayComms = commissions.filter(c => c.date === date)
  const dayBackend = backendOrders.filter(b => b.date === date)
  const dayCancel  = cancelledOrders.filter(c => c.originalDate === date)

  // cancel deductions
  const cancelDed = calcCancelDeduction(dayCancel, dayComms, commRates)

  // Group by page
  const pageMap = {}
  dayComms.forEach(c => {
    if (!pageMap[c.pageId]) pageMap[c.pageId] = []
    pageMap[c.pageId].push(c)
  })

  const results = []

  Object.entries(pageMap).forEach(([pageId, admins]) => {
    // Backend actual for this page
    const backend     = dayBackend.find(b => b.pageId === pageId)
    const actualCount = backend?.actualCount || 0
    const submitted   = admins.reduce((s, a) => s + (a.manualOrders||0) + (a.aiOrders||0), 0)

    // Missing deductions
    const missDeds = actualCount > 0
      ? calcMissingDeduction(actualCount, submitted, admins.map(a => ({ adminId:a.adminId, manualOrders:a.manualOrders||0, aiOrders:a.aiOrders||0, manualRate:a.manualRate||commRates.manualRate, aiRate:a.aiRate||commRates.aiRate })))
      : admins.map(a => ({ adminId:a.adminId, deduction:0, missingOrders:0 }))

    // Commission per admin
    const splits = splitPageCommission(
      admins.map(a => ({ adminId:a.adminId, manualOrders:a.manualOrders||0, aiOrders:a.aiOrders||0, manualRate:a.manualRate||commRates.manualRate, aiRate:a.aiRate||commRates.aiRate }))
    )

    admins.forEach(adm => {
      const split   = splits.find(s => s.adminId === adm.adminId) || {}
      const missDed = missDeds.find(m => m.adminId === adm.adminId) || {}
      const canDed  = cancelDed[adm.adminId] || 0

      const gross    = split.gross    || 0
      const totalDed = (missDed.deduction || 0) + canDed
      const net      = Math.max(0, gross - totalDed)

      results.push({
        adminId:       adm.adminId,
        pageId,
        date,
        ratio:         split.ratio || 1,
        // orders
        manualOrders:  adm.manualOrders || 0,
        aiOrders:      adm.aiOrders     || 0,
        totalOrders:   (adm.manualOrders||0) + (adm.aiOrders||0),
        // backend comparison
        backendActual: actualCount,
        submitted,
        missingOrders: missDed.missingOrders || 0,
        // commission
        grossManual:   split.grossManual || 0,
        grossAI:       split.grossAI     || 0,
        gross,
        missingDeduction: missDed.deduction || 0,
        cancelDeduction:  canDed,
        totalDeductions:  totalDed,
        net,
        // raw ref
        commissionId:  adm.id,
      })
    })
  })

  return results
}
