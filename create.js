const form = document.getElementById("createacc-form");

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);
    createAccount(data.get("name"), data.get("email"), data.get("password"), data.get("confirm"));
});

function createAccount(name, email, password, confirm) {
    if (password != confirm) {
        passwordsDoNotMatch();
    } else {
        // add account to database and redirect to signin
        alert("Account created, redirecting to signin.");
    }
}

function passwordsDoNotMatch() {
    alert("passwords DNM");
}