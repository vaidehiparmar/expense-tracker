const API = "/transactions";

const balance = document.getElementById("balance");
const plus = document.getElementById("money-plus");
const minus = document.getElementById("money-minus");

const incomeList = document.getElementById("income-list");
const expenseList = document.getElementById("expense-list");

const form = document.getElementById("form");
const text = document.getElementById("text");
const amount = document.getElementById("amount");
const category = document.getElementById("category");

const month = document.getElementById("month");
const year = document.getElementById("year");

const insightBox = document.getElementById("insight-box");
const comparisonBox = document.getElementById("comparison");
const highestCategoryBox = document.getElementById("highest-category");
const topMonthBox = document.getElementById("top-month");

let chart;

// ================= ICONS =================
const icons = {
    Food: "🍔",
    Transport: "🚗",
    Salary: "💰",
    Business: "📈",
    Education: "📚",
    Groceries: "🛒",
    Shopping: "🛍️",
    Other: "📦"
};

// ================= LOGIN =================
function login() {
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value.trim();

    if (user === "admin" && pass === "1234") {
        localStorage.setItem("login", "true");
        showApp();
    } else {
        alert("Wrong login ❌ (use admin / 1234)");
    }
}

function logout() {
    localStorage.removeItem("login");
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("app").style.display = "none";
}

function showApp() {
    
 

    document.getElementById("login-page").style.display = "none";
    document.getElementById("app").style.display = "block";

    loadData();
}
// ================= LOAD DATA =================
async function loadData() {

   const selectedMonth = month.value;
const selectedYear = year.value;

    const res = await fetch(
        `${API}?month=${selectedMonth}&year=${selectedYear}`
    );

    const data = await res.json();

    incomeList.innerHTML = "";
    expenseList.innerHTML = "";

    let income = 0;
    let expense = 0;

    // ================= GROUPING =================
    const grouped = {};

    data.forEach(item => {
        const cat = item.category || "Other";

        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    // ================= DISPLAY =================
    for (let cat in grouped) {

        let hasIncome = grouped[cat].some(i => i.amount > 0);
        let hasExpense = grouped[cat].some(i => i.amount < 0);

        // -------- INCOME --------
        if (hasIncome) {
            const title = document.createElement("h4");
            title.innerText = `${icons[cat] || "📌"} ${cat}`;
            incomeList.appendChild(title);

            grouped[cat].forEach(item => {
                if (item.amount > 0) {
                    const li = document.createElement("li");

                    li.innerHTML = `
                        ${item.text}
                        <span>₹${item.amount}</span>
                        <button onclick="deleteItem(${item.id})">🗑</button>
                    `;

                    incomeList.appendChild(li);
                    income += item.amount;
                }
            });
        }

        // -------- EXPENSE --------
        if (hasExpense) {
            const title = document.createElement("h4");
            title.innerText = `${icons[cat] || "📌"} ${cat}`;
            expenseList.appendChild(title);

            grouped[cat].forEach(item => {
                if (item.amount < 0) {
                    const li = document.createElement("li");

                    li.innerHTML = `
                        ${item.text}
                        <span>₹${item.amount}</span>
                        <button onclick="deleteItem(${item.id})">🗑</button>
                    `;

                    expenseList.appendChild(li);
                    expense += item.amount;
                }
            });
        }
    }

   // ================= TOTAL =================
balance.innerText = "₹" + (income + expense);
plus.innerText = "₹" + income;
minus.innerText = "₹" + Math.abs(expense);

// ================= INSIGHTS =================

let highestCategory = "";
let highestAmount = 0;

for (let cat in grouped) {

    let total = 0;

    grouped[cat].forEach(item => {
        if (item.amount < 0) {
            total += Math.abs(item.amount);
        }
    });

    if (total > highestAmount) {
        highestAmount = total;
        highestCategory = cat;
    }
}

if (highestCategoryBox) {
    highestCategoryBox.innerText =
        highestCategory
        ? `${icons[highestCategory]} ${highestCategory}`
        : "No Data";
}
// ================= TOP SPENDING MONTH =================

let monthTotals = {};

data.forEach(item => {

    if (item.amount < 0) {

        const monthKey = item.date.substring(0, 7);

        if (!monthTotals[monthKey]) {
            monthTotals[monthKey] = 0;
        }

        monthTotals[monthKey] += Math.abs(item.amount);
    }
});

let topMonth = "No Data";
let topAmount = 0;

for (let m in monthTotals) {

    if (monthTotals[m] > topAmount) {
        topAmount = monthTotals[m];
        topMonth = m;
    }
}

if (topMonthBox) {

    if (topMonth === "No Data") {
        topMonthBox.innerText = "No Data";
    } else {
        topMonthBox.innerText =
            `${topMonth} (₹${topAmount})`;
    }
}

const savings = income - Math.abs(expense);

if (insightBox) {

    if (savings > 0) {
        insightBox.innerText =
            `💡 Great! You saved ₹${savings} this month`;
    } else {
        insightBox.innerText =
            `⚠ You spent ₹${Math.abs(savings)} more than you earned`;
    }
}

// ================= MONTH COMPARISON =================

try {

    const compareRes = await fetch(
        `http://127.0.0.1:5000/month-comparison?month=${selectedMonth}&year=${selectedYear}`
    );

    const compareData = await compareRes.json();
console.log(compareData);
    if (comparisonBox) {

        if (compareData.difference > 0) {

            comparisonBox.innerText =
                `📈 ₹${compareData.difference} more spent than last month`;

        } else if (compareData.difference < 0) {

            comparisonBox.innerText =
                `🎉 ₹${Math.abs(compareData.difference)} less spent than last month`;

        } else {

            comparisonBox.innerText =
                `😎 Same spending as last month`;

        }
    }

} catch (err) {
    console.log(err);
}

drawChart(income, Math.abs(expense));

}
// ================= ADD  =================
if (form) {
form.addEventListener("submit", async (e) => {
    
    e.preventDefault();

    if (!text.value || !amount.value) {
        alert("Enter details properly");
        return;
    }

   let selectedMonth = month.value;
let selectedYear = year.value;

if (selectedMonth === "all") {
    selectedMonth = String(new Date().getMonth() + 1).padStart(2, "0");
}

if (selectedYear === "all") {
    selectedYear = String(new Date().getFullYear());
}
    await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text: text.value,
            amount: +amount.value,
            category: category.value,

            // 🔥 CRITICAL FIX
            month: selectedMonth,
            year: selectedYear
        })
    });

 const currentMonth =
    document.getElementById("month").value;

const currentYear =
    document.getElementById("year").value;

console.log(currentMonth, currentYear);

text.value = "";
amount.value = "";

month.value = currentMonth;
year.value = currentYear;

category.value = "Food";

loadData();
});
}

// ================= DELETE =================
async function deleteItem(id) {
    await fetch(API + "/" + id, { method: "DELETE" });
    loadData();
}

// ================= CHART =================
function drawChart(income, expense) {
    const ctx = document.getElementById("chart");

    if (!ctx) return;

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: ["Income", "Expense"],
            datasets: [{
                data: [income, expense],
                backgroundColor: ["#36A2EB", "#FF6384"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// ================= FILTER EVENTS =================
month?.addEventListener("change", loadData);
year?.addEventListener("change", loadData);

// ================= AUTO LOAD =================
window.onload = () => {


    if (localStorage.getItem("login") === "true") {
        showApp();
    } else {
        document.getElementById("login-page").style.display = "flex";
        document.getElementById("app").style.display = "none";
    }
};
