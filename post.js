const form = document.getElementById("post-form");

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);
    post(data.get("title"), data.get("description"), data.get("location"), data.get("payType"), data.get("pay"));
});

function post(title, description, location, payType, pay) {
    if (sessionStorage.getItem("signedIn") == "true") {
        alert("Post: " + title + description + location + payType + pay);
    } else {
        requireSignIn();
    }
}

function requireSignIn() {
    const ul = document.getElementById("post-ul");
    const required = document.createElement("li");

    required.innerHTML = "To create a post you must <a href='signin.html' class='Header-obj'>Sign In</a>";
    required.style.fontSize = "16px";
    required.style.textAlign = "center";
    required.style.color = "red";
    required.style.margin = "2%";

    ul.children[10].style.marginTop = "0";
    ul.insertBefore(required, ul.children[10]);
}