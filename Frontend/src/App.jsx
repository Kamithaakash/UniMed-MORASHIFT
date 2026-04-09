import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './App.css';

const API_BASE_URL = 'https://unimed-ivory.vercel.app';

/* ---- Reusable eye-toggle SVGs ---- */
const EyeOpen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/* ---- Sun / Moon icons ---- */
const SunIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);
const MoonIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const StethoscopeIcon = ({ size = 130 }) => (
  <svg width={size} height={size} viewBox="0 0 100 110" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="22" cy="9" r="5" fill="currentColor" stroke="currentColor" />
    <circle cx="78" cy="9" r="5" fill="currentColor" stroke="currentColor" />
    <line x1="22" y1="14" x2="22" y2="32" />
    <line x1="78" y1="14" x2="78" y2="32" />
    <path d="M22 32 Q22 50 50 50 Q78 50 78 32" />
    <line x1="50" y1="50" x2="50" y2="78" />
    <path d="M50 78 Q50 96 66 96" />
    <circle cx="78" cy="96" r="14" />
    <circle cx="78" cy="96" r="6" fill="currentColor" opacity="0.25" stroke="none" />
  </svg>
);

const LabFlaskIcon = ({ size = 130 }) => (
  <svg width={size} height={size} viewBox="0 0 100 110" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="36" y1="10" x2="64" y2="10" />
    <line x1="40" y1="10" x2="40" y2="42" />
    <line x1="60" y1="10" x2="60" y2="42" />
    <path d="M40 42 L16 82 Q10 95 24 95 L76 95 Q90 95 84 82 L60 42 Z" />
    <path d="M22 80 Q36 70 50 75 Q64 80 78 72 L84 82 Q90 95 76 95 L24 95 Q10 95 16 82 Z" fill="currentColor" opacity="0.25" stroke="none" />
    <circle cx="44" cy="80" r="4" fill="currentColor" opacity="0.5" stroke="none" />
    <circle cx="62" cy="77" r="3" fill="currentColor" opacity="0.5" stroke="none" />
    <circle cx="54" cy="86" r="2.5" fill="currentColor" opacity="0.5" stroke="none" />
  </svg>
);

/* ---- Utility Functions ---- */
const isProfileRecord = (diagnosis) => {
  if (!diagnosis) return false;
  if (diagnosis.includes('[PAST HISTORY]')) return true;
  if (diagnosis.includes('=== PERSONAL INFORMATION ===')) return true;
  if (diagnosis.includes('[PROFILE DELETED]')) return true;
  const hasMedicalFields =
    diagnosis.includes('Full Name:') &&
    (diagnosis.includes('NIC No:') || diagnosis.includes('Faculty:') || diagnosis.includes('Date of Birth:'));
  return hasMedicalFields;
};

const getProfileStatus = (records) => {
  if (!records || records.length === 0) return { status: 'New', record: null };
  const sorted = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const latestRec = sorted.find(r => r.diagnosis?.includes('[PAST HISTORY]') || r.diagnosis?.includes('[PROFILE DELETED]'));
  if (!latestRec || latestRec.diagnosis?.includes('[PROFILE DELETED]')) return { status: 'New', record: null };
  const match = latestRec.diagnosis.match(/Approval Status: (Pending|Approved|Rejected)/);
  const isComplete = latestRec.diagnosis.includes('[FILE_ATTACHMENT:');
  return {
    status: match ? match[1] : (isComplete ? 'Pending' : 'Incomplete'),
    record: latestRec,
    isComplete
  };
};

/* ---- Custom UI Components ---- */
const Toast = ({ message, show }) => {
  if (!show && !message) return null;
  return (
    <div className={`uni-toast ${show ? 'show' : ''}`}>
      <span className="uni-toast-icon">ℹ️</span>
      <span className="uni-toast-msg">{message}</span>
    </div>
  );
};

const ConfirmModal = ({ show, config, onCancel, onConfirm }) => {
  if (!show || !config) return null;
  return (
    <div className="uni-confirm-overlay">
      <div className="uni-confirm-modal">
        <div className="uni-confirm-icon">⚠️</div>
        <div className="uni-confirm-msg">{config.message}</div>
        <div className="uni-confirm-actions">
          <button className="uni-confirm-btn cancel" onClick={onCancel}>{config.cancelText || 'Cancel'}</button>
          <button className="uni-confirm-btn confirm" onClick={onConfirm}>{config.confirmText || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
};

const CustomSelect = ({ value, options, onChange, placeholder = "Select..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="custom-select-wrapper" ref={selectRef}>
      <div className={`custom-select-trigger ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        <span>{value || placeholder}</span>
        <div className="custom-select-arrow" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'flex' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
      {isOpen && (
        <div className="custom-select-menu slide-top">
          {options.map((opt) => (
            <div
              key={opt}
              className={`custom-select-option ${value === opt ? 'selected' : ''}`}
              onClick={() => { onChange(opt); setIsOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function App() {
  const [role, setRole] = useState(() => localStorage.getItem('auth_role') || 'Student');
  const [username, setUsername] = useState(() => localStorage.getItem('auth_username') || '');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('auth_loggedIn') === 'true');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [activeSection, setActiveSection] = useState(0);
  const [panelFading, setPanelFading] = useState(false);
  const panelFadeRef = useRef(null);
  const section0Ref = useRef(null);
  const section1Ref = useRef(null);
  const section2Ref = useRef(null);
  const scrollContainerRef = useRef(null);

  /* ---- Forgot Password State ---- */
  const [showForgotPwd, setShowForgotPwd] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotIndex, setForgotIndex] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [isVerifyingForgot, setIsVerifyingForgot] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);



  /* ---- Custom Toast & Confirm State ---- */
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef(null);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  /* ---- New Registration States in App Component ---- */
  const [showRegister, setShowRegister] = useState(false);
  const [regStep, setRegStep] = useState(1); // 1=index+email, 2=OTP, 3=password
  const [regIndex, setRegIndex] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showRegConfirmPwd, setShowRegConfirmPwd] = useState(false);
  const [isRegLoading, setIsRegLoading] = useState(false);

  /* ---- Handler Functions ---- */
  const [regError, setRegError] = useState('');
  const [regMsg, setRegMsg] = useState('');
  const [regIsNew, setRegIsNew] = useState(false); // true = brand-new student (no pre-registration)

  const resetRegForm = () => {
    setRegStep(1);
    setRegIndex('');
    setRegEmail('');
    setRegOtp('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegError('');
    setRegMsg('');
    setShowRegPwd(false);
    setShowRegConfirmPwd(false);
    setRegIsNew(false);
  };

  // Step 1: Send OTP to university email.
  // For pre-registered students: send-otp works directly.
  // For brand-new students: first create account with a temp password so they exist in DB,
  // then send OTP — student's real password is set via reset-password-with-otp after OTP verification.
  const handleRegSendOtp = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegMsg('');

    if (!regIndex.trim() || !regEmail.trim()) {
      setRegError('Please fill in all fields.');
      return;
    }
    if (!regEmail.toLowerCase().endsWith('@uom.lk')) {
      setRegError('Only @uom.lk university email addresses are accepted.');
      return;
    }

    setIsRegLoading(true);
    try {
      // Try sending OTP first (works if student is already in the system)
      let otpRes = await fetch(`${API_BASE_URL}/student/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: regIndex.trim().toUpperCase(), email: regEmail.trim().toLowerCase() })
      });
      let otpData = await otpRes.json();

      if (otpRes.ok) {
        // Student already has an account — block re-registration
        setRegError(
          'This index number is already registered. Please use "Forgot password?" to reset your password instead.'
        );
      } else if (otpRes.status === 404) {
        // Brand-new student — register with a temporary random password first
        const tempPwd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + '!A1';
        const regRes = await fetch(`${API_BASE_URL}/student/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            indexNumber: regIndex.trim().toUpperCase(),
            email: regEmail.trim().toLowerCase(),
            password: tempPwd
          })
        });
        if (!regRes.ok) {
          const regData = await regRes.json();
          setRegError(regData.error || 'Could not create account. Please try again.');
          return;
        }
        // Now the student exists — send OTP
        otpRes = await fetch(`${API_BASE_URL}/student/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index: regIndex.trim().toUpperCase(), email: regEmail.trim().toLowerCase() })
        });
        otpData = await otpRes.json();
        if (otpRes.ok) {
          setRegIsNew(true);
          setRegMsg(`Verification code sent to ${regEmail}. Check your inbox.`);
          setRegStep(2);
        } else {
          setRegError(otpData.error || 'Failed to send verification email. Please try again.');
        }
      } else {
        setRegError(otpData.error || 'Failed to send verification code. Please try again.');
      }
    } catch {
      setRegError('Network error: Could not reach the server.');
    } finally {
      setIsRegLoading(false);
    }
  };

  // Step 2: Verify OTP entry (move to password step)
  const handleRegVerifyOtp = (e) => {
    e.preventDefault();
    setRegError('');
    if (!regOtp.trim() || regOtp.trim().length !== 6) {
      setRegError('Please enter the 6-digit code sent to your email.');
      return;
    }
    setRegStep(3);
    setRegMsg('');
  };

  // Step 3: Both new and pre-registered students use reset-password-with-otp.
  // For new students, this replaces the temporary password set during registration.
  const handleFinalRegistration = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegMsg('');

    if (!regPassword.trim()) {
      setRegError('Password is required.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }

    setIsRegLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/student/reset-password-with-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.trim().toLowerCase(),
          indexNumber: regIndex.trim().toUpperCase(),
          otp: regOtp.trim(),
          newPassword: regPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRegMsg('✅ Email verified! Account created. You can now sign in.');
        setTimeout(() => {
          setShowRegister(false);
          resetRegForm();
        }, 3000);
      } else {
        setRegError(data.error || 'Verification failed. Please try again.');
        if (data.error && (data.error.includes('OTP') || data.error.includes('expired'))) {
          setRegStep(2);
        }
      }
    } catch {
      setRegError('Network error: Could not reach the server.');
    } finally {
      setIsRegLoading(false);
    }
  };

  const showAlert = useCallback((message) => {
    setToastMessage(message);
    setShowToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setShowToast(false), 5000);
  }, []);

  const showConfirm = useCallback((message, onConfirmCallback, confirmText = 'Confirm', cancelText = 'Cancel') => {
    setConfirmConfig({ message, onConfirmCallback, confirmText, cancelText });
    setShowConfirmModal(true);
  }, []);

  const handleConfirmAction = () => {
    if (confirmConfig?.onConfirmCallback) confirmConfig.onConfirmCallback();
    setShowConfirmModal(false);
  };

  const handleCancelConfirm = () => setShowConfirmModal(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (isLoggedIn) return;
    // Use scroll position instead of IntersectionObserver — more reliable
    // with scroll-snap since each section is exactly 100vh
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const idx = Math.round(container.scrollTop / container.clientHeight);
      const clampedIdx = Math.max(0, Math.min(2, idx));
      setActiveSection(prev => {
        if (prev !== clampedIdx) {
          clearTimeout(panelFadeRef.current);
          setPanelFading(true);
          panelFadeRef.current = setTimeout(() => setPanelFading(false), 220);
        }
        return clampedIdx;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(panelFadeRef.current);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn && !showRegister && !showForgotPwd) {
      const roles = ['Student', 'Doctor', 'Lab Assistant'];
      setRole(roles[activeSection]);
    }
  }, [activeSection, isLoggedIn, showRegister, showForgotPwd]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setRole('Student');
    setActiveSection(0);
    localStorage.removeItem('auth_loggedIn');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_username');
    localStorage.removeItem('doctor_last_search');
    localStorage.removeItem('lab_last_search');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    let endpoint = '';
    if (role === 'Student') endpoint = `/student/${username}/login`;
    else if (role === 'Doctor') endpoint = `/doctors/${username}/login`;
    else if (role === 'Lab Assistant') endpoint = `/labassistant/${username}/login`;

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        setIsLoggedIn(true);
        localStorage.setItem('auth_loggedIn', 'true');
        localStorage.setItem('auth_role', role);
        localStorage.setItem('auth_username', username);
      } else {
        setLoginError(data.error || 'Incorrect password or credentials.');
      }
    } catch {
      setLoginError('Network error. Is the local backend running?');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifyIndex = async (e) => {
    e.preventDefault();
    setForgotError('');
    setIsVerifyingForgot(true);
    try {
      const res = await fetch(`${API_BASE_URL}/student/${forgotIndex}`);
      if (res.ok) {
        const data = await res.json();
        setRegisteredEmail(data.email);
        setForgotStep(2);
      } else {
        setForgotError('Student record not found. Please register first.');
      }
    } catch {
      setForgotError('Network error connecting to the server.');
    } finally {
      setIsVerifyingForgot(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotMsg('Connecting to UniMed mail server...');
    setForgotError('');

    if (registeredEmail && forgotEmail.trim().toLowerCase() !== registeredEmail.trim().toLowerCase()) {
      setForgotError('Security Error: This email does not match the registered university email for this Index Number.');
      setForgotMsg('');
      return;
    }

    setIsVerifyingForgot(true);
    try {
      const res = await fetch(`${API_BASE_URL}/student/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: forgotIndex, email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotMsg(`Code sent to ${forgotEmail}. Please check your inbox.`);
        setForgotStep(3); // Move to OTP input step
      } else {
        setForgotError(data.error || 'Failed to send email.');
      }
    } catch {
      setForgotError('Network error: Could not reach the backend server.');
    } finally {
      setIsVerifyingForgot(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    // Validation Check
    if (newPassword !== confirmNewPassword) {
      setForgotError("Passwords do not match. Please re-type them.");
      return;
    }

    setForgotMsg('Updating your password...');
    setForgotError('');

    try {
      const res = await fetch(`${API_BASE_URL}/student/reset-password-with-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          indexNumber: forgotIndex,
          otp: otpCode,
          newPassword: newPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        setForgotMsg('Password reset successful!');
        setTimeout(() => {
          setShowForgotPwd(false);
          setForgotStep(1);
          setForgotMsg('');
          setOtpCode('');
          setNewPassword('');
          setConfirmNewPassword(''); // Reset new field
        }, 5000);
      } else {
        setForgotError(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      setForgotError('Network error: Could not reach the backend.');
    }
  };

  if (!isLoggedIn) {
    const sectionRefs = [section0Ref, section1Ref, section2Ref];
    const roleLabels = ['🎓 Student', '🩺 Doctor', '🔬 Lab Assistant'];
    const formPanel = (
      <div className={`landing-form-float landing-pos-${activeSection}${panelFading ? ' panel-fading' : ''}`}>
        <div className="glass-panel login-panel">
          <div className="login-header">
            <img src="/University_of_Moratuwa_logo.png" alt="UOM" className="uom-logo" />
            <h2 className="logo-text" style={{ fontSize: '2rem' }}>UniMed<span className="logo-dot">.</span></h2>
            <p className="login-subtext">
              {showRegister
                ? (regStep === 1 ? 'Verify your university email'
                  : regStep === 2 ? 'Check your inbox for the code'
                    : 'Almost done — set your password')
                : showForgotPwd ? 'Reset your password'
                  : 'Sign in to your portal'}
            </p>
          </div>

          {showRegister ? (
            <>
              {/* 3-step progress indicator */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px', marginTop: '-4px' }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{
                    width: s === regStep ? '28px' : '8px',
                    height: '8px',
                    borderRadius: '4px',
                    background: s <= regStep ? 'var(--blue)' : 'var(--border)',
                    transition: 'all 0.35s ease',
                    opacity: s < regStep ? 0.45 : 1
                  }} />
                ))}
              </div>

              {/* STEP 1: Index + Email */}
              {regStep === 1 && (
                <form onSubmit={handleRegSendOtp} className="login-form fade-in">
                  <div className="input-group slide-top">
                    <label>Index Number</label>
                    <input
                      type="text"
                      value={regIndex}
                      onChange={(e) => { setRegIndex(e.target.value); if (regError) setRegError(''); }}
                      placeholder="e.g. 220001V"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="input-group slide-top">
                    <label>University Email <span style={{ fontSize: '0.75rem', color: 'var(--t5)', fontWeight: 400 }}>(@uom.lk only)</span></label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => { setRegEmail(e.target.value); if (regError) setRegError(''); }}
                      placeholder="e.g. name.24@uom.lk"
                      required
                    />
                  </div>
                  {regError && <p className="error-text bounce-in">{regError}</p>}
                  <button type="submit" className="btn-primary login-submit-btn" disabled={isRegLoading}>
                    {isRegLoading ? 'Sending Code...' : <>Send Verification Code <span className="arrow">→</span></>}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setShowRegister(false); resetRegForm(); }} style={{ color: 'var(--blue)', fontSize: '0.86rem', textDecoration: 'none', fontWeight: '600' }}>
                      ← Back to Login
                    </a>
                  </div>
                </form>
              )}

              {/* STEP 2: OTP Verification */}
              {regStep === 2 && (
                <form onSubmit={handleRegVerifyOtp} className="login-form fade-in">
                  <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                    <div style={{ fontSize: '2.4rem', marginBottom: '6px' }}>📬</div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--t5)', lineHeight: 1.55 }}>
                      A 6-digit code was sent to<br />
                      <strong style={{ color: 'var(--t1)' }}>{regEmail}</strong>
                    </p>
                  </div>
                  <div className="input-group slide-top">
                    <label>Verification Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength="6"
                      value={regOtp}
                      onChange={(e) => { setRegOtp(e.target.value.replace(/\D/g, '')); if (regError) setRegError(''); }}
                      placeholder="Enter 6-digit code"
                      required
                      autoFocus
                      style={{ letterSpacing: '0.22em', fontSize: '1.3rem', textAlign: 'center', fontWeight: '700' }}
                    />
                  </div>
                  {regMsg && <p className="success-text bounce-in" style={{ color: 'var(--success)', background: 'var(--success-light)', padding: '10px', borderRadius: '8px', fontSize: '0.83rem', textAlign: 'center', marginBottom: '14px', fontWeight: '600', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{regMsg}</p>}
                  {regError && <p className="error-text bounce-in">{regError}</p>}
                  <button type="submit" className="btn-primary login-submit-btn">
                    Verify Code <span className="arrow">→</span>
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setRegError(''); setRegMsg(''); handleRegSendOtp({ preventDefault: () => { } }); }} style={{ color: 'var(--t5)', fontSize: '0.82rem', textDecoration: 'none', fontWeight: '500' }}>
                      Didn't receive? Resend code
                    </a>
                    <a href="#" onClick={(e) => { e.preventDefault(); setRegStep(1); setRegOtp(''); setRegError(''); setRegMsg(''); }} style={{ color: 'var(--blue)', fontSize: '0.82rem', textDecoration: 'none', fontWeight: '600' }}>
                      ← Change Email
                    </a>
                  </div>
                </form>
              )}

              {/* STEP 3: Set Password */}
              {regStep === 3 && (
                <form onSubmit={handleFinalRegistration} className="login-form fade-in">
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '4px' }}>🔐</div>
                    <p style={{ fontSize: '0.84rem', color: 'var(--t5)', lineHeight: 1.5 }}>
                      Email verified! Set a password for your account.
                    </p>
                  </div>
                  <div className="input-group slide-top">
                    <label>Password</label>
                    <div className="pwd-input-wrap">
                      <input type={showRegPwd ? 'text' : 'password'} value={regPassword} onChange={(e) => { setRegPassword(e.target.value); if (regError) setRegError(''); }} placeholder="At least 6 characters" required />
                      <button type="button" className="pwd-eye-btn" onClick={() => setShowRegPwd(!showRegPwd)} tabIndex={-1}>{showRegPwd ? <EyeOff /> : <EyeOpen />}</button>
                    </div>
                  </div>
                  <div className="input-group slide-top">
                    <label>Confirm Password</label>
                    <div className="pwd-input-wrap">
                      <input type={showRegConfirmPwd ? 'text' : 'password'} value={regConfirmPassword} onChange={(e) => { setRegConfirmPassword(e.target.value); if (regError) setRegError(''); }} placeholder="Type password again" required />
                      <button type="button" className="pwd-eye-btn" onClick={() => setShowRegConfirmPwd(!showRegConfirmPwd)} tabIndex={-1}>{showRegConfirmPwd ? <EyeOff /> : <EyeOpen />}</button>
                    </div>
                  </div>
                  {regError && <p className="error-text bounce-in">{regError}</p>}
                  {regMsg && <p className="success-text bounce-in" style={{ color: 'var(--success)', background: 'var(--success-light)', padding: '10px', borderRadius: '8px', fontSize: '0.86rem', textAlign: 'center', marginBottom: '16px', fontWeight: '600', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{regMsg}</p>}
                  <button type="submit" className="btn-primary login-submit-btn" disabled={isRegLoading}>
                    {isRegLoading ? 'Creating Account...' : <>Create Account <span className="arrow">→</span></>}
                  </button>
                </form>
              )}
            </>
          ) : showForgotPwd ? (
            <form onSubmit={forgotStep === 1 ? handleVerifyIndex : forgotStep === 2 ? handleForgotSubmit : handleResetPassword} className="login-form fade-in">
              {forgotStep === 1 && (
                <div className="input-group slide-top">
                  <label>Enter Student Index Number</label>
                  <input type="text" value={forgotIndex} onChange={(e) => setForgotIndex(e.target.value)} placeholder="e.g. 240000R" required />
                </div>
              )}
              {forgotStep === 2 && (
                <div className="input-group slide-top">
                  <label>Enter University Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      if (forgotError) setForgotError('');
                    }}
                    placeholder="e.g. name.24@uom.lk"
                    required
                  />
                </div>
              )}
              {forgotStep === 3 && (
                <div className="slide-top">
                  <div className="input-group">
                    <label>Enter 6-Digit Code</label>
                    <input type="text" maxLength="6" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="000000" required />
                  </div>
                  <div className="input-group">
                    <label>New Password</label>
                    <div className="pwd-input-wrap">
                      <input type={showNewPwd ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" required />
                      <button type="button" className="pwd-eye-btn" onClick={() => setShowNewPwd(!showNewPwd)} tabIndex={-1}>{showNewPwd ? <EyeOff /> : <EyeOpen />}</button>
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Confirm New Password</label>
                    <div className="pwd-input-wrap">
                      <input type={showConfirmPwd ? 'text' : 'password'} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Type password again" required />
                      <button type="button" className="pwd-eye-btn" onClick={() => setShowConfirmPwd(!showConfirmPwd)} tabIndex={-1}>{showConfirmPwd ? <EyeOff /> : <EyeOpen />}</button>
                    </div>
                  </div>
                </div>
              )}
              {forgotError && <p className="error-text bounce-in">{forgotError}</p>}
              {forgotMsg && <p className="success-text bounce-in" style={{ color: 'var(--success)', background: 'var(--success-light)', padding: '10px', borderRadius: '8px', fontSize: '0.86rem', textAlign: 'center', marginBottom: '16px', fontWeight: '600', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{forgotMsg}</p>}
              <button type="submit" className="btn-primary login-submit-btn" disabled={isVerifyingForgot}>
                {forgotStep === 1 ? (isVerifyingForgot ? 'Checking...' : 'Verify Student') : forgotStep === 2 ? 'Send Code' : 'Reset Password'} <span className="arrow">→</span>
              </button>
              <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {forgotStep === 2 && (
                  <a href="#" onClick={(e) => { e.preventDefault(); setForgotStep(1); setForgotError(''); }} style={{ color: 'var(--t5)', fontSize: '0.86rem', textDecoration: 'none', fontWeight: '500' }}>
                    ← Change Index Number
                  </a>
                )}
                <a href="#" onClick={(e) => { e.preventDefault(); setShowForgotPwd(false); setForgotStep(1); setForgotIndex(''); setForgotEmail(''); setForgotError(''); setForgotMsg(''); }} style={{ color: 'var(--blue)', fontSize: '0.86rem', textDecoration: 'none', fontWeight: '600' }}>
                  ← Back to Login
                </a>
              </div>
            </form>
          ) : (
            <>
              <div className="landing-role-pill">
                <span className={`landing-role-badge lrb-${activeSection}`}>{roleLabels[activeSection]}</span>
                <span className="landing-role-scroll-hint">scroll to switch portal</span>
              </div>
              <form onSubmit={handleLogin} className="login-form">
                <div className="input-group">
                  <label>{role === 'Student' ? 'Index Number' : `${role} ID`}</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={`e.g. ${role === 'Student' ? '220001V' : 'M-1234'}`} required />
                </div>
                <div className="input-group">
                  <label>Password</label>
                  <div className="pwd-input-wrap">
                    <input type={showLoginPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                    <button type="button" className="pwd-eye-btn" onClick={() => setShowLoginPwd(v => !v)} tabIndex={-1}>{showLoginPwd ? <EyeOff /> : <EyeOpen />}</button>
                  </div>
                </div>
                {loginError && <p className="error-text bounce-in">{loginError}</p>}
                {role === 'Student' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', marginTop: '-6px' }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setShowRegister(true); }} style={{ color: 'var(--blue)', fontSize: '0.82rem', textDecoration: 'none', fontWeight: '600' }}>New Student? Sign up</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); setShowForgotPwd(true); }} style={{ color: 'var(--blue)', fontSize: '0.82rem', textDecoration: 'none', fontWeight: '600' }}>Forgot password?</a>
                  </div>
                )}
                <button type="submit" className="btn-primary login-submit-btn" disabled={isLoggingIn}>
                  {isLoggingIn ? 'Verifying...' : <>Access Portal <span className="arrow">→</span></>}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );

    return (
      <div className="landing-root">
        <Toast message={toastMessage} show={showToast} />
        <button className="login-theme-btn landing-theme-toggle" onClick={() => setDarkMode(v => !v)}>
          {darkMode ? <SunIcon size={19} /> : <MoonIcon size={19} />}
        </button>

        {/* Side navigation dots */}
        <nav className="landing-nav-dots">
          {[0, 1, 2].map(i => (
            <button
              key={i}
              className={`landing-dot${activeSection === i ? ' active' : ''}`}
              onClick={() => sectionRefs[i].current?.scrollIntoView({ behavior: 'smooth' })}
              aria-label={['Student Portal', 'Doctor Portal', 'Lab Portal'][i]}
            />
          ))}
        </nav>

        {/* Floating login panel — slides left/right via CSS */}
        {formPanel}

        {/* Scroll-snap container */}
        <div className="landing-sections-container" ref={scrollContainerRef}>

          {/* ── SECTION 0: Student ── form LEFT  hero RIGHT */}
          <div className="landing-section-item ls-student" ref={section0Ref} data-section-idx="0">
            <div className="ls-col ls-form-col" />
            <div className="ls-col ls-hero-col">
              <div className="ls-hero-content">
                <div className="hero-badge">🏥 University of Moratuwa</div>
                <h1 className="hero-title" style={{ WebkitTextFillColor: 'unset' }}>
                  <span style={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 45%, #1d4ed8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    display: 'inline'
                  }}>UniMed</span><span className="logo-dot" style={{ WebkitTextFillColor: 'var(--blue)' }}>.</span>
                </h1>
                <p className="hero-sub">The all-in-one digital health platform for the University Medical Center</p>
                <div className="hero-features">
                  <div className="hero-feat"><span className="feat-icon" style={{ fontSize: '1.6rem' }}>🩺</span><div><div className="feat-title">Doctor Consultations</div><div className="feat-desc">Record diagnoses with voice input</div></div></div>
                  <div className="hero-feat"><span className="feat-icon" style={{ fontSize: '1.6rem' }}>🧪</span><div><div className="feat-title">Lab Reports</div><div className="feat-desc">Direct upload to student records</div></div></div>
                  <div className="hero-feat"><span className="feat-icon" style={{ fontSize: '1.6rem' }}>📋</span><div><div className="feat-title">Student Health Profiles</div><div className="feat-desc">Comprehensive medical history</div></div></div>
                </div>
                <div className="ls-scroll-hint">↓ Scroll down to explore portals</div>
              </div>
            </div>
          </div>

          {/* ── SECTION 1: Doctor ── hero LEFT  form RIGHT */}
          <div className="landing-section-item ls-doctor" ref={section1Ref} data-section-idx="1">
            <div className="ls-col ls-hero-col">
              <div className="ls-hero-content ls-icon-hero">
                <div className="ls-portal-icon"><StethoscopeIcon size={150} /></div>
                <h2 className="ls-portal-name">Doctor Portal</h2>
                <p className="ls-portal-tagline">Manage patient records, approve student health profiles, and record clinical diagnoses.</p>
              </div>
            </div>
            <div className="ls-col ls-form-col" />
          </div>

          {/* ── SECTION 2: Lab ── form LEFT  hero RIGHT */}
          <div className="landing-section-item ls-lab" ref={section2Ref} data-section-idx="2">
            <div className="ls-col ls-form-col" />
            <div className="ls-col ls-hero-col">
              <div className="ls-hero-content ls-icon-hero">
                <div className="ls-portal-icon"><LabFlaskIcon size={150} /></div>
                <h2 className="ls-portal-name">Lab Portal</h2>
                <p className="ls-portal-tagline">Upload lab reports, register student records, and manage clinical test results.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Toast message={toastMessage} show={showToast} />
      <ConfirmModal show={showConfirmModal} config={confirmConfig} onCancel={handleCancelConfirm} onConfirm={handleConfirmAction} />
      {role === 'Doctor' && <DoctorPortal username={username} handleLogout={handleLogout} showAlert={showAlert} showConfirm={showConfirm} />}
      {role === 'Student' && <StudentPortal indexNumber={username} handleLogout={handleLogout} showAlert={showAlert} showConfirm={showConfirm} />}
      {role === 'Lab Assistant' && <LabPortal username={username} handleLogout={handleLogout} showAlert={showAlert} showConfirm={showConfirm} />}
    </div>
  );
}

