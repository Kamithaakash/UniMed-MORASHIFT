# UniMed - Medical Records Management System

A medical records management system for university students, built with React (Frontend) and Flask/MongoDB (Backend).

---

## Repository Links

- **Backend Repository:** [https://github.com/Kamithaakash/UniMed-MORASHIFT/tree/main/Backend](https://github.com/Kamithaakash/UniMed-MORASHIFT/tree/main/Backend)
- **Frontend Repository:** [https://github.com/Kamithaakash/UniMed-MORASHIFT/tree/main/Frontend](https://github.com/Kamithaakash/UniMed-MORASHIFT/tree/main/Frontend)

---

## How to Run Locally

Follow these step-by-step instructions to get the application running on your local machine.

### Cloning the Repositories

If you haven't already cloned the repositories, follow these steps:

**Clone the Backend Repository:**
```bash
git clone https://github.com/Kamithaakash/UniMed-MORASHIFT.git
cd UniMed-MORASHIFT/Backend
```

**Clone the Frontend Repository:**
```bash
git clone https://github.com/Kamithaakash/UniMed-MORASHIFT.git
cd UniMed-MORASHIFT/Frontend
```

Alternatively, if you're already in the project directory, navigate to the appropriate folder using the terminal.

---

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Python](https://www.python.org/downloads/) (v3.8 or higher)
- A MongoDB Connection String (either an Atlas cluster URL or a local instance)

---

### Step 1: Start the Backend (Flask API)

The backend files are located inside the `unimed-backend-main` directory. 

1. Open a terminal and navigate to the backend folder from the root of the project:
   ```bash
   cd unimed-backend-main
   ```

2. Create and activate a Python virtual environment to keep your dependencies isolated:
   ```bash
   # On Windows:
   python -m venv venv
   venv\Scripts\activate
   
   # On macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up the Environment Variables:
   - Create a new file named `.env` inside the `unimed-backend-main` folder.
   - Open `.env` and add your MongoDB database URL:
     ```env
     MONGO_URI=your_mongodb_connection_string_here
     ```

5. Run the Python backend server:
   ```bash
   python api/index.py
   ```
   *(The backend API should now be running and listening for requests—usually on `http://127.0.0.1:5000`)*

---

### Step 2: Start the Frontend (React JS)

The frontend project is located in the root of the repository. Open a **second** terminal window.

1. Ensure you are in the root directory (where `package.json` is located).

2. Install the necessary JavaScript dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. View the Application:
   - Once Vite starts, open your web browser and go to `http://localhost:5173` (or the local link provided in your terminal).
   - Because you started the backend, the React frontend should successfully connect to it natively.

---

### Helpful Tips
- **Keep both terminals open:** You need one terminal running the Flask server and another running the Vite server to use the application fully.
- **Backend Port Configuration:** If your backend runs on a different port, make sure to update the `API_BASE_URL` logic located in `src/App.jsx`.