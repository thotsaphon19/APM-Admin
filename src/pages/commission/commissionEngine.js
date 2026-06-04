/**
 * Commission Calculation Engine
 * Implements all rules from spec Module 03
 */

// ── Rule 1+2: ค่าคอมต่อออเดอร์ ────────────────────────
export function calcCommission(manualOrders, aiOrders, manualRate, aiRate) {
  return (manualOrders * manualRate) + (aiOrders * aiRate)
}

// ── Rule 4: หลายคนในเพจเดียวกัน → เฉลี่ยตามสัดส่วน ──
/**
 * records = array ของ commission records ในเพจเดียวกัน วันเดียวกัน
 * Returns records พร้อม adjustedTotal (หลังเฉลี่ย) และ shareRatio
 */
export function distributePageCommission(records) {
  if (!records.length) return []
  if (records.length === 1) return records.map(r => ({ ...r, shareRatio:1, adjustedTotal: r.total||0, deduction:0 }))

  const totalPageOrders = records.reduce((a,r) => a + (r.manualOrders||0) + (r.aiOrders||0), 0)
  const totalPageComm   = records.reduce((a,r) => a + (r.total||0), 0)

  return records.map(r => {
    const myOrders = (r.manualOrders||0) + (r.aiOrders||0)
    const ratio    = totalPageOrders > 0 ? myOrders / totalPageOrders : 1 / records.length
    return {
      ...r,
      shareRatio:    ratio,
      adjustedTotal: totalPageComm * ratio,
      pageTotal:     totalPageComm,
      pagePeers:     records.length,
      deduction:     0,
    }
  })
}

// ── Rule 5+6: ชนกับ backend → หักเฉลี่ยตามสัดส่วน ────
/**
 * adminRecords: records ของแอดมินในเพจ+วันนั้น (after distributePageCommission)
 * backendCount: ออเดอร์จริงจากหลังบ้าน
 * Returns: records พร้อม lostOrders, lostDeduction
 */
export function applyBackendDiscount(adminRecords, backendCount, manualRate, aiRate) {
  const adminTotal = adminRecords.reduce((a,r) => a + (r.manualOrders||0) + (r.aiOrders||0), 0)
  const lostOrders = Math.max(0, adminTotal - backendCount)
  if (lostOrders === 0) return adminRecords.map(r => ({ ...r, lostOrders:0, lostDeduction:0 }))

  // ค่าคอมเฉลี่ยต่อออเดอร์ของเพจนี้
  const avgRatePerOrder = adminTotal > 0
    ? adminRecords.reduce((a,r) => a + (r.total||0), 0) / adminTotal
    : manualRate
  const totalLostComm = lostOrders * avgRatePerOrder

  return adminRecords.map(r => {
    const share      = r.shareRatio ?? 1 / adminRecords.length
    const lostDeduct = totalLostComm * share
    return {
      ...r,
      lostOrders:   Math.round(lostOrders * share),
      lostDeduction: lostDeduct,
      adjustedTotal: (r.adjustedTotal ?? r.total ?? 0) - lostDeduct,
    }
  })
}

// ── Rule 7: ออเดอร์ยกเลิก → หักคนที่อยู่เพจวันนั้น ───
/**
 * adminRecords: records ที่ผ่าน distribute + backend แล้ว
 * cancelledItems: [{ pageId, date, amount, qty }] ออเดอร์ยกเลิกในเพจ+วันนี้
 * Returns: records พร้อม cancelDeduction
 */
export function applyCancelledDeduction(adminRecords, cancelledItems) {
  const totalCancelComm = cancelledItems.reduce((a,c) => a + (c.amount||0), 0)
  if (totalCancelComm === 0) return adminRecords.map(r => ({ ...r, cancelDeduction:0, cancelQty:0 }))

  return adminRecords.map(r => {
    const share = r.shareRatio ?? 1 / adminRecords.length
    const cancelDeduct = totalCancelComm * share
    return {
      ...r,
      cancelDeduction: cancelDeduct,
      cancelQty:       Math.round(cancelledItems.reduce((a,c) => a+(c.qty||1), 0) * share),
      adjustedTotal:   (r.adjustedTotal ?? r.total ?? 0) - cancelDeduct,
    }
  })
}

// ── Rule 8: กะกลางคืนข้ามวัน ─────────────────────────
/**
 * ออเดอร์ก่อน 00:00 = นับวันที่เริ่มกะ
 * ออเดอร์หลัง 00:00  = นับวันพรุ่งนี้
 * สำหรับ UI เราให้แอดมินระบุ manualOrders/aiOrders แยกก่อน/หลัง midnight
 * แล้วระบบบันทึก 2 records แยกวัน
 */
