function signin() {
    sessionStorage.setItem("signedIn", "true");
    sessionStorage.setItem('mypostsdisplay', 'false');
}

function signout() {
    sessionStorage.setItem("signedIn", "false");
    sessionStorage.setItem('mypostsdisplay', 'false');
}

function updateHeader(signedIn) {
    const header = document.getElementById("header");

    if (signedIn) {
                
        const signout = document.createElement("div");
        const profile = document.createElement("div");
        const signin = document.getElementById("signin-link");

        signout.innerHTML = "<a href='signout.html'>Sign Out</a>";
        signout.classList.add("Header-obj");
        signout.id = "signout-link";

        profile.innerHTML = "<a href='profile.html'>Profile</a>";
        profile.classList.add("Header-obj");
        profile.id = "profile-link";

        header.appendChild(profile);
        header.appendChild(signout);
        header.removeChild(signin);

    } else if (!signedIn && document.getElementById("signout-link") && document.getElementById("profile-link")) {

        const signin = document.createElement("div");

        signin.innerHTML = "<a href='signin.html'>Sign In</a>";
        signin.classList.add("Header-obj");
        signin.id = "signin-link";

        header.removeChild(document.getElementById("signout-link"));
        header.removeChild(document.getElementById("profile-link"));
        header.insertBefore(signin, header.children[4]);
    }
}

const signedIn = sessionStorage.getItem("signedIn") === "true";
updateHeader(signedIn);