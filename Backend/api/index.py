import os
import random
import smtplib
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://unimed:*#Unimed2004@cluster0.fuvbjtu.mongodb.net/?appName=Cluster0",
)

_client = None
_db = None
students_collection = None
doctors_collection = None
labassistants_collection = None
otps_collection = None  # NEW: Store OTPs in database


def _init_db():
    global _client, _db, students_collection, doctors_collection, labassistants_collection, otps_collection
    if _db is not None:
        return
    if not MONGO_URI:
        raise RuntimeError("MONGO_URI is not set.")
    _client = MongoClient(MONGO_URI)
    _db = _client["unimed_db"]
    students_collection = _db["students"]
    doctors_collection = _db["doctors"]
    labassistants_collection = _db["labassistants"]
    otps_collection = _db["otps"]  # NEW
    students_collection.create_index("indexNumber", unique=True)
    doctors_collection.create_index("doctorId", unique=True)
    labassistants_collection.create_index("labId", unique=True)
    otps_collection.create_index("email", unique=True)  # NEW
    otps_collection.create_index(
        "expiresAt", expireAfterSeconds=0
    )  # Auto-delete expired OTPs


@app.before_request
def ensure_db():
    try:
        _init_db()
    except RuntimeError as e:
        from flask import abort

        app.logger.error(str(e))
        abort(500, description=str(e))


def _verify_and_upgrade(collection, query, field, incoming_password):
    doc = collection.find_one(query)
    if not doc:
        return False, None
    stored = doc.get(field, "")

    if stored.startswith("pbkdf2:") or stored.startswith("scrypt:"):
        ok = check_password_hash(stored, incoming_password)
    else:
        ok = stored == incoming_password
        if ok:
            new_hash = generate_password_hash(incoming_password)
            collection.update_one(query, {"$set": {field: new_hash}})

    return ok, doc


# ============================================
# EMAIL SENDING FUNCTION
# ============================================
def send_otp_email(recipient_email, otp_code):
    """Send OTP code via Brevo SMTP"""
    smtp_server = "smtp-relay.brevo.com"
    port = 587  # TLS port
    login = os.environ.get("BREVO_LOGIN", "your-brevo-login@example.com")
    password = os.environ.get("BREVO_SMTP_KEY")
    sender_email = os.environ.get(
        "BREVO_SENDER_EMAIL", login
    )  # Use separate sender email

    if not password:
        print("Error: BREVO_SMTP_KEY environment variable not set.")
        return False

    msg = MIMEMultipart()
    msg["From"] = f"UniMed <{sender_email}>"  # Use verified sender email
    msg["To"] = recipient_email
    msg["Subject"] = "UniMed - Password Reset Code"

    body = f"""
Hello,

Your UniMed password reset verification code is: {otp_code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Best regards,
UniMed Team
University of Moratuwa
"""

    msg.attach(MIMEText(body, "plain"))

    try:
        server = smtplib.SMTP(smtp_server, port, timeout=15)
        server.starttls()
        server.login(login, password)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False


# ============================================
# OTP ENDPOINTS
# ============================================
@app.route("/student/send-otp", methods=["POST"])
def send_otp():
    """Send OTP to student email for password reset"""
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    index_number = data.get("index", "").strip().upper()

    # Validate email domain
    if not email.endswith("@uom.lk"):
        return jsonify({"error": "Only @uom.lk emails are allowed"}), 400

    # Check if student exists
    student = students_collection.find_one({"indexNumber": index_number})
    if not student:
        return jsonify({"error": "Student not found. Please register first."}), 404

    # Generate 6-digit OTP
    otp_code = str(random.randint(100000, 999999))

    # Store OTP in database (expires in 10 minutes)
    try:
        otps_collection.update_one(
            {"email": email},
            {
                "$set": {
                    "otp": otp_code,
                    "indexNumber": index_number,
                    "expiresAt": datetime.now() + timedelta(minutes=10),
                }
            },
            upsert=True,
        )
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

    # Send OTP via email
    if send_otp_email(email, otp_code):
        return jsonify({"message": "OTP sent successfully"}), 200
    else:
        return jsonify({"error": "Failed to send email. Please try again."}), 500


