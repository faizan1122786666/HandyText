import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Type, 
  History as HistoryIcon, 
  Settings,
  LogOut,
  X
} from 'lucide-react';
import { TbLayoutSidebarRightExpand } from 'react-icons/tb';
import { cn } from '../utils/cn';
import logo1 from '../assets/logo1-transparent.png';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout, getLoggedInUser } from '../utils/auth';
import { useToast } from '../context/ToastContext';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'convert', label: 'Convert Text', icon: Type, path: '/convert', match: ['/convert', '/uploadpage', '/handwriting'] },
  { id: 'history', label: 'History', icon: HistoryIcon, path: '/history' },
];

export function Sidebar({ isMobileOpen, isClosing, onCloseMobileMenu }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [user, setUser] = useState(getLoggedInUser());
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Listen for storage changes to update user reactively
  useEffect(() => {
    const handleStorageChange = () => {
      setUser(getLoggedInUser());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleSidebar = () => setIsExpanded(!isExpanded);

  const handleLogoClick = (e) => {
    if (!isExpanded && !isMobileOpen) {
      e.preventDefault();
      setIsExpanded(true);
      return;
    }
    onCloseMobileMenu?.();
  };

  const handleLogout = () => {
    logout();
    onCloseMobileMenu?.();
    addToast('Logged out successfully', 'success');
    navigate('/login');
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      {/* Mobile Overlay Background */}
      <div
        className={`fixed inset-0 bg-slate-900/60 z-[51] lg:hidden transition-opacity duration-500 backdrop-blur-md ${
          isMobileOpen && !isClosing ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCloseMobileMenu}
      />

      {/* Sidebar Content */}
      <aside 
        className={cn(
          "app-sidebar fixed lg:sticky top-0 left-0 h-screen bg-white shadow-2xl shadow-slate-500/10 z-[52]",
          "transition-all duration-500 ease-in-out flex flex-col",
          // Mobile state: translate off-screen when closed
          isMobileOpen && !isClosing ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // Width based on expanded state (always expanded on mobile)
          isExpanded || isMobileOpen ? "w-[220px]" : "w-[64px]"
        )}
      >
        {/* Sidebar Header / Logo */}
        <div className={cn(
          "h-16 flex items-center border-b border-slate-100",
          (isExpanded || isMobileOpen) ? "px-3" : "px-2"
        )}>
          <Link
            to="/uploadpage"
            onClick={handleLogoClick}
            className={cn(
              "flex items-center gap-2 overflow-hidden min-w-0",
              (isExpanded || isMobileOpen) ? "flex-1" : "flex-1 justify-center"
            )}
          >
            <div
              className={cn(
                "flex-shrink-0",
                (isExpanded || isMobileOpen) ? "w-8 h-8" : "w-7 h-7"
              )}
            >
              <img
                src={logo1}
                alt="HandyText"
                className="app-logo-img w-full h-full object-contain"
              />
            </div>
            <span className={cn(
              "text-sm text-slate-700 font-sans font-medium tracking-tight truncate transition-all duration-300",
              !(isExpanded || isMobileOpen) && "opacity-0 w-0"
            )}>
              HandyText
            </span>
          </Link>

          {isExpanded && !isMobileOpen && (
            <div className="relative hidden lg:block group">
              <button
                type="button"
                onClick={toggleSidebar}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                aria-label="Collapse sidebar"
              >
                <TbLayoutSidebarRightExpand size={18} />
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 rounded-full bg-black text-white text-[11px] font-medium opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                Close sidebar
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onCloseMobileMenu}
            className="lg:hidden ml-2 text-slate-500 hover:text-[#3461ff] transition-transform duration-500"
            aria-label="Close menu"
          >
            <X size={24} className={isClosing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className={cn(
          "flex-1 py-3 px-2 flex flex-col gap-1",
          (isExpanded || isMobileOpen) ? "overflow-y-auto overflow-x-hidden" : "overflow-visible"
        )}>
          {(isExpanded || isMobileOpen) && (
            <span className="px-2.5 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Menu</span>
          )}
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.match
              ? item.match.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))
              : location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <div key={item.id} className="relative group">
                <Link
                  to={item.path}
                  onClick={onCloseMobileMenu}
                  className={cn(
                    "w-full flex items-center rounded-lg transition-all duration-200",
                    "hover:bg-[#f5f7fb]",
                    (isExpanded || isMobileOpen) ? "px-2.5 py-2 gap-2.5" : "p-2.5 justify-center",
                    isActive 
                      ? "bg-[#3461ff]/10 text-[#3461ff] font-semibold" 
                      : "text-slate-500 font-medium"
                  )}
                >
                  <Icon size={18} className={cn("flex-shrink-0 transition-transform duration-200", isActive ? "text-[#3461ff] scale-110" : "group-hover:scale-110")} />
                  
                  <span 
                    className={cn(
                      "text-[13px] whitespace-nowrap transition-opacity duration-300",
                      !(isExpanded || isMobileOpen) && "opacity-0 hidden"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>

                {/* Tooltip for collapsed mode (desktop only) */}
                {!(isExpanded || isMobileOpen) && (
                  <div className="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-slate-800 text-white text-xs font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 shadow-lg">
                    {item.label}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800"></div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Section with Profile */}
        <div className="p-2 mt-auto flex flex-col gap-1.5">
          {(isExpanded || isMobileOpen) && (
            <span className="px-2.5 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Account</span>
          )}
          <div className="relative group">
            <Link
              to="/settings"
              onClick={onCloseMobileMenu}
              className={cn(
                "w-full flex items-center rounded-lg transition-all duration-200 text-slate-500 hover:bg-[#f5f7fb] hover:text-slate-900",
                (isExpanded || isMobileOpen) ? "px-2.5 py-2 gap-2.5" : "p-2.5 justify-center"
              )}
            >
              <Settings size={18} />
              <span
                className={cn(
                  "text-[13px] font-medium whitespace-nowrap transition-opacity duration-300",
                  !(isExpanded || isMobileOpen) && "opacity-0 hidden"
                )}
              >
                Settings
              </span>
            </Link>

            {!(isExpanded || isMobileOpen) && (
              <div className="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-slate-800 text-white text-xs font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 shadow-lg">
                Settings
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800"></div>
              </div>
            )}
          </div>

          <div className={cn(
            "my-1 w-full h-px bg-slate-100"
          )} />

          <Link
            to="/settings"
            onClick={onCloseMobileMenu}
            className={cn(
              "app-profile-card mb-1.5 p-1.5 rounded-lg transition-all duration-200 flex items-center gap-2.5 hover:bg-[#f5f7fb]",
              (isExpanded || isMobileOpen) ? "bg-[#f8fafc]" : "justify-center"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#3461ff] text-xs font-bold flex-shrink-0 shadow-sm overflow-hidden">
              {user?.profile_image ? (
                <img src={user.profile_image} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                getUserInitials(user?.full_name || user?.username)
              )}
            </div>
            <div className={cn(
              "flex flex-col overflow-hidden transition-opacity duration-300",
              !(isExpanded || isMobileOpen) && "opacity-0 hidden"
            )}>
              <span className="text-xs font-bold text-slate-800 truncate">{user?.full_name || user?.username || 'User'}</span>
              <span className="text-[11px] text-slate-500 truncate">{user?.email || 'user@handytext.ai'}</span>
            </div>
          </Link>

          <div className="relative group">
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center rounded-lg transition-all duration-200 text-slate-500 hover:bg-[#f5f7fb] hover:text-slate-900",
                (isExpanded || isMobileOpen) ? "px-2.5 py-2 gap-2.5" : "p-2.5 justify-center"
              )}
            >
              <LogOut size={18} />
              <span 
                className={cn(
                  "text-[13px] font-medium whitespace-nowrap transition-opacity duration-300",
                  !(isExpanded || isMobileOpen) && "opacity-0 hidden"
                )}
              >
                Logout
              </span>
            </button>
            
            {!(isExpanded || isMobileOpen) && (
              <div className="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-slate-800 text-white text-xs font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 shadow-lg">
                Logout
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800"></div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
