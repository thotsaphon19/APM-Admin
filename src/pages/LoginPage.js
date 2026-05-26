// src/pages/LoginPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

// ── tiny sub-components ────────────────────────────────────────
function Input({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  const isPass = type === 'password';
  return (
    <div className="lp-field">
      <label className="lp-label">{label}</label>
      <div className="lp-input-wrap">
        <input
          className="lp-input"
          type={isPass && show ? 'text' : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        {isPass && (
          <button type="button" className="lp-eye" onClick={() => setShow(s => !s)}>
            {show ? '🙈' : '👁️'}
          </button>
        )}
      </div>
    </div>
  );
}

function OTPInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '8px 0' }}>
      {[0,1,2,3,4,5].map(i => (
        <input
          key={i}
          className="lp-otp-box"
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => {
            const v = e.target.value.replace(/\D/,'');
            const arr = value.split('');
            arr[i] = v;
            onChange(arr.join(''));
            if (v && e.target.nextSibling) e.target.nextSibling.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !value[i] && e.target.previousSibling)
              e.target.previousSibling.focus();
          }}
        />
      ))}
    </div>
  );
}

// ── screens ────────────────────────────────────────────────────
// SCREEN A: Login
function ScreenLogin({ onForgot, onNeedVerify }) {
  const { login } = useAuth();
  const [email, setEmail]   = useState('');
  const [pass,  setPass]    = useState('');
  const [err,   setErr]     = useState('');
  const [busy,  setBusy]    = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email || !pass) return setErr('กรุณากรอกอีเมลและรหัสผ่าน');
    setBusy(true); setErr('');
    try {
      await login(email, pass);
    } catch (ex) {
      // ถ้ายังไม่ยืนยันอีเมล → พาไปหน้ากรอก OTP เลย
      if (ex.message.includes('ยังไม่ได้รับการยืนยัน')) {
        onNeedVerify(email);
      } else {
        setErr(ex.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="lp-form">
      <div className="lp-head-icon">🔐</div>
      <h2 className="lp-title">เข้าสู่ระบบ</h2>
      <p className="lp-sub">Admin Page Manager</p>

      <Input label="อีเมล" type="email" value={email} onChange={e=>setEmail(e.target.value)}
             placeholder="your@email.com" autoComplete="email" />
      <Input label="รหัสผ่าน" type="password" value={pass} onChange={e=>setPass(e.target.value)}
             placeholder="••••••••" autoComplete="current-password" />

      {err && <div className="lp-error">{err}</div>}

      <button className="lp-btn" type="submit" disabled={busy}>
        {busy ? <span className="lp-spinner"/> : '→'}&nbsp;
        {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
      </button>

      <button type="button" className="lp-link" onClick={onForgot}>
        ลืมรหัสผ่าน?
      </button>
    </form>
  );
}

// SCREEN B: Verify email OTP (first login)
function ScreenVerify({ email, prefillOtp = '', onDone }) {
  const [otp,  setOtp]  = useState(prefillOtp);
  const [err,  setErr]  = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  // แค่ prefill OTP จาก URL ไว้ในช่อง ไม่ auto-verify
  useEffect(() => {
    if (prefillOtp) setOtp(prefillOtp);
  }, [prefillOtp]);

  async function resend() {
    setBusy(true); setErr(''); setSent(false);
    try {
      await api.sendVerifyEmail({ email, type: 'verify' });
      setSent(true);
      setOtp(''); // ล้าง OTP เก่าออก
    } catch(ex){ setErr(ex.message); }
    finally{ setBusy(false); }
  }

  async function verify() {
    const code = otp.trim();
    if (code.length < 6) return setErr('กรอก OTP 6 หลักให้ครบ');
    setBusy(true); setErr('');
    try {
      await api.verifyEmailOTP({ email, otp: code, type: 'verify' });
      onDone();
    } catch(ex){ setErr(ex.message); }
    finally{ setBusy(false); }
  }

  return (
    <div className="lp-form">
      <div className="lp-head-icon">📧</div>
      <h2 className="lp-title">ยืนยันอีเมล</h2>
      <p className="lp-sub">
        {prefillOtp
          ? <>OTP ถูกกรอกมาจากลิงก์อีเมล<br/>กด <strong>ยืนยัน OTP</strong> ได้เลย</>
          : <>ระบบส่ง OTP 6 หลักไปที่<br/><strong>{email}</strong></>
        }
      </p>

      <OTPInput value={otp} onChange={setOtp}/>

      {err  && <div className="lp-error">{err}</div>}
      {sent && <div className="lp-success">✅ ส่ง OTP ใหม่แล้ว ตรวจสอบอีเมล</div>}

      <button className="lp-btn" onClick={verify} disabled={busy || otp.length < 6}>
        {busy ? <span className="lp-spinner"/> : '✅'}&nbsp;ยืนยัน OTP
      </button>
      <button type="button" className="lp-link" onClick={resend} disabled={busy}>
        ส่ง OTP ใหม่
      </button>
    </div>
  );
}

// SCREEN C: Forgot password — step 1 enter email
function ScreenForgot({ onBack, initEmail = '', initOtp = '', initStep = 1 }) {
  const [email, setEmail] = useState(initEmail);
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);
  const [step,  setStep]  = useState(initStep); // 1=email, 2=otp+newpass
  const [otp,   setOtp]   = useState(initOtp);
  const [np,    setNp]    = useState('');
  const [np2,   setNp2]   = useState('');
  const [done,  setDone]  = useState(false);

  async function sendOTP(e) {
    e.preventDefault();
    if (!email) return setErr('กรอกอีเมล');
    setBusy(true); setErr('');
    try {
      await api.forgotPassword({ email });
      setStep(2);
    } catch(ex){ setErr(ex.message); }
    finally{ setBusy(false); }
  }

  async function doReset(e) {
    e.preventDefault();
    if (otp.length < 6) return setErr('กรอก OTP 6 หลัก');
    if (np.length < 6)  return setErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัว');
    if (np !== np2)     return setErr('รหัสผ่านไม่ตรงกัน');
    setBusy(true); setErr('');
    try {
      await api.resetPassword({ email, otp, newPassword: np });
      setDone(true);
    } catch(ex){ setErr(ex.message); }
    finally{ setBusy(false); }
  }

  if (done) return (
    <div className="lp-form">
      <div className="lp-head-icon">🎉</div>
      <h2 className="lp-title">รีเซ็ตสำเร็จ!</h2>
      <p className="lp-sub">รหัสผ่านใหม่ใช้งานได้แล้ว</p>
      <button className="lp-btn" onClick={onBack}>→ กลับหน้าเข้าสู่ระบบ</button>
    </div>
  );

  if (step === 2) return (
    <form onSubmit={doReset} className="lp-form">
      <div className="lp-head-icon">🔑</div>
      <h2 className="lp-title">ตั้งรหัสผ่านใหม่</h2>
      <p className="lp-sub">กรอก OTP ที่ส่งไปที่ <strong>{email}</strong></p>

      <OTPInput value={otp} onChange={setOtp}/>

      <Input label="รหัสผ่านใหม่" type="password" value={np} onChange={e=>setNp(e.target.value)}
             placeholder="อย่างน้อย 6 ตัวอักษร"/>
      <Input label="ยืนยันรหัสผ่านใหม่" type="password" value={np2} onChange={e=>setNp2(e.target.value)}
             placeholder="กรอกซ้ำอีกครั้ง"/>

      {err && <div className="lp-error">{err}</div>}

      <button className="lp-btn" type="submit" disabled={busy}>
        {busy ? <span className="lp-spinner"/> : '🔐'}&nbsp;ตั้งรหัสผ่านใหม่
      </button>
      <button type="button" className="lp-link" onClick={onBack}>← กลับ</button>
    </form>
  );

  return (
    <form onSubmit={sendOTP} className="lp-form">
      <div className="lp-head-icon">📬</div>
      <h2 className="lp-title">ลืมรหัสผ่าน</h2>
      <p className="lp-sub">กรอกอีเมลที่ลงทะเบียนไว้ ระบบจะส่ง OTP ให้</p>

      <Input label="อีเมล" type="email" value={email} onChange={e=>setEmail(e.target.value)}
             placeholder="your@email.com"/>
      {err && <div className="lp-error">{err}</div>}

      <button className="lp-btn" type="submit" disabled={busy}>
        {busy ? <span className="lp-spinner"/> : '📧'}&nbsp;ส่ง OTP
      </button>
      <button type="button" className="lp-link" onClick={onBack}>← กลับ</button>
    </form>
  );
}

// ── main export ─────────────────────────────────────────────
export default function LoginPage() {
  // ── รับ params จาก URL เช่น /verify?email=x&otp=123456&type=verify ──
  const params   = new URLSearchParams(window.location.search);
  const urlEmail = params.get('email') || '';
  const urlOtp   = params.get('otp')   || '';
  const urlType  = params.get('type')  || 'verify';

  // ถ้ามี email+otp ใน URL → ไปหน้ายืนยันได้เลย
  const initScreen = urlEmail && urlOtp
    ? (urlType === 'reset' ? 'forgot' : 'verify')
    : 'login';

  const [screen,      setScreen]      = useState(initScreen);
  const [verifyEmail, setVerifyEmail] = useState(urlEmail);
  const [prefillOtp,  setPrefillOtp]  = useState(urlOtp);
  const [forgotStep,  setForgotStep]  = useState(urlType === 'reset' && urlOtp ? 2 : 1);

  return (
    <div className="lp-page">
      <div className="lp-blob b1"/>
      <div className="lp-blob b2"/>
      <div className="lp-blob b3"/>

      <div className="lp-card">
        <div className="lp-logo-bar">
          <div className="lp-logo-mark">APM</div>
          <div>
            <div className="lp-brand">Admin Page Manager</div>
            <div className="lp-tagline">ระบบบริหารจัดการแอดมินเพจ</div>
          </div>
        </div>

        <div className="lp-divider"/>

        {screen === 'login'  && (
          <ScreenLogin
            onForgot={() => setScreen('forgot')}
            onNeedVerify={(email) => { setVerifyEmail(email); setScreen('verify'); }}
          />
        )}
        {screen === 'verify' && (
          <ScreenVerify
            email={verifyEmail}
            prefillOtp={prefillOtp}
            onDone={() => { setPrefillOtp(''); setScreen('login'); }}
          />
        )}
        {screen === 'forgot' && (
          <ScreenForgot
            initEmail={urlEmail}
            initOtp={urlType === 'reset' ? urlOtp : ''}
            initStep={urlType === 'reset' && urlOtp ? 2 : 1}
            onBack={() => setScreen('login')}
          />
        )}
      </div>

      <style>{`
        .lp-page {
          min-height:100vh; display:flex; align-items:center; justify-content:center;
          background:var(--bg-deep); padding:20px; position:relative; overflow:hidden;
        }
        .lp-blob {
          position:absolute; border-radius:50%; filter:blur(90px); opacity:.12; pointer-events:none;
        }
        .b1{width:500px;height:500px;background:var(--accent-gold);top:-140px;right:-100px;}
        .b2{width:380px;height:380px;background:var(--accent-blue);bottom:-80px;left:-80px;}
        .b3{width:280px;height:280px;background:var(--accent-purple);top:55%;left:50%;transform:translate(-50%,-50%);}

        .lp-card {
          position:relative; background:var(--bg-card);
          border:1px solid rgba(255,255,255,.09);
          border-radius:24px; width:100%; max-width:420px;
          padding:36px 32px; box-shadow:0 24px 64px rgba(0,0,0,.55);
        }
        .lp-logo-bar{display:flex;align-items:center;gap:14px;margin-bottom:0;}
        .lp-logo-mark{
          width:52px;height:52px;border-radius:14px;flex-shrink:0;
          background:linear-gradient(135deg,var(--accent-gold),var(--accent-blue));
          display:flex;align-items:center;justify-content:center;
          font-weight:800;font-size:17px;color:#0d0e1a;font-family:'Sora',sans-serif;
          box-shadow:0 6px 20px rgba(245,200,66,.28);
        }
        .lp-brand{font-size:16px;font-weight:700;color:var(--text-primary);}
        .lp-tagline{font-size:11px;color:var(--text-muted);margin-top:2px;}
        .lp-divider{height:1px;background:var(--border);margin:22px 0;}

        .lp-form{display:flex;flex-direction:column;gap:16px;}
        .lp-head-icon{font-size:36px;text-align:center;}
        .lp-title{font-size:20px;font-weight:700;text-align:center;color:var(--text-primary);}
        .lp-sub{font-size:13px;color:var(--text-muted);text-align:center;line-height:1.6;}

        .lp-field{display:flex;flex-direction:column;gap:5px;}
        .lp-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-secondary);}
        .lp-input-wrap{position:relative;}
        .lp-input{
          width:100%;background:var(--bg-surface);border:1px solid var(--border);
          border-radius:10px;padding:11px 42px 11px 14px;color:var(--text-primary);
          font-size:14px;font-family:inherit;transition:all .18s;
        }
        .lp-input:focus{outline:none;border-color:var(--accent-blue);box-shadow:0 0 0 3px rgba(79,142,247,.15);}
        .lp-input::placeholder{color:var(--text-muted);}
        .lp-eye{
          position:absolute;right:10px;top:50%;transform:translateY(-50%);
          background:none;border:none;cursor:pointer;font-size:16px;line-height:1;padding:2px;
        }

        .lp-otp-box{
          width:44px;height:52px;text-align:center;font-size:22px;font-weight:700;
          font-family:'Sora',sans-serif;background:var(--bg-surface);
          border:1.5px solid var(--border);border-radius:10px;color:var(--text-primary);
          transition:all .15s;
        }
        .lp-otp-box:focus{outline:none;border-color:var(--accent-gold);box-shadow:0 0 0 3px rgba(245,200,66,.18);}

        .lp-btn{
          width:100%;padding:13px;border-radius:10px;border:none;cursor:pointer;
          background:var(--accent-gold);color:#0d0e1a;font-size:15px;font-weight:700;
          font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;
          transition:all .2s;margin-top:4px;
        }
        .lp-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(245,200,66,.32);}
        .lp-btn:disabled{opacity:.6;cursor:not-allowed;}

        .lp-spinner{
          width:18px;height:18px;border:2px solid rgba(0,0,0,.3);border-top-color:#0d0e1a;
          border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0;
        }
        .lp-link{
          background:none;border:none;cursor:pointer;color:var(--text-muted);
          font-size:13px;font-family:inherit;text-align:center;padding:4px;
          transition:color .15s;
        }
        .lp-link:hover{color:var(--accent-blue);}
        .lp-link:disabled{opacity:.5;cursor:not-allowed;}

        .lp-error{
          background:rgba(247,111,142,.1);border:1px solid rgba(247,111,142,.3);
          border-radius:8px;padding:10px 14px;font-size:13px;color:var(--accent-rose);
          display:flex;align-items:center;gap:8px;
        }
        .lp-error::before{content:'⚠️';}
        .lp-success{
          background:rgba(54,215,183,.1);border:1px solid rgba(54,215,183,.3);
          border-radius:8px;padding:10px 14px;font-size:13px;color:var(--accent-teal);
          text-align:center;
        }
      `}</style>
    </div>
  );
}
