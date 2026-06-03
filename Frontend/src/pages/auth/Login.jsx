import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import authIllustration from '../../assets/auth_illustration.png';
import logo from '../../assets/logo.png';
import { setLoggedIn } from '../../utils/auth';
import { api } from '../../utils/api';
import { GoogleLogin } from '@react-oauth/google';
import { PasswordInput } from '../../components/PasswordInput';

export function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData(e.target);
    const username = formData.get('email'); // Using email as username for now as per backend models/schemas
    const password = formData.get('password');

    try {
      const data = await api.post('/auth/login', { username, password });
      setLoggedIn(data);
      navigate('/uploadpage');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/auth/google-login', { 
        credential: credentialResponse.credential 
      });
      setLoggedIn(data);
      navigate('/uploadpage');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Login failed. Please try again.');
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row-reverse font-sans bg-white overflow-hidden">
      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 h-full overflow-y-auto relative">
        <div className="max-w-md w-full">
          <div className="flex flex-col items-start gap-1 mb-4">
             <button 
               onClick={() => navigate('/')} 
               className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all flex-shrink-0"
             >
               <ArrowLeft size={20} />
             </button>
             <Link to="/" className="flex items-center">
               <div className="w-14 h-14">
                 <img 
                   src={logo} 
                   alt="HandyText" 
                   className="w-full h-full object-contain"
                   style={{ filter: 'brightness(0) saturate(100%) invert(34%) sepia(85%) saturate(3015%) hue-rotate(216deg) brightness(90%) contrast(92%)' }}
                 />
               </div>
             </Link>
           </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back!</h2>
          <p className="text-slate-500 mb-6 text-sm">Login to continue converting your handwritten text into digital text.</p>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-500 text-sm rounded-xl border border-red-100">{error}</div>}

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input 
                  type="email"
                  name="email"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4169e1]/50 focus:border-[#4169e1] transition-all bg-white text-sm"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <PasswordInput name="password" placeholder="Enter your password" />
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center text-slate-500 cursor-pointer">
                <input type="checkbox" className="mr-2 rounded border-slate-300 text-[#4169e1] focus:ring-[#4169e1]" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-[#4169e1] font-medium hover:text-[#3156c4] transition-colors">Forgot password?</Link>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className={`w-full bg-[#3461ff] hover:bg-[#2b51d6] text-white py-2.5 rounded-xl font-medium transition-all shadow-md shadow-[#4169e1]/20 mt-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            
            <div className="flex items-center gap-4 my-4">
              <div className="h-px flex-1 bg-slate-200"></div>
              <span className="text-xs text-slate-400">or continue with</span>
              <div className="h-px flex-1 bg-slate-200"></div>
            </div>

            <div className="flex justify-center w-full">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap
                theme="outline"
                shape="circle"
                size="large"
                width="100%"
                text="continue_with"
              />
            </div>
          </form>

          <p className="text-slate-500 text-xs mt-6 text-center">
            Don't have an account? <Link to="/register" className="text-[#4169e1] font-semibold hover:text-[#3156c4] transition-colors">Sign up</Link>
          </p>
        </div>
      </div>

      {/* Left Side - Illustration */}
      <div className="hidden lg:flex w-1/2 bg-[#f4f7fb] items-center justify-center h-full">
         <img src={authIllustration} alt="Login Illustration" className="w-full h-full object-cover" />
      </div>
    </div>
  );
}
