const params = new URLSearchParams(window.location.search);
const bidderId = params.get('user');
const postId = params.get('post');
const profileBox = document.getElementById('bidder-profile');
const gigsBox = document.getElementById('bidder-gigs');

loadBidder();

async function loadBidder() {
    if (!bidderId || !postId) {
        showMessage('Open a profile from the bids on one of your gigs.');
        return;
    }

    try {
        const response = await fetch(`/api/bidders/${encodeURIComponent(bidderId)}?post_id=${encodeURIComponent(postId)}`);
        if (response.status === 401) {
            window.location.href = 'signin.html';
            return;
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            showMessage(body.error || 'Could not load this profile.');
            return;
        }
        renderBidder(body);
    } catch (error) {
        console.error(error);
        showMessage('Could not load this profile.');
    }
}

function showMessage(message) {
    profileBox.replaceChildren();
    const note = document.createElement('p');
    note.className = 'bidder-empty';
    note.textContent = message;
    profileBox.append(note);
}

function renderBidder(profile) {
    profileBox.replaceChildren();

    const heading = document.createElement('h1');
    heading.className = 'bidder-name';
    heading.textContent = profile.name;

    const gig = document.createElement('p');
    gig.className = 'bidder-gig';
    gig.textContent = `Bid on ${profile.post_title}`;

    const amount = document.createElement('p');
    amount.className = 'bidder-amount';
    amount.textContent = `$${formatGigMoney(profile.bid.amount)}`;

    const status = document.createElement('p');
    status.className = 'display-hired';
    if (profile.hired) {
        status.textContent = 'You hired this person for this gig.';
    } else if (!profile.can_hire) {
        status.textContent = 'Someone else is already hired for this gig.';
    } else {
        status.textContent = 'You can hire this person for this gig.';
    }

    profileBox.append(heading, gig, amount, status);

    if (profile.can_hire) {
        const hire = document.createElement('button');
        hire.type = 'button';
        hire.className = 'createacc-button bid-action';
        hire.textContent = 'Hire';
        hire.addEventListener('click', function() {
            hireBidder(profile, hire, status);
        });
        profileBox.append(hire);
    }

    gigsBox.replaceChildren();
    gigsBox.append(
        gigSection('Gigs they posted', profile.posted_gigs, 'They have not posted a gig.'),
        gigSection('Gigs they were selected for', profile.selected_gigs, 'They have not been hired for a gig yet.')
    );
}

function gigSection(title, gigs, emptyText) {
    const section = document.createElement('section');
    section.className = 'bidder-section';

    const heading = document.createElement('h2');
    heading.className = 'bidder-section-title';
    heading.textContent = title;
    section.append(heading);

    if (!Array.isArray(gigs) || gigs.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'bidder-empty';
        empty.textContent = emptyText;
        section.append(empty);
        return section;
    }

    gigs.forEach(function(gig) {
        const card = document.createElement('div');
        card.className = 'display';
        card.innerHTML = gigHistoryHtml(gig);
        section.append(card);
    });
    return section;
}

async function hireBidder(profile, button, status) {
    button.disabled = true;
    try {
        const response = await fetch(`/api/acceptbid/${profile.post_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: profile.id }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            alert(body.error || 'Could not hire this person.');
            button.disabled = false;
            return;
        }
        button.remove();
        status.textContent = 'You hired this person for this gig.';
        alert(`${profile.name} is hired. The exact address is now available to them.`);
    } catch (error) {
        console.error(error);
        button.disabled = false;
    }
}
