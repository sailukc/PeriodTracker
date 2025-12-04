// Global helper functions

function apiGet(url) {
    return fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    }).then(res => res.json());
}

function apiPost(url, data) {
    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data)
    }).then(res => res.json());
}

console.log("JS loaded successfully!");
