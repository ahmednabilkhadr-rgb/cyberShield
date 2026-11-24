from flask import Flask, request, jsonify, send_from_directory
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import deque
from threading import RLock
from werkzeug.security import generate_password_hash, check_password_hash
import json
import urllib.request
import urllib.error
import logging
import re

# =====================================
# CYBERSHIELD RED TEAM / BLUE TEAM LAB
# LOCAL EDUCATIONAL ENVIRONMENT
# =====================================

app = Flask(__name__, static_folder=None)

BASE_DIR = Path(__file__).resolve().parent
HTML_DIR = BASE_DIR / "attack-simulation"
CSS_DIR = BASE_DIR / "css"
JS_DIR = BASE_DIR / "js"

LOG_DIR = BASE_DIR / "logs"
AUDIT_FILE = LOG_DIR / "red_team_audit.jsonl"

LOG_DIR.mkdir(parents=True, exist_ok=True)

HOST = "127.0.0.1"
PORT = 5001

# =====================================
# SECURITY CONFIGURATION
# =====================================

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 60

MAIN_AUDIT_URL = "http://127.0.0.1:5000/api/audit"

# =====================================
# LAB STATE
# =====================================

state_lock = RLock()

# One local educational account.
# Password is stored as a hash, not plain text.

demo_account = None

failed_attempts = 0
locked_until = None

events = deque(maxlen=500)

# =====================================
# LOGGER
# =====================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

logger = logging.getLogger("CYBERSHIELD_LAB")

# =====================================
# HELPERS
# =====================================

def utc_now():
    return datetime.now(timezone.utc).isoformat()


def account_exists():
    return demo_account is not None


def account_is_locked():
    return (
        locked_until is not None
        and datetime.now(timezone.utc) < locked_until
    )


def remaining_lock_seconds():
    if not account_is_locked():
        return 0

    return max(
        0,
        int((locked_until - datetime.now(timezone.utc)).total_seconds())
    )


def current_account_status():
    if not account_exists():
        return "NOT_CREATED"

    if account_is_locked():
        return "LOCKED"

    return "NORMAL"


# =====================================
# MAIN AUDIT INTEGRATION
# =====================================

def forward_to_main_audit(severity):

    result_map = {
        "INFO": "COMPLETED",
        "WARNING": "WARNING",
        "CRITICAL": "REVIEW_REQUIRED"
    }

    payload = {
        "module": "RED_TEAM_LAB",
        "result": result_map.get(severity, "WARNING")
    }

    try:
        body = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(
            MAIN_AUDIT_URL,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=2) as response:
            return 200 <= response.status < 300

    except (urllib.error.URLError, TimeoutError, OSError) as error:
        logger.warning("Main audit unavailable: %s", error)
        return False


# =====================================
# EVENT LOGGING
# =====================================

def record_event(event_type, severity, details):

    event = {
        "timestamp": utc_now(),
        "event": event_type,
        "severity": severity,
        "details": details
    }

    with state_lock:
        events.appendleft(event)

        try:
            with AUDIT_FILE.open("a", encoding="utf-8") as file:
                file.write(
                    json.dumps(event, ensure_ascii=False) + "\n"
                )
        except OSError:
            logger.exception("Could not save local audit event")

    # Send only event classification to the main dashboard.
    forward_to_main_audit(severity)

    logger.info("%s | %s", event_type, severity)

    return event


# =====================================
# CORS
# =====================================

ALLOWED_ORIGINS = {
    "http://127.0.0.1:5000",
    "http://localhost:5000",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
}


@app.after_request
def add_cors_headers(response):

    origin = request.headers.get("Origin")

    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin

    response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Max-Age"] = "600"

    return response


# =====================================
# FRONTEND ROUTES
# =====================================

@app.route("/", methods=["GET"])
def home():

    filename = "red-team-lab.html"

    if not (HTML_DIR / filename).is_file():
        return jsonify({
            "success": False,
            "message": "Red Team Lab HTML file not found."
        }), 404

    return send_from_directory(HTML_DIR, filename)


@app.route("/css/<path:filename>", methods=["GET"])
def serve_css(filename):
    return send_from_directory(CSS_DIR, filename)


@app.route("/js/<path:filename>", methods=["GET"])
def serve_js(filename):
    return send_from_directory(JS_DIR, filename)


