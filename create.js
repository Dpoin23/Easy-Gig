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
    const ul = document.getElementById("createacc-ul");
    const errorMsg = document.createElement("li");
    const passwordBox = document.getElementById("password");
    const confirmBox = document.getElementById("confirm");

    errorMsg.textContent = "Error, passwords do not match.";
    errorMsg.style.color = "red";
    errorMsg.style.fontSize = "16px";
    errorMsg.style.margin = "2%";

    passwordBox.style.border = "2px solid black";
    confirmBox.style.border = "2px solid black";

    ul.children[8].style.marginTop = "0";
    ul.insertBefore(errorMsg, ul.children[8]);
}