@app.route("/student/reset-password-with-otp", methods=["POST"])
def reset_password_with_otp():
    """Reset password using OTP verification"""
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    index_number = data.get("indexNumber", "").strip().upper()
    otp_input = data.get("otp", "").strip()
    new_password = data.get("newPassword", "")

    if not all([email, index_number, otp_input, new_password]):
        return jsonify({"error": "Missing required fields"}), 400

    # Verify OTP from database
    otp_record = otps_collection.find_one({"email": email})

    if not otp_record:
        return jsonify({"error": "No OTP found. Please request a new code."}), 400

    if otp_record.get("otp") != otp_input:
        return jsonify({"error": "Invalid OTP code"}), 401

    if otp_record.get("indexNumber") != index_number:
        return jsonify({"error": "Index number mismatch"}), 401

    if otp_record.get("expiresAt") < datetime.now():
        otps_collection.delete_one({"email": email})
        return jsonify({"error": "OTP expired. Please request a new code."}), 401

    # Update password
    hashed_password = generate_password_hash(new_password)
    result = students_collection.update_one(
        {"indexNumber": index_number}, {"$set": {"password": hashed_password}}
    )

    if result.matched_count == 0:
        return jsonify({"error": "Student not found"}), 404

    # Delete used OTP
    otps_collection.delete_one({"email": email})

    return jsonify({"message": "Password reset successful"}), 200


@app.route("/student/register", methods=["POST"])
def self_register_student():
    """Student self-registration with email and password"""
    data = request.json
    index_number = data.get("indexNumber", "").upper().strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    
    if not index_number or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400
    
    # Validate email ends with @uom.lk
    if not email.endswith("@uom.lk"):
        return jsonify({"error": "Email must end with @uom.lk"}), 400
    
    # Check if student already exists
    existing = students_collection.find_one({"indexNumber": index_number})
    
    if existing:
        # If student was pre-registered (no password), complete their registration
        if existing.get("password") is None or existing.get("accountComplete") == False:
            hashed_password = generate_password_hash(password)
            students_collection.update_one(
                {"indexNumber": index_number},
                {"$set": {
                    "email": email,
                    "password": hashed_password,
                    "accountComplete": True
                }}
            )
            return jsonify({"message": "Registration completed successfully"}), 200
        else:
            # Student already fully registered
            return jsonify({"error": "Student with this index number already exists"}), 409
    
    # Create new student with hashed password and email
    hashed_password = generate_password_hash(password)
    new_student = {
        "indexNumber": index_number,
        "email": email,
        "password": hashed_password,
        "name": "",  # Will be filled in profile setup
        "accountComplete": True,
        "medicalRecords": [],
    }
    
    students_collection.insert_one(new_student)
    return jsonify({"message": "Registration successful"}), 201


@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "UniMed API is fully operational"}), 200


@app.route("/students/pending", methods=["GET"])
def get_pending_students():
    """Get all students with pending approval status"""
    try:
        all_students = list(students_collection.find({}, {"_id": 0, "password": 0}))
        pending_students = []

        for student in all_students:
            if student.get("medicalRecords"):
                # Find the latest profile record
                sorted_records = sorted(
                    student["medicalRecords"],
                    key=lambda x: x.get("timestamp", datetime.min),
                    reverse=True,
                )

                for record in sorted_records:
                    diagnosis = record.get("diagnosis", "")
                    if (
                        "[PAST HISTORY]" in diagnosis
                        or "=== PERSONAL INFORMATION ===" in diagnosis
                    ):
                        # Check if status is Pending
                        if "Approval Status: Pending" in diagnosis:
                            pending_students.append(
                                {
                                    "indexNumber": student.get("indexNumber"),
                                    "name": student.get("name", ""),
                                    "timestamp": record.get("timestamp"),
                                    "hasAttachment": "[FILE_ATTACHMENT:" in diagnosis,
                                }
                            )
                        break

        return jsonify(pending_students), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/student/<index_number>", methods=["GET"])
