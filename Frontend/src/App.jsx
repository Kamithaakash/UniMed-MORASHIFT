import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE_URL = "https://unimed-backend.vercel.app";

function App() {
  const [role, setRole] = useState('Doctor');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    if (role === 'Doctor' && password === 'doctor123') setIsLoggedIn(true);
    else if (role === 'Lab Assistant' && password === 'lab123') setIsLoggedIn(true);
    else if (role === 'Student' && password === 'student123') setIsLoggedIn(true);
    else setLoginError('Incorrect password or credentials.');
  };

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="background-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
        <div className="glass-panel login-panel slide-top">
          <div className="login-header">
            <img
              src="/University_of_Moratuwa_logo.png"
              alt="University of Moratuwa"
              className="uom-logo"
            />
            <h1 className="logo-text">UniMed<span className="logo-dot">.</span></h1>
            <p className="login-subtext">University Medical Center System</p>
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
              <input
                type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required
              />
            </div>
            {loginError && <p className="error-text bounce-in">{loginError}</p>}
            <button type="submit" className="btn-primary login-submit-btn">
              Access Portal <span className="arrow">→</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {role === 'Doctor' && <DoctorPortal handleLogout={handleLogout} />}
      {role === 'Student' && <StudentPortal indexNumber={username} handleLogout={handleLogout} />}
      {role === 'Lab Assistant' && <LabPortal handleLogout={handleLogout} />}
    </div>
  );
}

/* =========================================
   STUDENT PORTAL
   ========================================= */
