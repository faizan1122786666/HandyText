import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRight, CheckCircle2, Zap, Shield, Image as ImageIcon,
  ChevronLeft, ChevronRight, Menu, X, Globe, MessageCircle, Mail, Quote, ArrowLeft, Loader2
} from 'lucide-react';
import heroImage from '../assets/hero_illustration.png';
import logo from '../assets/logo.png';
import { Link as RouterLink } from 'react-router-dom';
import { Link as ScrollLink } from 'react-scroll';
import { TestimonialSlider } from '../components/TestimonialSlider';
import { isLoggedIn, getLoggedInUser } from '../utils/auth';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
// ─── Testimonials data ────────────────────────────────────────────────────────

// ─── Stats counter hook ───────────────────────────────────────────────────────

function useCountUp(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    let animationFrame;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(1 + progress * (target - 1)));
      if (progress < 1) animationFrame = requestAnimationFrame(step);
      else setCount(target);
    };
    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration, start]);
  return count;
}

// ─── Stats Section ────────────────────────────────────────────────────────────

function StatsSection() {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const accuracy = useCountUp(98, 2000, isVisible);
  const members = useCountUp(150, 2000, isVisible);
  const documents = useCountUp(1200, 2000, isVisible);

  return (
    <div ref={sectionRef} className="px-6 py-10 bg-slate-50">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-md shadow-slate-200/40 text-center border border-slate-100 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-300/70 hover:border-slate-200 cursor-pointer">
          <div className="text-3xl sm:text-4xl font-extrabold text-[#3461ff] mb-1">
            {accuracy}.7%
          </div>
          <div className="text-slate-500 font-semibold uppercase tracking-wider text-xs">
            Accuracy Rate
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-md shadow-slate-200/40 text-center border border-slate-100 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-300/70 hover:border-slate-200 cursor-pointer">
          <div className="text-3xl sm:text-4xl font-extrabold text-[#3461ff] mb-1">
            {members}+
          </div>
          <div className="text-slate-500 font-semibold uppercase tracking-wider text-xs">
            Active Members
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-md shadow-slate-200/40 text-center border border-slate-100 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-300/70 hover:border-slate-200 cursor-pointer">
          <div className="text-3xl sm:text-4xl font-extrabold text-[#3461ff] mb-1">
            {documents}+
          </div>
          <div className="text-slate-500 font-semibold uppercase tracking-wider text-xs">
            Documents Scanned
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const toggleMobileMenu = () => {
    if (isMobileMenuOpen) {
      setIsClosing(true);
      setTimeout(() => {
        setIsMobileMenuOpen(false);
        setIsClosing(false);
      }, 500);
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
                style={{
                  filter:
                    'brightness(0) saturate(100%) invert(34%) sepia(85%) saturate(3015%) hue-rotate(216deg) brightness(90%) contrast(92%)',
                }}
              />
            </div>
          </RouterLink>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-6 mx-auto">
            {['overview', 'features', 'testimonials'].map((section) => (
              <ScrollLink
                key={section}
                to={section}
                smooth={true}
                duration={500}
                className="text-slate-600 hover:text-[#3461ff] font-medium cursor-pointer transition-colors capitalize"
              >
                {section}
              </ScrollLink>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-4">
            <RouterLink
              to="/login"
              className="text-slate-600 font-medium hover:text-[#3461ff] transition-colors"
            >
              Sign In
            </RouterLink>
            <RouterLink
              to="/register"
              className="bg-[#3461ff] hover:bg-[#2b51d6] text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-md shadow-[#3461ff]/20"
            >
              Get Started
            </RouterLink>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <button onClick={toggleMobileMenu} className="text-slate-600 hover:text-[#3461ff]">
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
        <button onClick={toggleMobileMenu} className="absolute top-4 right-4 text-slate-600 hover:text-[#3461ff] transition-transform duration-500">
          <X size={28} className={isClosing ? "animate-spin" : ""} />
        </button>
        <div className="flex flex-col items-center mt-10">
          {['overview', 'features', 'testimonials'].map((section) => (
            <ScrollLink
              key={section}
              to={section}
              smooth={true}
              duration={500}
              onClick={toggleMobileMenu}
              className="block text-slate-700 hover:text-[#3461ff] font-medium text-lg py-3 border-b border-slate-100 w-full text-center cursor-pointer capitalize"
            >
              {section}
            </ScrollLink>
          ))}
          <RouterLink
            to="/login"
            onClick={toggleMobileMenu}
            className="mt-6 bg-[#3461ff] hover:bg-[#2b51d6] text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md shadow-[#3461ff]/20 w-3/4 text-center"
          >
            Login
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

// ─── Hero typing animation ────────────────────────────────────────────────────

function useTypewriter(text, { typeSpeed = 50, deleteSpeed = 50, pauseAfterType = 1500, pauseAfterDelete = 400 } = {}) {
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let timeout;

    if (!deleting && charIndex === text.length) {
      timeout = setTimeout(() => setDeleting(true), pauseAfterType);
    } else if (deleting && charIndex === 0) {
      timeout = setTimeout(() => setDeleting(false), pauseAfterDelete);
    } else {
      timeout = setTimeout(() => {
        setCharIndex((index) => index + (deleting ? -1 : 1));
      }, deleting ? deleteSpeed : typeSpeed);
    }

    return () => clearTimeout(timeout);
  }, [charIndex, deleting, text, typeSpeed, deleteSpeed, pauseAfterType, pauseAfterDelete]);

  return text.slice(0, charIndex);
}

function HeroTypingTitle() {
  const gradientText = 'Digital Text';
  const restText = ' Instantly.';
  const fullText = gradientText + restText;
  const displayed = useTypewriter(fullText);

  const gradientDisplayed = displayed.slice(0, Math.min(displayed.length, gradientText.length));
  const restDisplayed = displayed.length > gradientText.length ? displayed.slice(gradientText.length) : '';

  return (
    <>
      Turn Handwriting into{' '}
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3461ff] to-cyan-500">
        {gradientDisplayed}
      </span>
      {restDisplayed}
      <span className="inline-block w-[3px] h-[0.85em] bg-[#3461ff] ml-1 align-middle animate-pulse" aria-hidden="true" />
    </>
  );
}

// ─── Dashboard Main ───────────────────────────────────────────────────────────

export function Dashboard() {
  const { addToast } = useToast();
  const [comment, setComment] = useState('');
  const [submittedRatings, setSubmittedRatings] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [currentRating, setCurrentRating] = useState(0);
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Slider state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsToShow, setItemsToShow] = useState(3);

  const isUserLoggedIn = isLoggedIn();

  const updateItemsToShow = useCallback(() => {
    if (window.innerWidth < 640) setItemsToShow(1);
    else if (window.innerWidth < 1024) setItemsToShow(2);
    else setItemsToShow(3);
  }, []);

  useEffect(() => {
    updateItemsToShow();
    window.addEventListener('resize', updateItemsToShow);
    return () => window.removeEventListener('resize', updateItemsToShow);
  }, [updateItemsToShow]);

  const totalDots = Math.max(1, submittedRatings.length - itemsToShow + 1);

  useEffect(() => {
    if (currentIndex >= totalDots) setCurrentIndex(Math.max(0, totalDots - 1));
  }, [itemsToShow, totalDots, currentIndex]);

  const goTo = (index) =>
    setCurrentIndex(Math.max(0, Math.min(index, totalDots - 1)));

  useEffect(() => {
    fetchFeedbacks();
    
    // Listen for profile updates to refresh feedbacks
    const handleProfileUpdate = () => {
      fetchFeedbacks();
    };
    window.addEventListener('profile-updated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, []);

  const fetchFeedbacks = async () => {
    try {
      const data = await api.get('/feedback/');
      setSubmittedRatings(data);
    } catch (err) {
      console.error('Failed to fetch feedbacks:', err);
      setSubmittedRatings([]);
    } finally {
      setIsLoadingFeedbacks(false);
    }
  };

  useEffect(() => {
    if (submittedRatings.length > 0) {
      const total = submittedRatings.reduce((sum, r) => sum + r.rating, 0);
      setAverageRating(total / submittedRatings.length);
    } else {
      setAverageRating(0);
    }
  }, [submittedRatings]);

  const handleSubmitRating = async (e) => {
    e.preventDefault();

    if (!isUserLoggedIn) {
      addToast('Please login in', 'info');
      return;
    }

    if (currentRating === 0) {
      addToast('Please select a star rating!', 'info');
      return;
    }
    if (!comment.trim()) {
      addToast('Please enter your feedback!', 'info');
      return;
    }
    
    const wordCount = comment.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount > 30) {
      addToast('Please keep your comment under 30 words.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const newFeedback = await api.post('/feedback/', {
        comment: comment,
        rating: currentRating
      });
      setSubmittedRatings([newFeedback, ...submittedRatings]);
      setCurrentRating(0);
      setComment('');
      addToast('Thank you for your feedback!', 'success');
    } catch (err) {
      addToast(err.message || 'Something went wrong', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pt-16">
      <Header />
      
      {/* Hero Section */}
      <div id="overview" className="px-6 py-20 bg-gradient-to-b from-white to-slate-30">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
          {/* Left Content */}
          <div className="lg:w-1/2 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-[#3461ff] font-semibold text-sm">
              <span className="w-2 h-2 rounded-full bg-[#3461ff] animate-pulse"></span>
              AI-Powered Recognition
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight mt-4">
              <HeroTypingTitle />
            </h1>
            
            <p className="text-lg text-slate-600 max-w-lg mx-auto lg:mx-0 leading-relaxed mt-6">
              HandyText uses advanced AI models to seamlessly scan, recognize, and convert your handwritten notes, prescriptions, and whiteboards into editable digital formats with unmatched accuracy.
            </p>
            
            <ul className="space-y-3 pt-8 text-left inline-block lg:block">
              <li className="flex items-center gap-3 text-slate-700 font-medium">
                <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={20} /> Works with cursive and messy handwriting
              </li>
              <li className="flex items-center gap-3 text-slate-700 font-medium">
                <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={20} /> Export to Word, PDF, or Markdown
              </li>
              <li className="flex items-center gap-3 text-slate-700 font-medium">
                <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={20} /> 100% secure and private processing
              </li>
            </ul>

            <div className="pt-10 flex justify-center lg:justify-start">
              <RouterLink to={isLoggedIn() ? '/uploadpage' : '/login'} className="bg-[#3461ff] hover:bg-[#2b51d6] text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-lg shadow-[#3461ff]/30 flex items-center gap-2 text-lg hover:scale-[1.02]">
                Start Converting <ArrowRight size={20} />
              </RouterLink>
            </div>
          </div>

{/* Right Image */}
           <div className="relative flex justify-center lg:justify-end mt-10 lg:mt-0">
             <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-transparent rounded-full blur-3xl opacity-30 transform -translate-x-10 translate-y-10"></div>
             <img 
               src={heroImage} 
               alt="HandyText Process" 
               className="relative z-10 w-full max-w-md object-contain"
             />
          </div>
        </div>
      </div>

      <StatsSection />

      {/* Features Section */}
      <div id="features" className="px-6 py-20 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl text-slate-900 font-extrabold  mb-4">Why choose HandyText?</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Our advanced AI features make digitizing your notes faster, more accurate, and entirely hassle-free.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Zap, color: 'text-[#3461ff]', bg: 'bg-blue-50', title: 'Lightning Fast', desc: 'Convert entire pages of handwriting into editable text in a matter of seconds.' },
              { icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-50', title: 'Bank-level Security', desc: 'Your data is encrypted end-to-end. We never store your documents permanently.' },
              { icon: ImageIcon, color: 'text-purple-500', bg: 'bg-purple-50', title: 'Any Format Support', desc: 'Upload JPGs, PNGs, or PDFs. Export your digitized text directly to Word or Markdown.' }
            ].map((f, i) => (
              <div key={i} className="p-8 rounded-3xl border border-slate-100 bg-white shadow-md shadow-slate-200/40 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-300/70 hover:border-slate-200 cursor-pointer">
                <div className={`w-14 h-14 ${f.bg} ${f.color} rounded-2xl flex items-center justify-center mb-6`}>
                  <f.icon size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TestimonialSlider />

      {/* Recent Experiences Section */}
      <div className="px-6 py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-6xl mx-auto">
          {/* Header with Arrows - Matching TestimonialSlider look */}
          <div className="relative flex flex-col md:block mb-10 gap-6 md:min-h-[5.5rem]">
            <div className="max-w-xl text-center md:absolute md:left-1/2 md:-translate-x-1/2 md:top-0 md:w-full md:max-w-xl">
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Recent Experiences</h2>
              <p className="text-lg text-slate-600 mb-8">See what our community has to say about HandyText.</p>
            </div>

            {/* Arrow buttons - Same style as Loved by Professional */}
            <div className="flex gap-3 flex-shrink-0 self-center md:absolute md:right-0 md:bottom-0">
              <button
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-all
                           bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900
                           disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                aria-label="Previous"
              >
                <ArrowLeft size={20} />
              </button>
              <button
                onClick={() => goTo(currentIndex + 1)}
                disabled={currentIndex >= totalDots - 1}
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-all
                           bg-[#3461ff]/10 text-[#3461ff] hover:bg-[#3461ff]/20
                           disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                aria-label="Next"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>

          {/* Slider track */}
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-300 ease-[cubic-bezier(.4,0,.2,1)]"
              style={{ transform: `translateX(-${currentIndex * (100 / itemsToShow)}%)` }}
            >
              {isLoadingFeedbacks ? (
                <div className="w-full text-center py-20 text-slate-400">Loading experiences...</div>
              ) : submittedRatings.length > 0 ? (
                submittedRatings.map((item, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 px-3"
                    style={{ width: `${100 / itemsToShow}%` }}
                  >
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-md shadow-slate-200/40 p-8 flex flex-col h-full transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-300/70 hover:border-slate-200 cursor-pointer">
                      
                      {/* Quote icon */}
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                        <Quote size={20} className="text-[#3461ff]" fill="currentColor" />
                      </div>

                      {/* Comment text */}
                      <p className="text-slate-600 text-[15px] leading-relaxed flex-1 mb-8 italic">
                        "{item.comment}"
                      </p>

                      {/* User info & Stars at bottom */}
                      <div className="flex items-center gap-4 pt-6 border-t border-slate-30">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[#3461ff] font-bold text-sm shadow-sm overflow-hidden">
                          {item.profile_image ? (
                            <img src={item.profile_image} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            (item.full_name || item.username)?.charAt(0).toUpperCase() || 'U'
                          )}
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-slate-900 leading-tight">
                            {item.full_name || item.username || 'Anonymous User'}
                          </p>
                          {/* Date */}
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(item.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                          {/* Star Ratings */}
                          <div className="flex items-center gap-0.5 mt-1.5">
                            {[...Array(5)].map((_, i) => (
                              <svg key={i} className={`w-3.5 h-3.5 ${i < item.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-200 fill-slate-200"}`} viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="w-full text-center py-20 text-slate-400 italic">No experiences shared yet. Be the first!</div>
              )}
            </div>
          </div>

          {/* Dots - Same style as Loved by Professional */}
          <div className="flex justify-center gap-2.5 mt-10">
            {Array.from({ length: totalDots }).map((_, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`rounded-full border-none transition-all duration-300 cursor-pointer ${
                  currentIndex === index
                    ? 'w-3 h-3 bg-[#3461ff] scale-110'
                    : 'w-2 h-2 bg-slate-200 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Experience Submission Section */}
      <div id="rating-form" className="px-6 py-20 bg-white border-t border-slate-200">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Share Your Experience</h2>
          <p className="text-lg text-slate-600 mb-8">We'd love to hear your feedback! Rate our service and leave a comment.</p>
          <form className="space-y-6" onSubmit={handleSubmitRating}>
            <div>
              <label htmlFor="rating" className="block text-xl font-semibold text-slate-700 mb-3">Your Rating</label>
              <div className="flex justify-center gap-1 text-3xl text-gray-300">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`cursor-pointer ${star <= currentRating ? 'text-amber-400' : 'hover:text-amber-300'} transition-colors`}
                    onClick={() => setCurrentRating(star)}
                  >
                    &#9733; {/* Unicode star character */}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-left">
              <label htmlFor="comment" className="block text-lg font-semibold text-slate-700 mb-2">Your Comment</label>
              <textarea
                id="comment"
                rows="5"
                className={`w-full p-4 border rounded-xl focus:outline-none focus:ring-2 resize-y ${
                  comment.trim().split(/\s+/).filter(w => w.length > 0).length > 30 
                    ? 'border-red-400 focus:ring-red-400 bg-red-50/50' 
                    : 'border-slate-300 focus:ring-[#4169e1]'
                }`}
                placeholder="Tell us what you think..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              ></textarea>
              <div className="flex justify-end mt-1">
                <span className={`text-sm font-medium ${comment.trim().split(/\s+/).filter(w => w.length > 0).length > 30 ? 'text-red-500' : 'text-slate-400'}`}>
                  {comment.trim().split(/\s+/).filter(w => w.length > 0).length} / 30 words
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || comment.trim().split(/\s+/).filter(w => w.length > 0).length > 30}
              className={`bg-[#4169e1] hover:bg-[#3156c4] text-white px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg shadow-[#4169e1]/30 text-lg flex items-center justify-center gap-2 mx-auto min-w-[200px] ${
                isSubmitting || comment.trim().split(/\s+/).filter(w => w.length > 0).length > 30 ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Feedback'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer id="contact" className="w-full bg-slate-900 pt-16 pb-8 border-t border-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="w-20 h-20">
                <img 
                  src={logo} 
                  alt="HandyText" 
                  className="w-full h-full object-contain"
                  style={{ filter: 'brightness(0) saturate(100%) invert(34%) sepia(85%) saturate(3015%) hue-rotate(216deg) brightness(90%) contrast(92%)' }}
                />
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              The world's most accurate AI handwriting to text converter. Digitize your life effortlessly.
            </p>
            <div className="flex gap-4 pt-2">
              <a href="#" className="text-slate-400 hover:text-white transition-colors"><Globe size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors"><MessageCircle size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors"><Mail size={20} /></a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">AI Scanner</a></li>
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">Security</a></li>
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">Integrations</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-[#3461ff] transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 border-t border-slate-800 pt-8 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} HandyText AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
