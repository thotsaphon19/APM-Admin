import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Spinner } from '../../components/ui'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [form, setForm]     = useState({ email:'', password:'' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const set = k => e => setForm(p=>({...p,[k]:e.target.value}))

  const handleSubmit = async e => {
    e.preventDefault(); setLoading(true); setError('')
    try { await login(form.email, form.password); nav('/') }
    catch(err) {
      const M = {
        'auth/invalid-credential':'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        'auth/user-not-found':'ไม่พบบัญชีในระบบ',
        'auth/wrong-password':'รหัสผ่านไม่ถูกต้อง',
        'auth/too-many-requests':'ลองใหม่อีกครั้งในภายหลัง',
        'auth/network-request-failed':'ไม่สามารถเชื่อมต่ออินเทอร์เน็ต',
      }
      setError(M[err.code]||err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight:'100vh',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:20,
      background:'linear-gradient(135deg, #eef2ff 0%, #f0fdf4 50%, #fdf4ff 100%)',
      position:'relative', overflow:'hidden',
    }}>
      {/* Deco blobs */}
      <div style={{ position:'absolute', top:'-10%', left:'-8%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,.15), transparent 70%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'-10%', right:'-8%', width:350, height:350, borderRadius:'50%', background:'radial-gradient(circle, rgba(20,184,166,.12), transparent 70%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', top:'35%', left:'55%', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(236,72,153,.08), transparent 70%)', pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{
            width:72, height:72, borderRadius:22, margin:'0 auto 14px',
            background:'linear-gradient(135deg, #6366f1, #7c3aed)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:32, boxShadow:'0 12px 36px rgba(99,102,241,.4)',
            animation:'float 3s ease-in-out infinite',
          }}>🚀</div>
          <h1 style={{ fontSize:28, fontWeight:900, color:'#1e1b4b', marginBottom:6 }}>AdminSys</h1>
          <p style={{ color:'#6b7280', fontSize:14 }}>ระบบจัดการแอดมิน ค่าคอม เพจ และวันลา</p>
        </div>

        {/* Card */}
        <div style={{
          background:'#ffffff',
          borderRadius:22, padding:32,
          boxShadow:'0 12px 40px rgba(99,102,241,.15)',
          border:'1.5px solid #e0e7ff',
        }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:'#1e1b4b', marginBottom:22, display:'flex', alignItems:'center', gap:8 }}>
            <span>👋</span> เข้าสู่ระบบ
          </h2>

          {error && (
            <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'10px 14px', color:'#881337', fontSize:13.5, marginBottom:14, display:'flex', gap:8 }}>
              <span>❌</span><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:6 }}>
                📧 อีเมล
              </label>
              <input type="email"
                style={{ width:'100%', background:'#fff', border:'1.5px solid #dde3f5', borderRadius:10, color:'#1e1b4b', fontFamily:'inherit', fontSize:13.5, padding:'9px 12px', outline:'none', transition:'all .18s' }}
                placeholder="your@email.com"
                value={form.email} onChange={set('email')} required autoFocus
                onFocus={e=>e.target.style.borderColor='#6366f1'}
                onBlur={e=>e.target.style.borderColor='#dde3f5'}
              />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:6 }}>
                🔑 รหัสผ่าน
              </label>
              <div style={{ position:'relative' }}>
                <input type={showPw?'text':'password'}
                  style={{ width:'100%', background:'#fff', border:'1.5px solid #dde3f5', borderRadius:10, color:'#1e1b4b', fontFamily:'inherit', fontSize:13.5, padding:'9px 42px 9px 12px', outline:'none', transition:'all .18s' }}
                  placeholder="••••••••"
                  value={form.password} onChange={set('password')} required
                  onFocus={e=>e.target.style.borderColor='#6366f1'}
                  onBlur={e=>e.target.style.borderColor='#dde3f5'}
                />
                <button type="button" onClick={()=>setShowPw(p=>!p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#9ca3af', cursor:'pointer', padding:4, display:'flex' }}>
                  {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              width:'100%', padding:'12px 20px', borderRadius:12, border:'none',
              background:'linear-gradient(135deg, #6366f1, #7c3aed)',
              color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer',
              boxShadow:'0 6px 20px rgba(99,102,241,.4)',
              fontFamily:'inherit', transition:'all .18s',
              opacity: loading ? .7 : 1,
            }}>
              {loading?<><Spinner size={15}/> กำลังเข้าสู่ระบบ...</>:<><LogIn size={15}/> 🎉 เข้าสู่ระบบ</>}
            </button>
          </form>
        </div>

        {/* Hint */}
        <div style={{ marginTop:14, background:'rgba(255,255,255,.8)', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'12px 18px', fontSize:12.5, color:'#6b7280' }}>
          <span style={{ color:'#6366f1', fontWeight:800 }}>🔧 ครั้งแรก:</span>
          {' '}สร้างบัญชีใน Firebase Auth → เพิ่ม doc ใน Firestore{' '}
          <code style={{ color:'#7c3aed', background:'#f5f3ff', padding:'1px 5px', borderRadius:4 }}>users/</code>{' '}พร้อม{' '}
          <code style={{ color:'#059669', background:'#f0fdf4', padding:'1px 5px', borderRadius:4 }}>role: "superadmin"</code>
        </div>
      </div>

      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
    </div>
  )
}
