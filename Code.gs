// ============================================================
// GOOGLE APPS SCRIPT BACKEND - Admin Page Management System
// Email + Password Auth with Email Verification
// Deploy as Web App: Execute as "Me", Access "Anyone"
// ============================================================

const ss = SpreadsheetApp.getActiveSpreadsheet();

const SHEETS = {
  USERS: 'Users',
  PAGES: 'Pages',
  DAILY: 'DailyEntries',
  OTP: 'OTP_Tokens'
};

// ============================================================
// ROUTER
// ============================================================
function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try {
    const body    = e.postData ? JSON.parse(e.postData.contents) : {};
    const action  = (e.parameter.action || body.action || '').trim();
    const data    = body.data || {};
    let result;
    switch (action) {
      // ---- AUTH ----
      case 'login':              result = login(data);             break;
      case 'sendVerifyEmail':    result = sendVerifyEmail(data);   break;
      case 'verifyEmailOTP':     result = verifyEmailOTP(data);    break;
      case 'changePassword':     result = changePassword(data);    break;
      case 'forgotPassword':     result = forgotPassword(data);    break;
      case 'resetPassword':      result = resetPassword(data);     break;
      // ---- USERS ----
      case 'getUsers':           result = getUsers();              break;
      case 'addUser':            result = addUser(data);           break;
      case 'updateUser':         result = updateUser(data);        break;
      case 'deleteUser':         result = deleteUser(data.email);  break;
      case 'updateUserRole':     result = updateUserRole(data);    break;
      // ---- PAGES ----
      case 'getPages':           result = getPages();              break;
      case 'addPage':            result = addPage(data);           break;
      case 'updatePage':         result = updatePage(data);        break;
      case 'deletePage':         result = deletePage(data.id);     break;
      // ---- DAILY ----
      case 'getDailyEntries':    result = getDailyEntries(data);   break;
      case 'addDailyEntry':      result = addDailyEntry(data);     break;
      case 'updateDailyEntry':   result = updateDailyEntry(data);  break;
      case 'deleteDailyEntry':   result = deleteDailyEntry(data.id); break;
      // ---- REPORTS ----
      case 'getReport':          result = getReport(data);         break;
      case 'getPersonalSummary': result = getPersonalSummary(data); break;
      default: result = { success: false, error: 'Unknown action: ' + action };
    }
    out.setContent(JSON.stringify(result));
  } catch (err) {
    out.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }
  return out;
}

// ============================================================
// SETUP
// ============================================================
function setupSheets() {
  const configs = [
    {
      name: SHEETS.USERS,
      headers: ['email','firstName','lastName','displayName','role','pages',
                'passwordHash','emailVerified','active','createdAt','lastLogin','createdBy']
    },
    {
      name: SHEETS.PAGES,
      headers: ['id','name','description','followers','category','createdAt','active']
    },
    {
      name: SHEETS.DAILY,
      headers: ['id','date','userEmail','userName','pageId','pageName',
                'messageCount','responseCount','newFollowers','posts','reach','engagement','notes','createdAt']
    },
    {
      name: SHEETS.OTP,
      headers: ['email','otp','type','expiresAt','used']
    }
  ];
  configs.forEach(cfg => {
    let sh = ss.getSheetByName(cfg.name);
    if (!sh) sh = ss.insertSheet(cfg.name);
    if (sh.getLastRow() === 0) {
      const hRange = sh.getRange(1, 1, 1, cfg.headers.length);
      hRange.setValues([cfg.headers]);
      hRange.setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');
    }
  });
  Logger.log('Sheets setup complete');
}

// ============================================================
// HELPERS
// ============================================================
function getSheetData(name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() <= 1) return [];
  const vals = sh.getDataRange().getValues();
  const headers = vals[0];
  return vals.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function uuid12() {
  return Utilities.getUuid().replace(/-/g,'').slice(0,12);
}

