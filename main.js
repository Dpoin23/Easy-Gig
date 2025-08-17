function signin() {
    sessionStorage.setItem("signedIn", "true");
}

function signout() {
    sessionStorage.setItem("signedIn", "false");
}

function updateHeader(signedIn) {
    const header = document.getElementById("header");
    console.log(document.getElementById("signout-link"));
    console.log(document.getElementById("signin-link"));


    if (signedIn) {
        
        const signout = document.createElement("li");

        signout.innerHTML = "<a href='signout.html' class='Header-obj'>Sign Out</a>";
        signout.classList.add("Header-links");
        signout.id = "signout-link";

        header.replaceChild(signout, document.getElementById("signin-link"));

    } else if (!signedIn && document.getElementById("signout-link")) {

        const signin = document.createElement("li");

        signin.innerHTML = "<a href='signin.html' class='Header-obj'>Sign In</a>";
        signin.classList.add("Header-links");
        signin.id = "signin-link";

        header.replaceChild(signin, document.getElementById("signout-link"));
    }
}
