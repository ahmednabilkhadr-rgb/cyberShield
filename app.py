from flask import Flask, request, jsonify, session, send_from_directory
from pathlib import Path
from collections import deque
from datetime import datetime, timezone
from threading import Lock
import secrets
import time
import json
import logging

# =====================================
# CYBERSHIELD CONFIGURATION
# =====================================

BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
AUDIT_FILE = LOG_DIR / "security_audit.jsonl"

LOG_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=None)
app.secret_key = secrets.token_hex(32)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    MAX_CONTENT_LENGTH=32 * 1024
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

otp_records = {}
audit_events = deque(maxlen=500)
audit_lock = Lock()

OTP_EXPIRY_SECONDS = 60
MAX_ATTEMPTS = 3

# =====================================
# ALLOWED MODULES AND RESULTS
# =====================================

ALLOWED_MODULES = {
    "URL_ANALYSIS",
    "DOMAIN_MONITORING",
    "CERTIFICATE_VALIDATION",
    "URL_AWARENESS",
    "RED_TEAM_LAB"
}

ALLOWED_RESULTS = {
    "COMPLETED",
    "WARNING",
    "REVIEW_REQUIRED"
}

ALLOWED_SEVERITIES = {
    "INFO",
    "WARNING",
    "CRITICAL"
}


# =====================================
# SECURITY AUDIT LOGGER
# =====================================

def record_audit(event, severity="INFO", details=None):

    if severity not in ALLOWED_SEVERITIES:
        severity = "INFO"

    audit_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": str(event)[:80],
        "severity": severity,
        "details": details if isinstance(details, dict) else {}
    }

    with audit_lock:
        audit_events.append(audit_entry)

        try:
            with AUDIT_FILE.open("a", encoding="utf-8") as file:
                file.write(json.dumps(audit_entry) + "\n")

        except OSError:
            app.logger.exception("Could not write audit log")

    app.logger.info(
        "AUDIT | %s | %s",
        severity,
        event
    )


# =====================================
# WEBSITE ROUTES
# =====================================

@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def project_files(filename):
    return send_from_directory(BASE_DIR, filename)


# =====================================
# SERVER HEALTH CHECK
# =====================================

@app.route("/api/health", methods=["GET"])
def health():

    return jsonify({
        "success": True,
        "server": "CyberShield",
        "status": "running",
        "mfa": "simulation mode",
        "audit_logging": "enabled",
        "modules": {
            "url_analysis": "available",
            "domain_monitoring": "available",
            "certificate_validation": "available",
            "mfa": "available",
            "audit_dashboard": "available",
            "red_team_lab": "connected"
        }
    }), 200


# =====================================
# SECURITY AUDIT API
# GET  = Retrieve events
# POST = Record module result
# =====================================

@app.route("/api/audit", methods=["GET", "POST"])
def audit_api():

    # ---------------------------------
    # POST: Receive module result
    # ---------------------------------

    if request.method == "POST":

        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "message": "A valid JSON object is required."
            }), 400

        module = data.get("module")
        result = data.get("result")

        if not isinstance(module, str) or module not in ALLOWED_MODULES:
            return jsonify({
                "success": False,
                "message": "Invalid module."
            }), 400

        if not isinstance(result, str) or result not in ALLOWED_RESULTS:
            return jsonify({
                "success": False,
                "message": "Invalid result."
            }), 400

        # REVIEW_REQUIRED means critical defensive review.
        if result == "REVIEW_REQUIRED":
            severity = "CRITICAL"
        elif result == "WARNING":
            severity = "WARNING"
        else:
            severity = "INFO"

        event_name = f"{module}_{result}"

        record_audit(
            event_name,
            severity,
            {
                "module": module,
                "result": result
            }
        )

        return jsonify({
            "success": True,
            "message": "Audit event recorded.",
            "event": event_name,
            "severity": severity
        }), 201

    # ---------------------------------
    # GET: Retrieve and filter events
    # ---------------------------------

    try:
        limit = int(request.args.get("limit", 100))
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Limit and offset must be numbers."
        }), 400

    if not 1 <= limit <= 500 or offset < 0:
        return jsonify({
            "success": False,
            "message": "Invalid pagination values."
        }), 400

    severity_filter = request.args.get("severity", "").upper()
    event_filter = request.args.get("event", "").upper()

    if severity_filter and severity_filter not in ALLOWED_SEVERITIES:
        return jsonify({
            "success": False,
            "message": "Invalid severity filter."
        }), 400

    with audit_lock:
        events = list(reversed(audit_events))

    if severity_filter:
        events = [
            event for event in events
            if event["severity"] == severity_filter
        ]

    if event_filter:
        events = [
            event for event in events
            if event_filter in event["event"].upper()
        ]

    total = len(events)
    paginated_events = events[offset:offset + limit]

    return jsonify({
        "success": True,
        "total_events": total,
        "limit": limit,
        "offset": offset,
        "events": paginated_events
    }), 200


# =====================================
# MFA - START SIMULATION
# =====================================

