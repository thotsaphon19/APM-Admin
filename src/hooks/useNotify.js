import { useNotifications } from '../contexts/NotificationContext'
import { useAuth } from '../contexts/AuthContext'

export function useNotify() {
  const { notify } = useNotifications()
  const { profile } = useAuth()
  const myName = profile?.name || 'ผู้ใช้'

  return {

    // ── ค่าคอม ────────────────────────────────────────
    notifyCommission: (action, details) => notify({
      type: 'commission',
      title: action==='add' ? `💰 ลงข้อมูลค่าคอมใหม่`
           : action==='edit' ? `✏️ แก้ไขข้อมูลค่าคอม`
           : `🗑️ ลบข้อมูลค่าคอม`,
      message: `${myName} ${action==='add'?'ลงข้อมูล':action==='edit'?'แก้ไข':'ลบ'}ค่าคอม${details?` · ${details}`:''}`,
      link: '/commission',
      targetRoles: ['superadmin','head_admin','assistant'],
    }),

    // ── วันลา ─────────────────────────────────────────
    notifyLeaveRequest: (reason) => notify({
      type: 'leave',
      title: `🌴 ${myName} ขอลา`,
      message: `เหตุผล: ${reason||'ไม่ระบุ'} — รออนุมัติ`,
      link: '/leave',
      targetRoles: ['superadmin','head_admin'],
    }),

    // แจ้งแอดมินคนนั้นโดยตรงด้วย targetUserIds
    notifyLeaveResult: (employeeId, employeeName, approved, reason) => notify({
      type: approved ? 'leave_approve' : 'leave_reject',
      title: approved ? `✅ วันลาของคุณได้รับการอนุมัติ` : `❌ วันลาของคุณถูกปฏิเสธ`,
      message: approved
        ? `${myName} อนุมัติวันลาของ ${employeeName} แล้ว`
        : `${myName} ปฏิเสธวันลาของ ${employeeName}${reason?` · เหตุผล: ${reason}`:''}`,
      link: '/leave',
      targetRoles: ['superadmin','head_admin'],
      targetUserIds: [employeeId],  // แจ้งแอดมินคนนั้นด้วย
    }),

    // (เก็บไว้ backward compat)
    notifyLeaveApproved: (employeeName) => notify({
      type: 'leave_approve',
      title: `✅ อนุมัติวันลา`,
      message: `${myName} อนุมัติวันลาของ ${employeeName}`,
      link: '/leave',
      targetRoles: ['all'],
    }),
    notifyLeaveRejected: (employeeName) => notify({
      type: 'leave_reject',
      title: `❌ ปฏิเสธวันลา`,
      message: `${myName} ปฏิเสธวันลาของ ${employeeName}`,
      link: '/leave',
      targetRoles: ['all'],
    }),

    // ── เพจ / เวร ─────────────────────────────────────
    notifyPage: (action, pageName) => notify({
      type: 'page',
      title: action==='add'    ? `📄 เพิ่มเพจ: ${pageName}`
           : action==='assign' ? `👥 มอบหมายเพจ: ${pageName}`
           : action==='edit'   ? `✏️ แก้ไขเพจ: ${pageName}`
           : `🗑️ ลบเพจ: ${pageName}`,
      message: `${myName} ${action==='add'?'เพิ่ม':action==='assign'?'มอบหมาย':action==='edit'?'แก้ไข':'ลบ'}เพจ "${pageName}"`,
      link: '/pages',
      targetRoles: ['superadmin','head_admin','admin'],
    }),

    // แจ้งแอดมินที่ได้รับมอบหมายเวรตรงๆ
    notifyDutyAssigned: (assignedUserIds, dateLabel, pageNames) => notify({
      type: 'duty',
      title: `🌙 คุณได้รับมอบหมายเวรเฝ้าเพจ`,
      message: `${myName} มอบหมายเวร ${dateLabel} · เพจ: ${pageNames}`,
      link: '/pages',
      targetRoles: ['admin'],
      targetUserIds: assignedUserIds,  // แจ้งเฉพาะคนที่ได้รับมอบหมาย
    }),

    // แจ้งจัดเวรทั้งอาทิตย์
    notifyWeekDuty: (assignedUserIds, weekLabel) => notify({
      type: 'duty_week',
      title: `📅 จัดเวรประจำสัปดาห์แล้ว`,
      message: `${myName} จัดเวรสัปดาห์ ${weekLabel} เรียบร้อย — กรุณาตรวจสอบตารางเวรของคุณ`,
      link: '/pages',
      targetRoles: ['admin'],
      targetUserIds: assignedUserIds,
    }),

    // ── พนักงาน ───────────────────────────────────────
    notifyEmployee: (action, empName, empUserId) => notify({
      type: action==='add' ? 'new_employee' : 'employee',
      title: action==='add'  ? `🎉 ยินดีต้อนรับ ${empName}!`
           : action==='role' ? `🔑 สิทธิ์การใช้งานของคุณถูกเปลี่ยน`
           : action==='edit' ? `✏️ ข้อมูลของคุณถูกอัพเดท`
           : `🗑️ ลบพนักงาน: ${empName}`,
      message: action==='add'  ? `${myName} เพิ่ม "${empName}" เข้าระบบแล้ว`
             : action==='role' ? `${myName} เปลี่ยนสิทธิ์ให้ ${empName}`
             : action==='edit' ? `${myName} แก้ไขข้อมูล ${empName}`
             : `${myName} ลบ "${empName}" ออกจากระบบ`,
      link: '/employees',
      targetRoles: ['superadmin','head_admin'],
      targetUserIds: empUserId ? [empUserId] : [],  // แจ้งตัวพนักงานด้วย
    }),

    // ── เมลงาน ────────────────────────────────────────
    notifyMailbox: (action, label, targetAdminId) => notify({
      type: action==='fill' ? 'mailbox_fill' : 'mailbox',
      title: action==='add'  ? `📬 ลงทะเบียนเมลงานใหม่: ${label}`
           : action==='fill' ? `🔑 เมลงานของคุณพร้อมใช้งานแล้ว!`
           : action==='edit' ? `✏️ แก้ไขเมลงาน: ${label}`
           : `🗑️ ลบเมลงาน: ${label}`,
      message: action==='add'  ? `${myName} สร้างเมลงาน "${label}" — รอกรอกอีเมล+รหัสผ่าน`
             : action==='fill' ? `${myName} กรอกอีเมล+รหัสผ่านให้เมลงาน "${label}" แล้ว — สามารถเริ่มใช้งานได้เลย`
             : action==='edit' ? `${myName} แก้ไขเมลงาน "${label}"`
             : `${myName} ลบเมลงาน "${label}"`,
      link: '/mailbox',
      targetRoles: ['superadmin','head_admin'],
      targetUserIds: targetAdminId ? [targetAdminId] : [],  // แจ้งแอดมินเจ้าของเมลด้วย
    }),

    // ── อัตราค่าคอม ──────────────────────────────────
    notifyRateChange: (manual, ai) => notify({
      type: 'system',
      title: `⚙️ อัพเดทอัตราค่าคอม`,
      message: `${myName} เปลี่ยน → มือ ฿${manual}/บ้าน · AI ฿${ai}/บ้าน`,
      link: '/settings',
      targetRoles: ['all'],
    }),

    // ── พัสดุค้าง ─────────────────────────────────────
    notifyParcelOverdue: (count, threshold) => notify({
      type: 'parcel_overdue',
      title: `⚠️ พัสดุค้างส่ง ${count} รายการ`,
      message: `มีพัสดุค้างส่งเกิน ${threshold} วัน จำนวน ${count} รายการ — กรุณาตรวจสอบ`,
      link: '/parcels',
      targetRoles: ['superadmin','head_admin'],
    }),

    // ── กลาง (ใช้เองได้) ─────────────────────────────
    notifyCustom: (opts) => notify(opts),
  }
}