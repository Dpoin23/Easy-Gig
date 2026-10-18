const search_form = document.getElementById('search-form');
const searchSelect = document.getElementById('search-select');
const searchInput = document.getElementById('search-input');
const locationTools = document.getElementById('search-location-tools');
const locationStatus = document.getElementById('search-location-status');
const useMyLocationButton = document.getElementById('use-my-location');

let geoOrigin = null;

const searchPlacePicker = bindPlacePicker(document.getElementById('search-place-picker'), {
    mode: 'search',
    onSelect() {
        geoOrigin = null;
        setLocationStatus('');
    },
});

function locationModeOn() {
    return searchSelect.value === 'Location';
}

function toggleLocationTools() {
    locationTools.hidden = !locationModeOn();
    searchInput.placeholder = locationModeOn()
        ? 'City, neighborhood, or current area'
        : 'Search for a Gig';
    if (!locationModeOn()) {
        geoOrigin = null;
        setLocationStatus('');
    }
}

searchSelect.addEventListener('change', toggleLocationTools);
toggleLocationTools();

useMyLocationButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
        setLocationStatus('This browser cannot share a current location. Type a city instead.');
        return;
    }

    setLocationStatus('Reading your current location…');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            geoOrigin = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };
            searchPlacePicker.setBias(geoOrigin.lat, geoOrigin.lng);
            setLocationStatus('Using your current location. Distance is measured from here.');
        },
        () => {
            geoOrigin = null;
            setLocationStatus('Could not read your location. Type a city instead.');
        },
        {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000,
        }
    );
});

search_form.addEventListener('submit', function(e) {
    e.preventDefault();
    const data = new FormData(this);
    const search = data.get('search');
    const mode = data.get('search-select');

    if (mode === 'Title') {
        searchTitle(search);
    } else if (mode === 'Location') {
        searchLocation(search, {
            placeId: searchPlacePicker.getPlaceId(),
            sessionToken: searchPlacePicker.getSessionToken(),
            radius: data.get('radius'),
            lat: geoOrigin ? geoOrigin.lat : null,
            lng: geoOrigin ? geoOrigin.lng : null,
        });
    } else if (mode === 'Type') {
        searchType(search);
    } else {
        searchPay(search);
    }
});

function setLocationStatus(message) {
    locationStatus.hidden = !message;
    locationStatus.textContent = message || '';
}

function escapeHtml(value) {
    return escapeGigText(value);
}

function currentUserId() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user') || 'null');
        const id = user && Number(user.id);
        return Number.isInteger(id) && id > 0 ? id : null;
    } catch {
        return null;
    }
}

function canMessagePost(point) {
    if (point.is_owner) {
        return false;
    }
    const userId = currentUserId();
    return userId == null || Number(point.user_id) !== userId;
}

async function openConversation(postId) {
    try {
        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: postId }),
        });
        if (response.status === 401) {
            alert('Sign in to message the poster.');
            window.location.href = 'signin.html';
            return;
        }
        const body = await response.json().catch(function() {
            return {};
        });
        if (!response.ok) {
            alert(body.error || 'Could not open that conversation.');
            return;
        }
        window.location.href = `messages.html?conversation=${encodeURIComponent(body.id)}`;
    } catch (error) {
        console.error(error);
    }
}

function appendPost(results, point) {
    const box = document.createElement('div');

    box.classList.add('display');
    box.innerHTML = `<div class="display-title">${escapeHtml(point.title)}</div>
                    <label><strong>Description</strong></label>
                    <p class="display-description">${escapeHtml(point.description)}</p>
                    ${gigImagesHtml(point)}
                    <div class="display-info">
                        ${gigLocationHtml(point)}
                        <div class="display-type">Type of Pay: ${escapeHtml(point.type_of_pay)}</div>
                        <div class="display-pay">Pay: $${escapeHtml(point.max_pay)}</div>
                    </div>
                    <div class="display-bid">
                        <div>Current Bid: $${escapeHtml(point.current_bid)}</div>
                        <div>
                            <form class="bid-form">
                                <input type="number" step="0.01" name="bid" placeholder="Enter A Bid . . ." class="display-input" required>
                                <button class="display-input-button" type="submit">Place</button>
                            </form>
                        </div>
                    </div>`;

    if (canMessagePost(point)) {
        const actions = document.createElement('div');
        actions.className = 'display-message';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'display-input-button message-poster';
        button.textContent = 'Message';
        button.addEventListener('click', function() {
            openConversation(point.id);
        });
        actions.appendChild(button);
        box.appendChild(actions);
    }

    results.appendChild(box);

    const display_form = box.querySelector('form');
    display_form.addEventListener('submit', function(b) {
        b.preventDefault();
        const event_data = new FormData(this);
        const bid = parseFloat(event_data.get('bid'));

        const current = Number(point.current_bid);
        const maxPay = Number(point.max_pay);
        if (!(bid > 0) || bid > maxPay) {
            alert('Bid must be greater than zero and no higher than the listed pay.');
            return;
        }
        if (current > 0 && bid >= current) {
            alert('Bid must be lower than the current bid.');
            return;
        }
        updateBid(point, bid);
    });
}

