import React, { useState } from 'react';
import './App.css';

// 1. Connection to your friend's Vercel hosting
const API_BASE_URL = "https://unimed-backend.vercel.app";

function App() {
  const [role, setRole] = useState('Doctor');
  const [username, setUsername] = useState(''); // Used as the Student Index Number
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  // NEW STATE: Holds the student "Chosen" from the database
  const [selectedStudent, setSelectedStudent] = useState(null);

  // --- BACKEND CONNECTION LOGIC ---

  // OPTION TO REGISTER: Use this if the ID is "Not Found"
  const registerMe = async () => {
    if (!username) return alert("Please enter an ID first.");
    try {
      const response = await fetch(`${API_BASE_URL}/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indexNumber: username, 
          name: "New Student" 
        })
      });
      const data = await response.json();
      alert("Registration: " + data.message);
    } catch (error) {
      alert("Registration failed.");
    }
  };

  // CHOOSE STUDENT: Pulls specific student data to "Select" them
  const verifyStudent = async () => {
    if (!username) return alert("Please enter a Student ID first.");
    try {
      const response = await fetch(`${API_BASE_URL}/student/${username}`);
      const data = await response.json();
      
      
      if (response.ok) {
        setSelectedStudent(data); // This selects the student for recording
        alert(`✅ Student Selected: ${data.name}`);
      } else {
        setSelectedStudent(null);
        alert("❌ Student not found. Please register them first.");
      }
    } catch (error) {
      alert("System Error: Could not reach the backend.");
    }
  };

  // RECORD DATA: Pushes diagnosis into the CHOSEN student's record
  const saveToDatabase = async () => {
    if (!selectedStudent) return alert("Please 'Verify' and choose a student first!");
    if (!diagnosis) return alert("Diagnosis notes are empty.");

    try {
      const response = await fetch(`${API_BASE_URL}/student/${selectedStudent.indexNumber}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosis: diagnosis,
          prescription: "Pending doctor review"
        })
      });

      if (response.ok) {
        alert(`🏥 Record securely saved for ${selectedStudent.name}!`);
        setDiagnosis(''); // Clear workspace after saving
      } else {
        alert("Failed to save record.");
      }
    } catch (error) {
      alert("Connection failed.");
    }
  };

  // --- VOICE LOGIC (Your Original Code) ---
  const handleVoiceRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice features. Please use Chrome.");
      return;
    }
    if (isListening) {
      if (window.recognitionInstance) { window.recognitionInstance.stop(); }
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    window.recognitionInstance = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) { finalTranscript += event.results[i][0].transcript; }
      }
      if (finalTranscript) { setDiagnosis((prev) => prev.trim() + " " + finalTranscript.trim() + "."); }
    };
    recognition.start();
  };

  const readAloud = () => {
    if (!diagnosis) return alert("No text to read!");
    const utterance = new SpeechSynthesisUtterance(diagnosis);
    window.speechSynthesis.speak(utterance);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (role === 'Doctor' && password === 'UniMedDoc2026') {
      setIsLoggedIn(true);
    } else if (role !== 'Doctor') {
      setIsLoggedIn(true);
    } else {
      alert("❌ Access Denied: Incorrect Password.");
    }
  };

  // --- DASHBOARD VIEW ---
  if (isLoggedIn) {
    return (
      <div className="dashboard-wrapper">
        <aside className="sidebar">
          <div className="logo">UniMed <span>Portal</span></div>
          <nav>
            <div className="nav-group">Healthcare Suite</div>
            <a href="#" className="active">Dashboard Overview</a>
            <a href="#">Patient Database</a>
            <a href="#">Virtual Appointments</a>
            <div className="nav-group">Account Settings</div>
            <a href="#" className="logout-nav" onClick={() => {setIsLoggedIn(false); setPassword(''); setSelectedStudent(null);}}>Sign Out</a>
          </nav>
        </aside>

        <main className="content">
          <header className="content-header">
            <h2>Welcome back, {role}</h2>
            <span className="status-badge">Secure SSL Active</span>
          </header>

          <div className="stats-grid">
            <div className="stat-card primary-card">
              <span className="label">AI Assistant</span>
              <h3>Text to Voice</h3>
              <button className="tool-btn-white" onClick={readAloud}>Read Notes Aloud</button>
            </div>
            <div className="stat-card outline-card">
              <span className="label">Session</span>
              <h3>Status</h3>
              <span className={isListening ? "pulse-red" : "status-online"}>
                {isListening ? "● Recording..." : "Online"}
              </span>
            </div>
            <div className="stat-card primary-card">
              <span className="label">Input Tool</span>
              <h3>Voice to Text</h3>
              <button 
                className={`tool-btn-white ${isListening ? 'mic-on' : ''}`} 
                onClick={handleVoiceRecording}
              >
                {isListening ? "Stop Mic" : "Start Recording"}
              </button>
            </div>
            <div className="stat-card outline-card">
              <span className="label">Patient Selection</span>
              <h3>{selectedStudent ? selectedStudent.name : "None Selected"}</h3>
              <button className="tool-btn-blue" onClick={() => setSelectedStudent(null)}>Clear Selection</button>
            </div>
          </div>

          <div className="info-grid">
            <div className="info-card wide-card">
              <div className="card-header-flex">
                <h3>Consultation Transcript</h3>
                {selectedStudent && (
                  <span className="status-badge" style={{background: '#dbeafe', color: '#1e40af'}}>
                    Active Record: {selectedStudent.indexNumber}
                  </span>
                )}
              </div>
              <textarea 
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder={selectedStudent ? "Type or record notes for this patient..." : "Verify a Student ID to begin recording notes."}
                className="main-notes-area"
                disabled={!selectedStudent}
              />
              <div className="card-footer">
                <button className="btn-save" onClick={saveToDatabase} disabled={!selectedStudent}>
                  Save to Student Record
                </button>
                <button className="btn-clear" onClick={() => setDiagnosis('')}>Reset Transcript</button>
              </div>
            </div>
            <div className="info-card sidebar-card">
              <h3>Quick Actions</h3>
              <div className="action-list">
                <button className="action-item" onClick={verifyStudent}>Choose/Verify Student</button>
                <button className="action-item" onClick={registerMe}>Register New Student</button>
                <button className="action-item">Emergency Protocol</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- LOGIN VIEW ---
  return (
    <div className="main-container">
      <div className="login-side">
        <div className="glass-card">
          <header className="brand-header">
            <h1>UniMed</h1>
            <p className="subtitle">University Medical Service Portal</p>
          </header>
          <div className="portal-switch">
            {['Student', 'Doctor', 'Staff'].map(r => (
              <button key={r} className={`portal-btn ${role === r ? 'active' : ''}`} onClick={() => {setRole(r); setPassword('');}}>
                {r}
              </button>
            ))}
          </div>
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label>{role} ID</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={`Enter your ${role} ID`} required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn-primary">Sign In to Portal</button>
          </form>
          <div className="security-tag"><span>🔒</span> Secure SSL Encrypted Access</div>
        </div>
      </div>
      <div className="visual-side">
        <div className="visual-content">
          <h2>Empowering <br/> University <br/> Healthcare</h2>
          <p>A digital-first medical experience for our campus community, ensuring secure student-doctor interactions.</p>
        </div>
      </div>
    </div>
  );
}

export default App;