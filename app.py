"""
Union Bank Management System - Flask Backend
Banking operations + user authentication with session protection.
"""

import os
import sqlite3
import random
from datetime import datetime, timedelta
from functools import wraps

from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    redirect,
    url_for,
    session,
    flash,
)
from werkzeug.security import generate_password_hash, check_password_hash

# ---------------------------------------------------------------------------
# Application Configuration
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "union-bank-dev-key-change-in-production")
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_DIR = os.path.join(BASE_DIR, "database")
DATABASE_PATH = os.path.join(DATABASE_DIR, "bank.db")


# ---------------------------------------------------------------------------
# Authentication Decorator
# ---------------------------------------------------------------------------
def login_required(f):
    """Protect routes — redirect HTML requests to login, return 401 for API."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            if request.is_json or request.headers.get("Content-Type") == "application/json":
                return jsonify({"success": False, "message": "Unauthorized. Please login."}), 401
            return redirect(url_for("login", next=request.url))
        return f(*args, **kwargs)

    return decorated_function


# ---------------------------------------------------------------------------
# Database Helpers
# ---------------------------------------------------------------------------
def get_db_connection():
    """Create and return a SQLite database connection."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database tables if they do not exist."""
    os.makedirs(DATABASE_DIR, exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullname TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            mobile TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT NOT NULL UNIQUE,
            account_number TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL,
            balance REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_number TEXT NOT NULL,
            transaction_type TEXT NOT NULL,
            amount REAL NOT NULL,
            transaction_date TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def generate_account_number():
    """Generate a unique 8-digit account number."""
    conn = get_db_connection()
    cursor = conn.cursor()
    while True:
        account_number = str(random.randint(10000000, 99999999))
        cursor.execute(
            "SELECT id FROM accounts WHERE account_number = ?", (account_number,)
        )
        if cursor.fetchone() is None:
            conn.close()
            return account_number


def generate_customer_id():
    """Generate a unique customer ID in format CUST1001, CUST1002, etc."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM accounts")
    count = cursor.fetchone()["count"]
    customer_id = f"CUST{1001 + count}"

    while True:
        cursor.execute(
            "SELECT id FROM accounts WHERE customer_id = ?", (customer_id,)
        )
        if cursor.fetchone() is None:
            conn.close()
            return customer_id
        count += 1
        customer_id = f"CUST{1001 + count}"


def record_transaction(account_number, transaction_type, amount):
    """Insert a transaction record into the transactions table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    transaction_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        """
        INSERT INTO transactions (account_number, transaction_type, amount, transaction_date)
        VALUES (?, ?, ?, ?)
        """,
        (account_number, transaction_type, amount, transaction_date),
    )
    conn.commit()
    conn.close()


