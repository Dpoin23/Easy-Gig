const form = document.getElementById("signin-form");

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);
    confirmAccount(data.get("email"), data.get("password"));
});

function confirmAccount(email, password) {
    alert("confirming email: " + email + " and password: " + password);
}