// Simple hash (SHA-256 hex via Utilities)
function hashPassword(plain) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    plain + 'APM_SALT_2025',
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ============================================================
// AUTH — LOGIN
// ============================================================
function login(data) {
  const { email, password } = data;
  if (!email || !password) return { success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' };

  const users = getSheetData(SHEETS.USERS);
  const user  = users.find(u => u.email === email);
  if (!user) return { success: false, error: 'ไม่พบบัญชีนี้ในระบบ' };
  if (user.active === false || user.active === 'false' || user.active === 'FALSE')
    return { success: false, error: 'บัญชีถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล' };
  if (user.emailVerified !== true && user.emailVerified !== 'true' && user.emailVerified !== 'TRUE')
    return { success: false, error: 'อีเมลยังไม่ได้รับการยืนยัน กรุณาตรวจสอบอีเมล' };

  const hash = hashPassword(password);
  if (hash !== user.passwordHash)
    return { success: false, error: 'รหัสผ่านไม่ถูกต้อง' };

  // Update lastLogin
  const sh = ss.getSheetByName(SHEETS.USERS);
  const allVals = sh.getDataRange().getValues();
  const headers = allVals[0];
  const rowIdx  = users.indexOf(user) + 2;
  const llCol   = headers.indexOf('lastLogin') + 1;
  sh.getRange(rowIdx, llCol).setValue(new Date().toISOString());

  const safeUser = { ...user };
  delete safeUser.passwordHash;
  return { success: true, user: safeUser };
}

// ============================================================
// AUTH — SEND VERIFY EMAIL (OTP)
// ============================================================

// ⚠️ ตั้งค่า URL ของเว็บคุณที่นี่
const APP_URL = 'https://YOUR-APP.vercel.app'; // ← เปลี่ยนเป็น URL จริง เช่น https://admin-page-manager.vercel.app

function sendVerifyEmail(data) {
  const { email, type } = data; // type: 'verify' | 'reset'
  if (!email) return { success: false, error: 'ไม่พบอีเมล' };

  const users = getSheetData(SHEETS.USERS);
  const user  = users.find(u => u.email === email);
  if (!user) return { success: false, error: 'ไม่พบบัญชีนี้' };

  const otp       = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  // Save OTP — mark old ones as used first
  const otpSheet = ss.getSheetByName(SHEETS.OTP);
  const otpVals  = otpSheet.getDataRange().getValues();
  const otpHdrs  = otpVals[0];
  const emailCol = otpHdrs.indexOf('email') + 1;
  const typeCol  = otpHdrs.indexOf('type')  + 1;
  const usedCol  = otpHdrs.indexOf('used')  + 1;
  for (let i = 1; i < otpVals.length; i++) {
    if (otpVals[i][emailCol-1] === email && otpVals[i][typeCol-1] === type) {
      otpSheet.getRange(i+1, usedCol).setValue('true');
    }
  }
  otpSheet.appendRow([email, otp, type || 'verify', expiresAt, 'false']);

  // Build verify link
  const isReset   = type === 'reset';
  const linkType  = isReset ? 'reset' : 'verify';
  const verifyLink = APP_URL + '/verify?email=' + encodeURIComponent(email) + '&otp=' + otp + '&type=' + linkType;

  const subject = isReset
    ? '[APM] รีเซ็ตรหัสผ่านของคุณ'
    : '[APM] ยืนยันอีเมลเพื่อเริ่มใช้งาน';

  const name = user.firstName || user.displayName || email;
  const actionLabel = isReset ? 'รีเซ็ตรหัสผ่าน' : 'ยืนยันอีเมล';
  const actionColor = isReset ? '#f5c842' : '#36d7b7';

  // HTML email
  const htmlBody = `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0e1a;font-family:'Noto Sans Thai',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0e1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1b2e;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1b2e,#252645);padding:32px 40px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="display:inline-block;background:linear-gradient(135deg,#f5c842,#4f8ef7);border-radius:14px;width:56px;height:56px;line-height:56px;text-align:center;font-size:22px;font-weight:800;color:#0d0e1a;margin-bottom:14px;">APM</div>
            <div style="color:#e8eaf6;font-size:20px;font-weight:700;margin-bottom:4px;">Admin Page Manager</div>
            <div style="color:#9096b8;font-size:13px;">ระบบบริหารจัดการแอดมินเพจ</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#9096b8;font-size:14px;margin:0 0 6px;">สวัสดีคุณ</p>
            <p style="color:#e8eaf6;font-size:18px;font-weight:700;margin:0 0 24px;">${name}</p>

            <p style="color:#c8cadf;font-size:14px;line-height:1.7;margin:0 0 28px;">
              ${isReset
                ? 'เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กรุณากดปุ่มด้านล่างเพื่อดำเนินการต่อ'
                : 'บัญชีของคุณถูกสร้างในระบบแล้ว กรุณายืนยันอีเมลเพื่อเริ่มใช้งาน'}
            </p>

            <!-- OTP box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td style="background:#13141f;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:24px;text-align:center;">
                <div style="color:#9096b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">รหัส OTP</div>
                <div style="color:${actionColor};font-size:38px;font-weight:800;letter-spacing:10px;font-family:monospace;">${otp}</div>
                <div style="color:#5a6090;font-size:12px;margin-top:10px;">⏱ หมดอายุใน 15 นาที</div>
              </td></tr>
            </table>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${verifyLink}"
                   style="display:inline-block;background:${actionColor};color:#0d0e1a;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
                  → ${actionLabel}
                </a>
              </td></tr>
            </table>

            <!-- Link fallback -->
            <p style="color:#5a6090;font-size:12px;text-align:center;margin:0 0 8px;">หรือเปิดลิงก์นี้ในเบราว์เซอร์:</p>
            <p style="text-align:center;margin:0 0 28px;">
              <a href="${verifyLink}" style="color:#4f8ef7;font-size:11px;word-break:break-all;">${verifyLink}</a>
            </p>

            <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0 0 24px;">

            <p style="color:#5a6090;font-size:12px;line-height:1.6;margin:0;">
              หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้<br>
              รหัส OTP นี้ใช้ได้ครั้งเดียวและหมดอายุใน 15 นาที
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#13141f;padding:20px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="color:#5a6090;font-size:12px;margin:0;">ระบบ Admin Page Manager · ส่งอัตโนมัติ กรุณาอย่าตอบกลับ</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  // Plain text fallback
  const plainBody = `สวัสดี ${name},\n\n${isReset ? 'รหัส OTP รีเซ็ตรหัสผ่าน' : 'รหัส OTP ยืนยันอีเมล'}: ${otp}\n\nหรือคลิกลิงก์: ${verifyLink}\n\nรหัสหมดอายุใน 15 นาที\n\n— ระบบ Admin Page Manager`;

  GmailApp.sendEmail(email, subject, plainBody, { htmlBody: htmlBody });
  return { success: true, message: 'ส่ง OTP ไปที่อีเมลแล้ว' };
}

// ============================================================
// AUTH — VERIFY OTP
// ============================================================
function verifyEmailOTP(data) {
  const { email, otp, type } = data;
  const otpData = getSheetData(SHEETS.OTP);
  const now     = new Date();

  const token = otpData.find(t =>
    t.email === email &&
    t.otp   === String(otp) &&
    t.type  === (type || 'verify') &&
    t.used  !== 'true' && t.used !== true &&
    new Date(t.expiresAt) > now
  );

  if (!token) return { success: false, error: 'OTP ไม่ถูกต้องหรือหมดอายุแล้ว' };

  // Mark used
  const otpSheet = ss.getSheetByName(SHEETS.OTP);
  const otpVals  = otpSheet.getDataRange().getValues();
  const otpHdrs  = otpVals[0];
  const usedCol  = otpHdrs.indexOf('used') + 1;
  const idx      = otpData.indexOf(token);
  otpSheet.getRange(idx + 2, usedCol).setValue('true');

  if (type === 'verify') {
    // Mark emailVerified = true
    const sh      = ss.getSheetByName(SHEETS.USERS);
    const users   = getSheetData(SHEETS.USERS);
    const userIdx = users.findIndex(u => u.email === email);
    if (userIdx === -1) return { success: false, error: 'ไม่พบผู้ใช้' };
    const uVals   = sh.getDataRange().getValues();
    const uHdrs   = uVals[0];
    const evCol   = uHdrs.indexOf('emailVerified') + 1;
    sh.getRange(userIdx + 2, evCol).setValue('true');
  }

  return { success: true, message: 'ยืนยัน OTP สำเร็จ' };
}

// ============================================================
// AUTH — CHANGE PASSWORD (logged-in)
// ============================================================
function changePassword(data) {
  const { email, currentPassword, newPassword } = data;
  const users  = getSheetData(SHEETS.USERS);
  const user   = users.find(u => u.email === email);
  if (!user) return { success: false, error: 'ไม่พบผู้ใช้' };

  if (hashPassword(currentPassword) !== user.passwordHash)
    return { success: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };

  const sh     = ss.getSheetByName(SHEETS.USERS);
  const vals   = sh.getDataRange().getValues();
  const hdrs   = vals[0];
  const phCol  = hdrs.indexOf('passwordHash') + 1;
  const rowNum = users.indexOf(user) + 2;
  sh.getRange(rowNum, phCol).setValue(hashPassword(newPassword));
  return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
}

// ============================================================
// AUTH — FORGOT PASSWORD
// ============================================================
function forgotPassword(data) {
  return sendVerifyEmail({ email: data.email, type: 'reset' });
}

function resetPassword(data) {
  const { email, otp, newPassword } = data;
  const verify = verifyEmailOTP({ email, otp, type: 'reset' });
  if (!verify.success) return verify;

  const sh     = ss.getSheetByName(SHEETS.USERS);
  const users  = getSheetData(SHEETS.USERS);
  const user   = users.find(u => u.email === email);
  if (!user) return { success: false, error: 'ไม่พบผู้ใช้' };

  const vals   = sh.getDataRange().getValues();
  const hdrs   = vals[0];
  const phCol  = hdrs.indexOf('passwordHash') + 1;
  sh.getRange(users.indexOf(user) + 2, phCol).setValue(hashPassword(newPassword));
  return { success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' };
}

// ============================================================
// USERS CRUD
// ============================================================
function getUsers() {
  const users = getSheetData(SHEETS.USERS).map(u => {
    const s = { ...u }; delete s.passwordHash; return s;
  });
  return { success: true, data: users };
}

function addUser(data) {
  const users = getSheetData(SHEETS.USERS);
  if (users.find(u => u.email === data.email))
    return { success: false, error: 'อีเมลนี้มีในระบบแล้ว' };
  if (!data.email || !data.password)
    return { success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' };

  const isFirst = users.length === 0;
  const sh      = ss.getSheetByName(SHEETS.USERS);
  const row = [
    data.email,
    data.firstName  || '',
    data.lastName   || '',
    `${data.firstName||''} ${data.lastName||''}`.trim(),
    isFirst ? 'executive' : (data.role || 'admin'),
    JSON.stringify(data.pages || []),
    hashPassword(data.password),
    'false',    // emailVerified — will be verified via OTP
    'true',     // active
    new Date().toISOString(),
    '',         // lastLogin
    data.createdBy || 'system'
  ];
  sh.appendRow(row);

  // Send verification OTP immediately
  try {
    sendVerifyEmail({ email: data.email, type: 'verify' });
  } catch(e) {
    Logger.log('Email send failed: ' + e);
  }

  return { success: true, message: 'เพิ่มผู้ใช้สำเร็จ ส่ง OTP ยืนยันอีเมลแล้ว' };
}

function updateUser(data) {
  const sh    = ss.getSheetByName(SHEETS.USERS);
  const users = getSheetData(SHEETS.USERS);
  const idx   = users.findIndex(u => u.email === data.email);
  if (idx === -1) return { success: false, error: 'ไม่พบผู้ใช้' };

  const vals   = sh.getDataRange().getValues();
  const hdrs   = vals[0];
  const rowNum = idx + 2;

  const fields = ['firstName','lastName','role','pages','active'];
  fields.forEach(f => {
    if (data[f] !== undefined) {
      const col = hdrs.indexOf(f) + 1;
      sh.getRange(rowNum, col).setValue(f === 'pages' ? JSON.stringify(data[f]) : data[f]);
    }
  });
  const dnCol = hdrs.indexOf('displayName') + 1;
  sh.getRange(rowNum, dnCol).setValue(`${data.firstName||''} ${data.lastName||''}`.trim());

  if (data.newPassword) {
    const phCol = hdrs.indexOf('passwordHash') + 1;
    sh.getRange(rowNum, phCol).setValue(hashPassword(data.newPassword));
  }
  return { success: true };
}

function deleteUser(email) {
  const sh    = ss.getSheetByName(SHEETS.USERS);
  const users = getSheetData(SHEETS.USERS);
  const idx   = users.findIndex(u => u.email === email);
  if (idx === -1) return { success: false, error: 'ไม่พบผู้ใช้' };
  sh.deleteRow(idx + 2);
  return { success: true };
}

function updateUserRole(data) {
  const { email, role } = data;
  if (!['executive','head','admin'].includes(role))
    return { success: false, error: 'Role ไม่ถูกต้อง' };
  const sh    = ss.getSheetByName(SHEETS.USERS);
  const users = getSheetData(SHEETS.USERS);
  const idx   = users.findIndex(u => u.email === email);
  if (idx === -1) return { success: false, error: 'ไม่พบผู้ใช้' };
  const hdrs  = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  sh.getRange(idx+2, hdrs.indexOf('role')+1).setValue(role);
  return { success: true };
}

// ============================================================
// PAGES CRUD
// ============================================================
function getPages() {
  return { success: true, data: getSheetData(SHEETS.PAGES) };
}
function addPage(data) {
  const sh   = ss.getSheetByName(SHEETS.PAGES);
  const page = { id: uuid12(), name: data.name, description: data.description||'',
                 followers: Number(data.followers)||0, category: data.category||'General',
                 createdAt: new Date().toISOString(), active: true };
  sh.appendRow(Object.values(page));
  return { success: true, page };
}
function updatePage(data) {
  const sh    = ss.getSheetByName(SHEETS.PAGES);
  const pages = getSheetData(SHEETS.PAGES);
  const idx   = pages.findIndex(p => p.id === data.id);
  if (idx === -1) return { success: false, error: 'ไม่พบเพจ' };
  const hdrs  = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  ['name','description','followers','category','active'].forEach(f => {
    if (data[f] !== undefined)
      sh.getRange(idx+2, hdrs.indexOf(f)+1).setValue(data[f]);
  });
  return { success: true };
}
function deletePage(id) {
  const sh    = ss.getSheetByName(SHEETS.PAGES);
  const pages = getSheetData(SHEETS.PAGES);
  const idx   = pages.findIndex(p => p.id === id);
  if (idx === -1) return { success: false, error: 'ไม่พบเพจ' };
  sh.deleteRow(idx+2);
  return { success: true };
}

// ============================================================
// DAILY ENTRIES
// ============================================================
function getDailyEntries(filter) {
  let e = getSheetData(SHEETS.DAILY);
  if (filter.startDate)  e = e.filter(x => x.date >= filter.startDate);
  if (filter.endDate)    e = e.filter(x => x.date <= filter.endDate);
  if (filter.pageId)     e = e.filter(x => x.pageId === filter.pageId);
  if (filter.userEmail)  e = e.filter(x => x.userEmail === filter.userEmail);
  return { success: true, data: e };
}
function addDailyEntry(data) {
  const sh    = ss.getSheetByName(SHEETS.DAILY);
  const entry = {
    id: uuid12(), date: data.date,
    userEmail: data.userEmail, userName: data.userName,
    pageId: data.pageId, pageName: data.pageName,
    messageCount: Number(data.messageCount)||0,
    responseCount: Number(data.responseCount)||0,
    newFollowers: Number(data.newFollowers)||0,
    posts: Number(data.posts)||0,
    reach: Number(data.reach)||0,
    engagement: Number(data.engagement)||0,
    notes: data.notes||'',
    createdAt: new Date().toISOString()
  };
  sh.appendRow(Object.values(entry));
  return { success: true, entry };
}
function updateDailyEntry(data) {
  const sh      = ss.getSheetByName(SHEETS.DAILY);
  const entries = getSheetData(SHEETS.DAILY);
  const idx     = entries.findIndex(e => e.id === data.id);
  if (idx === -1) return { success: false, error: 'ไม่พบรายการ' };
  const hdrs    = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const nums    = ['messageCount','responseCount','newFollowers','posts','reach','engagement'];
  ['date','pageId','pageName','messageCount','responseCount','newFollowers','posts','reach','engagement','notes']
    .forEach(f => {
      if (data[f] !== undefined)
        sh.getRange(idx+2, hdrs.indexOf(f)+1).setValue(nums.includes(f) ? Number(data[f]) : data[f]);
    });
  return { success: true };
}
function deleteDailyEntry(id) {
  const sh      = ss.getSheetByName(SHEETS.DAILY);
  const entries = getSheetData(SHEETS.DAILY);
  const idx     = entries.findIndex(e => e.id === id);
  if (idx === -1) return { success: false, error: 'ไม่พบรายการ' };
  sh.deleteRow(idx+2);
  return { success: true };
}

// ============================================================
// REPORTS
// ============================================================
function getReport(filter) {
  const entries = getDailyEntries(filter).data;
  const n       = f => Number(f||0);
  const summary = {
    totalMessages: entries.reduce((s,e) => s+n(e.messageCount),0),
    totalResponses: entries.reduce((s,e) => s+n(e.responseCount),0),
    totalFollowers: entries.reduce((s,e) => s+n(e.newFollowers),0),
    totalPosts: entries.reduce((s,e) => s+n(e.posts),0),
    totalReach: entries.reduce((s,e) => s+n(e.reach),0),
    totalEngagement: entries.reduce((s,e) => s+n(e.engagement),0),
    byPage: {}, byDate: {}, byUser: {}
  };
  entries.forEach(e => {
    const agg = (obj, key) => {
      if (!obj[key]) obj[key] = { messages:0, responses:0, followers:0, posts:0, reach:0, engagement:0, entries:0 };
      obj[key].messages   += n(e.messageCount);
      obj[key].responses  += n(e.responseCount);
      obj[key].followers  += n(e.newFollowers);
      obj[key].posts      += n(e.posts);
      obj[key].reach      += n(e.reach);
      obj[key].engagement += n(e.engagement);
      obj[key].entries    += 1;
    };
    agg(summary.byPage, e.pageName);
    agg(summary.byDate, e.date);
    agg(summary.byUser, e.userName);
  });
  return { success: true, data: { entries, summary } };
}

function getPersonalSummary(data) {
  const { email, startDate, endDate } = data;
  const entries = getDailyEntries({ userEmail: email, startDate, endDate }).data;
  const n = f => Number(f||0);
  const total = {
    messages: entries.reduce((s,e) => s+n(e.messageCount),0),
    responses: entries.reduce((s,e) => s+n(e.responseCount),0),
    followers: entries.reduce((s,e) => s+n(e.newFollowers),0),
    posts: entries.reduce((s,e) => s+n(e.posts),0),
    reach: entries.reduce((s,e) => s+n(e.reach),0),
    engagement: entries.reduce((s,e) => s+n(e.engagement),0)
  };
  return { success: true, data: { entries, total } };
}
