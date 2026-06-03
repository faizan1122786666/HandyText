import React from 'react';
import { Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export function DeleteAccountForm() {
  const { addToast } = useToast();

  const handleDeleteAccount = () => {
    if (window.confirm('Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone.')) {
      addToast('Account deletion initiated', 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-xl shadow-red-100/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-5 sm:p-6 space-y-5">
        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500 mb-1">
          <Trash2 size={24} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Delete Account</h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            This action is <span className="text-red-600 font-bold underline">permanent</span>. 
            You will lose all your conversion history and saved preferences.
          </p>
        </div>
        
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2.5">
          <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">What you'll lose:</h4>
          <ul className="space-y-1.5">
            {['All converted document history', 'Your profile information', 'Premium OCR features'].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                <div className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="px-5 py-4 bg-red-50/50 border-t border-red-50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest order-2 sm:order-1">Danger Zone</p>
        <button 
          onClick={handleDeleteAccount}
          className="w-full sm:w-auto px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-100 transition-all hover:bg-red-700 active:scale-95 flex items-center justify-center gap-2 text-xs order-1 sm:order-2"
        >
          <Trash2 size={16} />
          Delete My Account
        </button>
      </div>
    </div>
  );
}
