function registerUser() {
    let data = {
        username: document.getElementById("username").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
    };

    fetch("http://127.0.0.1:8000/api/register/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            document.getElementById("message").innerText = data.error;
        } else {
            alert("Registration Successful!");
           window.location.href = "/frontend/pages/login.html";
alert("Registration Successful!");

setTimeout(() => {
    window.location.href = "./login.html";
}, 300);

        }
    });
}