def get_account_by_number(account_number):
    """Fetch account details by account number. Returns dict or None."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM accounts WHERE account_number = ?", (account_number,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def get_user_by_username(username):
    """Fetch user by username."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_email(email):
    """Fetch user by email."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_username_or_email(identifier):
    """Fetch user by username or email (for login)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM users WHERE username = ? OR email = ?",
        (identifier, identifier),
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_username_and_email(username, email):
    """Verify forgot-password identity."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM users WHERE username = ? AND email = ?",
        (username, email),
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Authentication Routes (Public)
# ---------------------------------------------------------------------------
@app.route("/login", methods=["GET", "POST"])
def login():
    """User login with username or email."""
    if "user_id" in session:
        return redirect(url_for("index"))

    if request.method == "POST":
        identifier = (request.form.get("identifier") or "").strip()
        password = request.form.get("password") or ""
        remember = request.form.get("remember")

        if not identifier or not password:
            flash("Please enter username/email and password.", "error")
            return render_template("login.html")

        user = get_user_by_username_or_email(identifier)
        if not user or not check_password_hash(user["password_hash"], password):
            flash("Invalid credentials. Please try again.", "error")
            return render_template("login.html")

        session.clear()
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["fullname"] = user["fullname"]
        session.permanent = bool(remember)

        next_url = request.args.get("next") or request.form.get("next")
        if next_url and next_url.startswith("/"):
            return redirect(next_url)
        return redirect(url_for("index"))

    return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    """User registration with hashed password storage."""
    if "user_id" in session:
        return redirect(url_for("index"))

    if request.method == "POST":
        fullname = (request.form.get("fullname") or "").strip()
        email = (request.form.get("email") or "").strip().lower()
        mobile = (request.form.get("mobile") or "").strip()
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        confirm_password = request.form.get("confirm_password") or ""

        errors = []
        if not fullname:
            errors.append("Full name is required.")
        if not email or "@" not in email:
            errors.append("Valid email address is required.")
        if not mobile.isdigit() or len(mobile) != 10:
            errors.append("Mobile number must be 10 digits.")
        if not username:
            errors.append("Username is required.")
        if len(password) < 8:
            errors.append("Password must be at least 8 characters.")
        if password != confirm_password:
            errors.append("Password and Confirm Password must match.")

        if get_user_by_username(username):
            errors.append("Username already exists.")
        if get_user_by_email(email):
            errors.append("Email already registered.")

        if errors:
            for msg in errors:
                flash(msg, "error")
            return render_template("register.html")

        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        password_hash = generate_password_hash(password)

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO users (fullname, email, mobile, username, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (fullname, email, mobile, username, password_hash, created_at),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            conn.rollback()
            flash("Username or email already exists.", "error")
            conn.close()
            return render_template("register.html")
        finally:
            conn.close()

        flash("Registration Successful. Please Login.", "success")
        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    """Verify identity and reset password securely."""
    if "user_id" in session:
        return redirect(url_for("index"))

    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        email = (request.form.get("email") or "").strip().lower()
        new_password = request.form.get("new_password") or ""
        confirm_password = request.form.get("confirm_password") or ""

        user = get_user_by_username_and_email(username, email)
        if not user:
            flash("Account not found. Verify username and registered email.", "error")
            return render_template("forgot_password.html")

        if len(new_password) < 8:
            flash("Password must be at least 8 characters.", "error")
            return render_template("forgot_password.html")

        if new_password != confirm_password:
            flash("New password and confirm password must match.", "error")
            return render_template("forgot_password.html")

        password_hash = generate_password_hash(new_password)
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (password_hash, user["id"]),
        )
        conn.commit()
        conn.close()

        flash("Password Updated Successfully", "success")
        return redirect(url_for("login"))

    return render_template("forgot_password.html")


@app.route("/logout")
def logout():
    """Clear session and redirect to login."""
    session.clear()
    flash("You have been logged out successfully.", "info")
    return redirect(url_for("login"))


# ---------------------------------------------------------------------------
# Protected Page Routes
# ---------------------------------------------------------------------------
@app.route("/")
@login_required
def index():
    """Render the home page with create account, deposit, and withdraw forms."""
    return render_template("index.html")


@app.route("/account")
@login_required
def account_page():
    """Render the account details search page."""
    return render_template("account.html")


@app.route("/transaction-history")
@login_required
def transactions_page():
    """Render the transaction history page."""
    return render_template("transactions.html")


# ---------------------------------------------------------------------------
# Protected API Routes
# ---------------------------------------------------------------------------
@app.route("/create-account", methods=["POST"])
@login_required
def create_account():
    """Create a new bank account."""
    try:
        data = request.get_json() if request.is_json else request.form
        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").strip()
        address = (data.get("address") or "").strip()
        initial_deposit = data.get("initial_deposit", 0)

        if not name:
            return jsonify({"success": False, "message": "Account holder name cannot be empty."}), 400

        if not phone.isdigit() or len(phone) != 10:
            return jsonify({"success": False, "message": "Phone number must contain exactly 10 digits."}), 400

        if not address:
            return jsonify({"success": False, "message": "Address cannot be empty."}), 400

        try:
            initial_deposit = float(initial_deposit)
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Invalid initial deposit amount."}), 400

        if initial_deposit < 0:
            return jsonify({"success": False, "message": "Initial deposit cannot be negative."}), 400

        account_number = generate_account_number()
        customer_id = generate_customer_id()
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO accounts (customer_id, account_number, name, phone, address, balance, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (customer_id, account_number, name, phone, address, initial_deposit, created_at),
        )
        conn.commit()
        conn.close()

        record_transaction(account_number, "Account Creation", initial_deposit)

        return jsonify({
            "success": True,
            "message": "Account created successfully!",
            "account_number": account_number,
            "customer_id": customer_id,
            "balance": initial_deposit,
            "created_at": created_at,
        })

    except Exception as e:
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500


@app.route("/deposit", methods=["POST"])
@login_required
def deposit():
    """Deposit amount into an existing account."""
    try:
        data = request.get_json() if request.is_json else request.form
        account_number = (data.get("account_number") or "").strip()
        amount = data.get("amount", 0)

        if not account_number:
            return jsonify({"success": False, "message": "Account number is required."}), 400

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Invalid deposit amount."}), 400

        if amount <= 0:
            return jsonify({"success": False, "message": "Deposit amount must be greater than 0."}), 400

        account = get_account_by_number(account_number)
        if not account:
            return jsonify({"success": False, "message": "Account not found. Please verify the account number."}), 404

        new_balance = account["balance"] + amount

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE accounts SET balance = ? WHERE account_number = ?",
            (new_balance, account_number),
        )
        conn.commit()
        conn.close()

        record_transaction(account_number, "Deposit", amount)

        return jsonify({
            "success": True,
            "message": f"Deposit of ₹{amount:.2f} successful!",
            "previous_balance": account["balance"],
            "new_balance": new_balance,
            "deposit_amount": amount,
        })

    except Exception as e:
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500


@app.route("/withdraw", methods=["POST"])
@login_required
def withdraw():
    """Withdraw amount from an existing account."""
    try:
        data = request.get_json() if request.is_json else request.form
        account_number = (data.get("account_number") or "").strip()
        amount = data.get("amount", 0)

        if not account_number:
            return jsonify({"success": False, "message": "Account number is required."}), 400

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Invalid withdrawal amount."}), 400

        if amount <= 0:
            return jsonify({"success": False, "message": "Withdrawal amount must be greater than 0."}), 400

        account = get_account_by_number(account_number)
        if not account:
            return jsonify({"success": False, "message": "Account not found. Please verify the account number."}), 404

        if account["balance"] < amount:
            return jsonify({
                "success": False,
                "message": "Insufficient Funds",
                "current_balance": account["balance"],
            }), 400

        new_balance = account["balance"] - amount

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE accounts SET balance = balance - ? WHERE account_number = ? AND balance >= ?",
            (amount, account_number, amount),
        )
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({
                "success": False,
                "message": "Insufficient Funds",
                "current_balance": account["balance"],
            }), 400
        conn.commit()
        conn.close()

        record_transaction(account_number, "Withdrawal", amount)

        return jsonify({
            "success": True,
            "message": f"Withdrawal of ₹{amount:.2f} successful!",
            "previous_balance": account["balance"],
            "new_balance": new_balance,
            "withdraw_amount": amount,
        })

    except Exception as e:
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500


@app.route("/account/<account_number>")
@login_required
def get_account(account_number):
    """Return account details for a given account number."""
    try:
        account = get_account_by_number(account_number)
        if not account:
            return jsonify({"success": False, "message": "Account not found."}), 404

        return jsonify({
            "success": True,
            "account": {
                "name": account["name"],
                "phone": account["phone"],
                "account_number": account["account_number"],
                "customer_id": account["customer_id"],
                "balance": account["balance"],
                "created_at": account["created_at"],
                "address": account["address"],
            },
        })

    except Exception as e:
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500


@app.route("/transactions")
@login_required
def get_transactions():
    """Return all transactions ordered by date (most recent first)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, account_number, transaction_type, amount, transaction_date
            FROM transactions
            ORDER BY transaction_date DESC
            """
        )
        rows = cursor.fetchall()
        conn.close()

        transactions = [dict(row) for row in rows]
        return jsonify({"success": True, "transactions": transactions})

    except Exception as e:
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500


# ---------------------------------------------------------------------------
# Application Entry Point
# ---------------------------------------------------------------------------
init_db()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
