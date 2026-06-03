import React, { useState } from 'react';
import { Key } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../context/ToastContext';
import { api } from '../utils/api';
import { PasswordInput } from './PasswordInput';

const passwordFieldClass =
  'w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 focus:bg-white transition-all font-semibold text-slate-800 text-sm';

export function ChangePasswordForm() {
  const { addToast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmNewPassword) {
      addToast('Please fill in all password fields', 'info');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      addToast('New passwords do not match', 'error');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      addToast('New password must be at least 6 characters', 'error');
      return;
    }
    
    setIsChangingPassword(true);
    
    try {
      await api.post('/auth/change-password', {}, {
        params: {
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        }
      });
      
      // Clear password fields on success
      setPasswordData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      
      addToast('Password changed successfully!', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to change password', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-green-100 shadow-xl shadow-green-100/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-5 sm:p-6 space-y-6">
        <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 mb-1">
          <Key size={24} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Change Password</h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Update your password to keep your account secure.
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Current Password</label>
            <PasswordInput
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              leftIcon={null}
              required={false}
              className={passwordFieldClass}
              placeholder="Enter your current password"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">New Password</label>
              <PasswordInput
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                leftIcon={null}
                required={false}
                className={passwordFieldClass}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Confirm New Password</label>
              <PasswordInput
                value={passwordData.confirmNewPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmNewPassword: e.target.value })}
                leftIcon={null}
                required={false}
                className={passwordFieldClass}
                placeholder="Confirm new password"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Footer */}
      <div className="px-5 py-4 bg-green-50/50 border-t border-green-50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="order-2 sm:order-1" />
        <button 
          onClick={handleChangePassword}
          disabled={isChangingPassword}
          className={cn(
            "w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-100 transition-all hover:bg-green-700 active:scale-95 text-xs order-1 sm:order-2",
            isChangingPassword && "opacity-70 cursor-not-allowed"
          )}
        >
          {isChangingPassword ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Key size={16} />
          )}
          {isChangingPassword ? 'Changing Password...' : 'Change Password'}
        </button>
      </div>
    </div>
  );
}
