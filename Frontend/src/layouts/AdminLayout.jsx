import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export function AdminLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const closeMobileMenu = () => {
    if (!isMobileOpen) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsMobileOpen(false);
      setIsClosing(false);
    }, 500);
  };

  const toggleMobileMenu = () => {
    if (isMobileOpen) closeMobileMenu();
    else setIsMobileOpen(true);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans">
      
      {/* Mobile App Header (Only visible on mobile) */}
      <div className="lg:hidden w-full h-16 bg-white border-b border-slate-200 px-4 flex items-center sticky top-0 z-30 shadow-sm">
        <button
          onClick={toggleMobileMenu}
          className="text-slate-600 p-2 hover:text-[#3461ff] rounded-lg transition-colors"
          aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileOpen ? (
            <X size={28} className={isClosing ? 'animate-spin' : ''} />
          ) : (
            <Menu size={28} />
          )}
        </button>
      </div>

      <Sidebar
        isMobileOpen={isMobileOpen}
        isClosing={isClosing}
        onCloseMobileMenu={closeMobileMenu}
      />
      
      <main className="flex-1 overflow-y-auto w-full p-4 lg:p-0">
        <Outlet />
      </main>
    </div>
  );
}