def retrieve_student(index_number):
    index_number = index_number.upper()
    student = students_collection.find_one(
        {"indexNumber": index_number}, {"_id": 0, "password": 0}
    )
    if student:
        return jsonify(student), 200
    return jsonify({"error": "Not found"}), 404


@app.route("/student/<index_number>/record", methods=["POST"])
def save_visit_details(index_number):
    index_number = index_number.upper()
    data = request.json
    new_record = {
        "diagnosis": data.get("diagnosis", ""),
        "prescription": data.get("prescription", ""),
        "timestamp": datetime.now(),
    }
    result = students_collection.update_one(
        {"indexNumber": index_number}, {"$push": {"medicalRecords": new_record}}
    )
    if result.matched_count > 0:
        return jsonify({"message": "Success"}), 200
    return jsonify({"error": "Not found"}), 404


@app.route("/student", methods=["POST"])
def register_student():
    """Lab assistant pre-registration (no password, student must self-register)"""
    data = request.json
    index_number = data.get("indexNumber").upper() if data.get("indexNumber") else None
    existing = students_collection.find_one({"indexNumber": index_number})
    if existing:
        students_collection.update_one(
            {"indexNumber": index_number},
            {"$set": {"name": data.get("name", existing.get("name", ""))}},
        )
        return jsonify({"message": "Updated"}), 200
    # Create student WITHOUT a valid password - they must complete self-registration
    new_student = {
        "indexNumber": index_number,
        "name": data.get("name", ""),
        "password": None,  # No password - prevents login until self-registration
        "accountComplete": False,  # Flag to track completion
        "medicalRecords": [],
    }
    students_collection.insert_one(new_student)
    return jsonify({"message": "Created"}), 201


@app.route("/student/<index_number>/login", methods=["POST"])
def student_login(index_number):
    index_number = index_number.upper()
    data = request.json

    student = students_collection.find_one({"indexNumber": index_number})
    if not student:
        return jsonify({"error": "Student not found. Please register first."}), 404

    # Check if student was pre-registered by lab assistant (no password set)
    if student.get("password") is None or student.get("accountComplete") == False:
        return jsonify({"error": "Account not activated. Please complete registration by signing up with your email."}), 403

    ok, student = _verify_and_upgrade(
        students_collection,
        {"indexNumber": index_number},
        "password",
        data.get("password", ""),
    )
    if student is None:
        return jsonify({"error": "Not found"}), 404
    if ok:
        return (
            jsonify({"message": "Login successful", "name": student.get("name", "")}),
            200,
        )
    return jsonify({"error": "Incorrect password"}), 401


@app.route("/student/<index_number>/password", methods=["PUT"])
def update_student_password(index_number):
    index_number = index_number.upper()
    data = request.json
    ok, student = _verify_and_upgrade(
        students_collection,
        {"indexNumber": index_number},
        "password",
        data.get("oldPassword", ""),
    )
    if student is None:
        return jsonify({"error": "Not found"}), 404
    if not ok:
        return jsonify({"error": "Incorrect current password"}), 401
    students_collection.update_one(
        {"indexNumber": index_number},
        {"$set": {"password": generate_password_hash(data.get("newPassword", ""))}},
    )
    return jsonify({"message": "Password updated"}), 200


@app.route("/doctors", methods=["GET"])
def list_doctors():
    doctors = list(doctors_collection.find({}, {"_id": 0, "password": 0}))
    return jsonify(doctors), 200


@app.route("/doctors/<doctor_id>", methods=["GET"])
def retrieve_doctor(doctor_id):
    doctor = doctors_collection.find_one(
        {"doctorId": doctor_id}, {"_id": 0, "password": 0}
    )
    if doctor:
        return jsonify(doctor), 200
    return jsonify({"error": "Not found"}), 404


