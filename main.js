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

function display() {

}

function couldNotFind(message) {
    const main_body = document.getElementById('main-body');
    const response_message_div = document.createElement('div');

    response_message_div.innerText = `${message}`;
    response_message_div.style.color = 'red';
    response_message_div.style.fontSize = '18px';
    response_message_div.style.margin = '2%';
    response_message_div.style.display = 'flex';
    response_message_div.style.justifyContent = 'center';

    main_body.appendChild(response_message_div);
}

async function searchTitle(search) {
    try {
        const response = await fetch(`http://localhost:3000/api/getpostsbytitle?search=${search}`);

        if (!response.ok) {
            couldNotFind(`Could not find any posts with the title: "${search}"`);
        }

        const data = await response.json();
        console.log(data);
    } catch (err) {
        console.error(err);
    }
}

async function searchLocation(search) {
    try {
        const response = await fetch(`http://localhost:3000/api/getpostsbylocation?search=${search}`);

        if (!response.ok) {
            couldNotFind(`Could not find any posts with the location: "${search}`);
        }

        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error(error);
    }
}

async function searchType(search) {
    try {
        const response = await fetch(`http://localhost:3000/api/getpostsbytype?search=${search}`);

        if (!response.ok) {
            couldNotFind(`Could not find any posts with type of pay: "${search}`);
        }

        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error(error);
    }
}

async function searchPay(search) {
    try {
        const response = await fetch(`http://localhost:3000/api/getpostsbypay?search=${search}`);

        if (!response.ok) {
            couldNotFind(`Could not find any posts with type of pay: "${search}`);
        }

        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error(error);
    }
}