/* =========================================
   STUDENT PORTAL
   ========================================= */
function StudentPortal({ indexNumber, handleLogout, showAlert, showConfirm }) {
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [step, setStep] = useState(1);
  const [activeView, setActiveView] = useState('dashboard');
  const [studentTab, setStudentTab] = useState('consultations');
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem(`photo_${indexNumber}`) || null);
  const photoInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showAlert('Image must be under 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfilePhoto(ev.target.result);
      localStorage.setItem(`photo_${indexNumber}`, ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const [nic, setNic] = useState('');
  const [faculty, setFaculty] = useState('');
  const [telNo, setTelNo] = useState('');
  const [dob, setDob] = useState(''); // Store as dd/mm/yyyy visually
  const [sex, setSex] = useState('');
  const [religion, setReligion] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [nationality, setNationality] = useState('');
  const [lastSchool, setLastSchool] = useState('');
  const [siblings, setSiblings] = useState('');
  const [fatherOcc, setFatherOcc] = useState('');
  const [motherOcc, setMotherOcc] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [extracurricular, setExtracurricular] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergAddress, setEmergAddress] = useState('');
  const [emergTel, setEmergTel] = useState('');
  const [emergRel, setEmergRel] = useState('');
  const [famFather, setFamFather] = useState('');
  const [famMother, setFamMother] = useState('');
  const [famBrothers, setFamBrothers] = useState('');
  const [famSisters, setFamSisters] = useState('');
  const [famOther, setFamOther] = useState('');
  const [hist01, setHist01] = useState('');
  const [hist02, setHist02] = useState('');
  const [hist03, setHist03] = useState('');
  const [hist04, setHist04] = useState('');
  const [hist05, setHist05] = useState('');
  const [hist06, setHist06] = useState('');
  const [hist07, setHist07] = useState('');
  const [hist08, setHist08] = useState('');
  const [hist09, setHist09] = useState('');
  const [hist10, setHist10] = useState('');
  const [menstrual, setMenstrual] = useState('');
  const [disability, setDisability] = useState('');
  const [vacBCC, setVacBCC] = useState('');
  const [vacDPT, setVacDPT] = useState('');
  const [vacMMR, setVacMMR] = useState('');
  const [vacRubella, setVacRubella] = useState('');
  const [vacHepB, setVacHepB] = useState('');
  const [vacChicken, setVacChicken] = useState('');
  const [medicalReportFile, setMedicalReportFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleMedicalReportChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setMedicalReportFile(null);
      return;
    }
    if (file.type !== 'application/pdf') {
      showAlert("Only PDF documents are allowed.");
      e.target.value = null; // reset
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showAlert("File is too large! Please select a file under 10MB.");
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setMedicalReportFile(event.target.result); // Base64
    };
    reader.readAsDataURL(file);
  };

  const fetchStudentData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/student/${indexNumber}`);
      if (res.ok) {
        const data = await res.json();
        const profStatus = getProfileStatus(data.medicalRecords);
        if (profStatus.record) {
          const match = profStatus.record.diagnosis.match(/Full Name: (.*?)(?=\n|$)/);
          if (match && match[1].trim() && match[1].trim() !== 'None' && match[1].trim() !== 'N/A') {
            data.name = match[1].trim();
          }
        }
        setStudentData(data);
        setIsFirstTime(false);
      }
      else { setIsFirstTime(true); }
    } catch (err) {
      console.error(err);
      setIsFirstTime(true); // Prevent blank crash when fetch throws (e.g., from CORS)
    }
    finally { setLoading(false); }
  }, [indexNumber]);

  useEffect(() => { fetchStudentData(); }, [fetchStudentData]);

  const populateFormWithPastHistory = () => {
    const profStatus = getProfileStatus(studentData?.medicalRecords);
    if (!profStatus.record) return;
    const latestHistory = profStatus.record.diagnosis;

    const extractVal = (prefix) => {
      const regex = new RegExp(`${prefix}: (.*?)(?=\\n|$)`);
      const match = latestHistory.match(regex);
      let val = match ? match[1].trim() : '';
      if (val === 'None' || val === 'N/A' || val === 'Not recorded') return '';
      return val;
    };

    setFullName(studentData.name);
    setNic(extractVal('NIC No'));
    setFaculty(extractVal('Faculty'));
    setTelNo(extractVal('Student Tel'));
    let parsedDob = extractVal('Date of Birth');
    if (parsedDob && parsedDob.includes('/')) {
      const parts = parsedDob.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        parsedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    setDob(parsedDob);
    setSex(extractVal('Sex'));
    setReligion(extractVal('Religion'));
    setMaritalStatus(extractVal('Marital Status') || 'Single');
    setNationality(extractVal('Nationality'));
    setLastSchool(extractVal('Last School'));
    setSiblings(extractVal('Siblings'));
    setFatherOcc(extractVal("Father's Occupation"));
    setMotherOcc(extractVal("Mother's Occupation"));
    setHomeAddress(extractVal('Home Address'));
    setExtracurricular(extractVal('Extracurricular'));

    setEmergName(extractVal('Name'));
    setEmergAddress(extractVal('Address'));
    setEmergTel(extractVal('Telephone'));
    setEmergRel(extractVal('Relationship'));

    setFamFather(extractVal('Father'));
    setFamMother(extractVal('Mother'));
    setFamBrothers(extractVal('Brothers/Sisters'));
    setFamOther(extractVal('Other'));

    setHist01(extractVal('01\\. Infectious Diseases'));
    setHist02(extractVal('02\\. Worm Infestation'));
    setHist03(extractVal('03\\. Respiratory'));
    setHist04(extractVal('04\\. Circulatory'));
    setHist05(extractVal('05\\. E\\.N\\.T\\.'));
    setHist06(extractVal('06\\. Eye'));
    setHist07(extractVal('07\\. Nervous System'));
    setHist08(extractVal('08\\. Surgical'));
    setHist09(extractVal('09\\. Miscellaneous'));
    setHist10(extractVal('10\\. Allergic History'));

    setMenstrual(extractVal('Menstrual History'));
    setDisability(extractVal('Disability'));

    setVacBCC(extractVal('BCC'));
    setVacDPT(extractVal('DPT'));
    setVacMMR(extractVal('MR/MMR'));
    setVacRubella(extractVal('Rubella'));
    setVacHepB(extractVal('Hepatitis B'));
    setVacChicken(extractVal('Chickenpox'));
  };

  const handleSubmitMedicalForm = async () => {
    if (!medicalReportFile) {
      showAlert("Please upload your signed physical medical report (PDF) to complete your profile.");
      return;
    }
    setSubmitting(true);
    try {
      if (isFirstTime || fullName !== studentData?.name) {
        await fetch(`${API_BASE_URL}/student`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ indexNumber, name: fullName })
        });
      }
      const nameToUse = fullName || studentData?.name;
      const profileRecord = `[PAST HISTORY]
