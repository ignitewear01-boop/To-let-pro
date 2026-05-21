/**
 * TenantVerificationModal.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Futuristic tenant identity-verification wizard.
 *
 * 5-step flow (profile photo removed):
 *   1. Profession   (required)
 *   2. Work / Study  (required)
 *   3. Family size   (required)
 *   4. Emergency contact (required)
 *   5. NID upload    (optional, deferred)
 *   6. Review + Submit
 *
 * Visual language — "Neo-glass":
 *   Dark translucent overlay with an animated dot-grid.
 *   Frosted-glass card with holographic gradient borders.
 *   Neon-accent chip selectors with animated glow.
 *   Circular trust-score gauge with animated SVG ring.
 *   Futuristic step rail — glowing nodes + neon connector lines.
 *   Smooth framer-motion transitions between steps.
 *   Cyberpunk typography — monospaced numbers, tight tracking.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Check, CheckCircle2,
  Sparkles, Briefcase, GraduationCap, Store, Users,
  Building2, MapPin, Phone, IdCard, ShieldCheck,
  ImagePlus, Loader2, AlertCircle, Trash2, Heart,
  ArrowRight, Lock, Star, Award, Zap, Fingerprint,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'tolet_pro::tenant-verify:draft';
const MAX_BYTES   = 5 * 1024 * 1024;
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const POINTS = {
  profession:       15,
  workPlace:        15,
  familySize:        5,
  emergencyContact: 15,
  nidFront:         25,
  nidBack:          25,
};

// ─── Profession options ──────────────────────────────────────────────────
const PROFESSIONS = [
  { key: 'employed',      icon: Briefcase,     en: 'Salaried',   bn: 'চাকরিজীবী' },
  { key: 'self-employed', icon: Store,         en: 'Business',   bn: 'ব্যবসায়ী' },
  { key: 'student',       icon: GraduationCap, en: 'Student',    bn: 'ছাত্র/ছাত্রী' },
  { key: 'other',         icon: Users,         en: 'Other',      bn: 'অন্যান্য' },
];

// ─── Family-size options ─────────────────────────────────────────────────
const FAMILY_SIZES = [
  { key: 1, en: '1 person (Bachelor)',  bn: '১ জন (ব্যাচেলর)' },
  { key: 2, en: '2 people (Couple)',    bn: '২ জন (কাপল)' },
  { key: 4, en: '3–5 people',           bn: '৩-৫ জন' },
  { key: 6, en: '5+ people',            bn: '৫+ জন' },
];

// ─── File reader helper ──────────────────────────────────────────────────
const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload  = () => resolve(r.result);
  r.onerror = () => reject(new Error('read'));
  r.readAsDataURL(file);
});

// ─── Step definitions (photo removed) ────────────────────────────────────
const STEPS = [
  { key: 'profession',  icon: Briefcase,   required: true,  optional: false },
  { key: 'workPlace',   icon: Building2,   required: true,  optional: false },
  { key: 'familySize',  icon: Users,       required: true,  optional: false },
  { key: 'emergency',   icon: Phone,       required: true,  optional: false },
  { key: 'nid',         icon: IdCard,      required: false, optional: true  },
  { key: 'review',      icon: Sparkles,    required: false, optional: false },
];

// ─── Futuristic Chip ─────────────────────────────────────────────────────
const Chip = ({ active, onClick, icon: Icon, children }) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.97 }}
    className={`relative px-4 py-4 rounded-2xl text-left transition-all duration-200 flex items-center gap-3 group overflow-hidden
      ${active
        ? 'bg-gradient-to-br from-[#ba0036] via-[#e0004d] to-[#7a0024] text-white shadow-[0_0_25px_rgba(186,0,54,0.4)] ring-1 ring-[#ff4d6d]/30'
        : 'bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] backdrop-blur-sm'}`}
  >
    {active && (
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2.5s_linear_infinite]" />
    )}
    {Icon && (
      <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-colors
        ${active ? 'bg-white/20' : 'bg-white/[0.06] group-hover:bg-white/[0.1]'}`}>
        <Icon size={16} className={active ? 'text-white' : 'text-gray-400'} />
      </div>
    )}
    <span className="relative z-10 font-black text-sm tracking-tight">{children}</span>
    {active && (
      <Check size={14} className="relative z-10 ml-auto text-white" />
    )}
  </motion.button>
);

// ─── Circular Trust-Score Gauge ──────────────────────────────────────────
const TrustGauge = ({ score, isBn }) => {
  const tier = score >= 90 ? 'platinum'
             : score >= 70 ? 'gold'
             : score >= 40 ? 'silver'
             :               'bronze';
  const tierLabel = {
    platinum: isBn ? 'প্ল্যাটিনাম' : 'Platinum',
    gold:     isBn ? 'গোল্ড'       : 'Gold',
    silver:   isBn ? 'সিলভার'      : 'Silver',
    bronze:   isBn ? 'ব্রোঞ্জ'      : 'Bronze',
  }[tier];
  const tierGradient = {
    platinum: ['#818cf8', '#a78bfa'],
    gold:     ['#fbbf24', '#f59e0b'],
    silver:   ['#94a3b8', '#64748b'],
    bronze:   ['#fb923c', '#f97316'],
  }[tier];

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-[78px] h-[78px]">
        <svg width="78" height="78" viewBox="0 0 78 78" className="transform -rotate-90">
          <circle cx="39" cy="39" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <motion.circle
            cx="39" cy="39" r={radius}
            fill="none"
            stroke={`url(#gaugeGrad)`}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${tierGradient[0]}80)` }}
          />
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={tierGradient[0]} />
              <stop offset="100%" stopColor={tierGradient[1]} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-white tabular-nums leading-none">{score}</span>
          <span className="text-[8px] font-bold text-white/40 mt-0.5">/ 100</span>
        </div>
      </div>
      <div className="flex flex-col items-start">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
          {isBn ? 'ট্রাস্ট' : 'Trust'}
        </span>
        <span
          className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1"
          style={{
            background: `linear-gradient(135deg, ${tierGradient[0]}30, ${tierGradient[1]}30)`,
            color: tierGradient[0],
            border: `1px solid ${tierGradient[0]}40`,
          }}
        >
          {tierLabel}
        </span>
      </div>
    </div>
  );
};

// ─── Futuristic Step Rail ────────────────────────────────────────────────
const StepRail = ({ steps, stepIdx, data, onJump }) => (
  <div className="flex items-center gap-0">
    {steps.map((s, i) => {
      const visited = i < stepIdx;
      const active  = i === stepIdx;
      const filled  = isStepFilled(s.key, data);
      const isLast  = i === steps.length - 1;
      return (
        <React.Fragment key={s.key}>
          <button
            type="button"
            onClick={() => onJump(i)}
            className="relative group flex flex-col items-center"
            aria-label={`Step ${i + 1}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
              active
                ? 'bg-gradient-to-br from-[#ba0036] to-[#ff4d6d] text-white shadow-[0_0_20px_rgba(186,0,54,0.5)] ring-2 ring-[#ff4d6d]/30 scale-110'
                : (visited || filled)
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                  : 'bg-white/[0.05] text-white/30 ring-1 ring-white/[0.08]'
            }`}>
              {(visited || filled) && !active
                ? <Check size={12} />
                : <s.icon size={12} />}
            </div>
            {active && (
              <motion.div
                layoutId="stepGlow"
                className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#ff4d6d]"
                style={{ filter: 'blur(1px)', boxShadow: '0 0 8px 2px rgba(255,77,109,0.6)' }}
              />
            )}
          </button>
          {!isLast && (
            <div className={`flex-1 h-[2px] mx-0.5 rounded-full transition-all duration-500 ${
              i < stepIdx ? 'bg-emerald-500/40' : 'bg-white/[0.06]'
            }`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Step Frame ──────────────────────────────────────────────────────────
const StepFrame = ({ icon: Icon, titleBn, titleEn, hintBn, hintEn, optional, isBn, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
  >
    <div className="flex items-start gap-3.5 mb-6">
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#ba0036]/20 to-[#ff4d6d]/10 border border-[#ba0036]/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(186,0,54,0.15)]">
        <Icon size={18} className="text-[#ff4d6d]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="text-lg font-black text-white tracking-tight">
            {isBn ? titleBn : titleEn}
          </h3>
          {optional && (
            <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
              {isBn ? 'ঐচ্ছিক' : 'Optional'}
            </span>
          )}
        </div>
        <p className="text-[12px] text-white/40 font-medium mt-1 leading-relaxed">
          {isBn ? hintBn : hintEn}
        </p>
      </div>
    </div>
    {children}
  </motion.div>
);

// ─── NID Upload Card ─────────────────────────────────────────────────────
const NidUploadCard = ({ value, inputRef, onPick, onRemove, emptyLabelBn, emptyLabelEn, aspect, isBn }) => (
  <div>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />
    {value?.dataUrl ? (
      <div className={`relative group rounded-2xl overflow-hidden bg-white/[0.03] ring-1 ring-emerald-500/30 ${aspect}`}>
        <img src={value.dataUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 backdrop-blur-0 group-hover:backdrop-blur-sm transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button type="button" onClick={() => inputRef.current?.click()}
            className="bg-white/10 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[11px] font-black border border-white/20 flex items-center gap-1.5 hover:bg-white/20 transition-colors">
            <ImagePlus size={12} /> {isBn ? 'বদলান' : 'Replace'}
          </button>
          <button type="button" onClick={onRemove}
            className="bg-red-500/20 backdrop-blur-md text-red-300 px-3 py-1.5 rounded-full text-[11px] font-black border border-red-500/20 flex items-center gap-1.5 hover:bg-red-500/30 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
        <div className="absolute top-2 right-2 bg-emerald-500/20 backdrop-blur-md text-emerald-400 rounded-full p-1.5 border border-emerald-500/30">
          <CheckCircle2 size={12} />
        </div>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-full ${aspect} rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.1] hover:border-[#ff4d6d]/40 hover:bg-[#ba0036]/5 transition-all flex flex-col items-center justify-center gap-2.5 group`}
      >
        <div className="w-11 h-11 rounded-2xl bg-white/[0.04] group-hover:bg-[#ba0036]/10 border border-white/[0.06] flex items-center justify-center transition-colors">
          <ImagePlus size={18} className="text-white/30 group-hover:text-[#ff4d6d]" />
        </div>
        <p className="text-[11px] font-black text-white/50">{isBn ? emptyLabelBn : emptyLabelEn}</p>
      </button>
    )}
  </div>
);

// ─── Review Summary Row ──────────────────────────────────────────────────
const SummaryRow = ({ icon: Icon, labelBn, labelEn, value, muted, isBn }) => (
  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
      muted ? 'bg-white/[0.04] text-white/20' : 'bg-[#ba0036]/15 text-[#ff4d6d]'
    }`}>
      <Icon size={14} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
        {isBn ? labelBn : labelEn}
      </p>
      <p className={`text-sm font-black truncate ${muted ? 'text-white/25' : 'text-white/90'}`}>
        {value || '—'}
      </p>
    </div>
  </div>
);

// ─── Main Modal ──────────────────────────────────────────────────────────
const TenantVerificationModal = ({
  open,
  onClose,
  onSubmit,
  language     = 'বাংলা',
  initialData  = null,
}) => {
  const isBn = language === 'বাংলা';
  const TOTAL = STEPS.length;

  // ─── Form state (photo removed) ────────────────────────────────────
  const [stepIdx, setStepIdx]   = useState(0);
  const [data, setData] = useState({
    profession:       '',
    workPlace:        '',
    familySize:       null,
    emergencyName:    '',
    emergencyPhone:   '',
    nidFront:         null,
    nidBack:          null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  // ─── Hydrate ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setStepIdx(0);
    setError('');
    let seed = null;
    if (initialData && typeof initialData === 'object') {
      seed = {
        profession:     initialData.professionType || '',
        workPlace:      initialData.workPlace      || '',
        familySize:     initialData.familySize     || null,
        emergencyName:  initialData.emergencyContact?.name  || '',
        emergencyPhone: initialData.emergencyContact?.phone || '',
        nidFront: null, nidBack: null,
      };
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) seed = JSON.parse(raw);
      } catch { /* ignore */ }
    }
    if (seed) setData((d) => ({ ...d, ...seed }));
  }, [open, initialData]);

  // Persist draft
  useEffect(() => {
    if (!open) return;
    const { nidFront, nidBack, ...persistable } = data;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable)); } catch { /* ignore */ }
  }, [data, open]);

  // Body scroll lock + ESC
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // ─── Live trust score ──────────────────────────────────────────────
  const liveScore = useMemo(() => {
    let s = 20; // baseline: phone OTP
    if (data.profession)                                s += POINTS.profession;
    if (data.workPlace?.trim()?.length >= 2)            s += POINTS.workPlace;
    if (data.familySize)                                s += POINTS.familySize;
    if (data.emergencyPhone?.replace(/\D/g, '').length >= 10) s += POINTS.emergencyContact;
    return Math.min(100, s);
  }, [data]);

  // ─── Validation ────────────────────────────────────────────────────
  const current = STEPS[stepIdx];
  const isReview = current.key === 'review';

  const canAdvance = useMemo(() => {
    switch (current.key) {
      case 'profession': return !!data.profession;
      case 'workPlace':  return data.workPlace.trim().length >= 2;
      case 'familySize': return data.familySize !== null;
      case 'emergency':  return data.emergencyPhone.replace(/\D/g, '').length >= 10;
      case 'nid':
      case 'review':     return true;
      default:           return true;
    }
  }, [current.key, data]);

  // ─── Navigation ────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    setError('');
    if (!canAdvance && current.required) {
      setError(isBn
        ? 'এই ধাপ পূরণ করুন তারপর এগিয়ে যান।'
        : 'Please fill this step before continuing.');
      return;
    }
    setStepIdx((i) => Math.min(TOTAL - 1, i + 1));
  }, [canAdvance, current.required, isBn, TOTAL]);

  const goBack = useCallback(() => {
    setError('');
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  const jumpTo = useCallback((i) => {
    setError('');
    if (i <= stepIdx) return setStepIdx(i);
    for (let k = stepIdx; k < i; k++) {
      const s = STEPS[k];
      if (s.required) {
        const ok =
          (s.key === 'profession' && !!data.profession) ||
          (s.key === 'workPlace'  && data.workPlace.trim().length >= 2) ||
          (s.key === 'familySize' && data.familySize !== null) ||
          (s.key === 'emergency'  && data.emergencyPhone.replace(/\D/g, '').length >= 10);
        if (!ok) return;
      }
    }
    setStepIdx(i);
  }, [stepIdx, data]);

  // ─── File handling (NID only) ──────────────────────────────────────
  const nidFrontInputRef = useRef(null);
  const nidBackInputRef  = useRef(null);

  const handleFilePick = async (slot, e) => {
    setError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!IMAGE_MIMES.includes(file.type)) {
      return setError(isBn ? 'JPG, PNG বা WEBP ফাইল ব্যবহার করুন।' : 'Please use a JPG, PNG or WEBP image.');
    }
    if (file.size > MAX_BYTES) {
      return setError(isBn ? 'ফাইলটি অনেক বড় (সর্বোচ্চ ৫ MB)।' : 'File is too large (max 5 MB).');
    }
    try {
      const dataUrl = await readAsDataURL(file);
      setData((d) => ({
        ...d,
        [slot]: { dataUrl, file, name: file.name, size: file.size, type: file.type },
      }));
    } catch {
      setError(isBn ? 'ফাইল পড়তে সমস্যা হয়েছে।' : 'Could not read file.');
    }
  };

  const removeFile = (slot) => setData((d) => ({ ...d, [slot]: null }));

  // ─── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await onSubmit?.({
        professionType: data.profession,
        workPlace:      data.workPlace.trim(),
        familySize:     data.familySize,
        emergencyContact: {
          name:  data.emergencyName.trim(),
          phone: data.emergencyPhone.trim(),
        },
        nidFront: data.nidFront,
        nidBack:  data.nidBack,
        liveScore,
      });
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    } catch (err) {
      setError(err?.message || (isBn ? 'জমা দিতে সমস্যা হয়েছে।' : 'Submission failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch sm:items-center sm:justify-center p-0 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose?.(); }}
    >
      {/* Dark overlay with dot-grid pattern */}
      <div className="absolute inset-0 bg-[#0a0a14]/85 backdrop-blur-xl" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Main glass card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full sm:max-w-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-[2rem] overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(165deg, rgba(20,20,35,0.95) 0%, rgba(12,12,22,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 40px 100px -20px rgba(0,0,0,0.8), 0 0 60px -10px rgba(186,0,54,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Holographic top edge */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#ff4d6d]/40 to-transparent" />

        {/* Ambient glow orbs */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#ba0036]/8 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="relative px-5 sm:px-7 pt-5 pb-3 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ba0036] to-[#ff4d6d] flex items-center justify-center shadow-[0_0_20px_rgba(186,0,54,0.3)]">
                <Fingerprint size={15} className="text-white" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff4d6d]">
                  {isBn ? 'পরিচয় যাচাই' : 'Identity'}
                </p>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ff4d6d]/10 border border-[#ff4d6d]/20">
                  <Zap size={8} className="text-[#ff4d6d]" />
                  <span className="text-[8px] font-black text-[#ff4d6d]/80 uppercase tracking-widest">Secure</span>
                </div>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isBn ? 'নিজেকে পরিচিত করুন' : 'Tell us about yourself'}
            </h2>
            <p className="text-[12px] text-white/35 font-medium mt-1 leading-relaxed">
              {isBn
                ? 'মাত্র কয়েকটি প্রশ্ন। কোনো ডকুমেন্ট এখন বাধ্যতামূলক নয়।'
                : 'Just a few quick questions. No documents required right now.'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <X size={16} className="text-white/50" />
            </button>
            <TrustGauge score={liveScore} isBn={isBn} />
          </div>
        </div>

        {/* ── Step rail ───────────────────────────────────────────── */}
        <div className="relative px-5 sm:px-7 py-3 shrink-0">
          <StepRail steps={STEPS} stepIdx={stepIdx} data={data} onJump={jumpTo} />
          <p className="mt-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/25">
            {isBn ? `ধাপ ${stepIdx + 1} / ${TOTAL}` : `Step ${stepIdx + 1} of ${TOTAL}`}
          </p>
        </div>

        {/* Separator */}
        <div className="mx-5 sm:mx-7 h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="relative flex-1 overflow-y-auto px-5 sm:px-7 py-5">
          <AnimatePresence mode="wait">

            {/* STEP 1 — Profession */}
            {current.key === 'profession' && (
              <StepFrame
                key="profession"
                icon={Briefcase}
                titleBn="আপনি কী করেন?" titleEn="What do you do?"
                hintBn="বাড়িওয়ালা সাধারণত এটাই প্রথম জিজ্ঞেস করেন।"
                hintEn="This is usually a landlord's first question."
                isBn={isBn}
              >
                <div className="grid grid-cols-2 gap-2.5">
                  {PROFESSIONS.map((p) => (
                    <Chip
                      key={p.key}
                      icon={p.icon}
                      active={data.profession === p.key}
                      onClick={() => setData((d) => ({ ...d, profession: p.key }))}
                    >
                      {isBn ? p.bn : p.en}
                    </Chip>
                  ))}
                </div>
              </StepFrame>
            )}

            {/* STEP 2 — Work / Study */}
            {current.key === 'workPlace' && (
              <StepFrame
                key="workPlace"
                icon={Building2}
                titleBn={data.profession === 'student' ? 'কোথায় পড়াশোনা করেন?' : 'কোথায় কাজ করেন?'}
                titleEn={data.profession === 'student' ? 'Where do you study?'    : 'Where do you work?'}
                hintBn="শুধু নাম লিখুন। কোনো আইডি কার্ড দরকার নেই।"
                hintEn="Just the name. No ID card required."
                isBn={isBn}
              >
                <div className="relative">
                  <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
                  <input
                    type="text"
                    value={data.workPlace}
                    onChange={(e) => setData((d) => ({ ...d, workPlace: e.target.value }))}
                    placeholder={isBn
                      ? (data.profession === 'student' ? 'যেমন: ঢাকা ইউনিভার্সিটি' : 'যেমন: যমুনা ব্যাংক')
                      : (data.profession === 'student' ? 'e.g. Dhaka University'     : 'e.g. Jamuna Bank')}
                    className="w-full pl-12 pr-4 py-4 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.06] border border-white/[0.08] focus:border-[#ff4d6d]/40 rounded-2xl text-sm font-bold text-white placeholder:text-white/20 transition-all outline-none focus:shadow-[0_0_20px_rgba(186,0,54,0.1)] focus:ring-1 focus:ring-[#ff4d6d]/20"
                    autoFocus
                  />
                </div>
                <div className="mt-3.5 p-3.5 rounded-2xl bg-indigo-500/[0.06] border border-indigo-500/10 flex gap-2.5 items-start">
                  <Sparkles size={13} className="text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-indigo-300/70 leading-relaxed">
                    {isBn
                      ? 'বাড়িওয়ালারা একটা পরিচিত নাম দেখলেই আশ্বস্ত হন। আপনাকে কোনো প্রমাণ দিতে হবে না।'
                      : 'A familiar workplace name puts most landlords at ease. No proof required.'}
                  </p>
                </div>
              </StepFrame>
            )}

            {/* STEP 3 — Family size */}
            {current.key === 'familySize' && (
              <StepFrame
                key="familySize"
                icon={Users}
                titleBn="পরিবারে কত জন?" titleEn="How many people?"
                hintBn="বাসায় মোট কত জন থাকবেন?"
                hintEn="Total number of people who'll be living there."
                isBn={isBn}
              >
                <div className="grid grid-cols-2 gap-2.5">
                  {FAMILY_SIZES.map((f) => (
                    <Chip
                      key={f.key}
                      active={data.familySize === f.key}
                      onClick={() => setData((d) => ({ ...d, familySize: f.key }))}
                    >
                      {isBn ? f.bn : f.en}
                    </Chip>
                  ))}
                </div>
              </StepFrame>
            )}

            {/* STEP 4 — Emergency contact */}
            {current.key === 'emergency' && (
              <StepFrame
                key="emergency"
                icon={Phone}
                titleBn="জরুরি যোগাযোগ" titleEn="Emergency contact"
                hintBn="বাবা-মা, ভাই-বোন বা একজন আত্মীয়ের নাম্বার।"
                hintEn="A parent, sibling, or close relative's number."
                isBn={isBn}
              >
                <div className="space-y-2.5">
                  <div className="relative">
                    <Heart size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
                    <input
                      type="text"
                      value={data.emergencyName}
                      onChange={(e) => setData((d) => ({ ...d, emergencyName: e.target.value }))}
                      placeholder={isBn ? 'নাম (ঐচ্ছিক) — যেমন: বাবা / ভাই' : 'Name (optional) — e.g. Father / Brother'}
                      className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.06] border border-white/[0.08] focus:border-[#ff4d6d]/40 rounded-2xl text-sm font-bold text-white placeholder:text-white/20 transition-all outline-none focus:shadow-[0_0_20px_rgba(186,0,54,0.1)] focus:ring-1 focus:ring-[#ff4d6d]/20"
                    />
                  </div>
                  <div className="relative">
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
                    <input
                      type="tel"
                      inputMode="tel"
                      value={data.emergencyPhone}
                      onChange={(e) => setData((d) => ({ ...d, emergencyPhone: e.target.value }))}
                      placeholder={isBn ? 'মোবাইল নাম্বার (+880…)' : 'Mobile number (+880…)'}
                      className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.06] border border-white/[0.08] focus:border-[#ff4d6d]/40 rounded-2xl text-sm font-bold text-white placeholder:text-white/20 transition-all outline-none focus:shadow-[0_0_20px_rgba(186,0,54,0.1)] focus:ring-1 focus:ring-[#ff4d6d]/20"
                    />
                  </div>
                </div>
              </StepFrame>
            )}

            {/* STEP 5 — NID (optional) */}
            {current.key === 'nid' && (
              <StepFrame
                key="nid"
                icon={IdCard}
                titleBn="NID যাচাই" titleEn="NID verification"
                hintBn="এখন না দিলেও চলবে। বাসা চূড়ান্ত করার সময় চাইব।"
                hintEn="Skip for now if you'd rather not. We'll ask again when you finalise a property."
                optional isBn={isBn}
              >
                <div className="grid grid-cols-2 gap-3">
                  <NidUploadCard
                    value={data.nidFront}
                    inputRef={nidFrontInputRef}
                    onPick={(e) => handleFilePick('nidFront', e)}
                    onRemove={() => removeFile('nidFront')}
                    emptyLabelBn="NID — সামনে" emptyLabelEn="NID — Front"
                    isBn={isBn}
                    aspect="aspect-[4/3]"
                  />
                  <NidUploadCard
                    value={data.nidBack}
                    inputRef={nidBackInputRef}
                    onPick={(e) => handleFilePick('nidBack', e)}
                    onRemove={() => removeFile('nidBack')}
                    emptyLabelBn="NID — পিছনে" emptyLabelEn="NID — Back"
                    isBn={isBn}
                    aspect="aspect-[4/3]"
                  />
                </div>
                <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/[0.06] border border-amber-500/10 flex gap-2.5 items-start">
                  <Lock size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-amber-300/70 leading-relaxed">
                    {isBn
                      ? 'আপনার NID-এর ছবি এনক্রিপ্টেড আকারে সংরক্ষিত হবে। কোনো বাড়িওয়ালা সরাসরি এটা দেখতে পাবে না।'
                      : 'Your NID is encrypted and never shown directly to any landlord.'}
                  </p>
                </div>
              </StepFrame>
            )}

            {/* STEP 6 — Review */}
            {isReview && (
              <StepFrame
                key="review"
                icon={Sparkles}
                titleBn="পর্যালোচনা" titleEn="Review"
                hintBn="সব ঠিক থাকলে জমা দিন।"
                hintEn="Looks good? Submit when ready."
                isBn={isBn}
              >
                <div className="space-y-2.5">
                  <SummaryRow icon={Briefcase} labelBn="পেশা" labelEn="Profession" isBn={isBn}
                    value={PROFESSIONS.find((p) => p.key === data.profession)?.[isBn ? 'bn' : 'en']} />
                  <SummaryRow icon={Building2}
                    labelBn={data.profession === 'student' ? 'প্রতিষ্ঠান' : 'কাজের স্থান'}
                    labelEn={data.profession === 'student' ? 'Institution' : 'Workplace'}
                    isBn={isBn}
                    value={data.workPlace} />
                  <SummaryRow icon={Users} labelBn="সদস্য সংখ্যা" labelEn="Household size" isBn={isBn}
                    value={data.familySize ? (FAMILY_SIZES.find((f) => f.key === data.familySize)?.[isBn ? 'bn' : 'en']) : ''} />
                  <SummaryRow icon={Phone} labelBn="জরুরি যোগাযোগ" labelEn="Emergency contact" isBn={isBn}
                    value={data.emergencyPhone ? `${data.emergencyName || '—'} · ${data.emergencyPhone}` : ''} />
                  <SummaryRow icon={IdCard} labelBn="NID" labelEn="NID" isBn={isBn}
                    value={(data.nidFront && data.nidBack)
                      ? (isBn ? 'যোগ করা হয়েছে' : 'Added')
                      : (isBn ? 'পরে যোগ করব' : 'Add later')}
                    muted={!(data.nidFront && data.nidBack)} />
                </div>

                {!data.nidFront && (
                  <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-amber-500/[0.06] to-orange-500/[0.04] border border-amber-500/10">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center shrink-0">
                        <Star size={16} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="text-[12px] font-black text-amber-300 mb-0.5">
                          {isBn ? 'NID যোগ করলে গোল্ড ব্যাজ পাবেন' : 'Add NID to unlock the Gold badge'}
                        </p>
                        <p className="text-[11px] font-bold text-amber-400/50 leading-relaxed">
                          {isBn
                            ? 'ভেরিফায়েড টেনেন্টদের বাড়িওয়ালারা ৩x বেশি দ্রুত response দেন।'
                            : 'Verified tenants get a 3x faster response from landlords.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </StepFrame>
            )}

          </AnimatePresence>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-2"
            >
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-[12px] font-bold text-red-300">{error}</p>
            </motion.div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="relative px-5 sm:px-7 py-4 border-t border-white/[0.04] flex items-center justify-between gap-3 shrink-0 bg-[#0f0f1a]/60 backdrop-blur-sm">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIdx === 0 || submitting}
            className="px-4 py-2.5 rounded-full text-sm font-bold text-white/40 hover:text-white/70 hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all border border-transparent hover:border-white/[0.06]"
          >
            <ChevronLeft size={15} /> {isBn ? 'পিছনে' : 'Back'}
          </button>

          {isReview ? (
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative px-7 py-3.5 rounded-full text-sm font-black text-white bg-gradient-to-r from-[#ba0036] via-[#e0004d] to-[#ba0036] hover:shadow-[0_0_30px_rgba(186,0,54,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2.5s_linear_infinite]" />
              {submitting ? (
                <><Loader2 size={15} className="relative z-10 animate-spin" /> <span className="relative z-10">{isBn ? 'জমা দেওয়া হচ্ছে…' : 'Submitting…'}</span></>
              ) : (
                <><span className="relative z-10">{isBn ? 'সম্পন্ন করুন' : 'Finish'}</span> <ArrowRight size={15} className="relative z-10" /></>
              )}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={goNext}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative px-7 py-3.5 rounded-full text-sm font-black text-white bg-gradient-to-r from-[#ba0036] via-[#e0004d] to-[#ba0036] hover:shadow-[0_0_30px_rgba(186,0,54,0.4)] flex items-center gap-1.5 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2.5s_linear_infinite]" />
              <span className="relative z-10">
                {current.optional && !isStepFilled(current.key, data)
                  ? (isBn ? 'এড়িয়ে যান' : 'Skip')
                  : (isBn ? 'পরবর্তী' : 'Next')}
              </span>
              <ChevronRight size={15} className="relative z-10" />
            </motion.button>
          )}
        </div>
      </motion.div>

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

// ─── Helper ──────────────────────────────────────────────────────────────
function isStepFilled(key, data) {
  switch (key) {
    case 'profession': return !!data.profession;
    case 'workPlace':  return data.workPlace?.trim().length >= 2;
    case 'familySize': return data.familySize !== null;
    case 'emergency':  return data.emergencyPhone?.replace(/\D/g, '').length >= 10;
    case 'nid':        return !!(data.nidFront && data.nidBack);
    case 'review':     return false;
    default:           return false;
  }
}

export default TenantVerificationModal;