export function splitNightShiftOrders({ manualBeforeMidnight, aiBeforeMidnight, manualAfterMidnight, aiAfterMidnight, startDate, manualRate, aiRate, ...rest }) {
  const tomorrow = (() => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0,10)
  })()

  const records = []

  if ((manualBeforeMidnight||0) + (aiBeforeMidnight||0) > 0) {
    const mTotal = (manualBeforeMidnight||0) * manualRate
    const aTotal = (aiBeforeMidnight||0)    * aiRate
    records.push({
      ...rest, date: startDate, shift: 'night', segment: 'before_midnight',
      manualOrders: manualBeforeMidnight||0, aiOrders: aiBeforeMidnight||0,
      manualTotal: mTotal, aiTotal: aTotal, total: mTotal+aTotal,
      manualRate, aiRate,
    })
  }

  if ((manualAfterMidnight||0) + (aiAfterMidnight||0) > 0) {
    const mTotal = (manualAfterMidnight||0) * manualRate
    const aTotal = (aiAfterMidnight||0)     * aiRate
    records.push({
      ...rest, date: tomorrow, shift: 'night', segment: 'after_midnight',
      manualOrders: manualAfterMidnight||0, aiOrders: aiAfterMidnight||0,
      manualTotal: mTotal, aiTotal: aTotal, total: mTotal+aTotal,
      manualRate, aiRate,
    })
  }

  return records
}

// ── Full calculation pipeline ──────────────────────────
/**
 * ประมวลผลออเดอร์ทั้งหมดของวันหนึ่ง
 * @param {Array} commissions - commission records กรองเฉพาะวัน
 * @param {Array} backendOrders - backend records กรองเฉพาะวัน
 * @param {Array} cancelledOrders - cancelled records กรองเฉพาะวัน
 * @param {number} manualRate
 * @param {number} aiRate
 * @returns Array of enriched commission records
 */
export function computeDailyCommissions(commissions, backendOrders, cancelledOrders, manualRate, aiRate) {
  // Group by pageId
  const byPage = {}
  commissions.forEach(c => {
    if (!byPage[c.pageId]) byPage[c.pageId] = []
    byPage[c.pageId].push(c)
  })

  const results = []

  for (const [pageId, pageRecords] of Object.entries(byPage)) {
    // Step 1: distribute within page
    let enriched = distributePageCommission(pageRecords)

    // Step 2: apply backend discount
    const backend = backendOrders.find(b => b.pageId === pageId)
    if (backend) {
      enriched = applyBackendDiscount(enriched, backend.actualCount||0, manualRate, aiRate)
    } else {
      enriched = enriched.map(r => ({ ...r, lostOrders:0, lostDeduction:0 }))
    }

    // Step 3: apply cancellations
    const cancels = cancelledOrders.filter(c => c.pageId === pageId)
    if (cancels.length > 0) {
      enriched = applyCancelledDeduction(enriched, cancels)
    } else {
      enriched = enriched.map(r => ({ ...r, cancelDeduction:0, cancelQty:0 }))
    }

    // Step 4: final net
    enriched = enriched.map(r => ({
      ...r,
      netTotal: Math.max(0, r.adjustedTotal ?? r.total ?? 0),
      hasDeduction: (r.lostDeduction||0) + (r.cancelDeduction||0) > 0,
    }))

    results.push(...enriched)
  }

  return results
}

// ─────────────────────────────────────────────────────────
// Rule: กะกลางคืน 22:30 – 05:00 + ตัดยอดเที่ยงคืน
// ─────────────────────────────────────────────────────────

/**
 * คำนวณออเดอร์กะกลางคืนแยก 2 ช่วง
 *
 * กะเริ่ม 22:30 → เที่ยงคืน  = ช่วง "วันนี้"    (max ~1.5 ชม.)
 * เที่ยงคืน → 05:00           = ช่วง "วันพรุ่งนี้"  (5 ชม.)
 *
 * @param {number} ordersBeforeMidnight  - ออเดอร์ก่อน 00:00
 * @param {number} ordersAfterMidnight   - ออเดอร์หลัง 00:00
 * @param {number} manualRatio           - สัดส่วนออเดอร์ที่ตอบมือ (0-1)
 * @param {number} manualRate
 * @param {number} aiRate
 * @returns { before: { manualOrders, aiOrders, manualTotal, aiTotal, total },
 *            after:  { ... } }
 */
