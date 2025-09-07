function signin() {
    sessionStorage.setItem("signedIn", "true");
}

function signout() {
    sessionStorage.setItem("signedIn", "false");
}

function updateHeader(signedIn) {
    const header = document.getElementById("header");

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
        header.appendChild(signout);
        header.removeChild(signin);

    } else if (!signedIn && document.getElementById("signout-link") && document.getElementById("profile-link")) {

        const signin = document.createElement("li");

        signin.innerHTML = "<a href='signin.html' class='Header-obj'>Sign In</a>";
        signin.classList.add("Header-links");
        signin.id = "signin-link";

        header.removeChild(document.getElementById("signout-link"));
        header.removeChild(document.getElementById("profile-link"));
        header.insertBefore(signin, header.children[4]);
    }
}

const search_form = document.getElementById('search-bar');

search_form.addEventListener('submit', function(e) {
    e.preventDefault();
    const data = new FormData(this);

    if (data.get('search-select') == 'Title') {
        searchTitle(data.get('search'));
    } else if (data.get('search-select') == 'Location') {
        searchLocation(data.get('search'));
    } else if (data.get('search-select') == 'Type') {
        searchType(data.get('search'));
    } else {
        searchPay(data.get('search'));
    }
});

function searchTitle(search) {

}

function searchLocation(search) {

}

function searchType(search) {

}

function searchPay(search) {

}

function display() {

}