function StudentPortal({ indexNumber, handleLogout }) {
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [step, setStep] = useState(1);

  const [nic, setNic] = useState('');
  const [faculty, setFaculty] = useState('');
  const [telNo, setTelNo] = useState('');
  const [dob, setDob] = useState('');
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchStudentData(); }, [indexNumber]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/student/${indexNumber}`);
      if (res.ok) {
        const data = await res.json();
        // Since the backend doesn't upsert the root 'name' field,
        // we extract the most recent name from their latest medical form history.
        const pastRecords = data.medicalRecords?.filter(r => r.diagnosis?.includes('[PAST HISTORY]')) || [];
        if (pastRecords.length > 0) {
          pastRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          const latestHistory = pastRecords[0].diagnosis;
          const match = latestHistory.match(/Full Name: (.*?)(?=\n|$)/);
          if (match && match[1].trim() && match[1].trim() !== 'None' && match[1].trim() !== 'N/A') {
            data.name = match[1].trim();
          }
        }
        setStudentData(data);
        setIsFirstTime(false);
      }
      else { setIsFirstTime(true); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const populateFormWithPastHistory = () => {
    const records = studentData?.medicalRecords || [];
    const pastRecords = records.filter(r => r.diagnosis?.includes('[PAST HISTORY]'));
    if (pastRecords.length === 0) return;

    // Sort to get the most recent past history block
    pastRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const latestHistory = pastRecords[0].diagnosis;

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
Chickenpox: ${vacChicken || 'Not recorded'}`;

      await fetch(`${API_BASE_URL}/student/${indexNumber}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis: profileRecord, prescription: 'N/A' })
      });
      await fetchStudentData();
      setShowMedForm(false);
    } catch { alert('Submission failed. Please try again.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <Loader />;

  const renderMedicalForm = (isIncomplete) => {
    const stepTitles = ['Personal Info', 'Family History', 'Medical History', 'Immunisation'];
    const stepIcons = ['👤', '👨‍👩‍👧', '🩺', '💉'];
    return (
      <div className="setup-screen fade-in">
        <div className="setup-card-wide">
          <div className="setup-top-header">
            <div>
              <h2 className="logo-text" style={{ fontSize: '1.9rem' }}>UniMed<span className="logo-dot">.</span></h2>
              <p className="setup-subtitle">
                {isIncomplete ? `Complete your medical profile — ${studentData?.name || indexNumber}` : 'University of Moratuwa — Student Medical Examination'}
              </p>
            </div>
            <button className="btn-outline-danger" onClick={() => { if (isIncomplete) setShowMedForm(false); else handleLogout(); }}>
              {isIncomplete ? '← Back to Dashboard' : 'Logout'}
            </button>
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
            <div className="setup-progress-fill" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
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
                <div className="input-group"><label>Faculty *</label><input type="text" value={faculty} onChange={e => setFaculty(e.target.value)} placeholder="e.g. Engineering" /></div>
                <div className="input-group"><label>Student Tel No</label><input type="text" value={telNo} onChange={e => setTelNo(e.target.value)} placeholder="e.g. 0771234567" /></div>
                <div className="input-group"><label>Date of Birth *</label><input type="date" value={dob} onChange={e => setDob(e.target.value)} /></div>
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
              <div className="input-group"><label>Extracurricular Activities</label><input type="text" value={extracurricular} onChange={e => setExtracurricular(e.target.value)} placeholder="Sports / Music / Dancing / Leadership / Arts / None" /></div>
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
                  onClick={() => { const needName = isFirstTime && !fullName.trim(); if (needName || !nic.trim() || !faculty.trim() || !dob || !sex) { alert('Please fill all required fields (*)'); return; } setStep(2); }}>
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
                <button className="btn-primary" style={{ width: 'auto', padding: '12px 36px', opacity: submitting ? 0.7 : 1 }} onClick={handleSubmitMedicalForm} disabled={submitting}>
                  {submitting ? 'Submitting...' : '✓ Submit Medical Form'}
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
  const hasHistory = records.some(r => r.diagnosis?.includes('[PAST HISTORY]'));
  const consultations = records.filter(r => !r.diagnosis?.includes('[LAB REPORT') && !r.diagnosis?.includes('[PAST HISTORY]'));
  const labReports = records.filter(r => r.diagnosis?.includes('[LAB REPORT'));

  if (showMedForm) return renderMedicalForm(!hasHistory);

  return (
    <div className="dash-layout fade-in">
      <Sidebar role="Student" name={studentData.name} onLogout={handleLogout} />
      <div className="dash-main">
        <div className="topbar">
          <div>
            <h1 className="topbar-title">Welcome back, {studentData.name.split(' ')[0]} 👋</h1>
            <p className="topbar-sub">Your health dashboard — University Medical Center</p>
          </div>
          <span className={`status-pill ${hasHistory ? 'status-active' : 'status-incomplete'}`}>
            {hasHistory ? '● Active Profile' : '⚠ Incomplete Profile'}
          </span>
        </div>

        {!hasHistory && (
          <div className="incomplete-banner">
            <div className="incomplete-banner-left">
              <div className="incomplete-banner-icon">📋</div>
              <div>
                <div className="incomplete-banner-title">Your medical profile is incomplete</div>
                <div className="incomplete-banner-text">
                  Your account was created by the lab assistant but your full medical details have not been filled in yet.
                  Please complete your profile so the medical team can assist you properly.
                </div>
              </div>
            </div>
            <button className="btn-complete-profile" onClick={() => { setStep(1); setShowMedForm(true); }}>
              Complete Profile →
            </button>
          </div>
        )}

        <div className="stat-row">
          <div className="stat-card stat-blue"><div className="stat-icon">🩺</div><div><div className="stat-num">{consultations.length}</div><div className="stat-label">Consultations</div></div></div>
          <div className="stat-card stat-purple"><div className="stat-icon">🧪</div><div><div className="stat-num">{labReports.length}</div><div className="stat-label">Lab Reports</div></div></div>
          <div className="stat-card stat-amber"><div className="stat-icon">📅</div><div><div className="stat-num">{records.length}</div><div className="stat-label">Total Records</div></div></div>
        </div>

        <div className="content-grid">
          <div className="content-col-wide">
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">Medical History &amp; Consultations</h3>
                <span className="panel-count">{records.length} records</span>
              </div>
              <div className="records-scroll">
                {records.filter(r => !r.diagnosis?.includes('[PAST HISTORY]')).length > 0 ? [...records.filter(r => !r.diagnosis?.includes('[PAST HISTORY]'))].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((rec, i) => <RecordItem key={i} record={rec} />) : (
                  <div className="empty-state-box"><div className="empty-big-icon">📭</div><p>No medical records yet.</p></div>
                )}
              </div>
            </div>
          </div>

          <div className="content-col-narrow">
            <div className="panel profile-panel">
              <div className="profile-avatar-lg">{studentData.name.charAt(0)}</div>
              <div className="profile-name">{studentData.name}</div>
              <div className="profile-id">Index: {studentData.indexNumber || indexNumber}</div>
              <div className="profile-badges">
                <span className="mini-badge blue">Student</span>
                <span className={`mini-badge ${hasHistory ? 'green' : 'orange'}`}>{hasHistory ? 'Complete' : 'Incomplete'}</span>
              </div>
              {!hasHistory ? (
                <button className="btn-complete-profile-sm" onClick={() => { setFullName(studentData.name); setStep(1); setShowMedForm(true); }}>
                  📋 Fill Medical Form
                </button>
              ) : (
                <button className="btn-outline-secondary" style={{ width: '100%', marginTop: '12px', padding: '10px' }} onClick={() => {
                  populateFormWithPastHistory();
                  setStep(1);
                  setShowMedForm(true);
                }}>
                  ✏️ Edit Profile
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
    </div>
  );
}

/* =========================================
   DOCTOR PORTAL
   ========================================= */
function DoctorPortal({ handleLogout }) {
  const [searchId, setSearchId] = useState('');
  const [student, setStudent] = useState(null);
  const [diagnosisDetails, setDiagnosisDetails] = useState('');
  const [prescription, setPrescription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const searchStudent = async () => {
    if (!searchId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/student/${searchId}`);
      if (res.ok) {
        const data = await res.json();
        const pastRecords = data.medicalRecords?.filter(r => r.diagnosis?.includes('[PAST HISTORY]')) || [];
        if (pastRecords.length > 0) {
          pastRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          const match = pastRecords[0].diagnosis.match(/Full Name: (.*?)(?=\n|$)/);
          if (match && match[1].trim() && match[1].trim() !== 'None' && match[1].trim() !== 'N/A') {
            data.name = match[1].trim();
          }
        }
        setStudent(data);
      }
      else { alert("Student not found."); setStudent(null); }
    } catch { alert("Error searching student."); }
  };

  const toggleVoice = () => {
    if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Browser does not support Voice to Text.");
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
      if (res.ok) { alert("Consultation Saved!"); setDiagnosisDetails(''); setPrescription(''); searchStudent(); }
    } catch { alert("Failed to save."); }
  };

  const records = student?.medicalRecords || [];

  return (
    <div className="dash-layout fade-in">
      <Sidebar role="Doctor" name="Dr. Smith" onLogout={handleLogout} />

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
                  <div className="stat-num">{records.length}</div>
                  <div className="stat-label">Total Records</div>
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
              {/* LEFT — history */}
              <div className="content-col-wide">
                <div className="panel">
                  <div className="panel-header">
                    <h3 className="panel-title">Patient History — {student.name}</h3>
                    <span className="panel-count">{records.length} records</span>
                  </div>
                  <div className="records-scroll">
                    {records.filter(r => !r.diagnosis?.includes('[PAST HISTORY]')).length > 0 ? [...records.filter(r => !r.diagnosis?.includes('[PAST HISTORY]'))].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((rec, i) => (
                      <RecordItem key={i} record={rec} />
                    )) : <div className="empty-state-box"><div className="empty-big-icon">📂</div><p>No previous records.</p></div>}
                  </div>
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
    </div>
  );
}

