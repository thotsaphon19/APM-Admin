// src/components/Toast.js
import React, { useEffect } from 'react';

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration || 3500);
    return () => clearTimeout(timer);
  }, []);
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  return (
    <div className={`toast toast-${toast.type}`}>
      <span>{icons[toast.type] || 'ℹ️'}</span>
      <span>{toast.message}</span>
      <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
    </div>
  );
}

let toastId = 0;
export function useToast() {
  const [toasts, setToasts] = React.useState([]);
  const show = (message, type = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const remove = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, remove, toast: { success: m => show(m,'success'), error: m => show(m,'error'), info: m => show(m,'info') } };
}
