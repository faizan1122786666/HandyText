import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import logo from '../assets/logo.png';
import { Link as RouterLink } from 'react-router-dom';
import { Link as ScrollLink } from 'react-scroll';
import { isLoggedIn } from '../utils/auth';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());

  useEffect(() => {
    const syncAuthState = () => setLoggedIn(isLoggedIn());

    window.addEventListener('storage', syncAuthState);
    window.addEventListener('focus', syncAuthState);
    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('focus', syncAuthState);
    };
  }, []);

  const toggleMobileMenu = () => {
    if (isMobileMenuOpen) {
      setIsClosing(true);
      setTimeout(() => {
        setIsMobileMenuOpen(false);
        setIsClosing(false);
      }, 500); // Wait for animation
    } else {
      setIsMobileMenuOpen(true);
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-sm shadow-sm z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <RouterLink to="/" className="flex items-center">
            <div className="w-16 h-16">
              <img
                src={logo}
                alt="HandyText"
                className="w-full h-full object-contain"
                style={{ filter: 'brightness(0) saturate(100%) invert(34%) sepia(85%) saturate(3015%) hue-rotate(216deg) brightness(90%) contrast(92%)' }}
              />
            </div>
          </RouterLink>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6 mx-auto">
            <ScrollLink
              to="overview"
              smooth={true}
              duration={500}
              className="text-slate-600 hover:text-[#4169e1] font-medium cursor-pointer transition-colors"
            >
              Overview
            </ScrollLink>
            <ScrollLink
              to="features"
              smooth={true}
              duration={500}
              className="text-slate-600 hover:text-[#4169e1] font-medium cursor-pointer transition-colors"
            >
              Features
            </ScrollLink>
            <ScrollLink
              to="testimonials"
              smooth={true}
              duration={500}
              className="text-slate-600 hover:text-[#4169e1] font-medium cursor-pointer transition-colors"
            >
              Testimonials
            </ScrollLink>
          </div>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-4">
            {loggedIn ? (
              <RouterLink
                to="/convert"
                className="bg-[#4169e1] hover:bg-[#3156c4] text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-md shadow-[#4169e1]/20"
              >
                Start Converting
              </RouterLink>
            ) : (
              <>
                <RouterLink
                  to="/login"
                  className="text-slate-600 font-medium hover:text-[#4169e1] transition-colors"
                >
                  Sign In
                </RouterLink>
                <RouterLink
                  to="/register"
                  className="bg-[#4169e1] hover:bg-[#3156c4] text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-md shadow-[#4169e1]/20"
                >
                  Get Started
                </RouterLink>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button onClick={toggleMobileMenu} className="text-slate-600 hover:text-[#4169e1]">
              {isMobileMenuOpen ? <X size={28} className={isClosing ? "animate-spin" : ""} /> : <Menu size={28} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu Sidebar - Moved OUTSIDE header */}
      <div
        className={`lg:hidden fixed top-0 right-0 h-full w-64 bg-white shadow-2xl shadow-slate-500/10 z-[52] flex flex-col py-8 transition-transform duration-500 ease-in-out ${
          isMobileMenuOpen && !isClosing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button onClick={toggleMobileMenu} className="absolute top-4 right-4 text-slate-600 hover:text-[#4169e1] transition-transform duration-500">
          <X size={28} className={isClosing ? "animate-spin" : ""} />
        </button>
        <div className="flex flex-col items-center mt-10">
          <ScrollLink
            to="overview"
            smooth={true}
            duration={500}
            onClick={toggleMobileMenu}
            className="block text-slate-700 hover:text-[#4169e1] font-medium text-lg py-3 border-b border-slate-100 w-full text-center cursor-pointer"
          >
            Overview
          </ScrollLink>
          <ScrollLink
            to="features"
            smooth={true}
            duration={500}
            onClick={toggleMobileMenu}
            className="block text-slate-700 hover:text-[#4169e1] font-medium text-lg py-3 border-b border-slate-100 w-full text-center cursor-pointer"
          >
            Features
          </ScrollLink>
          <ScrollLink
            to="testimonials"
            smooth={true}
            duration={500}
            onClick={toggleMobileMenu}
            className="block text-slate-700 hover:text-[#4169e1] font-medium text-lg py-3 border-b border-slate-100 w-full text-center cursor-pointer"
          >
            Testimonials
          </ScrollLink>
          <RouterLink
            to={loggedIn ? '/convert' : '/login'}
            onClick={toggleMobileMenu}
            className="mt-6 bg-[#4169e1] hover:bg-[#3156c4] text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md shadow-[#4169e1]/20 w-3/4 text-center"
          >
            {loggedIn ? 'Start Converting' : 'Login'}
          </RouterLink>
        </div>
      </div>

      {/* Mobile Menu Overlay - Moved OUTSIDE header */}
      <div
        className={`lg:hidden fixed inset-0 bg-slate-900/60 z-[51] transition-opacity duration-500 backdrop-blur-md ${
          isMobileMenuOpen && !isClosing ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggleMobileMenu}
      ></div>
    </>
  );
}
