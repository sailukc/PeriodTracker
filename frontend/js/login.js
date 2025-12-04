function loginUser() {
    let data = {
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
    };

    fetch("http://127.0.0.1:8000/api/login/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            document.getElementById("msg").innerText = data.error;
        } else {
            localStorage.setItem("token", data.token);
            localStorage.setItem("username", data.username);

            alert("Login Successful!");
            window.location.href = "/frontend/pages/dashboard.html";
alert("Login Successful!");

setTimeout(() => {
    window.location.href = "./dashboard.html";
}, 300);
        }
    });
}
