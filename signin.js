const form = document.getElementById("signin-form");

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);
    confirmAccount(data.get("email"), data.get("password"));
});

function confirmAccount(email, password) {
    if (true) { // password not found
        accountNotFound();
    } else {
        alert("confirming email: " + email + " and password: " + password);
    }
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