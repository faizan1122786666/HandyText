import { useState } from 'react';
import { ArrowLeft, Mail, ShieldCheck, Lock, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import authIllustration from '../../assets/auth_illustration.png';
import logo from '../../assets/logo.png';
import { api } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { PasswordInput } from '../../components/PasswordInput';

export function ForgotPassword() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData(e.target);
    const emailVal = formData.get('email');
    setEmail(emailVal);

    try {
      await api.post(`/auth/forgot-password?email=${encodeURIComponent(emailVal)}`);
      setStep(2);
      addToast('OTP sent to your email!', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);

    if (digit && index < otp.length - 1) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const previousInput = document.getElementById(`otp-${index - 1}`);
      previousInput?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the 6-digit OTP');
      setLoading(false);
      return;
    }

    try {
      await api.post(`/auth/verify-otp?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
      addToast('OTP verified successfully!', 'success');
      setStep(3);
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.target);
    const code = otp.join('');
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await api.post(`/auth/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}&new_password=${encodeURIComponent(newPassword)}`);
      addToast('Password reset successfully! Please login.', 'success');
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row-reverse font-sans bg-white overflow-hidden">
      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 h-full overflow-y-auto relative">
        <div className="max-w-md w-full">
          <div className="flex flex-col items-start gap-1 mb-4">
             <button 
               onClick={() => {
                 if (step === 1) {
                   navigate('/login');
                   return;
                 }
                 setError('');
                 setStep(step - 1);
               }} 
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

          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {step === 1 ? 'Forgot Password?' : step === 2 ? 'Enter OTP' : 'Reset Password'}
          </h2>
          <p className="text-slate-500 mb-6 text-sm">
            {step === 1 
              ? "Enter your email address and we'll send you an OTP to reset your password." 
              : step === 2
                ? `Enter the 6-digit OTP sent to ${email}. Valid for 1 minute.`
                : 'Create a new password and confirm it to finish resetting your account.'}
          </p>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-500 text-sm rounded-xl border border-red-100">{error}</div>}

          {step === 1 ? (
            <form className="space-y-4" onSubmit={handleSendOTP}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
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
              
              <button 
                type="submit"
                disabled={loading}
                className={`w-full bg-[#3461ff] hover:bg-[#2b51d6] text-white py-2.5 rounded-xl font-medium transition-all shadow-md shadow-[#4169e1]/20 mt-2 flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          ) : step === 2 ? (
            <form className="space-y-4" onSubmit={handleVerifyOtp}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">OTP Code</label>
                <div className="grid grid-cols-6 gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="h-12 w-full text-center border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4169e1]/50 focus:border-[#4169e1] transition-all bg-white text-lg font-semibold"
                      required
                    />
                  ))}
                </div>
              </div>
              
              <button 
                type="submit"
                disabled={loading}
                className={`w-full bg-[#3461ff] hover:bg-[#2b51d6] text-white py-2.5 rounded-xl font-medium transition-all shadow-md shadow-[#4169e1]/20 mt-2 flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Verifying OTP...' : 'Verify OTP'}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleResetPassword}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">New Password</label>
                <PasswordInput
                  name="new_password"
                  placeholder="At least 6 characters"
                  leftIcon={<Lock className="h-4 w-4 text-slate-400" />}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Confirm Password</label>
                <PasswordInput
                  name="confirm_password"
                  placeholder="Confirm your password"
                  leftIcon={<ShieldCheck className="h-4 w-4 text-slate-400" />}
                />
              </div>
              
              <button 
                type="submit"
                disabled={loading}
                className={`w-full bg-[#3461ff] hover:bg-[#2b51d6] text-white py-2.5 rounded-xl font-medium transition-all shadow-md shadow-[#4169e1]/20 mt-2 flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          )}

          <div className="mt-8 text-center text-sm">
            <p className="text-slate-500">
              Remember your password? <Link to="/login" className="text-[#4169e1] font-bold hover:text-[#3156c4] transition-colors">Login</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Left Side - Illustration */}
      <div className="hidden lg:flex w-1/2 bg-[#f4f7fb] items-center justify-center h-full">
         <img src={authIllustration} alt="Reset Password Illustration" className="w-full h-full object-cover" />
      </div>
    </div>
  );
}
