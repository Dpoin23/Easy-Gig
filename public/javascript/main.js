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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function appendPost(results, point) {
    const box = document.createElement('div');

    box.classList.add('display');
    box.innerHTML = `<div class="display-title">${escapeHtml(point.title)}</div>
                    <label><strong>Description</strong></label>
                    <p class="display-description">${escapeHtml(point.description)}</p>
                    <div class="display-info">
                        <div class="display-location">Location: ${escapeHtml(point.location)}</div>
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

    results.appendChild(box);

    const display_form = box.querySelector('form');
    display_form.addEventListener('submit', function(b) {
        b.preventDefault();
        const event_data = new FormData(this);
        const bid = parseFloat(event_data.get('bid'));

        if ((point.current_bid == 0 && bid <= point.max_pay) || (point.current_bid != 0 && bid < point.current_bid)) {
            updateBid(point, bid);
        } else {
            alert('Bid is not valid.');
        }
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

        if (!response.ok) {
            throw new Error('failed to update bid');
        }

        const update = await response.json();
        console.log('Post updated: ', update);
        alert('Bid placed!');
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
            couldNotFind(emptyMessage);
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

async function searchLocation(search) {
    const query = encodeURIComponent(search);
    await runSearch(
        `/api/getpostsbylocation?search=${query}`,
        `Could not find any posts with the location: "${search}"`
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