import React, { useState, useRef, useEffect } from 'react';
import { User, Camera, Mail, Save } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../context/ToastContext';
import { getLoggedInUser } from '../utils/auth';
import { api } from '../utils/api';

export function ProfileForm() {
  const { addToast } = useToast();
  const [user, setUser] = useState({
    name: '',
    email: '',
    profileImage: null,
    updatedAt: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Load user data on mount
  useEffect(() => {
    const loggedInUser = getLoggedInUser();
    if (loggedInUser) {
      setUser({
        name: loggedInUser.full_name || loggedInUser.username || 'User',
        email: loggedInUser.email || 'user@handytext.ai',
        profileImage: loggedInUser.profile_image || null,
        updatedAt: loggedInUser.updated_at || null,
      });
    }
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUser({ ...user, profileImageFile: file, profileImage: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      let currentImage = user.profileImage;

      // Update profile image first if uploaded
      if (user.profileImageFile) {
        const formData = new FormData();
        formData.append('file', user.profileImageFile);
        const imageResponse = await api.post('/auth/profile-image', formData, true);
        
        currentImage = imageResponse.profile_image;
        const authData2 = JSON.parse(localStorage.getItem('handytext_auth') || '{}');
        if (authData2.user) {
          authData2.user.profile_image = currentImage;
          localStorage.setItem('handytext_auth', JSON.stringify(authData2));
          window.dispatchEvent(new Event('storage'));
        }
        
        setUser({ 
          ...user, 
          profileImage: currentImage,
          profileImageFile: null 
        });
      }
      
      // Update full name
      const response = await api.put('/auth/me', { full_name: user.name });
      
      // Update localStorage with the new user data
      const authData = JSON.parse(localStorage.getItem('handytext_auth') || '{}');
      if (authData.user) {
        authData.user.full_name = response.full_name || user.name;
        // Don't overwrite image with null or old data if we just uploaded one
        if (response.profile_image && !user.profileImageFile) {
          authData.user.profile_image = response.profile_image;
        } else if (currentImage) {
          authData.user.profile_image = currentImage;
        }
        authData.user.updated_at = response.updated_at;
        localStorage.setItem('handytext_auth', JSON.stringify(authData));
        window.dispatchEvent(new Event('storage'));
      }
      
      // Update local state with server response
      setUser(prev => ({
        ...prev,
        name: response.full_name || prev.name,
        profileImage: currentImage,
        updatedAt: response.updated_at
      }));
      
      addToast('Profile updated successfully!', 'success');
      // Emit an event to notify other parts of the app (like Dashboard) to refresh data
      window.dispatchEvent(new CustomEvent('profile-updated'));
    } catch (err) {
      addToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/30 overflow-hidden">
      <div className="p-5 sm:p-6 space-y-6">
        {/* Profile Image Section */}
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative group">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-100 border-4 border-white shadow-sm overflow-hidden flex items-center justify-center transition-transform group-hover:scale-[1.02]">
              {user.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-slate-300" />
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-1.5 bg-[#3461ff] text-white rounded-full shadow-md hover:bg-[#2b51d6] transition-all transform active:scale-95 border-2 border-white"
            >
              <Camera size={14} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          <div className="text-center sm:text-left space-y-0.5">
            <h3 className="text-lg font-bold text-slate-900">Profile Photo</h3>
            <p className="text-xs text-slate-500">Upload a new photo to update your profile.</p>
            <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
              <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold text-[#3461ff] px-2.5 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">Change Photo</button>
              {user.profileImage && <button onClick={() => setUser({...user, profileImage: null})} className="text-[10px] font-bold text-red-500 px-2.5 py-1 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Remove</button>}
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full" />

        {/* Form Section */}
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Full Name</label>
              <input 
                type="text" 
                value={user.name}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3461ff]/20 focus:border-[#3461ff] focus:bg-white transition-all font-semibold text-slate-800 text-sm"
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Email Address</label>
              <div className="relative group">
                <input 
                  type="email" 
                  value={user.email}
                  readOnly
                  className="w-full pl-3.5 pr-10 py-2 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed font-semibold text-slate-500 text-sm"
                />
                <Mail size={14} className="absolute right-3.5 top-2.5 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[10px] text-slate-400 italic font-medium order-2 sm:order-1">
          {user.updatedAt ? `Last updated: ${new Date(user.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : 'Never updated'}
        </p>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-2.5 bg-[#3461ff] text-white rounded-xl font-bold shadow-lg shadow-blue-100 transition-all hover:bg-[#2b51d6] active:scale-95 text-xs order-1 sm:order-2",
            isSaving && "opacity-70 cursor-not-allowed"
          )}
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