@app.route("/api/mfa/start", methods=["POST"])
def start_mfa():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "A valid JSON object is required."
        }), 400

    username = str(data.get("username", "")).strip()
    phone = str(data.get("phone", "")).strip()

    if not 3 <= len(username) <= 30:

        record_audit(
            "MFA_START_REJECTED",
            "WARNING",
            {"reason": "Invalid username format"}
        )

        return jsonify({
            "success": False,
            "message": "Username must be between 3 and 30 characters."
        }), 400

    if not phone.isdigit() or not 8 <= len(phone) <= 15:

        record_audit(
            "MFA_START_REJECTED",
            "WARNING",
            {"reason": "Invalid demo phone format"}
        )

        return jsonify({
            "success": False,
            "message": "Enter a valid demo phone number."
        }), 400

    old_id = session.get("mfa_id")

    if old_id:
        otp_records.pop(old_id, None)

    otp = f"{secrets.randbelow(1000000):06d}"
    demo_id = secrets.token_urlsafe(16)

    otp_records[demo_id] = {
        "username": username,
        "otp": otp,
        "created_at": time.time(),
        "attempts": 0
    }

    session["mfa_id"] = demo_id

    record_audit(
        "MFA_SIMULATION_STARTED",
        "INFO",
        {"expiry_seconds": OTP_EXPIRY_SECONDS}
    )

    # Local simulation only. No SMS is sent.
    return jsonify({
        "success": True,
        "message": "Local MFA simulation started.",
        "sms": {
            "sender": "CyberShield Demo",
            "phone": phone,
            "code": otp,
            "message": "Demo verification code. No real SMS was sent.",
            "expires_in": OTP_EXPIRY_SECONDS,
            "simulation": True
        }
    }), 200


# =====================================
# MFA - VERIFY OTP
# =====================================

@app.route("/api/mfa/verify", methods=["POST"])
def verify_mfa():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "A valid JSON object is required."
        }), 400

    entered_otp = str(data.get("otp", "")).strip()

    if not entered_otp.isdigit() or len(entered_otp) != 6:

        record_audit(
            "MFA_VERIFY_REJECTED",
            "WARNING",
            {"reason": "Invalid code format"}
        )

        return jsonify({
            "success": False,
            "message": "Enter a valid six-digit code."
        }), 400

    demo_id = session.get("mfa_id")

    if not demo_id or demo_id not in otp_records:

        record_audit(
            "MFA_VERIFY_REJECTED",
            "WARNING",
            {"reason": "No active verification session"}
        )

        return jsonify({
            "success": False,
            "message": "No active verification. Start again."
        }), 401

    record = otp_records[demo_id]

    elapsed = time.time() - record["created_at"]

    if elapsed > OTP_EXPIRY_SECONDS:

        otp_records.pop(demo_id, None)
        session.pop("mfa_id", None)

        record_audit("MFA_CODE_EXPIRED", "WARNING")

        return jsonify({
            "success": False,
            "message": "The code has expired. Start again."
        }), 410

    if record["attempts"] >= MAX_ATTEMPTS:

        otp_records.pop(demo_id, None)
        session.pop("mfa_id", None)

        record_audit(
            "MFA_ATTEMPTS_LIMIT_REACHED",
            "CRITICAL"
        )

        return jsonify({
            "success": False,
            "message": "Maximum attempts reached. Start again."
        }), 429

    record["attempts"] += 1

    if not secrets.compare_digest(entered_otp, record["otp"]):

        remaining = MAX_ATTEMPTS - record["attempts"]

        record_audit(
            "MFA_INVALID_CODE",
            "WARNING",
            {"attempts_remaining": remaining}
        )

        if remaining <= 0:

            otp_records.pop(demo_id, None)
            session.pop("mfa_id", None)

            record_audit(
                "MFA_ATTEMPTS_LIMIT_REACHED",
                "CRITICAL"
            )

            return jsonify({
                "success": False,
                "message": "Maximum attempts reached. Start again."
            }), 429

        return jsonify({
            "success": False,
            "message": f"Incorrect code. Attempts remaining: {remaining}."
        }), 401

    otp_records.pop(demo_id, None)
    session.pop("mfa_id", None)

    record_audit(
        "MFA_VERIFICATION_SUCCESS",
        "INFO"
    )

    return jsonify({
        "success": True,
        "message": "Verification successful. Demo account verified."
    }), 200


# =====================================
# ERROR HANDLERS
# =====================================

@app.errorhandler(404)
def not_found(error):

    if request.path.startswith("/api/"):
        return jsonify({
            "success": False,
            "message": "API endpoint not found."
        }), 404

    return "Page not found.", 404


@app.errorhandler(413)
def request_too_large(error):

    return jsonify({
        "success": False,
        "message": "Request payload is too large."
    }), 413


@app.errorhandler(500)
def server_error(error):

    app.logger.exception("Internal server error")

    record_audit(
        "SERVER_INTERNAL_ERROR",
        "CRITICAL"
    )

    return jsonify({
        "success": False,
        "message": "Internal server error. Check server terminal."
    }), 500


# =====================================
# START SERVER
# =====================================

if __name__ == "__main__":

    print("=" * 55)
    print("       CYBERSHIELD LOCAL TRAINING SERVER")
    print("=" * 55)
    print("Website: http://127.0.0.1:5000")
    print("Health:  http://127.0.0.1:5000/api/health")
    print("Audit:   http://127.0.0.1:5000/api/audit")
    print("MFA:     Local simulation only")
    print("Red Team Lab: Connected")
    print("Audit:   Enabled")
    print("=" * 55)

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False,
        use_reloader=False
    )