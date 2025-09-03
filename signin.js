const form = document.getElementById("signin-form");

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);
    checkUser(data.get("email"), data.get("password"));
});

function checkUser(email, password) {
    if (confirmPassword(email, password)) { 
        signin();
        window.location.href = "index.html";
    } else {
        accountNotFound();
    }
}

function confirmPassword(em, pw) {
    // use email to fetch the password, confirm account by comparing passwords
    const user = {
        email: em
    }

    fetch('/api/getuser', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(user)
    })
    .then(response => response.json())
    .then(user => console.log(user));
}

function accountNotFound() {
    const ul = document.getElementById("signin-ul");
    const notFound = document.createElement("li");
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    
    notFound.innerText = "Error, your email or password is incorrect"
    notFound.style.textAlign = "center";
    notFound.style.color = "red";
    notFound.style.fontSize = "16px";
    notFound.style.margin = "2%";

    email.style.border = "2px solid black";
    password.style.border = "2px solid black";

    ul.children[4].style.marginTop = "0";
    ul.insertBefore(notFound, ul.children[4]);
}