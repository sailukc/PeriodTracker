const API_BASE = "http://127.0.0.1:8000";

function getAuthHeaders() {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Token ${token}`
    };
}

function savePeriodLog() {
    const data = {
        start_date: document.getElementById("start_date").value,
        end_date: document.getElementById("end_date").value,
        cycle_length: document.getElementById("cycle_length").value || null,
        flow_level: document.getElementById("flow_level").value,
        mood: document.getElementById("mood").value,
        symptoms: document.getElementById("symptoms").value,
        notes: document.getElementById("notes").value,
    };

    fetch(`${API_BASE}/api/period-logs/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    })
    .then(res => res.json().then(body => ({ status: res.status, body })))
    .then(({ status, body }) => {
        if (status >= 400) {
            document.getElementById("log_msg").innerText =
                body.detail || JSON.stringify(body);
        } else {
            alert("Log saved!");
            document.getElementById("log_msg").innerText = "";
            loadPeriodLogs();
        }
    })
    .catch(err => {
        document.getElementById("log_msg").innerText = "Network error";
        console.error(err);
    });
}

function loadPeriodLogs() {
    fetch(`${API_BASE}/api/period-logs/`, {
        method: "GET",
        headers: getAuthHeaders()
    })
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById("logs_list");
        container.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = "<p>No logs yet.</p>";
            return;
        }

        data.forEach(log => {
            const div = document.createElement("div");
            div.className = "card";
            div.innerHTML = `
                <p><strong>${log.start_date}</strong> → ${log.end_date}</p>
                <p>Cycle: ${log.cycle_length || '-'} days | Flow: ${log.flow_level || '-'}</p>
                <p>Mood: ${log.mood || '-'}</p>
                <p>Symptoms: ${log.symptoms || '-'}</p>
                <p>Notes: ${log.notes || '-'}</p>
            `;
            container.appendChild(div);
        });
    })
    .catch(err => console.error(err));
}

// Auto-load logs when page opens
window.addEventListener("load", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Please login first");
        window.location.href = "login.html";
    } else {
        loadPeriodLogs();
    }
});
