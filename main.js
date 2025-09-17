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

function display(data) {
    const results = document.getElementById('search-results');
    results.innerHTML = "";

    data.forEach(function(point) {
        const box = document.createElement('div');

        box.classList.add('display');
        box.innerHTML = `<div class="display-title">${point.title}</div>
                        <label><strong>Description</strong></label>
                        <p class="display-description">${point.description}</p>
                        <div class="display-info">
                            <div class="display-location">Location: ${point.location}</div>
                            <div class="display-type">Type of Pay: ${point.type_of_pay}</div>
                            <div class="display-pay">Pay: $${point.max_pay}</div>
                        </div>
                        <div class="display-bid">
                            <div>Current Bid: $${point.current_bid}</div>
                            <div>
                                <form class="bid-form">
                                    <input type="number" step="0.01" name="bid" placeholder="Enter A Bid . . ." class="display-input" required>
                                    <button class="display-input-button" type="submit">Place</button>
                                </form>
                            </div>
                        </div>`;
            
        results.appendChild(box);

        const display_form = box.querySelector('form');
        display_form.addEventListener('submit', function(b) {
            b.preventDefault();
            const event_data = new FormData(this);
            bid = parseFloat(event_data.get('bid'));

            if ((point.current_bid == 0 && bid <= point.max_pay) || (point.current_bid != 0 && bid < point.current_bid)) {
                //update current bid and refresh the page after alerting bid placed
                updateBid(point, bid);
            } else {
                alert('Bid is not valid.');
            }
        });
    });
}

async function updateBid(post, bid) {
    try {
        const response = await fetch(`http://localhost:3000/api/updatecurrentbid/${post.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ current_bid: bid })
        });

        if (!response.ok) {
            throw new Error('failed to update bid');
        }

        const update = await response.json();
        console.log('Post updated: ', update);
        alert('Bid placed!');
        const results = document.getElementById('search-results');
        results.innerHTML = "";
    } catch (error) {
        console.error(error);
    } 

}

function couldNotFind(message) {
    const results = document.getElementById('search-results');
    results.innerHTML = "";

    const response_message_div = document.createElement('div');
    response_message_div.innerText = `${message}`;
    response_message_div.style.color = 'red';
    response_message_div.style.fontSize = '18px';
    response_message_div.style.margin = '2%';
    response_message_div.style.display = 'flex';
    response_message_div.style.justifyContent = 'center';

    results.appendChild(response_message_div);
}

async function searchTitle(search) {
    try {
        const response = await fetch(`http://localhost:3000/api/getpostsbytitle?search=${search}`);

        if (!response.ok) {
            couldNotFind(`Could not find any posts with the title: "${search}"`);
        }

        const data = await response.json();

        if (data.length == 0) {
            couldNotFind(`Could not find any posts with the title: ${search}`);
        } else {
            display(data);
        }
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

        if (data.length == 0) {
            couldNotFind(`Could not find any posts with the location: ${search}`);
        } else {
            display(data);
        }
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

        if (data.length == 0) {
            couldNotFind(`Could not find any posts with the type: ${search}`);
        } else {
            display(data);
        }
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

        if (data.length == 0) {
            couldNotFind(`Could not find any posts with pay: ${search}`);
        } else {
            display(data);
        }
    } catch (error) {
        console.error(error);
    }
}