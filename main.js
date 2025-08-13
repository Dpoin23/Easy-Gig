function signin() {
    localStorage.setItem("signedIn", "true");
    updateHeader(true);
}

function signout() {
    localStorage.setItem("signedIn", "false");
    updateHeader(false);
}

function updateHeader(signedIn) {
    const header = document.getElementById("header");

    if (signedIn) {
        const signout = document.createElement("li");

        signout.innerHTML = "<a href='signout.html' class='Header-obj'>Sign Out</a>";
        signout.classList.add("Header-links");
        signout.id = "signout-link";

        header.replaceChild(document.getElementById("signin-link"), signout);
    } else {
        const signin = document.createElement("li");

        signin.innerHTML = "<a href='signin.html' class='Header-obj'>Sign In</a>";
        signin.classList.add("Header-links");
        signin.id = "signin-link";

        header.replaceChild(document.getElementById("signout-link"), signin);
    }
}