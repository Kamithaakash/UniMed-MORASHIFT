import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const API_BASE_URL = 'https://unimed-backend.vercel.app';

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

/* ---- Utility: Check if a record is a profile/medical-form record ---- */
const isProfileRecord = (diagnosis) => {
  if (!diagnosis) return false;
  // Modern tagged records
  if (diagnosis.includes('[PAST HISTORY]')) return true;
  if (diagnosis.includes('=== PERSONAL INFORMATION ===')) return true;
  if (diagnosis.includes('[PROFILE DELETED]')) return true;
  // Legacy records saved before the [PAST HISTORY] tag was introduced —
  // they contain multiple characteristic medical-form field headers together
  const hasMedicalFields =
    diagnosis.includes('Full Name:') &&
    (diagnosis.includes('NIC No:') || diagnosis.includes('Faculty:') || diagnosis.includes('Date of Birth:'));
  if (hasMedicalFields) return true;
  return false;
};

/* ---- Utility: Parse Profile Status ---- */
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
const Toast = ({ message, show, onClose }) => {
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
          <button className="uni-confirm-btn cancel" onClick={onCancel}>
            {config.cancelText || 'Cancel'}
          </button>
          <button className="uni-confirm-btn confirm" onClick={onConfirm}>
            {config.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [role, setRole] = useState(() => localStorage.getItem('auth_role') || 'Doctor');
  const [username, setUsername] = useState(() => localStorage.getItem('auth_username') || '');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('auth_loggedIn') === 'true');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  /* ---- Custom Toast & Confirm State ---- */
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef(null);

  const [confirmConfig, setConfirmConfig] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const showAlert = useCallback((message) => {
    setToastMessage(message);
    setShowToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 5000);
  }, []);

  const showConfirm = useCallback((message, onConfirmCallback, confirmText = 'Confirm', cancelText = 'Cancel') => {
    setConfirmConfig({ message, onConfirmCallback, confirmText, cancelText });
    setShowConfirmModal(true);
  }, []);

  const handleConfirmAction = () => {
    if (confirmConfig?.onConfirmCallback) confirmConfig.onConfirmCallback();
    setShowConfirmModal(false);
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
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

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="background-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>

        {/* Dark mode toggle — top right */}
        <button
          className="login-theme-btn"
          onClick={() => setDarkMode(v => !v)}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <SunIcon size={19} /> : <MoonIcon size={19} />}
        </button>

        {/* ---- SPLIT LAYOUT ---- */}
        <div className="login-split">

          {/* LEFT — hero / branding panel */}
          <div className="login-hero slide-top">
            <div className="login-hero-inner">
              <div className="hero-badge">🏥 University of Moratuwa</div>
              <h1 className="hero-title">UniMed<span className="logo-dot">.</span></h1>
              <p className="hero-sub">The all-in-one digital health platform for the University Medical Center</p>

              <div className="hero-features">
                <div className="hero-feat">
                  <span className="feat-icon">🩺</span>
                  <div>
                    <div className="feat-title">Doctor Consultations</div>
                    <div className="feat-desc">Record diagnoses, prescriptions &amp; clinical notes with voice input</div>
                  </div>
                </div>
                <div className="hero-feat">
                  <span className="feat-icon">🧪</span>
                  <div>
                    <div className="feat-title">Lab Reports</div>
                    <div className="feat-desc">Upload and manage lab results directly to student records</div>
                  </div>
                </div>
                <div className="hero-feat">
                  <span className="feat-icon">📋</span>
                  <div>
                    <div className="feat-title">Student Health Profiles</div>
                    <div className="feat-desc">Comprehensive medical history, immunisation &amp; family records</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — login form */}
          <div className="login-form-side">
            <div className="glass-panel login-panel slide-top">
              <div className="login-header">
                <img
                  src="/University_of_Moratuwa_logo.png"
                  alt="University of Moratuwa"
                  className="uom-logo"
                />
                <h2 className="logo-text" style={{ fontSize: '2rem' }}>UniMed<span className="logo-dot">.</span></h2>
                <p className="login-subtext">Sign in to your portal</p>
              </div>
              <div className="role-selector">
                {['Student', 'Doctor', 'Lab Assistant'].map(r => (
                  <button
                    key={r}
                    className={`role-btn ${role === r ? 'active' : ''}`}
                    onClick={() => { setRole(r); setLoginError(''); }}
                    type="button"
                  >{r}</button>
                ))}
              </div>
              <form onSubmit={handleLogin} className="login-form">
                <div className="input-group">
                  <label>{role === 'Student' ? 'Index Number' : `${role} ID`}</label>
                  <input
                    type="text" value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={`e.g. ${role === 'Student' ? '220001V' : 'M-1234'}`}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Password</label>
                  <div className="pwd-input-wrap">
                    <input
                      type={showLoginPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <button type="button" className="pwd-eye-btn" onClick={() => setShowLoginPwd(v => !v)} tabIndex={-1}>
                      {showLoginPwd ? <EyeOff /> : <EyeOpen />}
                    </button>
                  </div>
                </div>
                {loginError && <p className="error-text bounce-in">{loginError}</p>}
                <button type="submit" className="btn-primary login-submit-btn" disabled={isLoggingIn}>
                  {isLoggingIn ? 'Verifying...' : <>Access Portal <span className="arrow">→</span></>}
                </button>
              </form>

              <p className="login-footer-note">
                Protected system — authorised personnel only
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Toast message={toastMessage} show={showToast} onClose={() => setShowToast(false)} />
      <ConfirmModal
        show={showConfirmModal}
        config={confirmConfig}
        onCancel={handleCancelConfirm}
        onConfirm={handleConfirmAction}
      />
      {role === 'Doctor' && <DoctorPortal handleLogout={handleLogout} showAlert={showAlert} showConfirm={showConfirm} />}
      {role === 'Student' && <StudentPortal indexNumber={username} handleLogout={handleLogout} showAlert={showAlert} showConfirm={showConfirm} />}
      {role === 'Lab Assistant' && <LabPortal handleLogout={handleLogout} showAlert={showAlert} showConfirm={showConfirm} />}
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
    setDob(extractVal('Date of Birth'));
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

  const handleDobChange = (e) => {
    let input = e.target.value.replace(/\D/g, ''); // Remove non-digits

    // Extract first 4 digits of NIC (if it looks like a 12-digit NIC starting with 19 or 20)
    let yearFromNic = '';
    if (nic && nic.length === 12 && (nic.startsWith('19') || nic.startsWith('20'))) {
      yearFromNic = nic.substring(0, 4);
    }

    if (input.length > 8) input = input.substring(0, 8); // Max 8 digits

    let formatted = input;

    // Auto insert first slash
    if (input.length >= 2) {
      formatted = input.substring(0, 2) + '/';
      if (input.length > 2) {
        // Auto insert second slash
        formatted += input.substring(2, 4) + '/';
        if (input.length > 4) {
          formatted += input.substring(4, 8);
        } else if (input.length === 4 && yearFromNic) {
          // Auto fill year if NIC is provided
          formatted += yearFromNic;
        }
      }
    }
    setDob(formatted);
  };

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
                    type="text"
                    value={dob}
                    onChange={handleDobChange}
                    placeholder="dd/mm/yyyy"
                    maxLength="10"
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
                  onClick={() => { const needName = isFirstTime && !fullName.trim(); if (needName || !nic.trim() || !faculty.trim() || !dob || !sex) { showAlert('Please fill all required fields (*)'); return; } setStep(2); }}>
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

  const consultations = records.filter(r => !r.diagnosis?.includes('[LAB REPORT') && !isProfileRecord(r.diagnosis));
  const labReports = records.filter(r => r.diagnosis?.includes('[LAB REPORT'));

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

          <div className="stat-row">
            <div className="stat-card stat-blue"><div className="stat-icon">👤</div><div><div className="stat-num">{studentData.name.split(' ')[0]}</div><div className="stat-label">Student</div></div></div>
            <div className="stat-card stat-purple"><div className="stat-icon">🧪</div><div><div className="stat-num">{labReports.length}</div><div className="stat-label">Lab Reports</div></div></div>
            <div className="stat-card stat-amber"><div className="stat-icon">📋</div><div><div className="stat-num">{approvalStatus === 'Approved' ? 'Approved' : approvalStatus === 'Rejected' ? 'Rejected' : approvalStatus === 'Pending' ? 'Pending' : hasHistory ? 'Completed' : 'Pending'}</div><div className="stat-label">Profile Status</div></div></div>
          </div>

          <div className="content-grid">
            <div className="content-col-wide">
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

/* =========================================
   DOCTOR PORTAL
   ========================================= */
function DoctorPortal({ handleLogout, showAlert, showConfirm }) {
  const [searchId, setSearchId] = useState(() => localStorage.getItem('doctor_last_search') || '');
  const [student, setStudent] = useState(null);
  const [diagnosisDetails, setDiagnosisDetails] = useState('');
  const [prescription, setPrescription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [docActiveTab, setDocActiveTab] = useState('consultations');
  const [activeView, setActiveView] = useState('dashboard');
  const recognitionRef = useRef(null);

  const fetchStudent = useCallback(async (id) => {
    if (!id) return;
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
      }
      else { showAlert("Student not found."); setStudent(null); }
    } catch { showAlert("Error searching student."); }
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

  const toggleVoice = () => {
    if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return showAlert("Browser does not support Voice to Text.");
    const recognition = new SR();
    recognition.continuous = true; recognition.interimResults = true;
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (e) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      if (final) setDiagnosisDetails(prev => prev + final);
    };
    recognition.start();
  };

  const saveConsultation = async () => {
    if (!student || (!diagnosisDetails && !prescription)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/student/${student.indexNumber}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis: diagnosisDetails, prescription })
      });
      if (res.ok) { showAlert("Consultation Saved!"); setDiagnosisDetails(''); setPrescription(''); searchStudent(); }
    } catch { showAlert("Failed to save."); }
  };

  const records = student?.medicalRecords || [];
  const LAB_REPORT_TAG = '[LAB REPORT';
  const docConsultations = records.filter(r => !isProfileRecord(r.diagnosis) && !r.diagnosis?.includes(LAB_REPORT_TAG));
  const labReports = records.filter(r => r.diagnosis?.includes(LAB_REPORT_TAG));

  return (
    <div className="dash-layout fade-in">
      <Sidebar role="Doctor" name="Dr. Smith" onLogout={handleLogout} activeView={activeView} onNavigate={setActiveView} />

      {activeView === 'settings' ? (
        <SettingsPanel role="Doctor" />
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
              <button className="btn-primary" style={{ width: 'auto', padding: '9px 20px' }} onClick={searchStudent}>Search</button>
            </div>
          </div>

          {student ? (
            <>
              {/* PATIENT STAT ROW */}
              <div className="stat-row">
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

              <div className="content-grid">
                {/* LEFT — tabbed history panel */}
                <div className="content-col-wide">
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
                        📋 Medical Profile
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

                {/* RIGHT — new consultation */}
                <div className="content-col-narrow">
                  <div className="panel consult-panel">
                    <div className="panel-header" style={{ marginBottom: 16 }}>
                      <h3 className="panel-title">New Consultation</h3>
                      <button
                        className={`btn-icon ${isListening ? 'pulse-btn recording' : ''}`}
                        onClick={toggleVoice}
                      >
                        {isListening ? '⏹ Stop' : '🎙 Voice'}
                      </button>
                    </div>
                    <div className="form-stack">
                      <label className="form-label">Clinical Notes &amp; Diagnosis</label>
                      <textarea
                        className="modern-textarea"
                        placeholder="Clinical notes, diagnosis, observations..."
                        rows="5"
                        value={diagnosisDetails}
                        onChange={e => setDiagnosisDetails(e.target.value)}
                      />
                      <label className="form-label">Prescription &amp; Treatment</label>
                      <textarea
                        className="modern-textarea"
                        placeholder="Prescription & Treatment Plan..."
                        rows="3"
                        value={prescription}
                        onChange={e => setPrescription(e.target.value)}
                      />
                      <button className="btn-primary w-full" onClick={saveConsultation}>
                        Save to Patient Record ✓
                      </button>
                    </div>
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
function LabPortal({ handleLogout, showAlert, showConfirm }) {
  const [searchId, setSearchId] = useState(() => localStorage.getItem('lab_last_search') || '');
  const [student, setStudent] = useState(null);
  const [reportTitle, setReportTitle] = useState('');
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [activeView, setActiveView] = useState('dashboard');
  const [labProfileEditMode, setLabProfileEditMode] = useState(false);
  const [labProfileText, setLabProfileText] = useState('');
  const [editStep, setEditStep] = useState(1);

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

  const handleEditDobChange = (e) => {
    let input = e.target.value.replace(/\D/g, '');
    if (input.length > 8) input = input.substring(0, 8);
    let formatted = input;
    if (input.length >= 2) {
      formatted = input.substring(0, 2) + '/';
      if (input.length > 2) {
        formatted += input.substring(2, 4) + '/';
        if (input.length > 4) formatted += input.substring(4, 8);
      }
    }
    setEDob(formatted);
  };


  const fetchStudent = useCallback(async (id) => {
    if (!id) return;
    setShowRegister(false);
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
      }
      else { setShowRegister(true); setStudent(null); }
    } catch { showAlert("Error finding student."); }
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
    setEDob(extractVal('Date of Birth'));
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
      <Sidebar role="Lab Assistant" name="Lab Dept" onLogout={handleLogout} activeView={activeView} onNavigate={setActiveView} />

      {activeView === 'settings' ? (
        <SettingsPanel role="Lab Assistant" />
      ) : (
        <div className="dash-main">
          <div className="topbar">
            <div>
              <h1 className="topbar-title">Lab Results Entry</h1>
            </div>
          </div>

          {/* STAT ROW */}
          <div className="stat-row">
            <div className="stat-card stat-blue">
              <div className="stat-icon">🧪</div>
              <div><div className="stat-num">Lab</div><div className="stat-label">Department</div></div>
            </div>
            <div className="stat-card stat-green">
              <div className="stat-icon">✅</div>
              <div><div className="stat-num">{student ? '1' : '0'}</div><div className="stat-label">Student Verified</div></div>
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
              <button className="btn-secondary" onClick={searchStudent}>Verify Student</button>
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
                <div className="verified-badge">✓ Verified: {student.name} ({student.indexNumber})</div>

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
                                  <input type="text" value={eDob} onChange={handleEditDobChange} placeholder="dd/mm/yyyy" maxLength="10" />
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
          <span className="s-nav-icon">⊞</span> Dashboard
        </button>
        <button
          className={`s-nav-item ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="s-nav-icon">⚙</span> Settings
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

    // Split into sections based on '===' headers
    const sectionsRaw = text.split(/===(.*?)===/g);

    // sectionsRaw[0] will contain anything before the first '===' (e.g. '[PAST HISTORY]')
    // sectionsRaw[1] will be the first header name, sectionsRaw[2] the content, and so on...

    const elements = [];

    // Check if there's any important info before the first section
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

      // Basic Key: Value parser
      for (const line of lines) {
        if (!line.trim()) continue;
        const colIdx = line.indexOf(':');

        // Exclude Approval Status if it's mixed in the last section, we render it separately if needed or as a field.
        if (line.startsWith('Approval Status:')) {
          fields.push({ key: 'Approval Status', value: line.substring(16).trim() });
          continue;
        }

        if (colIdx > 0 && colIdx < 40) { // arbitrary max key length guard
          if (currentField) fields.push(currentField);
          currentField = {
            key: line.substring(0, colIdx).trim(),
            value: line.substring(colIdx + 1).trim()
          };
        } else if (currentField) {
          // If a line doesn't have a colon, append it to the previous value (multi-line value)
          currentField.value += ' ' + line.trim();
        } else {
          // No current field and no colon, just push as a raw field
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

    // Fallback: If no '===' sections were found (legacy record), render it as plain text
    if (elements.length === 0 && introText) {
      return <p style={{ whiteSpace: 'pre-wrap' }}>{text}</p>;
    }

    return elements;
  };

  return (
    <div className={`record-item ${typeClass}`}>
      <div className="record-header">
        <span className="record-date">📅 {date}</span>
        <span className={`badge ${typeClass}-badge`}>{typeLabel}</span>
      </div>
      <div className="record-body">
        {isHistory ? (
          <div style={{ marginTop: 10 }}>{renderProfileSections(displayText)}</div>
        ) : (
          <p style={{ whiteSpace: 'pre-wrap' }}><strong>Notes:</strong><br />{displayText}</p>
        )}

        {attachedFile && (
          <div style={{ marginTop: 12, marginBottom: 8 }}>
            <button
              onClick={handleDownload}
              style={{
                background: 'var(--white)', border: '1px solid var(--blue)',
                padding: '6px 14px', borderRadius: 'var(--r-sm)', color: 'var(--blue)',
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
              }}
            >
              📎 Download: {attachedFile.name}
            </button>
          </div>
        )}

        {record.prescription && record.prescription !== 'N/A' && (
          <p style={{ marginTop: 8 }}><strong>Prescription:</strong> {record.prescription}</p>
        )}
      </div>
    </div>
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