// src/utils/api.js
const GAS_URL = process.env.REACT_APP_GAS_URL || 'YOUR_GOOGLE_APPS_SCRIPT_URL';

async function callAPI(action, data = {}) {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, data }),
      redirect: 'follow',
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'API Error');
    return result;
  } catch (err) {
    console.error(`[API:${action}]`, err.message);
    throw err;
  }
}

export const api = {
  // Auth
  login:              (d) => callAPI('login', d),
  sendVerifyEmail:    (d) => callAPI('sendVerifyEmail', d),
  verifyEmailOTP:     (d) => callAPI('verifyEmailOTP', d),
  changePassword:     (d) => callAPI('changePassword', d),
  forgotPassword:     (d) => callAPI('forgotPassword', d),
  resetPassword:      (d) => callAPI('resetPassword', d),
  // Profile (self)
  updateProfile:      (d) => callAPI('updateProfile', d),
  // Admin profiles (manager view)
  getAdminProfiles:   ()  => callAPI('getAdminProfiles'),
  updateAdminProfile: (d) => callAPI('updateAdminProfile', d),
  updateUserPages:    (d) => callAPI('updateUserPages', d),
  // Users
  getUsers:           ()  => callAPI('getUsers'),
  addUser:            (d) => callAPI('addUser', d),
  updateUser:         (d) => callAPI('updateUser', d),
  deleteUser:         (e) => callAPI('deleteUser', { email: e }),
  updateUserRole:     (d) => callAPI('updateUserRole', d),
  // Pages
  getPages:           ()  => callAPI('getPages'),
  addPage:            (d) => callAPI('addPage', d),
  updatePage:         (d) => callAPI('updatePage', d),
  deletePage:        (id) => callAPI('deletePage', { id }),
  // Daily
  getDailyEntries:    (d) => callAPI('getDailyEntries', d),
  addDailyEntry:      (d) => callAPI('addDailyEntry', d),
  updateDailyEntry:   (d) => callAPI('updateDailyEntry', d),
  deleteDailyEntry:  (id) => callAPI('deleteDailyEntry', { id }),
  // Reports
  getReport:          (d) => callAPI('getReport', d),
  getPersonalSummary: (d) => callAPI('getPersonalSummary', d),
  // Leaves
  getLeaves:          (d) => callAPI('getLeaves', d || {}),
  addLeave:           (d) => callAPI('addLeave', d),
  updateLeaveStatus:  (d) => callAPI('updateLeaveStatus', d),
  deleteLeave:       (id) => callAPI('deleteLeave', { id }),
  // My Page Entries (admin self-managed)
  getMyPageEntries:   (d) => callAPI('getMyPageEntries', d),
  addMyPageEntry:     (d) => callAPI('addMyPageEntry', d),
  updateMyPageEntry:  (d) => callAPI('updateMyPageEntry', d),
  deleteMyPageEntry: (id) => callAPI('deleteMyPageEntry', { id }),
  markNotifRead:      (d) => callAPI('markNotifRead', d),
  markAllNotifRead:   (d) => callAPI('markAllNotifRead', d),
};