@app.route("/doctors", methods=["POST"])
def register_doctor():
    data = request.json
    doctor_id = data.get("doctorId")
    if not doctor_id:
        return jsonify({"error": "doctorId is required"}), 400
    if doctors_collection.find_one({"doctorId": doctor_id}):
        return jsonify({"error": "Doctor ID already exists"}), 409
    new_doctor = {
        "doctorId": doctor_id,
        "name": data.get("name", ""),
        "password": generate_password_hash(data.get("password", "doctor123")),
        "createdAt": datetime.now(),
    }
    doctors_collection.insert_one(new_doctor)
    return jsonify({"message": "Doctor registered"}), 201


@app.route("/doctors/<doctor_id>/login", methods=["POST"])
def doctor_login(doctor_id):
    data = request.json
    ok, doctor = _verify_and_upgrade(
        doctors_collection,
        {"doctorId": doctor_id},
        "password",
        data.get("password", ""),
    )
    if doctor is None:
        return jsonify({"error": "Not found"}), 404
    if ok:
        return (
            jsonify({"message": "Login successful", "name": doctor.get("name", "")}),
            200,
        )
    return jsonify({"error": "Incorrect password"}), 401


@app.route("/doctors/<doctor_id>/password", methods=["PUT"])
def update_doctor_password(doctor_id):
    data = request.json
    ok, doctor = _verify_and_upgrade(
        doctors_collection,
        {"doctorId": doctor_id},
        "password",
        data.get("oldPassword", ""),
    )
    if doctor is None:
        return jsonify({"error": "Not found"}), 404
    if not ok:
        return jsonify({"error": "Incorrect current password"}), 401
    doctors_collection.update_one(
        {"doctorId": doctor_id},
        {"$set": {"password": generate_password_hash(data.get("newPassword", ""))}},
    )
    return jsonify({"message": "Password updated"}), 200


@app.route("/labassistant", methods=["GET"])
def list_labassistants():
    assistants = list(labassistants_collection.find({}, {"_id": 0, "password": 0}))
    return jsonify(assistants), 200


@app.route("/labassistant/<lab_id>", methods=["GET"])
def retrieve_labassistant(lab_id):
    assistant = labassistants_collection.find_one(
        {"labId": lab_id}, {"_id": 0, "password": 0}
    )
    if assistant:
        return jsonify(assistant), 200
    return jsonify({"error": "Not found"}), 404


@app.route("/labassistant", methods=["POST"])
def register_labassistant():
    data = request.json
    lab_id = data.get("labId")
    if not lab_id:
        return jsonify({"error": "labId is required"}), 400
    if labassistants_collection.find_one({"labId": lab_id}):
        return jsonify({"error": "Lab Assistant ID already exists"}), 409
    new_assistant = {
        "labId": lab_id,
        "name": data.get("name", ""),
        "password": generate_password_hash(data.get("password", "lab123")),
        "createdAt": datetime.now(),
    }
    labassistants_collection.insert_one(new_assistant)
    return jsonify({"message": "Lab Assistant registered"}), 201


@app.route("/labassistant/<lab_id>/login", methods=["POST"])
def labassistant_login(lab_id):
    data = request.json
    ok, assistant = _verify_and_upgrade(
        labassistants_collection,
        {"labId": lab_id},
        "password",
        data.get("password", ""),
    )
    if assistant is None:
        return jsonify({"error": "Not found"}), 404
    if ok:
        return (
            jsonify({"message": "Login successful", "name": assistant.get("name", "")}),
            200,
        )
    return jsonify({"error": "Incorrect password"}), 401


@app.route("/labassistant/<lab_id>/password", methods=["PUT"])
def update_labassistant_password(lab_id):
    data = request.json
    ok, assistant = _verify_and_upgrade(
        labassistants_collection,
        {"labId": lab_id},
        "password",
        data.get("oldPassword", ""),
    )
    if assistant is None:
        return jsonify({"error": "Not found"}), 404
    if not ok:
        return jsonify({"error": "Incorrect current password"}), 401
    labassistants_collection.update_one(
        {"labId": lab_id},
        {"$set": {"password": generate_password_hash(data.get("newPassword", ""))}},
    )
    return jsonify({"message": "Password updated"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
