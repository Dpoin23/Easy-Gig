const form = document.getElementById("createacc-form");

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);
    var name = data.get("name");
    var email = data.get("email");
    var password = data.get("password");
    var confirm = data.get("confirm");
    createAccount(name, email, password, confirm);
});

function createAccount(name, email, password, confirm) {
    if (password != confirm) {
        alert("Passwords must match!");
    } 
    // add account to database and redirect to signin/home
    alert(name + " " + email + " " + password + " " + confirm);
}