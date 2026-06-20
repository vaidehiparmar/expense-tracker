from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

# ================= DB =================
def get_db():
    conn = sqlite3.connect("database.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()

    # USERS TABLE
    conn.execute('''
    CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )
    ''')

    # TRANSACTIONS TABLE
    conn.execute('''
    CREATE TABLE IF NOT EXISTS transactions(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        text TEXT,
        amount REAL,
        category TEXT,
        date TIMESTAMP
    )
    ''')

    # ADD user_id COLUMN IF DATABASE IS OLD
    try:
        conn.execute(
            "ALTER TABLE transactions ADD COLUMN user_id INTEGER DEFAULT 1"
        )
    except:
        pass

    conn.commit()
    conn.close()

# ================= AUTH =================
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    conn = get_db()

    try:
        conn.execute(
            "INSERT INTO users(username,password) VALUES (?,?)",
            (data["username"], generate_password_hash(data["password"]))
        )
        conn.commit()
    except:
        return jsonify({"error": "User exists"})

    return jsonify({"msg": "created"})

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    conn = get_db()

    user = conn.execute(
        "SELECT * FROM users WHERE username=?",
        (data["username"],)
    ).fetchone()

    if user and check_password_hash(user["password"], data["password"]):
        return jsonify({"msg": "success"})
    return jsonify({"error": "invalid"})

# ================= GET =================
@app.route("/transactions", methods=["GET"])
def get_transactions():

    month = request.args.get("month", "all")
    year = request.args.get("year", "all")
    user_id = request.args.get("user_id", 1)

    conn = get_db()

    query = "SELECT * FROM transactions WHERE user_id=?"
    params = [user_id]

    if month != "all":
        query += " AND strftime('%m', date)=?"
        params.append(str(month).zfill(2))

    if year != "all":
        query += " AND strftime('%Y', date)=?"
        params.append(str(year))

    data = conn.execute(query, params).fetchall()

    conn.close()

    return jsonify([dict(x) for x in data])

# ================= ADD =================
@app.route("/transactions", methods=["POST"])
def add_transaction():

    data = request.json

    conn = get_db()

    month = str(data.get("month")).zfill(2)
    year = str(data.get("year"))

    custom_date = f"{year}-{month}-01 00:00:00"

    user_id = data.get("user_id", 1)

    conn.execute(
        """
        INSERT INTO transactions
        (user_id,text,amount,category,date)
        VALUES (?,?,?,?,?)
        """,
        (
            user_id,
            data["text"],
            data["amount"],
            data["category"],
            custom_date
        )
    )

    conn.commit()
    conn.close()

    return jsonify({"msg": "added"})


# ================= DELETE =================
@app.route("/transactions/<int:id>", methods=["DELETE"])
def delete_transaction(id):
    conn = get_db()

    conn.execute(
        "DELETE FROM transactions WHERE id=?",
        (id,)
    )

    conn.commit()
    conn.close()

    return jsonify({"msg": "deleted"})


# ================= UPDATE =================
@app.route("/transactions/<int:id>", methods=["PUT"])
def update_transaction(id):

    data = request.json

    conn = get_db()

    conn.execute(
        """
        UPDATE transactions
        SET text=?,
            amount=?,
            category=?
        WHERE id=?
        """,
        (
            data["text"],
            data["amount"],
            data["category"],
            id
        )
    )

    conn.commit()
    conn.close()

    return jsonify({"msg": "updated"})


# ================= SEARCH =================
@app.route("/search")
def search_transactions():

    keyword = request.args.get("q", "")

    conn = get_db()

    data = conn.execute(
        """
        SELECT *
        FROM transactions
        WHERE text LIKE ?
        """,
        ('%' + keyword + '%',)
    ).fetchall()

    conn.close()

    return jsonify([dict(x) for x in data])

# ================= STATS =================
@app.route("/stats")
def get_stats():

    conn = get_db()

    data = conn.execute(
        """
        SELECT *
        FROM transactions
        """
    ).fetchall()

    conn.close()

    transactions = [dict(x) for x in data]

    total_income = 0
    total_expense = 0

    category_totals = {}
    month_totals = {}

    for item in transactions:

        amount = float(item["amount"])

        if amount > 0:
            total_income += amount
        else:
            total_expense += abs(amount)

            category = item["category"]

            if category not in category_totals:
                category_totals[category] = 0

            category_totals[category] += abs(amount)

        date = str(item["date"])

        month_key = date[:7]   # YYYY-MM

        if month_key not in month_totals:
            month_totals[month_key] = 0

        if amount < 0:
            month_totals[month_key] += abs(amount)

    highest_category = "No Data"
    highest_amount = 0

    if category_totals:
        highest_category = max(
            category_totals,
            key=category_totals.get
        )

        highest_amount = category_totals[highest_category]

    top_month = "No Data"
    top_month_amount = 0

    if month_totals:
        top_month = max(
            month_totals,
            key=month_totals.get
        )

        top_month_amount = month_totals[top_month]

    savings = total_income - total_expense

    return jsonify({
        "total_income": total_income,
        "total_expense": total_expense,
        "savings": savings,

        "highest_category": highest_category,
        "highest_category_amount": highest_amount,

        "top_month": top_month,
        "top_month_amount": top_month_amount
    })
   # ================= MONTH COMPARISON =================
@app.route("/month-comparison")
def month_comparison():

    month_value = request.args.get("month")
    year_value = request.args.get("year")

    if month_value == "all" or year_value == "all":
        return jsonify({
            "current_expense": 0,
            "previous_expense": 0,
            "difference": 0
        })

    month = int(month_value)
    year = int(year_value)

    current_month = str(month).zfill(2)
    current_year = str(year)

    if month == 1:
        prev_month = "12"
        prev_year = str(year - 1)
    else:
        prev_month = str(month - 1).zfill(2)
        prev_year = str(year)

    conn = get_db()

    current = conn.execute(
        """
        SELECT amount
        FROM transactions
        WHERE strftime('%m', date)=?
        AND strftime('%Y', date)=?
        """,
        (current_month, current_year)
    ).fetchall()

    previous = conn.execute(
        """
        SELECT amount
        FROM transactions
        WHERE strftime('%m', date)=?
        AND strftime('%Y', date)=?
        """,
        (prev_month, prev_year)
    ).fetchall()

    conn.close()

    current_expense = sum(
        abs(float(x["amount"]))
        for x in current
        if float(x["amount"]) < 0
    )

    previous_expense = sum(
        abs(float(x["amount"]))
        for x in previous
        if float(x["amount"]) < 0
    )

    difference = current_expense - previous_expense

    return jsonify({
        "current_expense": current_expense,
        "previous_expense": previous_expense,
        "difference": difference
    })
@app.route("/")
def home():
    return send_from_directory(".", "index.html")

@app.route("/style.css")
def css():
    return send_from_directory(".", "style.css")

@app.route("/script.js")
def js():
    return send_from_directory(".", "script.js")
# ================= CHECK =================
@app.route("/check")
def check():

    conn = get_db()

    data = conn.execute(
        "SELECT * FROM transactions"
    ).fetchall()

    conn.close()

    return jsonify([dict(x) for x in data])


# ================= RUN =================
if __name__ == "__main__":
    init_db()
    app.run(debug=True)