export function calcNightShiftSplit(
  ordersBeforeMidnight,
  ordersAfterMidnight,
  manualRatio = 1,   // default = ตอบมือทั้งหมด
  manualRate  = 5,
  aiRate      = 2
) {
  const split = (totalOrders) => {
    const manual = Math.round(totalOrders * manualRatio)
    const ai     = totalOrders - manual
    const mTotal = manual * manualRate
    const aTotal = ai     * aiRate
    return { manualOrders: manual, aiOrders: ai, manualTotal: mTotal, aiTotal: aTotal, total: mTotal + aTotal }
  }
  return {
    before: split(ordersBeforeMidnight),
    after:  split(ordersAfterMidnight),
  }
}

// ─────────────────────────────────────────────────────────
// Rule: เงินรายวัน (Daily Quota) + ค่าคอมเมื่อเกินโควต้า
// ─────────────────────────────────────────────────────────

/**
 * ถ้า totalOrders <= dailyQuota  → ได้เงินรายวันเต็ม (dailySalary), ไม่มีค่าคอมพิเศษ
 * ถ้า totalOrders  > dailyQuota  → ได้เงินรายวัน + (ออเดอร์ที่เกิน × overRate)
 *
 * @param {number} totalOrders    - ออเดอร์ทั้งหมดที่ตอบ
 * @param {number} dailyQuota     - โควต้าต่อวัน (เช่น 300)
 * @param {number} dailySalary    - เงินรายวัน (เช่น ฿xxx)
 * @param {number} overRate       - ค่าคอมออเดอร์ที่เกิน / บ้าน (ใช้ manualRate หรือกำหนดแยก)
 * @returns {object}
 *   {
 *     dailySalary,          // เงินรายวัน (ได้เสมอ)
 *     quotaOrders,          // ออเดอร์ในโควต้า (≤ dailyQuota)
 *     overOrders,           // ออเดอร์ที่เกินโควต้า
 *     overCommission,       // ค่าคอมจากออเดอร์ที่เกิน
 *     totalPay,             // รวมทั้งหมดที่ได้
 *     isOverQuota,          // true/false
 *   }
 */
export function calcDailyQuotaCommission(totalOrders, dailyQuota, dailySalary, overRate) {
  if (!dailyQuota || dailyQuota <= 0) {
    // ไม่มีโควต้า → คิดเป็นค่าคอมทั้งหมด
    return {
      dailySalary:     0,
      quotaOrders:     0,
      overOrders:      totalOrders,
      overCommission:  totalOrders * overRate,
      totalPay:        totalOrders * overRate,
      isOverQuota:     false,
      mode:            'no_quota',
    }
  }

  const quotaOrders    = Math.min(totalOrders, dailyQuota)
  const overOrders     = Math.max(0, totalOrders - dailyQuota)
  const overCommission = overOrders * overRate

  return {
    dailySalary,
    quotaOrders,
    overOrders,
    overCommission,
    totalPay:    dailySalary + overCommission,
    isOverQuota: overOrders > 0,
    mode:        'quota',
  }
}

/**
 * คำนวณ Commission แบบเต็มรูปแบบสำหรับ record เดียว
 * รวม: manualRate, aiRate, dailyQuota, overRate
 *
 * @param {object} record - commission record
 * @param {object} config - { dailyQuota, dailySalary, overRate, useQuota }
 */
export function calcFullCommission(record, config = {}) {
  const {
    dailyQuota   = 0,
    dailySalary  = 0,
    overRate     = record.manualRate || 5,
    useQuota     = false,
  } = config

  const manualOrders = record.manualOrders || 0
  const aiOrders     = record.aiOrders     || 0
  const manualRate   = record.manualRate   || 0
  const aiRate       = record.aiRate       || 0
  const totalOrders  = manualOrders + aiOrders

  // ค่าคอมพื้นฐาน (manual + AI แยก rate)
  const baseManualComm = manualOrders * manualRate
  const baseAIComm     = aiOrders     * aiRate
  const baseTotal      = baseManualComm + baseAIComm

  if (!useQuota || dailyQuota <= 0) {
    return {
      ...record,
      baseManualComm, baseAIComm, baseTotal,
      dailySalary:    0,
      overOrders:     0,
      overCommission: 0,
      finalTotal:     baseTotal,
      useQuota:       false,
    }
  }

  // คำนวณโควต้า
  const quota = calcDailyQuotaCommission(totalOrders, dailyQuota, dailySalary, overRate)

  return {
    ...record,
    baseManualComm, baseAIComm, baseTotal,
    dailySalary:    quota.dailySalary,
    quotaOrders:    quota.quotaOrders,
    overOrders:     quota.overOrders,
    overCommission: quota.overCommission,
    finalTotal:     quota.totalPay,
    isOverQuota:    quota.isOverQuota,
    useQuota:       true,
  }
}
