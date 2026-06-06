import React, { useState } from 'react';
import { User, Key, Trash2, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';
import { ProfileForm } from '../components/ProfileForm';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { DeleteAccountForm } from '../components/DeleteAccountForm';
import { ApiKeyForm } from '../components/ApiKeyForm';

export function Settings() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="p-4 sm:p-6 w-full max-w-4xl mx-auto min-h-screen bg-slate-50/50 font-sans text-xs">
      <div className="space-y-1 mb-6">
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Account Settings</h1>
        <p className="text-sm text-slate-600 font-medium">Manage your profile and preferences.</p>
      </div>

      {/* Mobile Tab Switcher - Visible only on mobile/tablet */}
      <div className="flex lg:hidden bg-white p-1 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <button 
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
            activeTab === 'profile' 
              ? "bg-blue-50 text-[#3461ff] shadow-sm" 
              : "text-slate-500 hover:text-slate-900"
          )}
        >
          <User size={16} />
          Profile
        </button>
        <button 
          onClick={() => setActiveTab('password')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
            activeTab === 'password'
              ? "bg-green-50 text-green-600 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          )}
        >
          <Key size={16} />
          Password
        </button>
        <button
          onClick={() => setActiveTab('apikey')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
            activeTab === 'apikey'
              ? "bg-blue-50 text-[#3461ff] shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          )}
        >
          <Sparkles size={16} />
          AI Models
        </button>
        <button
          onClick={() => setActiveTab('delete')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
            activeTab === 'delete'
              ? "bg-red-50 text-red-600 shadow-sm"
              : "text-slate-500 hover:text-red-500"
          )}
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation Tabs - Desktop Only */}
        <div className="hidden lg:flex flex-col gap-1.5">
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all font-bold",
              activeTab === 'profile' 
                ? "bg-white border border-slate-200 text-[#3461ff] shadow-sm" 
                : "text-slate-500 hover:bg-white hover:text-slate-900"
            )}
          >
            <User size={16} />
            Profile
          </button>
          <button 
            onClick={() => setActiveTab('password')}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all font-bold",
              activeTab === 'password'
                ? "bg-green-50 border border-green-100 text-green-600 shadow-sm"
                : "text-slate-500 hover:bg-white hover:text-slate-900"
            )}
          >
            <Key size={16} />
            Change Password
          </button>
          <button
            onClick={() => setActiveTab('apikey')}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all font-bold",
              activeTab === 'apikey'
                ? "bg-white border border-slate-200 text-[#3461ff] shadow-sm"
                : "text-slate-500 hover:bg-white hover:text-slate-900"
            )}
          >
            <Sparkles size={16} />
            AI Models
          </button>
          <button
            onClick={() => setActiveTab('delete')}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all font-bold",
              activeTab === 'delete'
                ? "bg-red-50 border border-red-100 text-red-600 shadow-sm"
                : "text-slate-500 hover:bg-white hover:text-red-500"
            )}
          >
            <Trash2 size={16} />
            Delete Account
          </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-2 space-y-5">
          {activeTab === 'profile' ? (
            <ProfileForm />
          ) : activeTab === 'password' ? (
            <ChangePasswordForm />
          ) : activeTab === 'apikey' ? (
            <ApiKeyForm />
          ) : (
            <DeleteAccountForm />
          )}
        </div>
      </div>
    </div>
  );
}