# =====================================
# HEALTH CHECK
# =====================================

@app.route(
    "/api/lab/health",
    methods=["GET", "OPTIONS"]
)
def health():

    if request.method == "OPTIONS":
        return "", 200

    return jsonify({
        "success": True,
        "status": "ONLINE",
        "module": "CYBERSHIELD RED TEAM / BLUE TEAM",
        "environment": "LOCAL EDUCATIONAL LAB",
        "timestamp": utc_now()
    }), 200


# =====================================
# CREATE LOCAL DEMO ACCOUNT
# =====================================

@app.route(
    "/api/lab/account/create",
    methods=["POST", "OPTIONS"]
)
def create_account():

    global demo_account

    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json(silent=True) or {}

    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))

    if not re.fullmatch(r"[A-Za-z0-9_]{3,24}", username):
        return jsonify({
            "success": False,
            "message": "Username must be 3-24 characters using letters, numbers or underscore."
        }), 400

    if len(password) < 8 or len(password) > 128:
        return jsonify({
            "success": False,
            "message": "Password must be between 8 and 128 characters."
        }), 400

    with state_lock:

        if demo_account is not None:
            return jsonify({
                "success": False,
                "message": "A demo account already exists. Reset the lab before creating another."
            }), 409

        demo_account = {
            "username": username,
            "password_hash": generate_password_hash(password),
            "created_at": utc_now()
        }

    record_event(
        "DEMO_ACCOUNT_CREATED",
        "INFO",
        "A new local demonstration account was created."
    )

    return jsonify({
        "success": True,
        "message": "Local demo account created successfully.",
        "username": username,
        "account_status": "NORMAL"
    }), 201


# =====================================
# ACCOUNT / BLUE TEAM STATE
# =====================================

@app.route(
    "/api/lab/state",
    methods=["GET", "OPTIONS"]
)
def get_lab_state():

    if request.method == "OPTIONS":
        return "", 200

    with state_lock:

        status = current_account_status()
        attempts = failed_attempts
        remaining = max(0, MAX_ATTEMPTS - attempts)
        retry_after = remaining_lock_seconds()

        username = (
            demo_account["username"]
            if demo_account else None
        )

    return jsonify({
        "success": True,
        "account_exists": account_exists(),
        "username": username,
        "account_status": status,
        "detection_status": (
            "THREAT DETECTED"
            if status == "LOCKED"
            else "MONITORING"
        ),
        "attempts": attempts,
        "remaining_attempts": remaining,
        "max_attempts": MAX_ATTEMPTS,
        "blocked": status == "LOCKED",
        "retry_after": retry_after
    }), 200


# =====================================
# RED TEAM LOGIN TEST
# =====================================

@app.route(
    "/api/lab/login",
    methods=["POST", "OPTIONS"]
)
def demo_login():

    global failed_attempts
    global locked_until

    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json(silent=True) or {}

    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))

    if not username or not password:
        return jsonify({
            "success": False,
            "message": "Username and password are required."
        }), 400

    with state_lock:

        if demo_account is None:
            return jsonify({
                "success": False,
                "message": "No demo account exists. Create an account first.",
                "account_exists": False
            }), 409

        if account_is_locked():

            retry_after = remaining_lock_seconds()

            attempts = failed_attempts

            blocked = True

        else:
            blocked = False
            retry_after = 0
            attempts = failed_attempts

    if blocked:

        record_event(
            "LOGIN_BLOCKED",
            "CRITICAL",
            "Login rejected because the demo account is temporarily locked."
        )

        return jsonify({
            "success": False,
            "blocked": True,
            "message": "Account temporarily locked.",
            "attempts": attempts,
            "remaining_attempts": 0,
            "retry_after": retry_after
        }), 423

    with state_lock:
        stored_username = demo_account["username"]
        stored_hash = demo_account["password_hash"]

    username_valid = hmac_compare(username, stored_username)

    password_valid = check_password_hash(
        stored_hash,
        password
    )

    if username_valid and password_valid:

        with state_lock:
            failed_attempts = 0
            locked_until = None

        record_event(
            "DEMO_LOGIN_SUCCESS",
            "INFO",
            "Successful login to the local demonstration account."
        )

        return jsonify({
            "success": True,
            "blocked": False,
            "message": "Demo login successful.",
            "attempts": 0,
            "remaining_attempts": MAX_ATTEMPTS
        }), 200

    with state_lock:

        failed_attempts += 1
        attempts = failed_attempts

        should_lock = attempts >= MAX_ATTEMPTS

        if should_lock:
            locked_until = (
                datetime.now(timezone.utc)
                + timedelta(seconds=LOCKOUT_SECONDS)
            )

        remaining = max(0, MAX_ATTEMPTS - attempts)

    record_event(
        "FAILED_LOGIN",
        "WARNING",
        f"Failed login detected. Attempt count: {attempts}"
    )

    if should_lock:

        record_event(
            "ACCOUNT_LOCKED",
            "CRITICAL",
            "Repeated failed logins detected. Account temporarily locked."
        )

        return jsonify({
            "success": False,
            "blocked": True,
            "message": "Repeated failed attempts detected. Account locked.",
            "attempts": attempts,
            "remaining_attempts": 0,
            "retry_after": LOCKOUT_SECONDS
        }), 423

    return jsonify({
        "success": False,
        "blocked": False,
        "message": "Invalid demo credentials.",
        "attempts": attempts,
        "remaining_attempts": remaining
    }), 401


