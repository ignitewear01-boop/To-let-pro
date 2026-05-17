import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Building, Phone, Lock, ArrowLeft, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../services/firebase';

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const nextUrl = searchParams.get('next');
  const isAdminLoginHint = searchParams.get('admin') === '1';

  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('tenant');
  const [step, setStep] = useState('form');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  // Firebase refs
  const confirmationResultRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value !== '' && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const goToNextOrDashboard = () => {
    if (nextUrl) {
      try {
        navigate(decodeURIComponent(nextUrl), { replace: true });
        return;
      } catch { /* fall through */ }
    }
    navigate(role === 'landlord' ? '/host-dashboard' : '/tenant-dashboard', { replace: true });
  };

  // ─── STEP 1: Form Submit → Firebase OTP পাঠাও ───────────────────────────
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const phoneNumber = `+880${formData.phone}`;
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current);
      confirmationResultRef.current = result;

      setStep('otp'); // OTP screen দেখাও
    } catch (error) {
      console.error(error);
      setErrorMsg('OTP পাঠাতে সমস্যা হয়েছে। ফোন নম্বর চেক করুন।');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── STEP 2: OTP Verify → Backend Login/Register ─────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    const otpCode = otp.join('');

    try {
      // Firebase OTP যাচাই করো
      await confirmationResultRef.current.confirm(otpCode);

      // Firebase OTP সঠিক হলে Backend এ login/register করো
      await login({
        name: formData.name,
        phone: `+880${formData.phone}`,
        password: formData.password,
        role,
        isLogin, // true = login, false = register
      });

      goToNextOrDashboard();
    } catch (error) {
      console.error(error);
      setErrorMsg('OTP ভুল হয়েছে অথবা সার্ভারে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex bg-[#f8f9fa] font-sans overflow-hidden">

      {/* ── Invisible reCAPTCHA container (hidden) ── */}
      <div id="recaptcha-container"></div>

      {/* ── LEFT SIDE: DESKTOP IMAGE ── */}
      <div className="hidden lg:flex lg:w-[45%] relative bg-gray-900 overflow-hidden h-full">
        <img
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
          alt="To-Let Pro"
          className="absolute inset-0 w-full h-full object-cover opacity-80 transition-transform duration-[10s] hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-10 xl:p-14">
          <div className="bg-brandRed text-white text-[11px] font-bold uppercase tracking-widest py-1.5 px-3 rounded-full w-max mb-5">
            100% Verified Hosts
          </div>
          <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight mb-3">
            Find Your Next <br /> <span className="text-brandRed">Perfect Home.</span>
          </h1>
          <p className="text-gray-300 text-base max-w-md">
            Discover premium apartments, duplexes, and commercial spaces across Bangladesh.
          </p>
          <div className="flex items-center gap-5 mt-8">
            <div className="flex -space-x-3">
              <img src="https://i.pravatar.cc/100?img=1" className="w-9 h-9 rounded-full border-2 border-black" alt="user" />
              <img src="https://i.pravatar.cc/100?img=2" className="w-9 h-9 rounded-full border-2 border-black" alt="user" />
              <img src="https://i.pravatar.cc/100?img=3" className="w-9 h-9 rounded-full border-2 border-black" alt="user" />
            </div>
            <p className="text-xs font-medium text-gray-300">Happy Users <br />Joined Recently</p>
          </div>
        </div>
      </div>

      {/* ── RIGHT SIDE: FORM ── */}
      <div className="w-full lg:w-[55%] h-full flex flex-col justify-center items-center px-6 sm:px-12 bg-white relative overflow-y-auto custom-scrollbar">

        <button
          onClick={() => step === 'otp' ? setStep('form') : navigate(-1)}
          className="absolute top-6 left-6 text-gray-400 hover:text-brandRed transition-colors p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="w-full max-w-sm">

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-600 text-center">
              {errorMsg}
            </div>
          )}

          {/* ── FORM STEP ── */}
          {step === 'form' && (
            <>
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  {isLogin ? 'Welcome Back 👋' : 'Create Account'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {isLogin ? 'Sign in to continue' : 'Join To-Let Pro today'}
                </p>
              </div>

              {/* Role Toggle */}
              <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => setRole('tenant')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${role === 'tenant' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Tenant
                </button>
                <button
                  type="button"
                  onClick={() => setRole('landlord')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${role === 'landlord' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Landlord
                </button>
              </div>

              <form className="space-y-3.5" onSubmit={handleAuthSubmit}>

                {/* Full Name (Sign up only) */}
                {!isLogin && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 ml-1 uppercase tracking-wider">Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <User size={16} />
                      </div>
                      <input
                        type="text" name="name" value={formData.name} onChange={handleChange}
                        placeholder="আপনার নাম"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-brandRed focus:ring-2 focus:ring-brandRed/20 transition-all outline-none"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Phone Number */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1 ml-1 uppercase tracking-wider">Phone Number</label>
                  <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:bg-white focus-within:border-brandRed focus-within:ring-2 focus-within:ring-brandRed/20 transition-all overflow-hidden">
                    <div className="pl-3.5 pr-2.5 text-gray-400">
                      <Phone size={16} />
                    </div>
                    <div className="px-1.5 py-3 border-l border-gray-300 text-gray-600 font-bold text-sm">
                      +880
                    </div>
                    <input
                      type="tel" name="phone" value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                      maxLength={10} placeholder="1XXXXXXXXX"
                      className="w-full bg-transparent py-3 pl-2 pr-4 text-sm font-bold outline-none tracking-wide"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex justify-between items-center mb-1 ml-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">Password</label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock size={16} />
                    </div>
                    <input
                      type="password" name="password" value={formData.password} onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-brandRed focus:ring-2 focus:ring-brandRed/20 transition-all outline-none tracking-widest"
                      required
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading || formData.phone.length < 10}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-brandRed text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_6px_15px_rgba(186,0,54,0.2)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(186,0,54,0.3)] active:translate-y-0 transition-all disabled:opacity-70"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : (isLogin ? 'Send OTP & Log In' : 'Send OTP & Sign Up')}
                </button>
              </form>

              {/* Toggle */}
              <div className="mt-8 text-center">
                <p className="text-xs sm:text-sm font-semibold text-gray-500">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                  <button
                    onClick={() => { setIsLogin(!isLogin); setFormData({ name: '', phone: '', password: '' }); setErrorMsg(''); }}
                    className="text-brandRed font-black ml-1.5 hover:underline"
                  >
                    {isLogin ? "Sign Up" : "Log In"}
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ── OTP STEP ── */}
          {step === 'otp' && (
            <div className="animate-[fadeIn_0.3s_ease-out] text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Phone size={28} className="text-brandRed" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-1">Verification</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter the 4-digit code sent to <br />
                <span className="font-bold text-gray-800">+880 {formData.phone}</span>
              </p>

              <form onSubmit={handleVerifyOtp} className="flex flex-col items-center">
                <div className="flex justify-center gap-3 sm:gap-4 mb-6">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      className="w-12 h-12 sm:w-14 sm:h-14 text-center text-xl font-black text-brandRed bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-brandRed focus:bg-white transition-all shadow-sm"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.join('').length < 6}
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_6px_15px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> Verify Code</>}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtp(['', '', '', '', '', '']); setErrorMsg(''); }}
                  className="mt-4 text-sm font-bold text-gray-400 hover:text-brandRed transition-colors"
                >
                  ← Change number
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e5e7eb; border-radius: 20px; }
      `}</style>
    </div>
  );
};

export default LoginPage;