=== PERSONAL INFORMATION ===
Full Name: ${nameToUse}
NIC No: ${nic}
Faculty: ${faculty}
Student Tel: ${telNo}
Date of Birth: ${dob}
Sex: ${sex}
Religion: ${religion}
Marital Status: ${maritalStatus}
Nationality: ${nationality}
Last School: ${lastSchool}
Siblings: ${siblings}
Father's Occupation: ${fatherOcc}
Mother's Occupation: ${motherOcc}
Home Address: ${homeAddress}
Extracurricular: ${extracurricular}
=== EMERGENCY CONTACT ===
Name: ${emergName}
Address: ${emergAddress}
Telephone: ${emergTel}
Relationship: ${emergRel}
=== FAMILY MEDICAL HISTORY ===
Father: ${famFather || 'None'}
Mother: ${famMother || 'None'}
Brothers/Sisters: ${famBrothers || famSisters || 'None'}
Other: ${famOther || 'None'}
=== STUDENT MEDICAL HISTORY ===
01. Infectious Diseases: ${hist01 || 'None'}
02. Worm Infestation: ${hist02 || 'None'}
03. Respiratory: ${hist03 || 'None'}
04. Circulatory: ${hist04 || 'None'}
05. E.N.T.: ${hist05 || 'None'}
06. Eye: ${hist06 || 'None'}
07. Nervous System: ${hist07 || 'None'}
08. Surgical: ${hist08 || 'None'}
09. Miscellaneous: ${hist09 || 'None'}
10. Allergic History: ${hist10 || 'None'}
Menstrual History: ${menstrual || 'N/A'}
Disability: ${disability || 'None'}
=== IMMUNISATION ===
BCC: ${vacBCC || 'Not recorded'}
DPT: ${vacDPT || 'Not recorded'}
MR/MMR: ${vacMMR || 'Not recorded'}
Rubella: ${vacRubella || 'Not recorded'}
Hepatitis B: ${vacHepB || 'Not recorded'}
Chickenpox: ${vacChicken || 'Not recorded'}
Approval Status: Pending`;

      const finalProfileRecord = medicalReportFile
        ? profileRecord + `\n[FILE_ATTACHMENT:${indexNumber}_Medical_Report.pdf]\n${medicalReportFile}`
        : profileRecord;

      await fetch(`${API_BASE_URL}/student/${indexNumber}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis: finalProfileRecord, prescription: 'N/A' })
      });
      await fetchStudentData();
      setShowMedForm(false);
      showAlert("Profile Submitted Successfully!");
    } catch { showAlert('Submission failed. Please try again.'); }
    finally { setSubmitting(false); }
  };

  // handleDobChange has been removed in favor of native date input

  if (loading) return <Loader />;

  const renderMedicalForm = (isIncomplete) => {
    const stepTitles = ['Personal Info', 'Family History', 'Medical History', 'Immunisation', 'Submit Report'];
    const stepIcons = ['👤', '👨‍👩‍👧', '🩺', '💉', '📄'];
    return (
      <div className="setup-screen fade-in">
        <div className="setup-card-wide">
          <div className="setup-top-header">
            <div style={{ textAlign: 'center' }}>
              <h2 className="logo-text" style={{ fontSize: '1.9rem' }}>UniMed<span className="logo-dot">.</span></h2>
              <p className="setup-subtitle">
                {isIncomplete ? `Complete your medical profile — ${studentData?.name || indexNumber}` : 'University of Moratuwa — Student Medical Examination'}
              </p>
            </div>
            {isIncomplete ? (
              <button className="btn-outline-danger" onClick={() => setShowMedForm(false)}>
                ← Back to Dashboard
              </button>
            ) : isFirstTime ? (
              <button className="btn-outline-secondary" onClick={() => handleLogout()}>
                ← Back
              </button>
            ) : (
              <button className="btn-outline-secondary" onClick={() => setShowMedForm(false)}>
                ← Back to Dashboard
              </button>
            )}
          </div>

          {isIncomplete && (
            <div className="incomplete-form-alert">
              <span>⚠️</span>
              <span>Your profile was registered by the lab but is <strong>incomplete</strong>. Please fill in all sections to complete your medical record.</span>
            </div>
          )}

          <div className="setup-steps">
            {stepTitles.map((title, i) => (
              <div key={i} className={`setup-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
                <div className="step-circle">{step > i + 1 ? '✓' : stepIcons[i]}</div>
                <div className="step-label">{title}</div>
              </div>
            ))}
          </div>
          <div className="setup-progress-bar">
            <div className="setup-progress-fill" style={{ width: `${((step - 1) / 4) * 100}%` }}></div>
          </div>

          {step === 1 && (
            <div className="setup-section slide-top">
              <h3 className="section-heading">Part 1 — Personal Information</h3>
              <p className="section-note">Please fill with block letters. This information is strictly confidential.</p>
              <div className="input-group">
                <label>Full Name *</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Kavindu Perera" required />
              </div>
              <div className="form-grid-2">
                <div className="input-group"><label>NIC Number *</label><input type="text" value={nic} onChange={e => setNic(e.target.value)} placeholder="e.g. 200012345678" /></div>
                <div className="input-group">
                  <label>Faculty *</label>
                  <select value={faculty} onChange={e => setFaculty(e.target.value)} className="form-select">
                    <option value="">Select Faculty...</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Business">Business</option>
                    <option value="Medicine">Medicine</option>
                    <option value="Graduate Studies">Graduate Studies</option>
                  </select>
                </div>
                <div className="input-group"><label>Student Tel No</label><input type="text" value={telNo} onChange={e => setTelNo(e.target.value)} placeholder="e.g. 0771234567" /></div>
                <div className="input-group">
                  <label>Date of Birth *</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>Sex *</label>
                  <select value={sex} onChange={e => setSex(e.target.value)} className="form-select">
                    <option value="">Select...</option><option>Male</option><option>Female</option>
                  </select>
                </div>
                <div className="input-group"><label>Religion</label><input type="text" value={religion} onChange={e => setReligion(e.target.value)} placeholder="e.g. Buddhist" /></div>
                <div className="input-group">
                  <label>Marital Status</label>
                  <select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)} className="form-select">
                    <option>Single</option><option>Married</option>
                  </select>
                </div>
                <div className="input-group"><label>Nationality</label><input type="text" value={nationality} onChange={e => setNationality(e.target.value)} placeholder="e.g. Sri Lankan" /></div>
                <div className="input-group"><label>Last School Attended</label><input type="text" value={lastSchool} onChange={e => setLastSchool(e.target.value)} placeholder="School name" /></div>
                <div className="input-group"><label>Number of Siblings</label><input type="number" min="0" value={siblings} onChange={e => setSiblings(e.target.value)} placeholder="e.g. 2" /></div>
                <div className="input-group"><label>Father's Occupation</label><input type="text" value={fatherOcc} onChange={e => setFatherOcc(e.target.value)} placeholder="e.g. Engineer" /></div>
                <div className="input-group"><label>Mother's Occupation</label><input type="text" value={motherOcc} onChange={e => setMotherOcc(e.target.value)} placeholder="e.g. Teacher" /></div>
              </div>
              <div className="input-group"><label>Home Address, District, Telephone</label><textarea rows="2" value={homeAddress} onChange={e => setHomeAddress(e.target.value)} placeholder="Full address, district and telephone..." /></div>

              <h3 className="section-heading" style={{ marginTop: 24 }}>Emergency Contact</h3>
              <div className="form-grid-2">
                <div className="input-group"><label>Contact Name</label><input type="text" value={emergName} onChange={e => setEmergName(e.target.value)} placeholder="Full name" /></div>
                <div className="input-group"><label>Relationship</label><input type="text" value={emergRel} onChange={e => setEmergRel(e.target.value)} placeholder="e.g. Parent" /></div>
                <div className="input-group"><label>Telephone No</label><input type="text" value={emergTel} onChange={e => setEmergTel(e.target.value)} placeholder="e.g. 0771234567" /></div>
                <div className="input-group"><label>Address</label><input type="text" value={emergAddress} onChange={e => setEmergAddress(e.target.value)} placeholder="Contact address" /></div>
              </div>
              <div className="setup-nav-row">
                <div />
                <button className="btn-primary" style={{ width: 'auto', padding: '12px 32px' }}
                  onClick={() => {
                    const needName = isFirstTime && !fullName.trim();
                    if (needName || !nic.trim() || !faculty.trim() || !dob || !sex) { showAlert('Please fill all required fields (*)'); return; }

                    if (!/^\d{12}$/.test(nic)) { showAlert('NIC Number must be exactly 12 digits'); return; }
                    if (telNo && !/^0\d{9}$/.test(telNo)) { showAlert('Student Tel No must be 10 digits starting with 0'); return; }
                    if (emergTel && !/^0\d{9}$/.test(emergTel)) { showAlert('Emergency Telephone must be 10 digits starting with 0'); return; }

                    setStep(2);
                  }}>
                  Next: Family History →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="setup-section slide-top">
              <h3 className="section-heading">Family Medical History</h3>
              <p className="section-note">Please indicate known conditions in your family. Leave blank if none.</p>
              <div className="family-table">
                <div className="family-table-header"><span>Member</span><span>Known Medical Conditions</span></div>
                {[['Father', famFather, setFamFather], ['Mother', famMother, setFamMother], ['Brothers', famBrothers, setFamBrothers], ['Sisters', famSisters, setFamSisters], ['Other', famOther, setFamOther]].map(([lbl, val, setter]) => (
                  <div className="family-table-row" key={lbl}>
                    <span className="family-member-label">{lbl}</span>
                    <input type="text" value={val} onChange={e => setter(e.target.value)} placeholder={`${lbl}'s conditions, or 'None'`} className="family-input" />
                  </div>
                ))}
              </div>
              <div className="setup-nav-row">
                <button className="btn-outline-secondary" onClick={() => setStep(1)}>← Back</button>
                <button className="btn-primary" style={{ width: 'auto', padding: '12px 32px' }} onClick={() => setStep(3)}>Next: Medical History →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="setup-section slide-top">
              <h3 className="section-heading">Student Medical History</h3>
              <p className="section-note">Have you suffered from any of the following? Describe or write "None".</p>
              <div className="medical-history-list">
                {[['01', 'Infectious Diseases', 'Mumps, Measles, Rubella, Chicken Pox, Hepatitis, Other', hist01, setHist01],
                ['02', 'Worm Infestation', 'Round Worm, Hook Worm, Thread Worm, Tape Worm, Filaria, Other', hist02, setHist02],
                ['03', 'Respiratory', 'Frequent Colds, Hay Fever, Asthma, Pneumonia, T.B., Other', hist03, setHist03],
                ['04', 'Circulatory', 'Heart Disease, Blood Pressure', hist04, setHist04],
                ['05', 'E.N.T.', 'Ear Infections, Sinusitis, Tonsillitis, Other', hist05, setHist05],
                ['06', 'Eye', 'Short Sight, Long Sight, Infections, Injuries, Other', hist06, setHist06],
                ['07', 'Nervous System', 'Epilepsy, Migraine, Other', hist07, setHist07],
                ['08', 'Surgical', 'Fractures, Injuries, Operations', hist08, setHist08],
                ['09', 'Miscellaneous', 'Anaemia, Diabetes, Skin Disorders, Kidney Disease, Depression, Other', hist09, setHist09],
                ['10', 'Allergic History', 'Drugs / Food allergies', hist10, setHist10],
                ].map(([num, title, hint, val, setter]) => (
                  <div className="med-hist-row" key={num}>
                    <div className="med-hist-num">{num}</div>
                    <div className="med-hist-content">
                      <div className="med-hist-title">{title}</div>
                      <div className="med-hist-hint">{hint}</div>
                      <input type="text" value={val} onChange={e => setter(e.target.value)} placeholder="Describe or write 'None'" className="med-hist-input" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="form-grid-2" style={{ marginTop: 20 }}>
                <div className="input-group"><label>Menstrual History (Female only)</label><input type="text" value={menstrual} onChange={e => setMenstrual(e.target.value)} placeholder="Regular/Irregular, Flow, Pain: Yes/No" /></div>
                <div className="input-group"><label>Disability (if any)</label><input type="text" value={disability} onChange={e => setDisability(e.target.value)} placeholder="Describe or 'None'" /></div>
              </div>
              <div className="setup-nav-row">
                <button className="btn-outline-secondary" onClick={() => setStep(2)}>← Back</button>
                <button className="btn-primary" style={{ width: 'auto', padding: '12px 32px' }} onClick={() => setStep(4)}>Next: Immunisation →</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="setup-section slide-top">
              <h3 className="section-heading">Immunisation Record</h3>
              <p className="section-note">Enter the date of each vaccination if known.</p>
              <div className="vaccine-table">
                <div className="vaccine-table-header"><span>Vaccination</span><span>Date Administered</span></div>
                {[['BCC', vacBCC, setVacBCC], ['DPT', vacDPT, setVacDPT], ['MR / MMR', vacMMR, setVacMMR], ['Rubella', vacRubella, setVacRubella], ['Hepatitis B', vacHepB, setVacHepB], ['Chickenpox', vacChicken, setVacChicken]].map(([lbl, val, setter]) => (
                  <div className="vaccine-row" key={lbl}>
                    <span className="vaccine-name">{lbl}</span>
                    <input type="date" value={val} onChange={e => setter(e.target.value)} className="vaccine-input" />
                  </div>
                ))}
              </div>
              <div className="certification-box">
                <p>I certify that the information furnished by me are true and correct.</p>
                <p style={{ marginTop: 6, color: 'var(--t5)', fontSize: '0.85rem' }}>Student ID: <strong>{indexNumber}</strong> — Date: <strong>{new Date().toLocaleDateString('en-GB')}</strong></p>
              </div>
              <div className="setup-nav-row">
                <button className="btn-outline-secondary" onClick={() => setStep(3)}>← Back</button>
                <button className="btn-primary" style={{ width: 'auto', padding: '12px 32px' }} onClick={() => setStep(5)}>Next: Submit Report →</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="setup-section slide-top">
              <h3 className="section-heading">Submit Medical Report</h3>
              <p className="section-note">Please upload a scanned PDF copy of your physical medical report signed by a senior doctor of a government hospital.</p>

              <div className="input-group file-upload-group" style={{ marginTop: 20 }}>
                <label>Upload Signed Medical Report (PDF Only)</label>
                <div className="file-drop-area" style={{ border: medicalReportFile ? '2px solid var(--green)' : '2px dashed var(--b3)' }}>
                  <span className="file-icon">📄</span>
                  <span className="file-msg" style={{ wordBreak: 'break-all' }}>
                    {medicalReportFile ? `${indexNumber}_Medical_Report.pdf (Attached)` : 'Click to select or drag and drop your PDF file'}
                  </span>
                  <input
                    type="file"
                    className="file-input-hidden"
                    onChange={handleMedicalReportChange}
                    accept=".pdf"
                  />
                </div>
                {medicalReportFile && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button className="btn-outline-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setMedicalReportFile(null)}>
                      Remove &amp; Re-upload
                    </button>
                  </div>
                )}
              </div>

              <div className="certification-box" style={{ marginTop: 30 }}>
                <p>I certify that the information furnished by me and the uploaded medical report are true, correct, and authentic.</p>
                <p style={{ marginTop: 6, color: 'var(--t5)', fontSize: '0.85rem' }}>Student ID: <strong>{indexNumber}</strong> — Date: <strong>{new Date().toLocaleDateString('en-GB')}</strong></p>
              </div>

              <div className="setup-nav-row">
                <button className="btn-outline-secondary" onClick={() => setStep(4)}>← Back</button>
                <button className="btn-primary" style={{ width: 'auto', padding: '12px 36px', opacity: submitting || !medicalReportFile ? 0.7 : 1 }} onClick={handleSubmitMedicalForm} disabled={submitting || !medicalReportFile}>
                  {submitting ? 'Submitting...' : '✓ Submit Profile & Report'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isFirstTime) return renderMedicalForm(false);

  const records = studentData.medicalRecords || [];
  const profStatus = getProfileStatus(records);
  const hasHistory = profStatus.status !== 'New' && profStatus.isComplete;
  const approvalStatus = profStatus.status; // New, Incomplete, Pending, Approved, Rejected

  // Extract rejection note if profile is rejected
  let rejectionNote = '';
  if (approvalStatus === 'Rejected' && profStatus.record) {
    const noteMatch = profStatus.record.diagnosis.match(/Rejection Note: (.*?)(?:\n|$)/);
    rejectionNote = noteMatch ? noteMatch[1].trim() : '';
  }

  const consultations = records.filter(r => !r.diagnosis?.includes('[LAB REPORT') && !isProfileRecord(r.diagnosis))
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  const labReports = records.filter(r => r.diagnosis?.includes('[LAB REPORT'))
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  if (showMedForm) return renderMedicalForm(!hasHistory);

  let statusPillClass = 'status-incomplete';
  let statusText = '⚠ Profile Incomplete';
  if (approvalStatus === 'Pending') { statusPillClass = 'status-pending'; statusText = '⏳ Review Pending'; }
  if (approvalStatus === 'Approved') { statusPillClass = 'status-active'; statusText = '● Profile Approved'; }
  if (approvalStatus === 'Rejected') { statusPillClass = 'status-rejected'; statusText = '❌ Profile Rejected'; }

  return (
    <div className="dash-layout fade-in">
      <Sidebar role="Student" name={studentData.name} onLogout={handleLogout} activeView={activeView} onNavigate={setActiveView} profilePhoto={profilePhoto} />
      {activeView === 'settings' ? (
        <SettingsPanel role="Student" />
      ) : (
        <div className="dash-main">
          <div className="topbar">
            <div>
              <h1 className="topbar-title">Welcome back, {studentData.name.split(' ')[0]} 👋</h1>
              <p className="topbar-sub">Your health dashboard — University Medical Center</p>
            </div>
            <span className={`status-pill ${statusPillClass}`}>
              {statusText}
            </span>
          </div>

          {!hasHistory && (
            <div className="incomplete-banner">
              <div className="incomplete-banner-left">
                <div className="incomplete-banner-icon">📋</div>
                <div>
                  <div className="incomplete-banner-title">Your medical profile is incomplete</div>
                  <div className="incomplete-banner-text">
                    Your account was created by the lab assistant but your full medical details or report have not been filled.
                    Please complete your profile so the medical team can assist you properly.
                  </div>
                </div>
              </div>
              <button className="btn-complete-profile" onClick={() => { populateFormWithPastHistory(); setStep(1); setShowMedForm(true); }}>
                Complete Profile →
              </button>
            </div>
          )}

          {approvalStatus === 'Rejected' && (
            <div className="incomplete-banner" style={{ background: 'var(--red-light)', border: '1px solid var(--red)' }}>
              <div className="incomplete-banner-left">
                <div className="incomplete-banner-icon">❌</div>
                <div>
                  <div className="incomplete-banner-title" style={{ color: '#7f1d1d' }}>Profile Rejected by Lab Assistant</div>
                  <div className="incomplete-banner-text" style={{ color: '#991b1b' }}>
                    {rejectionNote ? rejectionNote : 'There was a discrepancy with your medical report. Please review your details, re-upload the correct report, and submit again.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="stat-row doc-mini-stats">
            <div className="stat-card stat-blue"><div className="stat-icon">👤</div><div><div className="stat-num">{studentData.name.split(' ')[0]}</div><div className="stat-label">Student</div></div></div>
            <div className="stat-card stat-purple"><div className="stat-icon">🧪</div><div><div className="stat-num">{labReports.length}</div><div className="stat-label">Lab Reports</div></div></div>
            <div className="stat-card stat-amber"><div className="stat-icon">📋</div><div><div className="stat-num">{approvalStatus === 'Approved' ? 'Approved' : approvalStatus === 'Rejected' ? 'Rejected' : approvalStatus === 'Pending' ? 'Pending' : hasHistory ? 'Completed' : 'Pending'}</div><div className="stat-label">Profile Status</div></div></div>
          </div>

          <div className="content-grid">
            <div className="content-col-wide">
              <div className="doc-tab-bar" style={{ marginBottom: 20 }}>
                <button
                  className={`doc-tab-btn ${studentTab === 'consultations' ? 'active' : ''}`}
                  onClick={() => setStudentTab('consultations')}
                >
                  🩺 Consultations &amp; Prescriptions
                </button>
                <button
                  className={`doc-tab-btn ${studentTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setStudentTab('profile')}
                >
                  📋 Medical Profile Record
                </button>
              </div>

              {studentTab === 'consultations' ? (
                <div className="panel">
                  <div className="panel-header">
                    <h3 className="panel-title">Your Doctor Consultations</h3>
                    <span className="panel-count">{consultations.length}</span>
                  </div>
                  <div className="records-scroll">
                    {consultations.length > 0 ? (
                      consultations.map((rec, i) => <RecordItem key={i} record={rec} />)
                    ) : (
                      <div className="empty-state-box">
                        <div className="empty-big-icon">🩺</div>
                        <p>No doctor consultations recorded yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="panel">
                  <div className="panel-header">
                    <h3 className="panel-title">Your Medical Profile</h3>
                  </div>
                  <div className="records-scroll">
                    {profStatus.record ? (
                      <RecordItem record={profStatus.record} />
                    ) : (
                      <div className="empty-state-box"><div className="empty-big-icon">📋</div><p>No medical profile submitted yet.</p></div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="content-col-narrow">
              <div className="panel profile-panel">
                {/* Clickable avatar with pencil overlay */}
                <div className="profile-avatar-wrap" onClick={() => photoInputRef.current?.click()} title="Change photo">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="profile-avatar-photo" />
                  ) : (
                    <div className="profile-avatar-lg">{studentData.name.charAt(0)}</div>
                  )}
                  <div className="profile-avatar-edit-btn">✏</div>
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                <div className="profile-name">{studentData.name}</div>
                <div className="profile-id">Index: {studentData.indexNumber || indexNumber}</div>
                <div className="profile-badges">
                  <span className="mini-badge blue">Student</span>
                  <span className={`mini-badge ${approvalStatus === 'Rejected' ? 'red' : approvalStatus === 'Approved' ? 'green' : approvalStatus === 'Pending' ? 'yellow' : hasHistory ? 'green' : 'orange'}`}>{approvalStatus === 'Rejected' ? 'Rejected' : approvalStatus === 'Approved' ? 'Approved' : approvalStatus === 'Pending' ? 'Pending' : hasHistory ? 'Complete' : 'Incomplete'}</span>
                </div>
                {!hasHistory || approvalStatus === 'Rejected' ? (
                  <button className={approvalStatus === 'Rejected' ? 'btn-outline-danger' : 'btn-complete-profile-sm'} style={{ width: '100%', marginTop: '12px' }} onClick={() => { setFullName(studentData.name); populateFormWithPastHistory(); setStep(1); setShowMedForm(true); }}>
                    {hasHistory ? '✏️ Edit & Resubmit Profile' : '📋 Fill Medical Form'}
                  </button>
                ) : (
                  <button className="btn-outline-secondary" disabled style={{ width: '100%', marginTop: '12px', padding: '10px', opacity: 0.6, cursor: 'not-allowed' }}>
                    🔒 Profile {approvalStatus}
                  </button>
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3 className="panel-title">Recent Lab Reports</h3>
                  <span className="panel-count">{labReports.length}</span>
                </div>
                {labReports.length > 0 ? labReports.slice(0, 3).map((rec, i) => (
                  <div className="mini-record" key={i}>
                    <div className="mini-record-dot purple"></div>
                    <div>
                      <div className="mini-record-title">{rec.diagnosis.replace('[LAB REPORT: ', '').split(']')[0]}</div>
                      <div className="mini-record-date">{rec.timestamp ? new Date(rec.timestamp).toLocaleDateString() : '—'}</div>
                    </div>
                  </div>
                )) : <p className="empty-small">No lab reports yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Common Medicine Database ---- */
const MEDICINE_DB = [
  // Analgesics / Antipyretics
  'Paracetamol', 'Ibuprofen', 'Aspirin', 'Diclofenac', 'Naproxen', 'Mefenamic Acid', 'Ketorolac', 'Tramadol', 'Codeine', 'Morphine',
  // Antibiotics
  'Amoxicillin', 'Amoxicillin-Clavulanate', 'Ampicillin', 'Azithromycin', 'Ciprofloxacin', 'Clarithromycin', 'Clindamycin',
  'Doxycycline', 'Erythromycin', 'Metronidazole', 'Norfloxacin', 'Penicillin V', 'Tetracycline', 'Trimethoprim-Sulfamethoxazole',
  'Cephalexin', 'Cefuroxime', 'Ceftriaxone', 'Gentamicin', 'Vancomycin', 'Meropenem',
  // Antifungals
  'Clotrimazole', 'Fluconazole', 'Ketoconazole', 'Miconazole', 'Nystatin', 'Terbinafine',
  // Antivirals
  'Acyclovir', 'Oseltamivir', 'Valacyclovir',
  // Antihistamines
  'Cetirizine', 'Chlorpheniramine', 'Diphenhydramine', 'Fexofenadine', 'Loratadine', 'Promethazine',
  // GI / Antacids
  'Antacid (Aluminium Hydroxide)', 'Domperidone', 'Esomeprazole', 'Lactulose', 'Loperamide', 'Metoclopramide',
  'Omeprazole', 'Pantoprazole', 'Ranitidine', 'Bisacodyl', 'Ondansetron',
  // Respiratory
  'Salbutamol', 'Beclomethasone', 'Budesonide', 'Ipratropium', 'Montelukast', 'Theophylline',
  'Dextromethorphan', 'Guaifenesin', 'Bromhexine', 'Cetylpyridinium',
  // Cardiovascular
  'Amlodipine', 'Atenolol', 'Atorvastatin', 'Bisoprolol', 'Captopril', 'Enalapril', 'Furosemide',
  'Lisinopril', 'Metoprolol', 'Nifedipine', 'Simvastatin', 'Warfarin', 'Verapamil',
  // Diabetes
  'Metformin', 'Glibenclamide', 'Insulin (Regular)', 'Insulin (NPH)', 'Sitagliptin',
  // Vitamins / Supplements
  'Vitamin B Complex', 'Vitamin C', 'Vitamin D3', 'Folic Acid', 'Ferrous Sulphate', 'Calcium Carbonate', 'Zinc Sulphate',
  // Dermatology
  'Betamethasone', 'Hydrocortisone Cream', 'Permethrin', 'Calamine Lotion', 'Mupirocin',
  // Others
  'Oral Rehydration Salts (ORS)', 'Prednisolone', 'Dexamethasone', 'Methylprednisolone',
];

/* ---- MedicineInput — autocomplete tag picker ---- */
function MedicineInput({ medicines, onChange }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const inputRef = useRef(null);
  const [customDb, setCustomDb] = useState(() => {
    try { return JSON.parse(localStorage.getItem('custom_medicines') || '[]'); } catch { return []; }
  });

  const fullDb = [...new Set([...MEDICINE_DB, ...customDb])];

  const handleQuery = (val) => {
    setQuery(val);
    if (!val.trim()) { setSuggestions([]); setShowDrop(false); return; }
    const q = val.toLowerCase();
    const matches = fullDb.filter(m => m.toLowerCase().includes(q) && !medicines.find(x => x.name === m));
    setSuggestions(matches.slice(0, 8));
    setShowDrop(true);
  };

  const addMed = (name, isCustom = false) => {
    if (isCustom && !fullDb.includes(name)) {
      const updated = [...customDb, name];
      setCustomDb(updated);
      localStorage.setItem('custom_medicines', JSON.stringify(updated));
    }
    onChange([...medicines, { name, dosage: '', duration: '', frequency: '1x daily' }]);
    setQuery('');
    setSuggestions([]);
    setShowDrop(false);
    inputRef.current?.focus();
  };

  const removeMed = (idx) => onChange(medicines.filter((_, i) => i !== idx));

  const updateMed = (idx, field, val) => {
    const updated = medicines.map((m, i) => i === idx ? { ...m, [field]: val } : m);
    onChange(updated);
  };

  return (
    <div className="med-input-root">
      {/* Added medicine cards */}
      {medicines.map((med, idx) => (
        <div key={idx} className="med-card">
          <div className="med-card-top">
            <span className="med-card-name">💊 {med.name}</span>
            <button className="med-card-remove" onClick={() => removeMed(idx)}>×</button>
          </div>
          <div className="med-card-fields">
            <input
              className="med-mini-input"
              placeholder="Dosage (e.g. 500mg)"
              value={med.dosage}
              onChange={e => updateMed(idx, 'dosage', e.target.value)}
            />
            <select
              className="med-mini-input med-mini-select"
              value={med.frequency}
              onChange={e => updateMed(idx, 'frequency', e.target.value)}
            >
              <optgroup label="Daily">
                <option>1x daily</option>
                <option>2x daily</option>
                <option>3x daily</option>
                <option>4x daily</option>
              </optgroup>
              <optgroup label="Weekly">
                <option>1x per week</option>
                <option>2x per week</option>
                <option>3x per week</option>
                <option>4x per week</option>
                <option>5x per week</option>
                <option>Every other day</option>
              </optgroup>
              <optgroup label="Timing">
                <option>At night</option>
                <option>Before meals</option>
                <option>After meals</option>
                <option>With meals</option>
                <option>Morning only</option>
                <option>As needed</option>
              </optgroup>
            </select>
            <select
              className="med-mini-input med-mini-select"
              value={med.duration}
              onChange={e => updateMed(idx, 'duration', e.target.value)}
            >
              <option value="">Duration...</option>
              <optgroup label="Days">
                <option value="1 day">1 day</option>
                <option value="2 days">2 days</option>
                <option value="3 days">3 days</option>
                <option value="4 days">4 days</option>
                <option value="5 days">5 days</option>
                <option value="7 days">7 days</option>
                <option value="10 days">10 days</option>
                <option value="14 days">14 days</option>
              </optgroup>
              <optgroup label="Long Term">
                <option value="1 month">1 month</option>
                <option value="2 months">2 months</option>
                <option value="3 months">3 months</option>
                <option value="Until finished">Until finished</option>
                <option value="Continually">Continually</option>
              </optgroup>
              <optgroup label="Other">
                <option value="As needed">As needed (SOS)</option>
                <option value="Stat">Stat (Immediately)</option>
              </optgroup>
            </select>
          </div>
        </div>
      ))}

      {/* Search input */}
      <div className="med-search-wrap" style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          className="med-search-input"
          placeholder="💊 Type medicine name..."
          value={query}
          onChange={e => handleQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && query.trim()) {
              const exact = fullDb.find(m => m.toLowerCase() === query.trim().toLowerCase());
              addMed(exact || query.trim(), !exact);
            }
            if (e.key === 'Escape') { setShowDrop(false); }
          }}
          onFocus={() => query && setShowDrop(true)}
          autoComplete="off"
        />
        {/* Dropdown suggestions */}
        {showDrop && (
          <div className="med-dropdown">
            {suggestions.length > 0 ? suggestions.map(s => (
              <button key={s} className="med-dropdown-item" onMouseDown={() => addMed(s)}>
                💊 {s}
              </button>
            )) : query.trim() ? (
              <button className="med-dropdown-item med-dropdown-custom" onMouseDown={() => addMed(query.trim(), true)}>
                ➕ Add "{query.trim()}" as custom medicine
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}


function DoctorPortal({ username, handleLogout, showAlert, showConfirm }) {
  const [searchId, setSearchId] = useState(() => localStorage.getItem('doctor_last_search') || '');
  const [student, setStudent] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [diagnosisDetails, setDiagnosisDetails] = useState('');
  const [prescription, setPrescription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [docActiveTab, setDocActiveTab] = useState('consultations');
  const [activeView, setActiveView] = useState('dashboard');
  const [doctorName, setDoctorName] = useState(() => localStorage.getItem('auth_name') || 'Doctor');
  const recognitionRef = useRef(null);
  // — New consultation state —
  const [visitType, setVisitType] = useState('General');
  const [severity, setSeverity] = useState('Mild');
  const [followUpDate, setFollowUpDate] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [showCustomSymptomField, setShowCustomSymptomField] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [voiceTarget, setVoiceTarget] = useState('notes'); // 'notes' | 'prescription'

  const QUICK_SYMPTOMS = ['Fever', 'Headache', 'Cough', 'Sore Throat', 'Chest Pain', 'Shortness of Breath',
    'Nausea', 'Vomiting', 'Diarrhea', 'Fatigue', 'Dizziness', 'Rash', 'Body Aches', 'Abdominal Pain'];
  const VISIT_TYPES = ['General', 'Follow-up', 'Emergency', 'Specialist Referral'];
  const SEVERITY_LEVELS = [
    { label: 'Mild', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Moderate', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Severe', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  ];

  useEffect(() => {
    if (!username) return;
    fetch(`${API_BASE_URL}/doctors/${username}`)
      .then(res => res.json())
      .then(data => {
        if (data.name) {
          let dName = data.name;
          if (!dName.toLowerCase().startsWith('dr.')) {
            dName = 'Dr. ' + dName;
          }
          setDoctorName(dName);
          localStorage.setItem('auth_name', dName);
        }
      })
      .catch(console.error);
  }, [username]);

  const fetchStudent = useCallback(async (id) => {
    if (!id) return;
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/student/${id}`);
      if (res.ok) {
        const data = await res.json();
        const profStatus = getProfileStatus(data.medicalRecords);
        if (profStatus.record) {
          const match = profStatus.record.diagnosis.match(/Full Name: (.*?)(?=\n|$)/);
          if (match && match[1].trim() && match[1].trim() !== 'None' && match[1].trim() !== 'N/A') {
            data.name = match[1].trim();
          }
        }
        setStudent(data);
        // Cache this student's records for the Logs dashboard
        try {
          const cache = JSON.parse(localStorage.getItem('unimed_records_cache') || '{}');
          cache[data.indexNumber] = {
            name: data.name,
            records: data.medicalRecords || [],
            cachedAt: new Date().toISOString()
          };
          localStorage.setItem('unimed_records_cache', JSON.stringify(cache));
        } catch { /* storage full — ignore */ }
      }
      else { showAlert("Student not found."); setStudent(null); }
    } catch { showAlert("Error searching student."); }
    finally { setIsSearching(false); }
  }, [showAlert]);

  // Re-fetch last searched student on mount (e.g. after page refresh)
  useEffect(() => {
    const saved = localStorage.getItem('doctor_last_search');
    if (!saved) return;
    const timer = setTimeout(() => { void fetchStudent(saved); }, 0);
    return () => clearTimeout(timer);
  }, [fetchStudent]);

  const searchStudent = async () => {
    if (!searchId) return;
    localStorage.setItem('doctor_last_search', searchId);
    await fetchStudent(searchId);
  };

  const toggleVoice = (target = 'notes') => {
    if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return showAlert('Browser does not support Voice to Text.');
    const recognition = new SR();
    recognition.continuous = true; recognition.interimResults = true;
    recognitionRef.current = recognition;
    recognition.onstart = () => { setIsListening(true); setVoiceTarget(target); };
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (e) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      if (final) {
        if (target === 'notes') setDiagnosisDetails(prev => prev + final);
        else setPrescription(prev => prev + final);
      }
    };
    recognition.start();
  };

  const saveConsultation = async () => {
    if (!student || (!diagnosisDetails.trim() && medicines.length === 0 && !prescription.trim())) {
      showAlert('Please add clinical notes or at least one medicine.');
      return;
    }
    // Build structured prescription text from medicine cards
    const medLines = medicines.map(m => {
      let dur = '';
      if (m.duration) {
        if (m.duration.includes('Until') || m.duration.includes('Continually') || m.duration.includes('As needed') || m.duration.includes('Stat')) {
          dur = ` (${m.duration.split(' ')[0] === 'As' ? 'As needed' : m.duration})`; /* Clean up (SOS) for display */
        } else {
          dur = ` (for ${m.duration})`;
        }
      }
      return `• ${m.name}${m.dosage ? ` — ${m.dosage}` : ''}${m.frequency ? `, ${m.frequency}` : ''}${dur}`;
    }).join('\n');
    const symptomLine = selectedSymptoms.length ? `Symptoms: ${selectedSymptoms.join(', ')}` : '';
    const fullDiagnosis = [
      `[Visit Type: ${visitType}] [Severity: ${severity}]`,
      symptomLine,
      diagnosisDetails.trim()
    ].filter(Boolean).join('\n');
    const fullPrescription = [medLines, prescription.trim()].filter(Boolean).join('\n');
    try {
      const res = await fetch(`${API_BASE_URL}/student/${student.indexNumber}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosis: fullDiagnosis,
          prescription: fullPrescription || 'N/A'
        })
      });
      if (res.ok) {
        showAlert('Consultation Saved!');
        setDiagnosisDetails(''); setPrescription(''); setMedicines([]);
        setSelectedSymptoms([]); setFollowUpDate(''); setVisitType('General'); setSeverity('Mild');
        fetchStudent(student.indexNumber);
      }
    } catch { showAlert('Failed to save.'); }
  };

  const records = student?.medicalRecords || [];
  const LAB_REPORT_TAG = '[LAB REPORT';
  const docConsultations = records.filter(r => !isProfileRecord(r.diagnosis) && !r.diagnosis?.includes(LAB_REPORT_TAG));
  const labReports = records.filter(r => r.diagnosis?.includes(LAB_REPORT_TAG));

  return (
    <div className="dash-layout fade-in">
      <Sidebar role="Doctor" name={doctorName} onLogout={handleLogout} activeView={activeView} onNavigate={setActiveView} />

      {activeView === 'settings' ? (
        <SettingsPanel role="Doctor" />
      ) : activeView === 'logs' ? (
        <LogsDashboard />
      ) : (
        <div className="dash-main">
          {/* TOPBAR */}
          <div className="topbar">
            <div>
              <h1 className="topbar-title">Doctor Consultations</h1>
              <p className="topbar-sub">Search a student to view their history and record a new consultation</p>
            </div>
            <div className="search-bar">
              <input
                type="text" placeholder="Enter Student Index..."
                value={searchId} onChange={e => setSearchId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchStudent()}
              />
              <button className="btn-primary" style={{ width: 'auto', padding: '9px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={searchStudent} disabled={isSearching}>
                {isSearching ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6 }} /> : null}
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {student ? (
            <>
              {/* PATIENT STAT ROW */}
              <div className="stat-row doc-mini-stats">
                <div className="stat-card stat-blue">
                  <div className="stat-icon">👤</div>
                  <div>
                    <div className="stat-num">{student.name}</div>
                    <div className="stat-label">Patient Name</div>
                  </div>
                </div>
                <div className="stat-card stat-purple">
                  <div className="stat-icon">🆔</div>
                  <div>
                    <div className="stat-num">{student.indexNumber}</div>
                    <div className="stat-label">Index Number</div>
                  </div>
                </div>
                <div className="stat-card stat-green">
                  <div className="stat-icon">📁</div>
                  <div>
                    <div className="stat-num">{records.filter(r => !isProfileRecord(r.diagnosis)).length}</div>
                    <div className="stat-label">Total Records</div>
                  </div>
                </div>
                <div className="stat-card stat-amber">
                  <div className="stat-icon">
                    {getProfileStatus(student.medicalRecords).status === 'Approved' ? '✅' :
                      getProfileStatus(student.medicalRecords).status === 'Rejected' ? '❌' : '⏳'}
                  </div>
                  <div>
                    <div className="stat-num" style={{ fontSize: '1.2rem' }}>
                      {getProfileStatus(student.medicalRecords).status}
                    </div>
                    <div className="stat-label">Profile Status</div>
                  </div>
                </div>
                <div className="stat-card stat-amber">
                  <div className="stat-icon">🧪</div>
                  <div>
                    <div className="stat-num">{records.filter(r => r.diagnosis?.includes('[LAB REPORT')).length}</div>
                    <div className="stat-label">Lab Reports</div>
                  </div>
                </div>
              </div>

              <div className="doc-grid">
                {/* LEFT — NEW CONSULTATION (main/primary) */}
                <div className="doc-col-consult">
                  <div className="panel consult-panel">

                    {/* Panel header */}
                    <div className="panel-header" style={{ marginBottom: 16 }}>
                      <h3 className="panel-title">New Consultation</h3>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className={`btn-icon ${isListening && voiceTarget === 'notes' ? 'pulse-btn recording' : ''}`}
                          onClick={() => toggleVoice('notes')}
                          title="Voice to Clinical Notes"
                        >
                          {isListening && voiceTarget === 'notes' ? '⏹' : '🎙'} Notes
                        </button>
                        <button
                          className={`btn-icon ${isListening && voiceTarget === 'prescription' ? 'pulse-btn recording' : ''}`}
                          onClick={() => toggleVoice('prescription')}
                          title="Voice to Prescription Notes"
                        >
                          {isListening && voiceTarget === 'prescription' ? '⏹' : '🎙'} Rx
                        </button>
                      </div>
                    </div>

                    <div className="form-stack">

                      {/* Visit type + Severity */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                        <div style={{ flex: 1 }}>
                          <label className="form-label">Visit Type</label>
                          <div style={{ marginTop: 4 }}>
                            <CustomSelect
                              value={visitType}
                              onChange={setVisitType}
                              options={VISIT_TYPES}
                            />
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="form-label">Severity</label>
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {SEVERITY_LEVELS.map(s => (
                              <button
                                key={s.label}
                                onClick={() => setSeverity(s.label)}
                                style={{
                                  flex: 1, padding: '7px 4px',
                                  borderRadius: 'var(--r-sm)',
                                  border: severity === s.label ? `2px solid ${s.color}` : '1.5px solid rgba(100,116,139,0.25)',
                                  background: severity === s.label ? s.bg : 'transparent',
                                  color: severity === s.label ? s.color : 'var(--t5)',
                                  fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                                  fontFamily: 'inherit'
                                }}
                              >{s.label}</button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Quick & Custom Symptom Chips */}
                      <div>
                        <label className="form-label">Symptoms</label>
                        <div className="symptom-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                          {Array.from(new Set([...QUICK_SYMPTOMS, ...selectedSymptoms])).map(s => (
                            <button
                              key={s}
                              type="button"
                              className={`symptom-chip ${selectedSymptoms.includes(s) ? 'active' : ''}`}
                              onClick={() => setSelectedSymptoms(prev =>
                                prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                              )}
                            >
                              {s}
                              {selectedSymptoms.includes(s) && !QUICK_SYMPTOMS.includes(s) ? '  ×' : ''}
                            </button>
                          ))}

                          {/* Custom Symptom Add */}
                          {showCustomSymptomField ? (
                            <input
                              autoFocus
                              type="text"
                              className="symptom-chip"
                              style={{
                                background: '#fff',
                                border: '1.5px solid var(--blue)',
                                cursor: 'text',
                                padding: '6px 12px',
                                outline: 'none',
                                width: '140px'
                              }}
                              placeholder="Type symptom..."
                              value={customSymptom}
                              onChange={e => setCustomSymptom(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && customSymptom.trim()) {
                                  e.preventDefault();
                                  setSelectedSymptoms(prev => Array.from(new Set([...prev, customSymptom.trim()])));
                                  setCustomSymptom('');
                                  setShowCustomSymptomField(false);
                                } else if (e.key === 'Escape') {
                                  setShowCustomSymptomField(false);
                                  setCustomSymptom('');
                                }
                              }}
                              onBlur={() => {
                                if (customSymptom.trim()) {
                                  setSelectedSymptoms(prev => Array.from(new Set([...prev, customSymptom.trim()])));
                                }
                                setShowCustomSymptomField(false);
                                setCustomSymptom('');
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              className="symptom-chip"
                              style={{ background: 'var(--b2)', borderStyle: 'dashed', color: 'var(--t5)' }}
                              onClick={() => setShowCustomSymptomField(true)}
                              title="Add custom symptom"
                            >
                              + Add Custom
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Clinical Notes */}
                      <div>
                        <label className="form-label">
                          Clinical Notes & Diagnosis
                          {isListening && voiceTarget === 'notes' && <span className="voice-live-badge">● LIVE</span>}
                        </label>
                        <textarea
                          className="modern-textarea"
                          placeholder="Clinical notes, diagnosis, observations..."
                          rows="4"
                          value={diagnosisDetails}
                          onChange={e => setDiagnosisDetails(e.target.value)}
                        />
                      </div>

                      {/* Medicines */}
                      <div>
                        <label className="form-label">Prescription & Medicines</label>
                        <MedicineInput medicines={medicines} onChange={setMedicines} />
                      </div>

                      {/* Extra notes */}
                      <div>
                        <label className="form-label">
                          Additional Notes / Instructions
                          {isListening && voiceTarget === 'prescription' && <span className="voice-live-badge">● LIVE</span>}
                        </label>
                        <textarea
                          className="modern-textarea"
                          placeholder="Special instructions, referrals..."
                          rows="2"
                          value={prescription}
                          onChange={e => setPrescription(e.target.value)}
                        />
                      </div>

                      {/* Follow-up date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Follow-up</label>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={followUpDate}
                          onChange={e => setFollowUpDate(e.target.value)}
                          style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1.5px solid rgba(226,232,240,0.85)', fontSize: '0.9rem', fontFamily: 'inherit', background: 'rgba(248,250,252,0.9)', color: 'var(--t9)' }}
                        />
                      </div>

                      <button className="btn-primary w-full" onClick={saveConsultation}>
                        Save to Patient Record ✓
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT — tabbed history panel (secondary) */}
                <div className="doc-col-records">
                  <div className="panel">
                    {/* Tab header */}
                    <div className="doc-tab-bar">
                      <button
                        className={`doc-tab-btn ${docActiveTab === 'consultations' ? 'active' : ''}`}
                        onClick={() => setDocActiveTab('consultations')}
                      >
                        🩺 Consultations
                        <span className="doc-tab-count">{docConsultations.length}</span>
                      </button>
                      <button
                        className={`doc-tab-btn ${docActiveTab === 'labreports' ? 'active' : ''}`}
                        onClick={() => setDocActiveTab('labreports')}
                      >
                        🧪 Lab Reports
                        <span className="doc-tab-count">{labReports.length}</span>
                      </button>
                      <button
                        className={`doc-tab-btn ${docActiveTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setDocActiveTab('profile')}
                      >
                        📋 Profile
                      </button>
                    </div>

                    {/* Consultations Tab */}
                    {docActiveTab === 'consultations' && (
                      <div className="records-scroll">
                        {docConsultations.length > 0
                          ? [...docConsultations].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((rec, i) => (
                            <RecordItem key={i} record={rec} />
                          ))
                          : <div className="empty-state-box"><div className="empty-big-icon">📂</div><p>No previous consultation records.</p></div>
                        }
                      </div>
                    )}

                    {/* Lab Reports Tab */}
                    {docActiveTab === 'labreports' && (
                      <div className="records-scroll">
                        {labReports.length > 0
                          ? [...labReports].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((rec, i) => (
                            <RecordItem key={i} record={rec} />
                          ))
                          : <div className="empty-state-box"><div className="empty-big-icon">🧪</div><p>No lab reports submitted yet.</p></div>
                        }
                      </div>
                    )}

                    {/* Medical Profile Tab */}
                    {docActiveTab === 'profile' && (
                      <div className="records-scroll">
                        {getProfileStatus(student.medicalRecords).record
                          ? <RecordItem record={getProfileStatus(student.medicalRecords).record} />
                          : <div className="empty-state-box"><div className="empty-big-icon">📋</div><p>No medical profile submitted yet.</p></div>
                        }
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </>

          ) : (
            <div className="empty-search-state">
              <div className="empty-search-icon">🔍</div>
              <h2>Find a Student</h2>
              <p>Enter a student index number above and press Search to view their medical history and begin a consultation.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================
   LAB PORTAL
   ========================================= */
function LabPortal({ username, handleLogout, showAlert, showConfirm }) {
  const [searchId, setSearchId] = useState(() => localStorage.getItem('lab_last_search') || '');
  const [labName, setLabName] = useState(() => localStorage.getItem('auth_name') || 'Lab Dept');
  const [student, setStudent] = useState(null);
  const [reportTitle, setReportTitle] = useState('');
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [activeView, setActiveView] = useState('dashboard');
  const [isSearching, setIsSearching] = useState(false);
  const [labActiveTab, setLabActiveTab] = useState('upload');
  const [labProfileEditMode, setLabProfileEditMode] = useState(false);
  const [labProfileText, setLabProfileText] = useState('');
  const [editStep, setEditStep] = useState(1);

  useEffect(() => {
    if (!username) return;
    fetch(`${API_BASE_URL}/labassistant/${username}`)
      .then(res => res.json())
      .then(data => {
        if (data.name) {
          setLabName(data.name);
          localStorage.setItem('auth_name', data.name);
        }
      })
      .catch(console.error);
  }, [username]);

  // Edit form fields for Lab Assistant
  const [eFullName, setEFullName] = useState('');
  const [eNic, setENic] = useState('');
  const [eFaculty, setEFaculty] = useState('');
  const [eTelNo, setETelNo] = useState('');
  const [eDob, setEDob] = useState('');
  const [eSex, setESex] = useState('');
  const [eReligion, setEReligion] = useState('');
  const [eMaritalStatus, setEMaritalStatus] = useState('Single');
  const [eNationality, setENationality] = useState('');
  const [eLastSchool, setELastSchool] = useState('');
  const [eSiblings, setESiblings] = useState('');
  const [eFatherOcc, setEFatherOcc] = useState('');
  const [eMotherOcc, setEMotherOcc] = useState('');
  const [eHomeAddress, setEHomeAddress] = useState('');
  const [eExtracurricular, setEExtracurricular] = useState('');
  const [eEmergName, setEEmergName] = useState('');
  const [eEmergAddress, setEEmergAddress] = useState('');
  const [eEmergTel, setEEmergTel] = useState('');
  const [eEmergRel, setEEmergRel] = useState('');
  const [eFamFather, setEFamFather] = useState('');
  const [eFamMother, setEFamMother] = useState('');
  const [eFamBrothers, setEFamBrothers] = useState('');
  const [eFamSisters, setEFamSisters] = useState('');
  const [eFamOther, setEFamOther] = useState('');
  const [eHist01, setEHist01] = useState('');
  const [eHist02, setEHist02] = useState('');
  const [eHist03, setEHist03] = useState('');
  const [eHist04, setEHist04] = useState('');
  const [eHist05, setEHist05] = useState('');
  const [eHist06, setEHist06] = useState('');
  const [eHist07, setEHist07] = useState('');
  const [eHist08, setEHist08] = useState('');
  const [eHist09, setEHist09] = useState('');
  const [eHist10, setEHist10] = useState('');
  const [eMenstrual, setEMenstrual] = useState('');
  const [eDisability, setEDisability] = useState('');
  const [eVacBCC, setEVacBCC] = useState('');
  const [eVacDPT, setEVacDPT] = useState('');
  const [eVacMMR, setEVacMMR] = useState('');
  const [eVacRubella, setEVacRubella] = useState('');
  const [eVacHepB, setEVacHepB] = useState('');
  const [eVacChicken, setEVacChicken] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [pendingRejectionAction, setPendingRejectionAction] = useState(null);
  const [pendingStudents, setPendingStudents] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // handleEditDobChange has been removed in favor of native date input


  const fetchStudent = useCallback(async (id) => {
    if (!id) return;
    setShowRegister(false);
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/student/${id}`);
      if (res.ok) {
        const data = await res.json();
        const profStatus = getProfileStatus(data.medicalRecords);
        if (profStatus.record) {
          const match = profStatus.record.diagnosis.match(/Full Name: (.*?)(?=\n|$)/);
          if (match && match[1].trim() && match[1].trim() !== 'None' && match[1].trim() !== 'N/A') {
            data.name = match[1].trim();
          }
        }
        setStudent(data);
        try {
          const cache = JSON.parse(localStorage.getItem('unimed_records_cache') || '{}');
          cache[data.indexNumber] = {
            name: data.name,
            records: data.medicalRecords || [],
            cachedAt: new Date().toISOString()
          };
          localStorage.setItem('unimed_records_cache', JSON.stringify(cache));
        } catch { /* ignore */ }
      }
      else { setShowRegister(true); setStudent(null); }
    } catch { showAlert("Error finding student."); }
    finally { setIsSearching(false); }
  }, [showAlert]);

  // Re-fetch last verified student on mount (e.g. after page refresh)
  useEffect(() => {
    const saved = localStorage.getItem('lab_last_search');
    if (!saved) return;
    const timer = setTimeout(() => { void fetchStudent(saved); }, 0);
    return () => clearTimeout(timer);
  }, [fetchStudent]);

  const searchStudent = async () => {
    if (!searchId) return;
    localStorage.setItem('lab_last_search', searchId);
    await fetchStudent(searchId);
  };

  const fetchPendingStudents = async () => {
    setLoadingPending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/students/pending`);
      if (res.ok) {
        const data = await res.json();
        setPendingStudents(data);
        try {
          const cache = JSON.parse(localStorage.getItem('unimed_records_cache') || '{}');
          data.forEach(s => {
            cache[s.indexNumber] = { name: s.name, records: s.medicalRecords || [], cachedAt: new Date().toISOString() };
          });
          localStorage.setItem('unimed_records_cache', JSON.stringify(cache));
        } catch { /* ignore */ }
      } else {
        showAlert('Failed to load pending students');
      }
    } catch {
      showAlert('Error connecting to server');
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (activeView === 'pending-approvals') {
      fetchPendingStudents();
    }
  }, [activeView]);

  const registerStudent = async () => {
    if (!searchId || !newStudentName.trim()) return showAlert("Please enter the student's name.");
    try {
      const res = await fetch(`${API_BASE_URL}/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexNumber: searchId, name: newStudentName })
      });
      if (res.ok) {
        showAlert("Student Registered! You can now upload the lab report.");
        setStudent({ indexNumber: searchId, name: newStudentName });
        setShowRegister(false);
      } else {
        showAlert("Registration failed.");
      }
    } catch { showAlert("Failed to register student."); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setFileData(null);
      setFileName('');
      return;
    }

    // Check file size (limit to ~4MB to avoid DB bloat if using base64)
    if (file.size > 4 * 1024 * 1024) {
      showAlert("File is too large! Please select a file under 4MB.");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileData(event.target.result); // Base64 string
    };
    reader.readAsDataURL(file);
  };

  const submitLabReport = async () => {
    if (!student || !reportTitle || !fileData) return showAlert('Please enter a title and attach a file.');
    try {
      // Send the base64 string directly within the diagnosis field
      const res = await fetch(`${API_BASE_URL}/student/${student.indexNumber}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosis: `[LAB REPORT: ${reportTitle.toUpperCase()}] \n[FILE_ATTACHMENT:${fileName}] \n${fileData}`,
          prescription: 'Awaiting Doctor Review'
        })
      });
      if (res.ok) {
        showAlert("Lab Report Uploaded!");
        setReportTitle('');
        setFileData(null);
        setFileName('');
        setStudent(null);
        setSearchId('');
      }
    } catch { showAlert("Failed to upload."); }
  };

  const handlePatientAction = async (actionStr) => {
    if (!student) return;
    const profStatus = getProfileStatus(student.medicalRecords);
    if (!profStatus.record) return;

    try {
      let finalDiagnosis = profStatus.record.diagnosis;

      if (actionStr === 'Approve') {
        if (!finalDiagnosis.includes('Approval Status:')) {
          // If old record has no status line, insert before attachments or at end
          if (finalDiagnosis.includes('[FILE_ATTACHMENT:')) {
            finalDiagnosis = finalDiagnosis.replace('[FILE_ATTACHMENT:', `Approval Status: Approved\n[FILE_ATTACHMENT:`);
          } else {
            finalDiagnosis += '\nApproval Status: Approved';
          }
        } else {
          finalDiagnosis = finalDiagnosis.replace(/Approval Status: (Pending|Rejected|Approved)/, 'Approval Status: Approved');
        }
        await updateProfileRecord(finalDiagnosis, actionStr);
      }
      else if (actionStr === 'Reject') {
        setRejectionReason('');
        setPendingRejectionAction({ finalDiagnosis });
        setShowRejectionModal(true);
        return;
      }
      else if (actionStr === 'Delete') {
        showConfirm(
          "Are you sure you want to completely DELETE this student's profile? They will have to re-register and re-upload everything.",
          async () => {
            finalDiagnosis = '[PROFILE DELETED]';
            await updateProfileRecord(finalDiagnosis, actionStr);
          },
          'Delete Profile',
          'Cancel'
        );
        return; // Action handled in callback
      }
      else if (actionStr === 'SaveEdit') {
        const needName = !eFullName.trim();
        if (needName || !eNic.trim() || !eFaculty.trim() || !eDob || !eSex) {
          showAlert('Please fill all required fields (*)');
          return;
        }
        if (!/^\d{12}$/.test(eNic)) { showAlert('NIC Number must be exactly 12 digits'); return; }
        if (eTelNo && !/^0\d{9}$/.test(eTelNo)) { showAlert('Student Tel No must be 10 digits starting with 0'); return; }
        if (eEmergTel && !/^0\d{9}$/.test(eEmergTel)) { showAlert('Emergency Telephone must be 10 digits starting with 0'); return; }

        let profileRecord = `[PAST HISTORY]
=== PERSONAL INFORMATION ===
Full Name: ${eFullName || 'N/A'}\nNIC No: ${eNic || 'N/A'}\nFaculty: ${eFaculty || 'N/A'}\nStudent Tel: ${eTelNo || 'N/A'}\nDate of Birth: ${eDob || 'N/A'}\nSex: ${eSex || 'N/A'}\nReligion: ${eReligion || 'N/A'}\nMarital Status: ${eMaritalStatus || 'Single'}\nNationality: ${eNationality || 'N/A'}\nLast School: ${eLastSchool || 'N/A'}\nSiblings: ${eSiblings || '0'}\nFather's Occupation: ${eFatherOcc || 'N/A'}\nMother's Occupation: ${eMotherOcc || 'N/A'}\nHome Address: ${eHomeAddress || 'N/A'}\nExtracurricular: ${eExtracurricular || 'N/A'}
=== EMERGENCY CONTACT ===
Name: ${eEmergName || 'N/A'}\nRelationship: ${eEmergRel || 'N/A'}\nTelephone: ${eEmergTel || 'N/A'}\nAddress: ${eEmergAddress || 'N/A'}
=== FAMILY MEDICAL HISTORY ===
Father: ${eFamFather || 'None'}\nMother: ${eFamMother || 'None'}\nBrothers/Sisters: ${eFamBrothers || 'None'} ${eFamSisters || ''}\nOther: ${eFamOther || 'None'}
=== STUDENT MEDICAL HISTORY ===
01. Infectious Diseases: ${eHist01 || 'None'}\n02. Worm Infestation: ${eHist02 || 'None'}\n03. Respiratory: ${eHist03 || 'None'}\n04. Circulatory: ${eHist04 || 'None'}\n05. E.N.T.: ${eHist05 || 'None'}\n06. Eye: ${eHist06 || 'None'}\n07. Nervous System: ${eHist07 || 'None'}\n08. Surgical: ${eHist08 || 'None'}\n09. Miscellaneous: ${eHist09 || 'None'}\n10. Allergic History: ${eHist10 || 'None'}\nMenstrual History: ${eMenstrual || 'N/A'}\nDisability: ${eDisability || 'None'}
=== IMMUNISATION ===
BCC: ${eVacBCC || 'Not recorded'}\nDPT: ${eVacDPT || 'Not recorded'}\nMR/MMR: ${eVacMMR || 'Not recorded'}\nRubella: ${eVacRubella || 'Not recorded'}\nHepatitis B: ${eVacHepB || 'Not recorded'}\nChickenpox: ${eVacChicken || 'Not recorded'}
`;
        let appStatusStr = '\nApproval Status: Pending';
        const appMatch = labProfileText.match(/Approval Status: (Pending|Approved|Rejected)/);
        if (appMatch) appStatusStr = `\n${appMatch[0]}`;
        let fileAttachmentStr = '';
        if (labProfileText.includes('[FILE_ATTACHMENT:')) {
          fileAttachmentStr = '\n' + labProfileText.substring(labProfileText.indexOf('[FILE_ATTACHMENT:'));
        }
        finalDiagnosis = profileRecord + appStatusStr + fileAttachmentStr;
        setLabProfileEditMode(false);
        await updateProfileRecord(finalDiagnosis, actionStr);
      }
    } catch { showAlert(`Failed to process profile action.`); }
  };

  const updateProfileRecord = async (finalDiagnosis, actionStr) => {
    try {
      await fetch(`${API_BASE_URL}/student/${student.indexNumber}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis: finalDiagnosis, prescription: 'N/A' })
      });
      showAlert(`Profile ${actionStr} successful.`);
      fetchStudent(student.indexNumber); // refresh
      // Refresh pending list if we're on that view
      if (activeView === 'pending-approvals') {
        fetchPendingStudents();
      }
    } catch { showAlert(`Failed to ${actionStr} profile.`); }
  };

  const startEditProfile = () => {
    const profStatus = getProfileStatus(student?.medicalRecords);
    if (!profStatus.record) return;

    const latestHistory = profStatus.record.diagnosis;
    const extractVal = (prefix) => {
      const regex = new RegExp(`${prefix}: (.*?)(?=\\n|$)`);
      const match = latestHistory.match(regex);
      let val = match ? match[1].trim() : '';
      if (val === 'None' || val === 'N/A' || val === 'Not recorded') return '';
      return val;
    };

    setEditStep(1);
    setEFullName(extractVal('Full Name'));
    setENic(extractVal('NIC No'));
    setEFaculty(extractVal('Faculty'));
    setETelNo(extractVal('Student Tel'));
    let parsedDob = extractVal('Date of Birth');
    if (parsedDob && parsedDob.includes('/')) {
      const parts = parsedDob.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        parsedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    setEDob(parsedDob);
    setESex(extractVal('Sex'));
    setEReligion(extractVal('Religion'));
    setEMaritalStatus(extractVal('Marital Status') || 'Single');
    setENationality(extractVal('Nationality'));
    setELastSchool(extractVal('Last School'));
    setESiblings(extractVal('Siblings'));
    setEFatherOcc(extractVal("Father's Occupation"));
    setEMotherOcc(extractVal("Mother's Occupation"));
    setEHomeAddress(extractVal('Home Address'));
    setEExtracurricular(extractVal('Extracurricular'));

    setEEmergName(extractVal('Name'));
    setEEmergAddress(extractVal('Address'));
    setEEmergTel(extractVal('Telephone'));
    setEEmergRel(extractVal('Relationship'));

    setEFamFather(extractVal('Father'));
    setEFamMother(extractVal('Mother'));
    setEFamBrothers(extractVal('Brothers/Sisters'));
    setEFamOther(extractVal('Other'));

    setEHist01(extractVal('01\\. Infectious Diseases'));
    setEHist02(extractVal('02\\. Worm Infestation'));
    setEHist03(extractVal('03\\. Respiratory'));
    setEHist04(extractVal('04\\. Circulatory'));
    setEHist05(extractVal('05\\. E\\.N\\.T\\.'));
    setEHist06(extractVal('06\\. Eye'));
    setEHist07(extractVal('07\\. Nervous System'));
    setEHist08(extractVal('08\\. Surgical'));
    setEHist09(extractVal('09\\. Miscellaneous'));
    setEHist10(extractVal('10\\. Allergic History'));

    setEMenstrual(extractVal('Menstrual History'));
    setEDisability(extractVal('Disability'));

    setEVacBCC(extractVal('BCC'));
    setEVacDPT(extractVal('DPT'));
    setEVacMMR(extractVal('MR/MMR'));
    setEVacRubella(extractVal('Rubella'));
    setEVacHepB(extractVal('Hepatitis B'));
    setEVacChicken(extractVal('Chickenpox'));

    setLabProfileText(latestHistory);
    setLabProfileEditMode(true);
  };

  return (
    <div className="dash-layout fade-in">
      <Sidebar role="Lab Assistant" name={labName} onLogout={handleLogout} activeView={activeView} onNavigate={setActiveView} />

      {activeView === 'settings' ? (
        <SettingsPanel role="Lab Assistant" />
      ) : activeView === 'logs' ? (
        <LogsDashboard />
      ) : activeView === 'pending-approvals' ? (
        <div className="dash-main">
          <div className="topbar">
            <div>
              <h1 className="topbar-title">⏳ Pending Approvals</h1>
              <p style={{ color: 'var(--t5)', marginTop: 4 }}>Students waiting for profile verification</p>
            </div>
            <button className="btn-outline-secondary" onClick={fetchPendingStudents}>
              🔄 Refresh
            </button>
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            {loadingPending ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
                <p style={{ marginTop: 12, color: 'var(--t5)' }}>Loading pending students...</p>
              </div>
            ) : pendingStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
                <h3 style={{ color: 'var(--t7)', marginBottom: 8 }}>All Caught Up!</h3>
                <p style={{ color: 'var(--t5)' }}>No students are waiting for approval</p>
              </div>
            ) : (
              <>
                <div className="panel-header" style={{ marginBottom: 16 }}>
                  <h3 className="panel-title">{pendingStudents.length} Student{pendingStudents.length !== 1 ? 's' : ''} Pending</h3>
                </div>
                <div className="pending-students-list">
                  {pendingStudents.map((student, idx) => (
                    <div key={idx} className="pending-student-card">
                      <div className="pending-student-info">
                        <div className="pending-student-avatar">
                          {student.name ? student.name.charAt(0).toUpperCase() : student.indexNumber.charAt(0)}
                        </div>
                        <div>
                          <div className="pending-student-name">{student.name || 'Student'}</div>
                          <div className="pending-student-index">{student.indexNumber}</div>
                          <div className="pending-student-date">
                            Submitted: {new Date(student.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div className="pending-student-actions">
                        {student.hasAttachment && (
                          <span className="badge badge-success" style={{ marginRight: 8 }}>📎 Has Report</span>
                        )}
                        <button
                          className="btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                          onClick={async () => {
                            setActiveView('dashboard');
                            setSearchId(student.indexNumber);
                            await fetchStudent(student.indexNumber);
                          }}
                        >
                          Review →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="dash-main">
          <div className="topbar">
            <div>
              <h1 className="topbar-title">Lab Results Entry</h1>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-card stat-blue">
              <div className="stat-icon">🧪</div>
              <div><div className="stat-num">Lab</div><div className="stat-label">Department</div></div>
            </div>
            <div className="stat-card stat-green">
              <div className="stat-icon">{student ? '👤' : '🔍'}</div>
              <div>
                <div className="stat-num">{student ? student.indexNumber : 'None'}</div>
                <div className="stat-label">Active Student</div>
              </div>
            </div>
          </div>

          <div className="panel lab-upload-panel">
            <div className="panel-header" style={{ marginBottom: 20 }}>
              <h3 className="panel-title">Upload Lab Report</h3>
            </div>

            {/* Search */}
            <div className="lab-verify-row">
              <input
                className="lab-input"
                type="text"
                placeholder="Enter Student Index Number to Verify..."
                value={searchId}
                onChange={e => { setSearchId(e.target.value); setShowRegister(false); setStudent(null); setNewStudentName(''); }}
                onKeyDown={e => e.key === 'Enter' && searchStudent()}
              />
              <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'auto', padding: '0 20px' }} onClick={searchStudent} disabled={isSearching}>
                {isSearching ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 8, borderColor: 'currentColor', borderTopColor: 'transparent' }} /> : null}
                {isSearching ? 'Verifying...' : 'Verify Student'}
              </button>
            </div>

            {showRegister && !student && (
              <div className="lab-form-body slide-top" style={{ backgroundColor: '#fff7ed', border: '1.5px solid rgba(234,88,12,0.3)', marginTop: 20, padding: 24, borderRadius: 'var(--r-lg)' }}>
                <div className="incomplete-form-alert" style={{ marginBottom: 15, padding: 0, border: 'none', background: 'transparent' }}>
                  <span style={{ fontSize: '1.2rem', marginTop: -2 }}>⚠️</span>
                  <span>Student not found in database. You can pre-register them below to continue uploading this report. The student will be prompted to finish their profile upon their next login.</span>
                </div>
                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label style={{ color: '#9a3412', fontWeight: 700 }}>Student Full Name</label>
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={e => setNewStudentName(e.target.value)}
                    placeholder="e.g. Kavindu Perera"
                    style={{ border: '1.5px solid rgba(234,88,12,0.4)', background: '#fff' }}
                  />
                </div>
                <button className="btn-complete-profile" style={{ width: '100%' }} onClick={registerStudent}>
                  Register Partial Profile &amp; Continue →
                </button>
              </div>
            )}

            {student && (
              <div className="lab-form-body slide-top">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div className="verified-badge" style={{ margin: 0 }}>✓ Verified: {student.name} ({student.indexNumber})</div>
                  {labActiveTab === 'upload' ? (
                    <button className="btn-outline-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', color: 'var(--blue)', borderColor: 'var(--blue)', background: 'rgba(37,99,235,0.05)' }} onClick={(e) => { e.preventDefault(); setLabActiveTab('profile'); }}>
                      📋 Review Profile →
                    </button>
                  ) : (
                    <button className="btn-outline-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={(e) => { e.preventDefault(); setLabActiveTab('upload'); }}>
                      ← Back to Upload
                    </button>
                  )}
                </div>

                {labActiveTab === 'profile' && (
                  <>
                    {/* Profile Review Section for Lab Assistant */}
                    {getProfileStatus(student.medicalRecords).record ? (
                      <div className="panel" style={{ marginTop: 20, marginBottom: 20, border: '1px solid var(--b2)', boxShadow: 'none' }}>
                        <div className="panel-header" style={{ background: 'var(--b0)', borderRadius: 'var(--r-md) var(--r-md) 0 0', padding: '12px 16px' }}>
                          <h4 style={{ margin: 0, fontSize: '1rem' }}>Profile Review: {getProfileStatus(student.medicalRecords).status}</h4>
                        </div>
                        <div style={{ padding: '16px' }}>
                          {labProfileEditMode ? (
                            <>
                              <div className="setup-steps" style={{ marginTop: 0, marginBottom: 20 }}>
                                {['Personal Info', 'Family History', 'Medical History', 'Immunisation'].map((title, i) => (
                                  <div key={i} onClick={() => setEditStep(i + 1)} className={`setup-step ${editStep === i + 1 ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                                    <div className="step-circle">{['👤', '👨‍👩‍👧', '🩺', '💉'][i]}</div>
                                    <div className="step-label">{title}</div>
                                  </div>
                                ))}
                              </div>

                              {editStep === 1 && (
                                <div className="setup-section slide-top">
                                  <h3 className="section-heading">Part 1 — Personal Information</h3>
                                  <div className="input-group">
                                    <label>Full Name *</label>
                                    <input type="text" value={eFullName} onChange={e => setEFullName(e.target.value)} required />
                                  </div>
                                  <div className="form-grid-2">
                                    <div className="input-group"><label>NIC Number *</label><input type="text" value={eNic} onChange={e => setENic(e.target.value)} /></div>
                                    <div className="input-group">
                                      <label>Faculty *</label>
                                      <select value={eFaculty} onChange={e => setEFaculty(e.target.value)} className="form-select">
                                        <option value="">Select Faculty...</option>
                                        <option value="Engineering">Engineering</option>
                                        <option value="Architecture">Architecture</option>
                                        <option value="Information Technology">Information Technology</option>
                                        <option value="Business">Business</option>
                                        <option value="Medicine">Medicine</option>
                                        <option value="Graduate Studies">Graduate Studies</option>
                                      </select>
                                    </div>
                                    <div className="input-group"><label>Student Tel No</label><input type="text" value={eTelNo} onChange={e => setETelNo(e.target.value)} /></div>
                                    <div className="input-group">
                                      <label>Date of Birth *</label>
                                      <input type="date" value={eDob} onChange={e => setEDob(e.target.value)} />
                                    </div>
                                    <div className="input-group">
                                      <label>Sex *</label>
                                      <select value={eSex} onChange={e => setESex(e.target.value)} className="form-select">
                                        <option value="">Select...</option><option>Male</option><option>Female</option>
                                      </select>
                                    </div>
                                    <div className="input-group"><label>Religion</label><input type="text" value={eReligion} onChange={e => setEReligion(e.target.value)} /></div>
                                    <div className="input-group">
                                      <label>Marital Status</label>
                                      <select value={eMaritalStatus} onChange={e => setEMaritalStatus(e.target.value)} className="form-select">
                                        <option>Single</option><option>Married</option>
                                      </select>
                                    </div>
                                    <div className="input-group"><label>Nationality</label><input type="text" value={eNationality} onChange={e => setENationality(e.target.value)} /></div>
                                    <div className="input-group"><label>Last School Attended</label><input type="text" value={eLastSchool} onChange={e => setELastSchool(e.target.value)} /></div>
                                    <div className="input-group"><label>Number of Siblings</label><input type="number" min="0" value={eSiblings} onChange={e => setESiblings(e.target.value)} /></div>
                                    <div className="input-group"><label>Father's Occupation</label><input type="text" value={eFatherOcc} onChange={e => setEFatherOcc(e.target.value)} /></div>
                                    <div className="input-group"><label>Mother's Occupation</label><input type="text" value={eMotherOcc} onChange={e => setEMotherOcc(e.target.value)} /></div>
                                  </div>
                                  <div className="input-group"><label>Home Address, District, Telephone</label><textarea rows="2" value={eHomeAddress} onChange={e => setEHomeAddress(e.target.value)} /></div>

                                  <h3 className="section-heading" style={{ marginTop: 24 }}>Emergency Contact</h3>
                                  <div className="form-grid-2">
                                    <div className="input-group"><label>Contact Name</label><input type="text" value={eEmergName} onChange={e => setEEmergName(e.target.value)} /></div>
                                    <div className="input-group"><label>Relationship</label><input type="text" value={eEmergRel} onChange={e => setEEmergRel(e.target.value)} /></div>
                                    <div className="input-group"><label>Telephone No</label><input type="text" value={eEmergTel} onChange={e => setEEmergTel(e.target.value)} /></div>
                                    <div className="input-group"><label>Address</label><input type="text" value={eEmergAddress} onChange={e => setEEmergAddress(e.target.value)} /></div>
                                  </div>
                                </div>
                              )}

                              {editStep === 2 && (
                                <div className="setup-section slide-top">
                                  <h3 className="section-heading">Family Medical History</h3>
                                  <div className="family-table">
                                    <div className="family-table-header"><span>Member</span><span>Known Medical Conditions</span></div>
                                    {[['Father', eFamFather, setEFamFather], ['Mother', eFamMother, setEFamMother], ['Brothers', eFamBrothers, setEFamBrothers], ['Sisters', eFamSisters, setEFamSisters], ['Other', eFamOther, setEFamOther]].map(([lbl, val, setter]) => (
                                      <div className="family-table-row" key={lbl}>
                                        <span className="family-member-label">{lbl}</span>
                                        <input type="text" value={val} onChange={e => setter(e.target.value)} className="family-input" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {editStep === 3 && (
                                <div className="setup-section slide-top">
                                  <h3 className="section-heading">Student Medical History</h3>
                                  <div className="medical-history-list">
                                    {[['01', 'Infectious Diseases', 'Mumps, Measles, Rubella, Chicken Pox, Hepatitis, Other', eHist01, setEHist01],
                                    ['02', 'Worm Infestation', 'Round Worm, Hook Worm, Thread Worm, Tape Worm, Filaria, Other', eHist02, setEHist02],
                                    ['03', 'Respiratory', 'Frequent Colds, Hay Fever, Asthma, Pneumonia, T.B., Other', eHist03, setEHist03],
                                    ['04', 'Circulatory', 'Heart Disease, Blood Pressure', eHist04, setEHist04],
                                    ['05', 'E.N.T.', 'Ear Infections, Sinusitis, Tonsillitis, Other', eHist05, setEHist05],
                                    ['06', 'Eye', 'Short Sight, Long Sight, Infections, Injuries, Other', eHist06, setEHist06],
                                    ['07', 'Nervous System', 'Epilepsy, Migraine, Other', eHist07, setEHist07],
                                    ['08', 'Surgical', 'Fractures, Injuries, Operations', eHist08, setEHist08],
                                    ['09', 'Miscellaneous', 'Anaemia, Diabetes, Skin Disorders, Kidney Disease, Depression, Other', eHist09, setEHist09],
                                    ['10', 'Allergic History', 'Drugs / Food allergies', eHist10, setEHist10],
                                    ].map(([num, title, hint, val, setter]) => (
                                      <div className="med-hist-row" key={num}>
                                        <div className="med-hist-num">{num}</div>
                                        <div className="med-hist-content">
                                          <div className="med-hist-title">{title}</div>
                                          <div className="med-hist-hint">{hint}</div>
                                          <input type="text" value={val} onChange={e => setter(e.target.value)} className="med-hist-input" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="form-grid-2" style={{ marginTop: 20 }}>
                                    <div className="input-group"><label>Menstrual History (Female only)</label><input type="text" value={eMenstrual} onChange={e => setEMenstrual(e.target.value)} /></div>
                                    <div className="input-group"><label>Disability (if any)</label><input type="text" value={eDisability} onChange={e => setEDisability(e.target.value)} /></div>
                                  </div>
                                </div>
                              )}

                              {editStep === 4 && (
                                <div className="setup-section slide-top">
                                  <h3 className="section-heading">Immunisation Record</h3>
                                  <div className="vaccine-table">
                                    <div className="vaccine-table-header"><span>Vaccination</span><span>Date Administered</span></div>
                                    {[['BCC', eVacBCC, setEVacBCC], ['DPT', eVacDPT, setEVacDPT], ['MR / MMR', eVacMMR, setEVacMMR], ['Rubella', eVacRubella, setEVacRubella], ['Hepatitis B', eVacHepB, setEVacHepB], ['Chickenpox', eVacChicken, setEVacChicken]].map(([lbl, val, setter]) => (
                                      <div className="vaccine-row" key={lbl}>
                                        <span className="vaccine-name">{lbl}</span>
                                        <input type="date" value={val} onChange={e => setter(e.target.value)} className="vaccine-input" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                <button className="btn-primary" onClick={() => handlePatientAction('SaveEdit')}>Save Changes</button>
                                <button className="btn-outline-secondary" onClick={() => setLabProfileEditMode(false)}>Cancel Edit</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <RecordItem record={getProfileStatus(student.medicalRecords).record} />
                              <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                                {getProfileStatus(student.medicalRecords).status !== 'Approved' && (
                                  <>
                                    <button className="btn-outline-success" style={{ flex: 1 }} onClick={() => handlePatientAction('Approve')}>✓ Approve</button>
                                    <button className="btn-outline-danger" style={{ flex: 1 }} onClick={() => handlePatientAction('Reject')}>❌ Reject</button>
                                  </>
                                )}
                                <button className="btn-outline-secondary" style={{ flex: 1 }} onClick={startEditProfile}>✏️ Edit Profile</button>
                                <button className="btn-outline-secondary" style={{ flex: 1, color: 'var(--red)' }} onClick={() => handlePatientAction('Delete')}>🗑️ Delete</button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="incomplete-banner" style={{ marginTop: 20, marginBottom: 20 }}>
                        <div className="incomplete-banner-left">
                          <div className="incomplete-banner-icon">⏳</div>
                          <div>
                            <div className="incomplete-banner-title">Profile Pending Student Action</div>
                            <div className="incomplete-banner-text">This student has not submitted their medical profile and PDF report yet.</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {labActiveTab === 'upload' && (
                  <>
                    <div className="input-group">
                      <label>Report Type / Title</label>
                      <input type="text" value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="e.g. Full Blood Count" />
                    </div>

                    <div className="input-group file-upload-group">
                      <label>Upload Report File (PDF/Image)</label>
                      <div className="file-drop-area">
                        <span className="file-icon">📁</span>
                        <span className="file-msg">{fileName ? fileName : 'Click to select or drag and drop a file'}</span>
                        <input
                          type="file"
                          className="file-input-hidden"
                          onChange={handleFileChange}
                          accept=".pdf,image/*"
                        />
                      </div>
                    </div>

                    <button className="btn-primary w-full" onClick={submitLabReport}>
                      Upload Report to Medical Record 📤
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="uni-confirm-overlay">
          <div className="uni-confirm-modal" style={{ maxWidth: '500px' }}>
            <div className="uni-confirm-icon" style={{ fontSize: '2.5rem' }}>⚠️</div>
            <div className="uni-confirm-msg" style={{ marginBottom: '20px' }}>Enter a rejection reason (optional):</div>
            <textarea
              className="modern-textarea"
              placeholder="e.g., Missing required documents, Incomplete information..."
              rows="4"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              style={{ marginBottom: '20px', width: '100%' }}
            />
            <div className="uni-confirm-actions">
              <button className="uni-confirm-btn cancel" onClick={() => { setShowRejectionModal(false); setRejectionReason(''); setPendingRejectionAction(null); }}>
                Cancel
              </button>
              <button className="uni-confirm-btn confirm" onClick={() => {
                if (pendingRejectionAction) {
                  let updatedDiagnosis = pendingRejectionAction.finalDiagnosis;
                  if (!updatedDiagnosis.includes('Approval Status:')) {
                    if (updatedDiagnosis.includes('[FILE_ATTACHMENT:')) {
                      updatedDiagnosis = updatedDiagnosis.replace('[FILE_ATTACHMENT:', `Approval Status: Rejected\n[FILE_ATTACHMENT:`);
                    } else {
                      updatedDiagnosis += '\nApproval Status: Rejected';
                    }
                  } else {
                    updatedDiagnosis = updatedDiagnosis.replace(/Approval Status: (Pending|Rejected|Approved)/, 'Approval Status: Rejected');
                  }
                  if (rejectionReason.trim()) updatedDiagnosis += `\nRejection Note: ${rejectionReason}`;
                  updateProfileRecord(updatedDiagnosis, 'Reject');
                  setShowRejectionModal(false);
                  setRejectionReason('');
                }
              }}>
                Reject Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================
   LOGS DASHBOARD
   ========================================= */
function LogsDashboard() {
  const [period, setPeriod] = useState('month'); // 'week' | 'month' | 'all'
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Load all cached records
    try {
      const cache = JSON.parse(localStorage.getItem('unimed_records_cache') || '{}');
      const allRecords = [];
      Object.values(cache).forEach(entry => {
        (entry.records || []).forEach(r => allRecords.push(r));
      });

      const now = new Date();
      const cutoff = period === 'week'
        ? new Date(now - 7 * 86400000)
        : period === 'month'
          ? new Date(now - 30 * 86400000)
          : new Date(0);

      const filtered = allRecords.filter(r => {
        if (!r.timestamp) return true;
        return new Date(r.timestamp) >= cutoff;
      });

      // Only consultations (not labs, not profile)
      const consults = filtered.filter(r =>
        !isProfileRecord(r.diagnosis) && !r.diagnosis?.includes('[LAB REPORT')
      );

      // Symptom frequency
      const symptomMap = {};
      consults.forEach(r => {
        const m = r.diagnosis?.match(/Symptoms: (.+)/);
        if (m) m[1].split(',').forEach(s => {
          const sym = s.trim();
          if (sym) symptomMap[sym] = (symptomMap[sym] || 0) + 1;
        });
      });

      // Medicine frequency
      const medMap = {};
      consults.forEach(r => {
        const lines = (r.prescription || '').split('\n');
        lines.forEach(line => {
          // Extract everything from bullet point until the first '—' dash or ',' comma
          const m = line.match(/^[•\-]\s+([^—,]+)/);
          if (m) {
            let name = m[1].trim();
            // Edge case: if no dosage or freq but there is duration
            if (name.includes(' for ')) name = name.split(' for ')[0].trim();

            if (name) medMap[name] = (medMap[name] || 0) + 1;
          }
        });
      });


      // Severity distribution
      const sevMap = { Mild: 0, Moderate: 0, Severe: 0 };
      consults.forEach(r => {
        const m = r.diagnosis?.match(/\[Severity: (\w+)\]/);
        if (m && sevMap[m[1]] !== undefined) sevMap[m[1]]++;
      });

      // Visit type distribution
      const visitMap = {};
      consults.forEach(r => {
        const m = r.diagnosis?.match(/\[Visit Type: ([^\]]+)\]/);
        if (m) visitMap[m[1]] = (visitMap[m[1]] || 0) + 1;
      });

      // Consultations per day based on period
      let daysCount = 14;
      if (period === 'week') daysCount = 7;
      else if (period === 'month') daysCount = 30;
      else daysCount = 30; // 'all' period timeline default to 30 days

      const dayMap = {};
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        dayMap[d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })] = 0;
      }
      consults.forEach(r => {
        if (!r.timestamp) return;
        const d = new Date(r.timestamp);
        const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        if (dayMap[label] !== undefined) dayMap[label]++;
      });

      setStats({
        total: consults.length,
        totalStudents: Object.keys(cache).length,
        labReports: filtered.filter(r => r.diagnosis?.includes('[LAB REPORT')).length,
        symptoms: Object.entries(symptomMap).sort((a, b) => b[1] - a[1]).slice(0, 10),
        medicines: Object.entries(medMap).sort((a, b) => b[1] - a[1]).slice(0, 10),
        severity: Object.entries(sevMap),
        visits: Object.entries(visitMap),
        timeline: Object.entries(dayMap),
      });
    } catch (e) {
      console.error(e);
    }
  }, [period]);

  // --- Mini SVG Bar Chart ---
  const BarChart = ({ data, color = '#2563eb', label = 'Count' }) => {
    if (!data || data.length === 0) return <p className="logs-empty">No data yet for this period.</p>;
    const max = Math.max(...data.map(d => d[1]), 1);
    const h = 160, barW = Math.max(16, Math.floor((520 - 40) / data.length) - 6);
    const topPad = 25; // Add top padding to prevent the tallest bar's text from cutting off
    return (
      <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
        <svg width={Math.max(520, data.length * (barW + 6) + 40)} height={topPad + h + 90} style={{ display: 'block' }}>
          {data.map(([name, val], i) => {
            const bh = Math.round((val / max) * h);
            const x = 20 + i * (barW + 6);
            const y = topPad + h - bh;
            return (
              <g key={name}>
                <rect x={x} y={y} width={barW} height={bh}
                  rx="4"
                  fill={color}
                  opacity="0.85"
                />
                <text x={x + barW / 2} y={y - 8} textAnchor="middle"
                  fontSize="11" fill="var(--t9)" fontWeight="700">{val}</text>
                <text
                  x={x + barW / 2 + 4} y={topPad + h + 14}
                  textAnchor="end" fontSize="10.5"
                  fill="var(--t6)" fontWeight="600"
                  transform={`rotate(-40, ${x + barW / 2 + 4}, ${topPad + h + 14})`}
                >{name.length > 20 ? name.slice(0, 19) + '…' : name}</text>
              </g>
            );
          })}
          <line x1="16" y1={topPad + h} x2={Math.max(520, data.length * (barW + 6) + 40) - 4} y2={topPad + h}
            stroke="rgba(100,116,139,0.3)" strokeWidth="1.5" />
        </svg>
      </div>
    );
  };

  // --- Donut Chart ---
  const DonutChart = ({ data, colors }) => {
    if (!data || data.length === 0 || data.every(d => d[1] === 0))
      return <p className="logs-empty">No data.</p>;
    const total = data.reduce((s, d) => s + d[1], 0);
    if (total === 0) return <p className="logs-empty">No data.</p>;
    const r = 60, cx = 80, cy = 75, stroke = 28;
    let angle = -Math.PI / 2;
    const slices = data.map(([label, val], i) => {
      const frac = val / total;
      const start = angle;
      angle += frac * 2 * Math.PI;
      const end = angle;
      const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
      const large = frac > 0.5 ? 1 : 0;
      return { label, val, frac, color: colors[i % colors.length], path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z` };
    });
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <svg width={160} height={150}>
          {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={0.88} />)}
          <circle cx={cx} cy={cy} r={r - stroke} fill="var(--white)" />
          <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--t9)">{total}</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--t5)' }}>{s.label}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--t9)', marginLeft: 'auto', paddingLeft: 12 }}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Timeline line chart ---
  const TimelineChart = ({ data }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data.map(d => d[1]), 1);

    // H=160 (taller chart), padTop=60 (massive clearance above peak), padBottom=25 (clearance for axis separation)
    const W = 520, H = 160, padX = 20, padBottom = 25, padTop = 60;

    const getY = (val) => H - padBottom - Math.round((val / max) * (H - padBottom - padTop));

    const pts = data.map(([, v], i) => `${padX + i * ((W - 2 * padX) / (data.length - 1))},${getY(v)}`);
    const line = pts.join(' ');
    const area = `${pts[0]} ` + line + ` ${padX + (data.length - 1) * ((W - 2 * padX) / (data.length - 1))},${H - padBottom} ${padX},${H - padBottom}`;

    return (
      <div style={{ overflowX: 'auto', paddingTop: '24px' }}>
        <svg width={W} height={H + 20} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="tlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#tlGrad)" />
          <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
          {data.map(([label, val], i) => {
            const x = padX + i * ((W - 2 * padX) / (data.length - 1));
            const y = getY(val);
            return (
              <g key={label}>
                <circle cx={x} cy={y} r={4} fill="#2563eb" />
                {val > 0 && <text x={x} y={y - 12} textAnchor="middle" fontSize="9.5" fill="var(--t5)" fontWeight="800">{val}</text>}
                {(i % Math.ceil(data.length / 10) === 0) && <text x={x} y={H + 12} textAnchor="middle" fontSize="9" fill="var(--t5)">{label}</text>}
              </g>
            );
          })}
          {/* Axis line separated by 12px below the graph baseline */}
          <line x1={padX} y1={H - padBottom + 12} x2={W - padX} y2={H - padBottom + 12} stroke="rgba(100,116,139,0.3)" strokeWidth="1.5" />
        </svg>
      </div>
    );
  };


  return (
    <div className="logs-page fade-in">
      {/* Topbar */}
      <div className="topbar">
        <div>
          <h1 className="topbar-title">📊 Medical Logs & Analytics</h1>
          <p className="topbar-sub">University student health trends, medicine usage, and consultation statistics</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['week', 'month', 'all'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                padding: '8px 18px', borderRadius: 'var(--r-sm)', fontWeight: 700,
                fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit',
                background: period === p ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'transparent',
                color: period === p ? '#fff' : 'var(--t5)',
                border: period === p ? 'none' : '1.5px solid rgba(100,116,139,0.3)',
                boxShadow: period === p ? '0 4px 14px rgba(37,99,235,0.3)' : 'none',
                transition: 'all 0.18s'
              }}
            >{p === 'all' ? 'All Time' : `Last ${p === 'week' ? '7' : '30'} Days`}</button>
          ))}
        </div>
      </div>

      {!stats || stats.total === 0 ? (
        <div className="logs-onboard">
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>📊</div>
          <h2 style={{ fontWeight: 800, marginBottom: 8 }}>No Data Yet</h2>
          <p style={{ color: 'var(--t5)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
            Analytics are built as you see patients. Search for students in the <strong>Dashboard</strong>, record consultations with symptoms and medicines, and the data will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="stat-row">
            <div className="stat-card stat-blue">
              <div className="stat-icon">🩺</div>
              <div><div className="stat-num">{stats.total}</div><div className="stat-label">Consultations</div></div>
            </div>
            <div className="stat-card stat-green">
              <div className="stat-icon">👥</div>
              <div><div className="stat-num">{stats.totalStudents}</div><div className="stat-label">Students Seen</div></div>
            </div>
            <div className="stat-card stat-purple">
              <div className="stat-icon">🧪</div>
              <div><div className="stat-num">{stats.labReports}</div><div className="stat-label">Lab Reports</div></div>
            </div>
            <div className="stat-card stat-amber">
              <div className="stat-icon">💊</div>
              <div><div className="stat-num">{stats.medicines.length}</div><div className="stat-label">Unique Medicines</div></div>
            </div>
          </div>

          {/* Timeline */}
          <div className="logs-section">
            <div className="logs-section-title">
              📈 Consultations — {period === 'week' ? 'Last 7 Days' : period === 'month' ? 'Last 30 Days' : 'Last 30 Days Trend'}
            </div>
            <TimelineChart data={stats.timeline} />
          </div>

          {/* 2-col charts */}
          <div className="logs-grid">

            {/* Top Symptoms */}
            <div className="logs-card">
              <div className="logs-card-title">🤒 Top Health Issues / Symptoms</div>
              <BarChart data={stats.symptoms} color="#ef4444" />
            </div>

            {/* Top Medicines */}
            <div className="logs-card">
              <div className="logs-card-title">💊 Most Used Medicines</div>
              <BarChart data={stats.medicines} color="#2563eb" />
            </div>

            {/* Severity Distribution */}
            <div className="logs-card">
              <div className="logs-card-title">⚠️ Severity Distribution</div>
              <DonutChart
                data={stats.severity}
                colors={['#10b981', '#f59e0b', '#ef4444']}
              />
            </div>

            {/* Visit Type Distribution */}
            <div className="logs-card">
              <div className="logs-card-title">🏥 Visit Type Breakdown</div>
              <DonutChart
                data={stats.visits}
                colors={['#2563eb', '#7c3aed', '#059669', '#dc2626']}
              />
            </div>

          </div>
        </>
      )}
    </div>
  );
}

/* =========================================
   SIDEBAR
   ========================================= */
function Sidebar({ role, name, onLogout, activeView, onNavigate, profilePhoto }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-text sm">UniMed<span className="logo-dot">.</span></span>
        <span className="role-tag">{role}</span>
      </div>

      <div className="sidebar-user">
        {profilePhoto ? (
          <img src={profilePhoto} alt="avatar" className="s-avatar s-avatar-img" />
        ) : (
          <div className="s-avatar">{name ? name.charAt(0).toUpperCase() : 'U'}</div>
        )}
        <div className="s-user-info">
          <div className="s-user-name">{name || 'User'}</div>
          <div className="s-user-role">{role}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`s-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span className="s-nav-icon">⊞</span>
          <span className="s-nav-label">Dashboard</span>
        </button>
        {role === 'Lab Assistant' && (
          <button
            className={`s-nav-item ${activeView === 'pending-approvals' ? 'active' : ''}`}
            onClick={() => onNavigate('pending-approvals')}
          >
            <span className="s-nav-icon">⏳</span>
            <span className="s-nav-label">Approvals</span>
          </button>
        )}
        {(role === 'Doctor' || role === 'Lab Assistant') && (
          <button
            className={`s-nav-item ${activeView === 'logs' ? 'active' : ''}`}
            onClick={() => onNavigate('logs')}
          >
            <span className="s-nav-icon">📊</span>
            <span className="s-nav-label">Logs</span>
          </button>
        )}
        <button
          className={`s-nav-item ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="s-nav-icon">⚙</span>
          <span className="s-nav-label">Settings</span>
        </button>
        {/* Mobile-only sign out — hidden on desktop via CSS */}
        <button
          className="s-nav-item mobile-logout-btn"
          onClick={onLogout}
        >
          <span className="s-nav-icon">🚪</span>
          <span className="s-nav-label">Sign Out</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <button className="btn-logout" onClick={onLogout}>🚪 Sign Out</button>
      </div>
    </aside>
  );
}

/* =========================================
   SETTINGS PANEL
   ========================================= */
function SettingsPanel({ role }) {
  const defaults = { 'Doctor': 'doctor123', 'Lab Assistant': 'lab123', 'Student': 'student123' };
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [msg, setMsg] = useState(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (newPwd.length < 6) { setMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return; }
    if (newPwd === currentPwd) { setMsg({ type: 'error', text: 'New password must be different from the current password.' }); return; }
    if (newPwd !== confirmPwd) { setMsg({ type: 'error', text: 'Passwords do not match.' }); return; }

    const userId = localStorage.getItem('auth_username');
    let endpoint = '';
    if (role === 'Student') endpoint = `/student/${userId}/password`;
    else if (role === 'Doctor') endpoint = `/doctors/${userId}/password`;
    else if (role === 'Lab Assistant') endpoint = `/labassistant/${userId}/password`;

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: currentPwd, newPassword: newPwd })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: '✓ Password changed successfully! Use your new password on the next login.' });
        setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to update password.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error. Could not connect to the server.' });
    }
  };

  return (
    <div className="settings-page fade-in">
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Settings</h1>
          <p className="topbar-sub">Manage your account security &amp; preferences</p>
        </div>
      </div>

      {/* ---- APPEARANCE ---- */}
      <div className="settings-card">
        <div className="settings-section-title">🎨 Appearance</div>
        <p className="settings-section-sub">Choose between light and dark mode. Your preference is saved automatically.</p>
        <DarkModeToggle />
      </div>


      <div className="settings-card">
        <div className="settings-section-title">🔒 Change Password</div>
        <p className="settings-section-sub">
          Logged in as <strong>{role}</strong>. Your new password will be required on your next login.
        </p>

        {msg && (
          <div className={`settings-msg settings-msg-${msg.type} bounce-in`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleChange} className="settings-form">
          <div className="input-group">
            <label>Current Password</label>
            <div className="pwd-input-wrap">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)}
                placeholder="Enter your current password"
                required
              />
              <button type="button" className="pwd-eye-btn" onClick={() => setShowCurrent(v => !v)} tabIndex={-1}>
                {showCurrent ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
          </div>
          <div className="input-group">
            <label>New Password</label>
            <div className="pwd-input-wrap">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
              <button type="button" className="pwd-eye-btn" onClick={() => setShowNew(v => !v)} tabIndex={-1}>
                {showNew ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
          </div>
          <div className="input-group">
            <label>Confirm New Password</label>
            <div className="pwd-input-wrap">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                placeholder="Re-enter your new password"
                required
              />
              <button type="button" className="pwd-eye-btn" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                {showConfirm ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '12px 36px' }}>
            Update Password 🔐
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================
   RECORD ITEM
   ========================================= */
function RecordItem({ record }) {
  const date = record.timestamp ? new Date(record.timestamp).toLocaleDateString('en-GB') : 'Unknown Date';
  const isLab = record.diagnosis?.includes('[LAB REPORT');
  const isHistory = isProfileRecord(record.diagnosis);
  const [pdfOpen, setPdfOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  // Close on ESC key
  React.useEffect(() => {
    if (!pdfOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setPdfOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pdfOpen]);

  let typeClass = 'type-consult'; let typeLabel = 'Consultation';
  if (isLab) { typeClass = 'type-lab'; typeLabel = 'Lab Report'; }
  if (isHistory) { typeClass = 'type-history'; typeLabel = 'Medical Profile'; }

  // Parse for File Attachment
  let displayText = record.diagnosis || '';
  let attachedFile = null;

  if (displayText.includes('[FILE_ATTACHMENT:')) {
    const parts = displayText.split('\n');
    let cleanNotes = [];
    for (let line of parts) {
      if (line.startsWith('[FILE_ATTACHMENT:')) {
        const fName = line.substring(17, line.lastIndexOf(']')).trim();
        attachedFile = { name: fName, data: '' };
      } else if (line.startsWith('data:') && attachedFile) {
        attachedFile.data = line;
      } else {
        cleanNotes.push(line);
      }
    }
    displayText = cleanNotes.join('\n').trim();
  }

  const handleDownload = () => {
    if (!attachedFile || !attachedFile.data) return;
    const link = document.createElement('a');
    link.href = attachedFile.data;
    link.download = attachedFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderProfileSections = (text) => {
    if (!text) return null;
    const sectionsRaw = text.split(/===(.*?)===/g);
    const elements = [];
    const introText = sectionsRaw[0].trim();
    if (introText && introText !== '[PAST HISTORY]' && introText !== '[PROFILE DELETED]') {
      elements.push(<p key="intro" style={{ marginBottom: 12 }}>{introText.replace('[PAST HISTORY]', '').trim()}</p>);
    }
    if (text.includes('[PROFILE DELETED]')) {
      elements.push(<div key="deleted" className="error-text" style={{ marginTop: 10 }}>This student profile has been completely deleted.</div>);
      return elements;
    }
    for (let i = 1; i < sectionsRaw.length; i += 2) {
      const sectionName = sectionsRaw[i].trim();
      const sectionContent = sectionsRaw[i + 1] ? sectionsRaw[i + 1].trim() : '';
      if (!sectionContent) continue;
      const lines = sectionContent.split('\n');
      const fields = [];
      let currentField = null;
      for (const line of lines) {
        if (!line.trim()) continue;
        const colIdx = line.indexOf(':');
        if (line.startsWith('Approval Status:')) {
          fields.push({ key: 'Approval Status', value: line.substring(16).trim() });
          continue;
        }
        if (colIdx > 0 && colIdx < 40) {
          if (currentField) fields.push(currentField);
          currentField = { key: line.substring(0, colIdx).trim(), value: line.substring(colIdx + 1).trim() };
        } else if (currentField) {
          currentField.value += ' ' + line.trim();
        } else {
          fields.push({ key: '', value: line.trim() });
        }
      }
      if (currentField) fields.push(currentField);
      if (fields.length > 0) {
        elements.push(
          <div className="profile-section-card" key={sectionName}>
            <div className="profile-section-title">{sectionName}</div>
            <div className="profile-field-grid">
              {fields.map((f, idx) => (
                <div className="profile-field" key={idx}>
                  {f.key && <span className="profile-field-label">{f.key}</span>}
                  <span className="profile-field-value">{f.value || 'None'}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
    }
    if (elements.length === 0 && introText) {
      return <p style={{ whiteSpace: 'pre-wrap' }}>{text}</p>;
    }
    return elements;
  };

  const renderConsultationData = (text) => {
    if (!text) return null;

    // Check if it matches the current structured format saved by the Doctor Portal
    if (text.includes('[Visit Type:') || text.includes('Symptoms:')) {
      let visitType = 'General';
      let severity = 'Not Specified';
      let symptoms = 'None recorded';
      let notes = text;

      const typeMatch = text.match(/\[Visit Type: (.*?)\]/);
      if (typeMatch) visitType = typeMatch[1];

      const sevMatch = text.match(/\[Severity: (.*?)\]/);
      if (sevMatch) severity = sevMatch[1];

      const sympMatch = text.match(/Symptoms: (.*?)(?=\nNotes:|\n\[|$)/);
      if (sympMatch) symptoms = sympMatch[1].trim();

      const notesMatch = text.match(/Notes: ([\s\S]*)/);
      if (notesMatch) notes = notesMatch[1].trim();
      else if (typeMatch || sevMatch || sympMatch) {
        notes = text.replace(/\[Visit Type: .*?\]|\[Severity: .*?\]|Symptoms: .*?(?=\n|$)/g, '').trim();
      }

      const getSeverityMeta = (sev) => {
        const s = sev.toLowerCase();
        if (s.includes('mild')) return { cls: 'severity-mild', icon: '🟢', label: 'Mild Condition' };
        if (s.includes('moderate')) return { cls: 'severity-moderate', icon: '🟡', label: 'Moderate Condition' };
        if (s.includes('severe')) return { cls: 'severity-severe', icon: '🔴', label: 'Severe Condition' };
        return { cls: 'severity-mild', icon: '⚪', label: sev };
      };

      const sevMeta = getSeverityMeta(severity);

      // Parse symptoms into list items
      const symptomList = symptoms
        .split(/,|;/)
        .map(s => s.trim())
        .filter(Boolean);

      const getSymptomIndicator = () => {
        const sympLower = symptoms.toLowerCase();
        if (sympLower.includes('none') || sympLower === 'none recorded' || severity.toLowerCase() === 'none') {
           return { text: '🟢 Normal', color: '#22C55E' };
        }
        if (severity.toLowerCase().includes('severe')) {
           return { text: '🔴 Severe', color: '#EF4444' };
        }
        return { text: '🟡 Mild', color: '#EAB308' };
      };
      const sympInd = getSymptomIndicator();

      return (
        <div className="patient-status-card">
          <div className="patient-status-header">Patient Status / Health Summary</div>
          <table className="patient-status-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Indicator</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Visit Type</td>
                <td><span className="patient-value-text">{visitType} Visit</span></td>
                <td>
                  <span className="status-indicator">
                    {sevMeta.icon} {sevMeta.label}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Symptoms</td>
                <td>
                  {symptomList.length > 1 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px' }} className="patient-value-text">
                      {symptomList.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  ) : (
                    <span className="patient-value-text">{symptoms}</span>
                  )}
                </td>
                <td>
                  <span className="status-indicator" style={{ color: sympInd.color }}>
                    {sympInd.text}
                  </span>
                </td>
              </tr>
              {notes && notes !== 'No further notes provided.' ? (
                <tr>
                  <td>Clinical Notes</td>
                  <td><span className="patient-value-text">{notes}</span></td>
                  <td>—</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      );
    }

    // Fallback for older free-text format or unrecognised notes
    return (
      <div className="consult-card">
        <div className="consult-section">
          <div className="consult-section-header">
            <span className="consult-section-icon">📝</span>
            <span className="consult-section-title">Notes</span>
          </div>
          <div className="consult-section-body">
            <span className="consult-section-text" style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={`record-item ${typeClass}`}>
        <div className="record-header" onClick={() => setCollapsed(c => !c)} style={{ cursor: 'pointer' }}>
          <span className="record-date">📅 {date}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge ${typeClass}-badge`}>{typeLabel}</span>
            <span className={`record-collapse-arrow ${collapsed ? 'collapsed' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </div>
        </div>
        {!collapsed && (
          <div className="record-body">
            {isHistory ? (
              <div style={{ marginTop: 10 }}>{renderProfileSections(displayText)}</div>
            ) : (
              renderConsultationData(displayText)
            )}

            {attachedFile && (
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setPdfOpen(true)}
                  className="pdf-view-btn"
                >
                  📄 View PDF
                </button>
                <button
                  onClick={handleDownload}
                  className="pdf-dl-btn"
                >
                  ⬇️ Download
                </button>
                <span style={{ fontSize: '0.78rem', color: 'var(--t3)' }}>📎 {attachedFile.name}</span>
              </div>
            )}

            {record.prescription && record.prescription !== 'N/A' && (
              <div className="consult-prescription-card">
                <div className="consult-prescription-header">
                  <span className="consult-presc-icon">💊</span>
                  <span className="consult-presc-title">Prescription</span>
                </div>
                <div className="consult-presc-divider" />
                <div className="consult-presc-items">
                  {record.prescription.split('\n').filter(Boolean).map((line, i) => {
                    const clean = line.replace(/^[•\-\*]\s*/, '').trim();
                    if (!clean) return null;
                    const dashSplit = clean.split(/—|-(?!\d)/);
                    const drugName = dashSplit[0].trim();
                    const rest = dashSplit.slice(1).join(' ').trim();
                    return (
                      <div className="consult-presc-item" key={i}>
                        <span className="consult-presc-drug">{drugName}</span>
                        {rest && <span className="consult-presc-detail">{rest}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fullscreen PDF modal ── */}
      {pdfOpen && attachedFile?.data && ReactDOM.createPortal(
        <div className="pdf-fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPdfOpen(false); }}>
          <div className="pdf-fs-topbar">
            <div className="pdf-fs-filename">📄 {attachedFile.name}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pdf-fs-dl-btn" onClick={handleDownload}>⬇️ Download</button>
              <button className="pdf-fs-close-btn" onClick={() => setPdfOpen(false)}>✕ Close</button>
            </div>
          </div>
          <iframe
            src={attachedFile.data}
            title={attachedFile.name}
            className="pdf-fs-frame"
          />
        </div>,
        document.body
      )}
    </>
  );
}

/* =========================================
   LOADER
   ========================================= */
function Loader() {
  return (
    <div className="loader-container">
      <div className="spinner"></div>
    </div>
  );
}

/* =========================================
   DARK MODE TOGGLE
   ========================================= */
function DarkModeToggle() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <div className="dark-toggle-row">
      <div className="dark-toggle-info">
        <span className="dark-toggle-icon">{dark ? <MoonIcon size={26} /> : <SunIcon size={26} />}</span>
        <div>
          <div className="dark-toggle-label">{dark ? 'Dark Mode' : 'Light Mode'}</div>
          <div className="dark-toggle-desc">{dark ? 'Easy on the eyes in low light' : 'Bright and clean interface'}</div>
        </div>
      </div>
      <button
        type="button"
        className={`toggle-switch ${dark ? 'toggle-on' : ''}`}
        onClick={toggle}
        aria-label="Toggle dark mode"
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}

export default App;