function displayGrouped(relevant, related) {
    clearSearch();
    const results = document.getElementById('search-results');

    relevant.forEach(function(point) {
        appendPost(results, point);
    });

    if (related.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'search-divider';
        divider.setAttribute('role', 'separator');
        divider.textContent = 'Related searches';
        results.appendChild(divider);

        related.forEach(function(point) {
            appendPost(results, point);
        });
    }
}

async function updateBid(post, bid) {
    try {
        const response = await fetch(`/api/updatecurrentbid/${post.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ current_bid: bid })
        });

        if (response.status === 401) {
            alert('Sign in to place a bid.');
            return;
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            alert(body.error || 'Could not place that bid.');
            return;
        }

        let message = 'Bid placed!';
        if (post.has_precise_address && !post.precise_address) {
            message = 'Bid placed. Exact address is shared after you are hired.';
        }
        alert(message);
        clearSearch();
    } catch (error) {
        console.error(error);
    }
}

function couldNotFind(message) {
    const results = document.getElementById('search-results');
    results.innerHTML = '';

    const response_message_div = document.createElement('div');
    response_message_div.innerText = `${message}`;
    response_message_div.style.color = 'red';
    response_message_div.style.fontSize = '18px';
    response_message_div.style.margin = '2%';
    response_message_div.style.display = 'flex';
    response_message_div.style.justifyContent = 'center';

    results.appendChild(response_message_div);
}

async function runSearch(url, emptyMessage) {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            couldNotFind(body.error || emptyMessage);
            return;
        }

        const data = await response.json();
        const relevant = Array.isArray(data) ? data : (data.relevant || []);
        const related = Array.isArray(data) ? [] : (data.related || []);

        if (relevant.length === 0 && related.length === 0) {
            couldNotFind(emptyMessage);
            return;
        }

        displayGrouped(relevant, related);
    } catch (err) {
        console.error(err);
    }
}

async function searchTitle(search) {
    const query = encodeURIComponent(search);
    await runSearch(
        `/api/getpostsbytitle?search=${query}`,
        `Could not find any posts with the title: "${search}"`
    );
}

async function searchLocation(search, extras) {
    const params = new URLSearchParams();
    if (search) {
        params.set('search', search);
    }
    if (extras.radius) {
        params.set('radius', extras.radius);
    }
    if (extras.lat != null && extras.lng != null) {
        params.set('lat', extras.lat);
        params.set('lng', extras.lng);
    } else if (extras.placeId) {
        params.set('placeId', extras.placeId);
        if (extras.sessionToken) {
            params.set('sessionToken', extras.sessionToken);
        }
    }

    const label = extras.lat != null
        ? 'your current location'
        : (search || 'that area');
    await runSearch(
        `/api/getpostsbylocation?${params.toString()}`,
        `Could not find any posts near ${label}`
    );
}

async function searchType(search) {
    const query = encodeURIComponent(search);
    await runSearch(
        `/api/getpostsbytype?search=${query}`,
        `Could not find any posts with type of pay: "${search}"`
    );
}

async function searchPay(search) {
    const query = encodeURIComponent(search);
    await runSearch(
        `/api/getpostsbypay?search=${query}`,
        `Could not find any posts with pay: "${search}"`
    );
}

function clearSearch() {
    const results = document.getElementById('search-results');
    results.innerHTML = '';
}