# =====================================
# SAFE STRING COMPARISON
# =====================================

def hmac_compare(first, second):
    import hmac
    return hmac.compare_digest(first, second)


# =====================================
# BLUE TEAM SECURITY EVENTS
# =====================================

@app.route(
    "/api/lab/events",
    methods=["GET", "OPTIONS"]
)
def get_events():

    if request.method == "OPTIONS":
        return "", 200

    with state_lock:
        recent_events = list(events)

    return jsonify({
        "success": True,
        "total": len(recent_events),
        "events": recent_events
    }), 200


# =====================================
# RESET LAB COUNTERS
# =====================================

@app.route(
    "/api/lab/reset",
    methods=["POST", "OPTIONS"]
)
def reset_lab():

    global failed_attempts
    global locked_until

    if request.method == "OPTIONS":
        return "", 200

    with state_lock:
        failed_attempts = 0
        locked_until = None

    record_event(
        "LAB_RESET",
        "INFO",
        "Failed-attempt counter and temporary lock were reset."
    )

    return jsonify({
        "success": True,
        "message": "Lab counters reset. Existing demo account was preserved."
    }), 200


# =====================================
# DELETE DEMO ACCOUNT
# =====================================

@app.route(
    "/api/lab/account/delete",
    methods=["POST", "OPTIONS"]
)
def delete_account():

    global demo_account
    global failed_attempts
    global locked_until

    if request.method == "OPTIONS":
        return "", 200

    with state_lock:

        if demo_account is None:
            return jsonify({
                "success": False,
                "message": "No demo account exists."
            }), 404

        demo_account = None
        failed_attempts = 0
        locked_until = None

    record_event(
        "DEMO_ACCOUNT_DELETED",
        "WARNING",
        "The local demonstration account was deleted."
    )

    return jsonify({
        "success": True,
        "message": "Local demo account deleted."
    }), 200


# =====================================
# ERROR HANDLERS
# =====================================

@app.errorhandler(404)
def not_found(error):

    return jsonify({
        "success": False,
        "message": "Requested resource was not found."
    }), 404


@app.errorhandler(500)
def server_error(error):

    logger.exception("Internal server error")

    return jsonify({
        "success": False,
        "message": "Internal server error."
    }), 500


# =====================================
# START SERVER
# =====================================

if __name__ == "__main__":

    print("=" * 55)
    print("CYBERSHIELD RED TEAM / BLUE TEAM LAB")
    print("Local server: http://127.0.0.1:5001")
    print("Health: /api/lab/health")
    print("Create account: /api/lab/account/create")
    print("Lab state: /api/lab/state")
    print("Security events: /api/lab/events")
    print("Main audit:", MAIN_AUDIT_URL)
    print("Account storage: IN MEMORY")
    print("Password storage: HASHED")
    print("Blue Team detection: ENABLED")
    print("=" * 55)

    app.run(
        host=HOST,
        port=PORT,
        debug=False,
        threaded=True
    )