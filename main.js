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
        const profile = document.createElement("li");
        const signin = document.getElementById("signin-link");

        signout.innerHTML = "<a href='signout.html' class='Header-obj'>Sign Out</a>";
        signout.classList.add("Header-links");
        signout.id = "signout-link";

        profile.innerHTML = "<a href='profile.html' class='Header-obj'>Profile</a>";
        profile.classList.add("Header-links");
        profile.id = "profile-link";

        header.appendChild(profile);
        //header.replaceChild(signout, document.getElementById("signin-link"));
        header.appendChild(signout);

        header.removeChild(signin);

    } else if (!signedIn && document.getElementById("signout-link") && document.getElementById("profile-link")) {

        const signin = document.createElement("li");

        signin.innerHTML = "<a href='signin.html' class='Header-obj'>Sign In</a>";
        signin.classList.add("Header-links");
        signin.id = "signin-link";

        //header.replaceChild(signin, document.getElementById("signout-link"));
        header.removeChild(document.getElementById("signout-link"));

        header.removeChild(document.getElementById("profile-link"));

        header.insertBefore(signin, header.children[4]);
    }
}
