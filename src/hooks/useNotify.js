import { useNotifications } from '../contexts/NotificationContext'
import { useAuth } from '../contexts/AuthContext'

export function useNotify() {
  const { notify } = useNotifications()
  const { profile } = useAuth()
  const myName = profile?.name || 'ผู้ใช้'

  return {
    notifyCommission: (action, details) => notify({
      type: 'commission',
      title: action==='add'?`💰 ลงข้อมูลค่าคอมใหม่`:action==='edit'?`✏️ แก้ไขข้อมูลค่าคอม`:`🗑️ ลบข้อมูลค่าคอม`,
      message: `${myName} ${action==='add'?'ลงข้อมูล':action==='edit'?'แก้ไข':'ลบ'}ค่าคอม${details?` · ${details}`:''}`,
      link: '/commission',
      targetRoles: ['superadmin','head_admin','assistant'],
    }),
    notifyLeaveRequest: (reason) => notify({
      type: 'leave',
      title: `🌴 ${myName} ขอลา`,
      message: `เหตุผล: ${reason||'ไม่ระบุ'} — รออนุมัติ`,
      link: '/leave',
      targetRoles: ['superadmin','head_admin'],
    }),
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
    notifyPage: (action, pageName) => notify({
      type: 'page',
      title: action==='add'?`📄 เพิ่มเพจ: ${pageName}`:action==='assign'?`👥 มอบหมายเพจ: ${pageName}`:action==='edit'?`✏️ แก้ไขเพจ: ${pageName}`:`🗑️ ลบเพจ: ${pageName}`,
      message: `${myName} ${action==='add'?'เพิ่ม':action==='assign'?'มอบหมาย':action==='edit'?'แก้ไข':'ลบ'}เพจ "${pageName}"`,
      link: '/pages',
      targetRoles: ['superadmin','head_admin','admin'],
    }),
    notifyEmployee: (action, empName) => notify({
      type: 'employee',
      title: action==='add'?`👥 เพิ่มพนักงาน: ${empName}`:action==='role'?`🔑 เปลี่ยนสิทธิ์: ${empName}`:action==='edit'?`✏️ แก้ไขพนักงาน`:`🗑️ ลบพนักงาน: ${empName}`,
      message: `${myName} ${action==='add'?'เพิ่ม':action==='role'?'เปลี่ยนสิทธิ์ให้':action==='edit'?'แก้ไข':'ลบ'}${action!=='edit'?` "${empName}"`:''}`,
      link: '/employees',
      targetRoles: ['superadmin','head_admin'],
    }),
    notifyMailbox: (action, label) => notify({
      type: 'mailbox',
      title: action==='add'?`📬 เพิ่มเมลงาน: ${label}`:action==='edit'?`✏️ แก้ไขเมลงาน: ${label}`:`🗑️ ลบเมลงาน: ${label}`,
      message: `${myName} ${action==='add'?'เพิ่ม':action==='edit'?'แก้ไข':'ลบ'}เมลงาน "${label}"`,
      link: '/mailbox',
      targetRoles: ['superadmin','head_admin'],
    }),
    notifyRateChange: (manual, ai) => notify({
      type: 'system',
      title: `⚙️ อัพเดทอัตราค่าคอม`,
      message: `${myName} เปลี่ยน → มือ ฿${manual}/บ้าน · AI ฿${ai}/บ้าน`,
      link: '/settings',
      targetRoles: ['all'],
    }),
    notifyCustom: (opts) => notify(opts),
  }
}
