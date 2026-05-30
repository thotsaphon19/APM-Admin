// src/pages/SettingsPage.js
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ToastContainer, useToast } from '../components/Toast';
import { api } from '../utils/api';
import CODE_GS from '../utils/codeGs';

const STORAGE_KEY = 'apm_gas_url';

export default function SettingsPage() {
  const { user, isExecutive } = useAuth();
  const { toasts, remove, toast } = useToast();
  const codeRef = useRef(null);

  const [gasUrl,     setGasUrl]     = useState('');
  const [savedUrl,   setSavedUrl]   = useState('');
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testMsg,    setTestMsg]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [showUrl,    setShowUrl]    = useState(false);
  const [activeTab,  setActiveTab]  = useState('connection');
  const [copied,     setCopied]     = useState(false);
  const [sysInfo,    setSysInfo]    = useState(null);
  const [loadingSys, setLoadingSys] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || process.env.REACT_APP_GAS_URL || '';
    setGasUrl(stored);
    setSavedUrl(stored);
  }, []);

  function saveUrl() {
    if (!gasUrl.trim()) return toast.error('กรุณากรอก URL');
    if (!gasUrl.includes('script.google.com'))
      return toast.error('URL ต้องเป็น Google Apps Script URL');
    setSaving(true);
    localStorage.setItem(STORAGE_KEY, gasUrl.trim());
    setSavedUrl(gasUrl.trim());
    setTimeout(() => {
      setSaving(false);
      setTestResult(null);
      toast.success('บันทึก URL สำเร็จ — กด Reload เพื่อให้มีผล');
    }, 300);
  }

  function resetUrl() {
    const envUrl = process.env.REACT_APP_GAS_URL || '';
    setGasUrl(envUrl);
    localStorage.removeItem(STORAGE_KEY);
    setSavedUrl(envUrl);
    setTestResult(null);
    toast.info('รีเซ็ตเป็นค่าเริ่มต้นแล้ว');
  }

  async function testConnection() {
    const url = gasUrl.trim();
    if (!url) return toast.error('กรอก URL ก่อน');
    setTesting(true); setTestResult(null); setTestMsg('');
    try {
      const res  = await fetch(`${url}?action=getPages`, { method:'GET', redirect:'follow' });
      const data = await res.json();
      if (data.success !== undefined) {
        setTestResult('ok');
        setTestMsg(`✅ เชื่อมต่อสำเร็จ — พบ ${data.data?.length || 0} เพจในระบบ`);
      } else {
        setTestResult('fail');
        setTestMsg('Response ไม่ถูกต้อง: ' + JSON.stringify(data).slice(0,120));
      }
    } catch(e) {
      setTestResult('fail');
      setTestMsg('เชื่อมต่อไม่ได้: ' + e.message);
    } finally { setTesting(false); }
  }

  async function loadSysInfo() {
    setLoadingSys(true); setSysInfo(null);
    try {
      const [uR, pR, lR] = await Promise.all([
        api.getUsers(), api.getPages(), api.getLeaves({}),
      ]);
      setSysInfo({
        users:  (uR.data||[]).length,
        pages:  (pR.data||[]).length,
        leaves: (lR.data||[]).length,
        url:    savedUrl || '—',
        env:    process.env.REACT_APP_GAS_URL || '(ไม่ได้ตั้งค่า)',
        local:  localStorage.getItem(STORAGE_KEY) || '(ไม่ได้ตั้งค่า)',
      });
    } catch(e) { toast.error('โหลดไม่ได้: ' + e.message); }
    finally { setLoadingSys(false); }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(CODE_GS);
      setCopied(true);
      toast.success('คัดลอก Code.gs สำเร็จ! วางใน Apps Script ได้เลย');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = CODE_GS;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      toast.success('คัดลอกสำเร็จ!');
      setTimeout(() => setCopied(false), 3000);
    }
  }

  function downloadCode() {
    const blob = new Blob([CODE_GS], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'Code.gs'; a.click();
    URL.revokeObjectURL(url);
    toast.success('ดาวน์โหลด Code.gs สำเร็จ');
  }

  const isChanged  = gasUrl !== savedUrl;
  const connected  = savedUrl && savedUrl.includes('script.google.com');

  // highlight search in code
  const codeLines  = CODE_GS.split('\n');
  const matchLines = codeSearch
    ? codeLines.reduce((acc, line, i) => {
        if (line.toLowerCase().includes(codeSearch.toLowerCase())) acc.push(i+1);
        return acc;
      }, [])
    : [];

  const TABS = [
    { id:'connection', label:'🔗 การเชื่อมต่อ' },
    { id:'codereview', label:'📋 Code.gs'        },
    { id:'system',     label:'🖥️ ระบบ'           },
    { id:'guide',      label:'📖 คู่มือ'          },
  ];

  return (
    <div style={{ maxWidth:900 }}>
      <ToastContainer toasts={toasts} removeToast={remove}/>

      {/* Tab bar */}
      <div style={{
        display:'flex', gap:4, marginBottom:22, flexWrap:'wrap',
        background:'var(--bg-hover)', padding:4,
        borderRadius:12, width:'fit-content',
        border:'1px solid var(--border)',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`btn btn-sm ${activeTab===t.id?'btn-primary':'btn-ghost'}`}
            style={{ borderRadius:9 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ Tab: Connection ══════════ */}
      {activeTab==='connection' && (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

          {/* Status card */}
          <div className="card" style={{
            background: connected
              ? 'linear-gradient(135deg,rgba(16,185,129,0.06),rgba(16,185,129,0.02))'
              : 'linear-gradient(135deg,rgba(244,63,94,0.06),rgba(244,63,94,0.02))',
            border: connected ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(244,63,94,0.25)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
              <div style={{ fontSize:38 }}>{connected ? '🟢' : '🔴'}</div>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>
                  {connected ? 'เชื่อมต่อ GAS แล้ว' : 'ยังไม่ได้ตั้งค่า URL'}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace', wordBreak:'break-all' }}>
                  {savedUrl || '(ไม่มี URL)'}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={testConnection}
                  disabled={testing || !savedUrl}>
                  {testing ? '⏳' : '🔍 ทดสอบ'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
                  🔄 Reload
                </button>
              </div>
            </div>
            {testResult && (
              <div style={{
                marginTop:12, padding:'10px 14px', borderRadius:8, fontSize:13,
                background: testResult==='ok'?'rgba(16,185,129,0.1)':'rgba(244,63,94,0.1)',
                border:`1px solid ${testResult==='ok'?'rgba(16,185,129,0.3)':'rgba(244,63,94,0.3)'}`,
                color: testResult==='ok'?'#059669':'#e11d48',
              }}>{testMsg}</div>
            )}
          </div>

          {/* Edit URL */}
          {isExecutive && (
            <div className="card">
              <div className="chart-title" style={{ marginBottom:16 }}>🔗 ตั้งค่า Google Apps Script URL</div>

              <div style={{
                background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.15)',
                borderRadius:9, padding:'11px 15px', marginBottom:16, fontSize:13,
                color:'var(--text-secondary)', lineHeight:1.7,
              }}>
                URL คือที่อยู่ของ Google Apps Script Web App ที่ใช้เชื่อมต่อกับ Google Sheet
                ผู้บริหารสามารถเปลี่ยน URL ได้โดยไม่ต้อง redeploy เว็บ
              </div>

              <div className="form-group" style={{ marginBottom:14 }}>
                <label className="form-label">Web App URL</label>
                <div style={{ position:'relative' }}>
                  <input className="form-input"
                    type={showUrl?'text':'password'}
                    value={gasUrl}
                    onChange={e => setGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/xxxxx/exec"
                    style={{ paddingRight:44, fontFamily:'monospace', fontSize:12 }}/>
                  <button type="button" onClick={() => setShowUrl(s=>!s)} style={{
                    position:'absolute', right:11, top:'50%', transform:'translateY(-50%)',
                    background:'none', border:'none', cursor:'pointer', fontSize:16,
                  }}>{showUrl?'🙈':'👁️'}</button>
                </div>
                {isChanged && (
                  <div style={{ fontSize:11, color:'#f59e0b', marginTop:4 }}>
                    ⚠️ มีการเปลี่ยนแปลง — กด "บันทึก" เพื่อใช้งาน
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className="btn btn-primary" onClick={saveUrl} disabled={saving||!gasUrl}>
                  {saving?'⏳...':'💾 บันทึก URL'}
                </button>
                <button className="btn btn-secondary" onClick={testConnection}
                  disabled={testing||!gasUrl}>
                  {testing?'⏳ ทดสอบ...':'🔍 ทดสอบ'}
                </button>
                <button className="btn btn-ghost" onClick={resetUrl}>🔄 รีเซ็ต</button>
                {isChanged && (
                  <button className="btn btn-ghost" onClick={() => setGasUrl(savedUrl)}>✕ ยกเลิก</button>
                )}
              </div>
            </div>
          )}

          {/* URL format */}
          <div className="card">
            <div className="chart-title" style={{ marginBottom:12 }}>📋 รูปแบบ URL ที่ถูกต้อง</div>
            <div style={{
              background:'var(--bg-hover)', borderRadius:8, padding:'11px 14px',
              fontFamily:'monospace', fontSize:12, color:'var(--text-primary)',
              border:'1px solid var(--border)', wordBreak:'break-all', lineHeight:2,
            }}>
              https://script.google.com/macros/s/
              <span style={{ color:'var(--brand-primary)', fontWeight:700 }}>AKfycb...xxx</span>/exec
            </div>
            <div style={{ marginTop:10, fontSize:12, color:'var(--text-muted)', lineHeight:1.9 }}>
              • ขึ้นต้นด้วย <code style={{background:'var(--bg-hover)',padding:'1px 5px',borderRadius:4}}>https://script.google.com/macros/s/</code><br/>
              • ลงท้ายด้วย <code style={{background:'var(--bg-hover)',padding:'1px 5px',borderRadius:4}}>/exec</code><br/>
              • Deploy ตั้งค่า <strong>Who has access: Anyone</strong>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Tab: Code.gs ══════════ */}
      {activeTab==='codereview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Info + actions */}
          <div className="card" style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', border:'1px solid rgba(99,102,241,0.18)' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>📋 Code.gs — Backend ทั้งหมด</div>
                <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.7 }}>
                  คัดลอก code นี้ไปวางใน <strong>Google Apps Script</strong> แล้วรัน <code style={{background:'rgba(99,102,241,0.1)',padding:'1px 6px',borderRadius:4}}>setupSheets()</code> เพื่อสร้าง Sheet ครบทุก tab
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>
                  {CODE_GS.split('\n').length.toLocaleString()} บรรทัด · {(CODE_GS.length/1024).toFixed(1)} KB
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', flexShrink:0 }}>
                <button className="btn btn-primary" onClick={copyCode}>
                  {copied ? '✅ คัดลอกแล้ว!' : '📋 คัดลอก Code'}
                </button>
                <button className="btn btn-secondary" onClick={downloadCode}>
                  ⬇️ ดาวน์โหลด
                </button>
              </div>
            </div>
          </div>

          {/* Search in code */}
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <input className="form-input" style={{ maxWidth:280 }}
              placeholder="🔍 ค้นหาใน Code.gs..."
              value={codeSearch}
              onChange={e => setCodeSearch(e.target.value)}/>
            {codeSearch && (
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                พบ {matchLines.length} บรรทัด
                {matchLines.length > 0 && ` (บรรทัด ${matchLines.slice(0,5).join(', ')}${matchLines.length>5?'...':''})`}
              </span>
            )}
          </div>

          {/* Code display */}
          <div style={{ position:'relative' }}>
            <button onClick={copyCode} style={{
              position:'absolute', top:12, right:12, zIndex:10,
              background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.9)',
              border: `1px solid ${copied?'rgba(16,185,129,0.3)':'var(--border)'}`,
              borderRadius:7, padding:'5px 12px', cursor:'pointer',
              fontSize:12, fontWeight:600, color: copied?'#059669':'var(--text-secondary)',
              transition:'all .2s',
            }}>
              {copied ? '✅ คัดลอกแล้ว' : '📋 คัดลอก'}
            </button>

            <pre ref={codeRef} style={{
              background:'#1e1b4b', color:'#e0e7ff',
              borderRadius:12, padding:'20px 20px 20px 16px',
              fontSize:12, lineHeight:1.7, overflow:'auto',
              maxHeight:'60vh', border:'1px solid rgba(99,102,241,0.2)',
              fontFamily:"'Fira Code','Cascadia Code','JetBrains Mono',monospace",
              margin:0, whiteSpace:'pre',
            }}>
              {CODE_GS.split('\n').map((line, i) => {
                const lineNum  = i + 1;
                const isMatch  = codeSearch && line.toLowerCase().includes(codeSearch.toLowerCase());
                return (
                  <div key={i} style={{
                    display:'flex',
                    background: isMatch ? 'rgba(245,200,66,0.2)' : 'transparent',
                    borderRadius: isMatch ? 3 : 0,
                    marginLeft:-4, paddingLeft:4,
                  }}>
                    <span style={{
                      width:36, flexShrink:0, textAlign:'right', paddingRight:16,
                      color:'rgba(148,163,247,0.4)', userSelect:'none', fontSize:11,
                    }}>{lineNum}</span>
                    <span style={{ flex:1 }}>
                      {codeSearch && isMatch
                        ? highlightMatch(line, codeSearch)
                        : colorize(line)
                      }
                    </span>
                  </div>
                );
              })}
            </pre>
          </div>

          {/* Step guide */}
          <div className="card">
            <div className="chart-title" style={{ marginBottom:14 }}>🚀 ขั้นตอนนำไปใช้</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { num:'1', text:'เปิด Google Sheet ใหม่ หรือ Sheet ที่มีอยู่แล้ว', sub:'sheets.google.com → สร้างใหม่หรือเปิด Sheet ที่ต้องการ' },
                { num:'2', text:'เปิด Apps Script', sub:'เมนู Extensions → Apps Script' },
                { num:'3', text:'วาง Code.gs', sub:'ลบโค้ดเดิมทั้งหมด → กด "คัดลอก Code" ด้านบน → วาง → Ctrl+S' },
                { num:'4', text:'แก้ไข APP_URL (บรรทัดที่ 3 ของโค้ด)', sub:'เปลี่ยนเป็น URL จริงของเว็บคุณ' },
                { num:'5', text:'รัน setupSheets()', sub:'เลือก function setupSheets → กด ▶ Run → อนุญาต Permission' },
                { num:'6', text:'Deploy เป็น Web App', sub:'Deploy → New deployment → Web app → Execute as: Me → Anyone → Deploy' },
                { num:'7', text:'นำ URL มาใส่ในหน้าตั้งค่า', sub:'คัดลอก URL ที่ได้ → กลับมาที่ Tab การเชื่อมต่อ → วาง URL → บันทึก' },
              ].map(step => (
                <div key={step.num} style={{
                  display:'flex', gap:14, alignItems:'flex-start',
                  padding:'12px 16px', background:'var(--bg-hover)',
                  borderRadius:10, border:'1px solid var(--border)',
                }}>
                  <div style={{
                    width:28, height:28, borderRadius:'50%', flexShrink:0,
                    background:'var(--brand-gradient)', color:'white',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:13, fontWeight:700,
                    boxShadow:'0 2px 8px rgba(99,102,241,0.3)',
                  }}>{step.num}</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{step.text}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{step.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Tab: System ══════════ */}
      {activeTab==='system' && (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:10 }}>
              <div className="chart-title" style={{ marginBottom:0 }}>🖥️ ข้อมูลระบบ</div>
              <button className="btn btn-secondary btn-sm" onClick={loadSysInfo} disabled={loadingSys}>
                {loadingSys?'⏳...':'🔄 โหลด'}
              </button>
            </div>
            {!sysInfo && !loadingSys && (
              <div className="empty-state" style={{ padding:'28px' }}>
                <div className="empty-icon">🖥️</div>
                <div className="empty-title">กด "โหลด" เพื่อดูสถานะระบบ</div>
              </div>
            )}
            {loadingSys && <div className="loading-overlay"><div className="spinner"/></div>}
            {sysInfo && (
              <>
                <div className="stats-grid" style={{ marginBottom:18 }}>
                  {[
                    { icon:'👥', label:'ผู้ใช้', value: sysInfo.users,  color:'#6366f1' },
                    { icon:'📄', label:'เพจ',    value: sysInfo.pages,  color:'#8b5cf6' },
                    { icon:'🌴', label:'ใบลา',   value: sysInfo.leaves, color:'#10b981' },
                  ].map((s,i) => (
                    <div key={i} className="stat-card" style={{ '--accent-color':s.color }}>
                      <div className="stat-icon">{s.icon}</div>
                      <div className="stat-label">{s.label}</div>
                      <div className="stat-value">{s.value}</div>
                    </div>
                  ))}
                </div>
                <div className="table-wrapper">
                  <table>
                    <tbody>
                      {[
                        ['URL ที่ใช้งาน', sysInfo.url,   true],
                        ['ENV URL',        sysInfo.env,   true],
                        ['Local Override', sysInfo.local, true],
                        ['เวอร์ชัน',       'APM v2.0',    false],
                        ['ผู้ใช้',          user?.email,   false],
                        ['สิทธิ์', user?.role==='executive'?'ผู้บริหาร':user?.role==='head'?'หัวหน้า':'แอดมิน', false],
                        ['เวลา', new Date().toLocaleString('th-TH'), false],
                      ].map(([k,v,mono]) => (
                        <tr key={k}>
                          <td style={{ padding:'9px 14px', fontSize:12, color:'var(--text-muted)', fontWeight:600, width:'35%', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{k}</td>
                          <td style={{ padding:'9px 14px', fontSize:11, borderBottom:'1px solid var(--border)', fontFamily:mono?'monospace':'inherit', color:'var(--text-primary)', wordBreak:'break-all' }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {isExecutive && (
            <div className="card" style={{ border:'1px solid rgba(244,63,94,0.2)', background:'rgba(244,63,94,0.02)' }}>
              <div className="chart-title" style={{ marginBottom:14, color:'var(--accent-rose)' }}>⚠️ Danger Zone</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { label:'ล้าง Local Storage', desc:'ลบการตั้งค่าใน browser ทั้งหมด (ต้อง login ใหม่)',
                    btn:'ล้าง', cls:'btn-danger', action:() => {
                      if(window.confirm('ล้าง localStorage ทั้งหมด?')) { localStorage.clear(); window.location.reload(); }
                    }},
                  { label:'Reload หน้าเว็บ', desc:'โหลดซ้ำเพื่อให้การตั้งค่าใหม่มีผล',
                    btn:'🔄 Reload', cls:'btn-secondary', action:() => window.location.reload() },
                ].map(item => (
                  <div key={item.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'13px 16px', background:'white', borderRadius:9, border:'1px solid var(--border)', flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{item.label}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{item.desc}</div>
                    </div>
                    <button className={`btn ${item.cls} btn-sm`} onClick={item.action}>{item.btn}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ Tab: Guide ══════════ */}
      {activeTab==='guide' && (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          {[
            {
              title:'📋 Deploy Google Apps Script ครั้งแรก',
              steps:[
                'sheets.google.com → สร้าง Spreadsheet ใหม่',
                'Extensions → Apps Script → ลบโค้ดเดิม → วางโค้ดจาก Tab "Code.gs"',
                'แก้ไข APP_URL บรรทัดที่ 3 เป็น URL เว็บของคุณ',
                'เลือก function setupSheets → ▶ Run → อนุญาต Permission',
                'Deploy → New deployment → Web app → Execute as: Me → Anyone → Deploy',
                'คัดลอก URL → ใส่ใน Tab "การเชื่อมต่อ" → บันทึก → ทดสอบ',
              ],
            },
            {
              title:'🔄 อัปเดต Code.gs',
              steps:[
                'แก้ไข code ใน Apps Script → Ctrl+S',
                'Deploy → Manage deployments → แก้ไข ✏️',
                'Version → New version → Deploy',
                'URL เดิมยังใช้ได้ ไม่ต้องเปลี่ยน',
              ],
            },
            {
              title:'🛠️ แก้ปัญหาที่พบบ่อย',
              steps:[
                'Login ไม่ได้ → ทดสอบ URL ด้วยปุ่ม "ทดสอบการเชื่อมต่อ"',
                'OTP ไม่ถูกต้อง → Sheet OTP_Tokens → เปลี่ยน used เป็น false',
                'ไม่มี Sheet tab → รัน setupSheets() ใหม่',
                'ข้อมูลไม่อัปเดต → Deploy Code.gs ใหม่ (New version)',
                'CORS Error → ตรวจสอบว่า Who has access = Anyone',
              ],
            },
          ].map((s,i) => (
            <div key={i} className="card">
              <div className="chart-title" style={{ marginBottom:14 }}>{s.title}</div>
              <ol style={{ paddingLeft:18, display:'flex', flexDirection:'column', gap:9 }}>
                {s.steps.map((step,j) => (
                  <li key={j} style={{ fontSize:13.5, color:'var(--text-secondary)', lineHeight:1.65 }}>{step}</li>
                ))}
              </ol>
            </div>
          ))}

          <div className="card">
            <div className="chart-title" style={{ marginBottom:14 }}>📊 Sheet Tabs ทั้งหมด</div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Tab</th><th>หน้าที่</th><th>คอลัมน์หลัก</th></tr>
                </thead>
                <tbody>
                  {[
                    ['Users','ผู้ใช้ทั้งหมด','email, role, passwordHash, emailVerified'],
                    ['Pages','เพจในระบบ','id, name, category, followers'],
                    ['DailyEntries','รายการประจำวัน','date, userEmail, messageCount'],
                    ['Leaves','คำขอลางาน','userEmail, leaveType, startDate, status'],
                    ['MyPageEntries','เพจของแต่ละแอดมิน','userEmail, pageName, workDays'],
                    ['Notifications','แจ้งเตือนในระบบ','toEmail, type, title, read'],
                    ['OTP_Tokens','รหัส OTP','email, otp, expiresAt, used'],
                  ].map(([name,desc,cols]) => (
                    <tr key={name}>
                      <td><span className="tag tag-blue" style={{fontFamily:'monospace',fontSize:10}}>{name}</span></td>
                      <td style={{fontSize:13}}>{desc}</td>
                      <td style={{fontSize:11,color:'var(--text-muted)',fontFamily:'monospace'}}>{cols}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── syntax highlight helpers ─────────────────────────────────
function colorize(line) {
  if (line.trim().startsWith('//')) return <span style={{color:'#6b7280'}}>{line}</span>;
  if (line.trim().startsWith('function ')) return <span style={{color:'#93c5fd'}}>{line}</span>;
  if (/^\s*(const|let|var|return|if|else|for|while|try|catch|switch|case|break|new)\b/.test(line))
    return <span style={{color:'#c4b5fd'}}>{line}</span>;
  if (line.includes("'") || line.includes('"'))
    return <span style={{color:'#86efac'}}>{line}</span>;
  return <span>{line}</span>;
}

function highlightMatch(line, search) {
  const idx = line.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return <span>{line}</span>;
  return (
    <span>
      {line.slice(0, idx)}
      <mark style={{ background:'rgba(245,200,66,0.5)', color:'#1e1b4b', borderRadius:2 }}>
        {line.slice(idx, idx + search.length)}
      </mark>
      {line.slice(idx + search.length)}
    </span>
  );
}