/* =========================================
   LAB PORTAL
   ========================================= */
function LabPortal({ handleLogout }) {
  const [searchId, setSearchId] = useState('');
  const [student, setStudent] = useState(null);
  const [reportTitle, setReportTitle] = useState('');
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');

  const searchStudent = async () => {
    if (!searchId) return;
    setShowRegister(false);
    try {
      const res = await fetch(`${API_BASE_URL}/student/${searchId}`);
      if (res.ok) {
        const data = await res.json();
        const pastRecords = data.medicalRecords?.filter(r => r.diagnosis?.includes('[PAST HISTORY]')) || [];
        if (pastRecords.length > 0) {
          pastRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          const match = pastRecords[0].diagnosis.match(/Full Name: (.*?)(?=\n|$)/);
          if (match && match[1].trim() && match[1].trim() !== 'None' && match[1].trim() !== 'N/A') {
            data.name = match[1].trim();
          }
        }
        setStudent(data);
      }
      else { setShowRegister(true); setStudent(null); }
    } catch { alert("Error finding student."); }
  };

  const registerStudent = async () => {
    if (!searchId || !newStudentName.trim()) return alert("Please enter the student's name.");
    try {
      const res = await fetch(`${API_BASE_URL}/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexNumber: searchId, name: newStudentName })
      });
      if (res.ok) {
        alert("Student Registered! You can now upload the lab report.");
        setStudent({ indexNumber: searchId, name: newStudentName });
        setShowRegister(false);
      } else {
        alert("Registration failed.");
      }
    } catch { alert("Failed to register student."); }
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
      alert("File is too large! Please select a file under 4MB.");
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
    if (!student || !reportTitle || !fileData) return alert('Please enter a title and attach a file.');
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
        alert("Lab Report Uploaded!");
        setReportTitle('');
        setFileData(null);
        setFileName('');
        setStudent(null);
        setSearchId('');
      }
    } catch { alert("Failed to upload."); }
  };

  return (
    <div className="dash-layout fade-in">
      <Sidebar role="Lab Assistant" name="Lab Dept" onLogout={handleLogout} />

      <div className="dash-main">
        <div className="topbar">
          <div>
            <h1 className="topbar-title">Lab Results Entry</h1>
            <p className="topbar-sub">Verify a student and upload their lab report</p>
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
          <div className="stat-card stat-purple">
            <div className="stat-icon">📤</div>
            <div><div className="stat-num">Upload</div><div className="stat-label">Reports Here</div></div>
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
    </div>
  );
}

/* =========================================
   SIDEBAR
   ========================================= */
function Sidebar({ role, name, onLogout }) {
  const icons = { 'Dashboard Overview': '⊞', 'Settings': '⚙' };
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-text sm">UniMed<span className="logo-dot">.</span></span>
        <span className="role-tag">{role}</span>
      </div>

      <div className="sidebar-user">
        <div className="s-avatar">{name ? name.charAt(0).toUpperCase() : 'U'}</div>
        <div className="s-user-info">
          <div className="s-user-name">{name || 'User'}</div>
          <div className="s-user-role">{role}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <a href="#" className="s-nav-item active">
          <span className="s-nav-icon">⊞</span> Dashboard
        </a>
        <a href="#" className="s-nav-item">
          <span className="s-nav-icon">⚙</span> Settings
        </a>
      </nav>

      <div className="sidebar-bottom">
        <button className="btn-logout" onClick={onLogout}>🚪 Sign Out</button>
      </div>
    </aside>
  );
}

/* =========================================
   RECORD ITEM
   ========================================= */
function RecordItem({ record }) {
  const date = record.timestamp ? new Date(record.timestamp).toLocaleDateString('en-GB') : 'Unknown Date';
  const isLab = record.diagnosis?.includes('[LAB REPORT');
  const isHistory = record.diagnosis?.includes('[PAST HISTORY]');

  let typeClass = 'type-consult'; let typeLabel = 'Consultation';
  if (isLab) { typeClass = 'type-lab'; typeLabel = 'Lab Report'; }
  if (isHistory) { typeClass = 'type-history'; typeLabel = 'Initial History'; }

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

  return (
    <div className={`record-item ${typeClass}`}>
      <div className="record-header">
        <span className="record-date">📅 {date}</span>
        <span className={`badge ${typeClass}-badge`}>{typeLabel}</span>
      </div>
      <div className="record-body">
        <p style={{ whiteSpace: 'pre-wrap' }}><strong>Notes:</strong><br />{displayText}</p>

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
      <p>Syncing securely...</p>
    </div>
  );
}

export default App;
