/*
Profile Box Section
*/
localStorage.setItem('editing', 'false');
localStorage.setItem('PW', 'false');
let userId = null;
const profileBox = document.getElementById('profile-box');
profileBox.innerHTML = `<form id="edit-profile-form">
                            <ul class="createacc-ul" id="profile-ul">
                                <li class="createacc-li"><strong>Name</strong></li>
                                <li class="createacc-li profile-notediting-li" id="name-li"></li>

                                <li class="createacc-li"><strong>Email Address</strong></li>
                                <li class="createacc-li profile-notediting-li" id="email-li"></li>

                                <li class="createacc-button-div profile-buttons">
                                    <button class="createacc-button" type="submit" id="button-li">Edit</button>
                                </li>

                                <li class="createacc-button-div profile-buttons" id="profile-changepw">
                                    <button class="createacc-button" type="submit" onclick="editPassword()">Change Password</button>
                                </li>
                            </ul>
                        </form>`;
loadProfile();

async function loadProfile() {
    try {
        const response = await fetch('/api/me');
        if (response.status === 401) {
            sessionStorage.setItem('signedIn', 'false');
            window.location.href = 'signin.html';
            return;
        }
        if (!response.ok) {
            alert('Could not load your profile');
            return;
        }

        const user = await response.json();
        userId = user.id;
        sessionStorage.setItem('user', JSON.stringify(user));
        document.getElementById('name-li').textContent = user.name;
        document.getElementById('email-li').textContent = user.email;
    } catch (error) {
        console.error(error);
    }
}

const editForm = document.getElementById('edit-profile-form');
editForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const status = localStorage.getItem('editing') === 'false';
    const changingPw = localStorage.getItem("PW") === "true";
    const nameLi = document.getElementById('name-li');
    const emailLi = document.getElementById('email-li');
    const button = document.getElementById('button-li');
    const ul = document.getElementById("profile-ul");
    const newUserData = JSON.parse(sessionStorage.getItem('user'));
    
    if (status && !changingPw) {
        alert('now editing');
        localStorage.setItem('editing', 'true');

        const deleteButton = document.createElement("li");
        deleteButton.classList.add("createacc-button-div");
        deleteButton.classList.add("profile-buttons");
        deleteButton.id = "profile-delete-button";
        deleteButton.innerHTML = '<button class="createacc-button" id="delete-li" type="button" onclick="deleteAccount()">Delete Account</button>';

        ul.removeChild(document.getElementById("profile-changepw"));
        ul.appendChild(deleteButton);

        nameLi.classList.remove('profile-notediting-li');
        emailLi.classList.remove('profile-notediting-li');

        nameLi.replaceChildren(profileField('name', newUserData.name));
        emailLi.replaceChildren(profileField('email', newUserData.email));
        button.innerText = 'Save';
    } else if (!status && !changingPw) {
        const data = new FormData(this);
        const newData = {
            name: data.get('name'),
            email: data.get('email')
        };
        const unchanged = newData.name == newUserData.name && newData.email == newUserData.email;

        if (unchanged) {
            localStorage.setItem('editing', 'false');
            showProfileSummary(newUserData.name, newUserData.email);
            alert('No changes made');
            return;
        }

        fetch('/api/updateuser', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newData)
        })
        .then(response => {
            return response.json().then(body => {
                if (!response.ok) {
                    throw new Error(body.error || 'Could not update profile');
                }
                return body;
            });
        })
        .then(() => {
            const savedUser = {
                id: Number(userId),
                name: newData.name,
                email: newData.email
            };
            sessionStorage.setItem('user', JSON.stringify(savedUser));
            localStorage.setItem('editing', 'false');
            showProfileSummary(savedUser.name, savedUser.email);
            alert('saved');
        })
        .catch(error => {
            console.error(error);
            alert(error.message || 'Could not update profile');
        });
    }
});

function profileField(name, value) {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = name;
    input.name = name;
    input.required = true;
    input.value = value ?? '';
    return input;
}

function showProfileSummary(name, email) {
    const nameLi = document.getElementById('name-li');
    const emailLi = document.getElementById('email-li');
    const button = document.getElementById('button-li');
    const ul = document.getElementById('profile-ul');

    nameLi.classList.add('profile-notediting-li');
    emailLi.classList.add('profile-notediting-li');
    nameLi.textContent = name;
    emailLi.textContent = email;
    button.innerText = 'Edit';

    const editpassword = document.createElement('li');
    editpassword.classList.add('createacc-button-div');
    editpassword.classList.add('profile-buttons');
    editpassword.id = 'profile-changepw';
    editpassword.innerHTML = '<button class="createacc-button" id="change-password" type="button" onclick="editPassword()">Change Password</button>';

    const deleteButton = document.getElementById('profile-delete-button');
    if (deleteButton) {
        ul.removeChild(deleteButton);
    }
    if (!document.getElementById('profile-changepw')) {
        ul.appendChild(editpassword);
    }
}

/* exported deleteAccount, editPassword */
function deleteAccount() {
    alert('deleting account. . .');
    fetch('/api/deleteaccountbyid', { method: 'DELETE' })
    .then(response => {
        if(!response.ok) {
            console.error('Status: ', response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log('Delete successful: ', data);
        deleteSignout();
    })
    .catch(err => {
        console.error(err);
    })
}

function deleteSignout() {
    sessionStorage.setItem("signedIn", "false");
    sessionStorage.setItem('mypostsdisplay', 'false');
    sessionStorage.removeItem('user');
    window.location.href = "index.html";
}

function editPassword() {
    localStorage.setItem("PW", "true");
    window.location.href = "changePassword.html";
}

/*
User Posts Section
*/

const postsform = document.getElementById('mypostsform');
sessionStorage.setItem('mypostsdisplay', 'false');
document.getElementById('myposts').innerHTML = '';

postsform.addEventListener('submit', async function(event) {
    event.preventDefault();
    const myPostsDisplayed = sessionStorage.getItem('mypostsdisplay') === 'true';

    if (myPostsDisplayed) {
        updateDisplayButton();
        const postsbox = document.getElementById('myposts');
        postsbox.innerHTML = '';
        sessionStorage.setItem('mypostsdisplay', 'false');
    } else {
        const posts = await getUserPosts();
        displayPosts(posts);
    }
});

async function getUserPosts() {
    try {
        const response = await fetch(`/api/getpostsbyuserid?user_id=${userId}`);

        if (!response.ok) {
            console.error(response.status);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
    }
}

function displayPosts(posts) {
    if (posts.length != 0) {
        const postsbox = document.getElementById('myposts');
        posts.forEach(function(post) {
            const box = document.createElement('div');

            box.classList.add('display');
            box.classList.add('myposts');
            const bidCount = Number(post.bid_count) || 0;
            const hiredNote = post.accepted_user_id
                ? '<div class="display-hired">A worker is hired. They can see the exact address.</div>'
                : '';

            box.innerHTML = `<div class="display-title">${escapeGigText(post.title)}</div>
                            <label><strong>Description</strong></label>
                            <p class="display-description">${escapeGigText(post.description)}</p>
                            ${gigImagesHtml(post)}
                            <div class="display-info">
                                ${gigLocationHtml(post, { owner: true })}
                                <div class="display-type">Type of Pay: ${escapeGigText(post.type_of_pay)}</div>
                                <div class="display-pay">Pay: $${escapeGigText(post.max_pay)}</div>
                            </div>
                            ${hiredNote}
                            <div class="display-bid">
                                <div>Current Bid: $${escapeGigText(formatGigMoney(post.current_bid))}</div>
                                <div class="myposts-actions">
                                    <button class="display-input-button bid-action view-bids-button" type="button">View bids (${bidCount})</button>
                                    <form class="bid-form">
                                        <button class="display-input-button" type="submit">Delete</button>
                                    </form>
                                </div>
                            </div>
                            <div class="bid-list" hidden></div>`;

            postsbox.append(box);

            const delete_form = box.querySelector('form');
            delete_form.addEventListener('submit', function(event) {
                event.preventDefault();
                deletePost(post.id, box);
            });

            const viewBids = box.querySelector('.view-bids-button');
            viewBids.addEventListener('click', function() {
                toggleBids(post, box);
            });
        });
        updateDisplayButton();
        sessionStorage.setItem("mypostsdisplay", "true");
    } else {
        alert('No posts to display');
        sessionStorage.setItem('mypostsdisplay', 'false');
    }
}

function updateDisplayButton() {
    const display = sessionStorage.getItem("mypostsdisplay") === 'true';
    if (display) {
        const button = document.getElementById('mypostsbutton');
        button.innerText = 'Show My Posts'; 
    } else {
        const button = document.getElementById('mypostsbutton');
        button.innerText = 'Hide My Posts';
    }
}

function showPostsButton() {
    const button = document.getElementById('mypostsbutton');
    button.textContent = 'Show My Posts';
    sessionStorage.setItem('mypostsdisplay', 'false');
}

async function toggleBids(post, box) {
    const list = box.querySelector('.bid-list');
    const button = box.querySelector('.view-bids-button');
    if (!list.hidden) {
        list.hidden = true;
        list.innerHTML = '';
        button.textContent = `View bids (${Number(post.bid_count) || 0})`;
        return;
    }

    button.disabled = true;
    try {
        const response = await fetch(`/api/posts/${post.id}/bids`);
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
            window.location.href = 'signin.html';
            return;
        }
        if (!response.ok) {
            alert(body.error || 'Could not load bids.');
            return;
        }
        post.bid_count = body.bids.length;
        post.accepted_user_id = body.accepted_user_id;
        renderBids(post, box, body.bids);
        list.hidden = false;
        button.textContent = 'Hide bids';
    } catch (err) {
        console.error(err);
        alert('Could not load bids.');
    } finally {
        button.disabled = false;
    }
}

function renderBids(post, box, bids) {
    const list = box.querySelector('.bid-list');
    list.replaceChildren();

    const heading = document.createElement('div');
    heading.className = 'bid-list-heading';
    heading.textContent = bids.length
        ? 'People who bid on this gig. The lowest bid is first.'
        : 'No one has bid on this gig yet.';
    list.append(heading);

    bids.forEach(function(bid) {
        const row = document.createElement('div');
        row.className = 'bid-row';

        const person = document.createElement('div');
        person.className = 'bid-person';
        const name = document.createElement('div');
        name.className = 'bid-name';
        name.textContent = bid.name;
        const meta = document.createElement('div');
        meta.className = 'bid-meta';
        const tags = [`$${formatGigMoney(bid.amount)}`];
        if (bid.is_leading) {
            tags.push('Lowest bid');
        }
        if (bid.is_hired) {
            tags.push('Hired');
        }
        meta.textContent = tags.join(' · ');
        person.append(name, meta);

        const actions = document.createElement('div');
        actions.className = 'bid-actions';
        const profileLink = document.createElement('a');
        profileLink.className = 'display-input-button bid-action';
        profileLink.href = `bidder.html?user=${encodeURIComponent(bid.user_id)}&post=${encodeURIComponent(post.id)}`;
        profileLink.textContent = 'Profile';
        actions.append(profileLink);

        if (!post.accepted_user_id) {
            const hire = document.createElement('button');
            hire.type = 'button';
            hire.className = 'display-input-button bid-action';
            hire.textContent = 'Hire';
            hire.addEventListener('click', function() {
                hireBidder(post, box, bid);
            });
            actions.append(hire);
        }

        row.append(person, actions);
        list.append(row);
    });
}

async function hireBidder(post, box, bid) {
    const hireButtons = box.querySelectorAll('.bid-actions button');
    hireButtons.forEach(function(button) {
        button.disabled = true;
    });
    try {
        const response = await fetch(`/api/acceptbid/${post.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: bid.user_id }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            alert(body.error || 'Could not hire that person.');
            hireButtons.forEach(function(button) {
                button.disabled = false;
            });
            return;
        }
        post.accepted_user_id = body.accepted_user_id;
        post.current_bid = body.amount;
        const current = box.querySelector('.display-bid > div');
        if (current) {
            current.textContent = `Current Bid: $${formatGigMoney(body.amount)}`;
        }
        if (!box.querySelector('.display-hired')) {
            const note = document.createElement('div');
            note.className = 'display-hired';
            note.textContent = 'A worker is hired. They can see the exact address.';
            box.querySelector('.display-info').after(note);
        }
        const refreshed = await fetch(`/api/posts/${post.id}/bids`);
        const listing = await refreshed.json().catch(() => ({}));
        if (refreshed.ok) {
            renderBids(post, box, listing.bids || []);
        }
        alert(`${bid.name} is hired. The exact address is now available to them.`);
    } catch (err) {
        console.error(err);
        hireButtons.forEach(function(button) {
            button.disabled = false;
        });
    }
}

const hiredForm = document.getElementById('hiredform');
const hiredBox = document.getElementById('hiredposts');
let hiredVisible = false;

if (hiredForm && hiredBox) {
    hiredForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        if (hiredVisible) {
            hiredBox.innerHTML = '';
            hiredVisible = false;
            document.getElementById('hiredbutton').textContent = 'Show Gigs I Was Hired For';
            return;
        }

        try {
            const response = await fetch('/api/me/selected');
            if (response.status === 401) {
                window.location.href = 'signin.html';
                return;
            }
            const gigs = await response.json().catch(() => []);
            if (!response.ok) {
                alert(gigs.error || 'Could not load gigs you were hired for.');
                return;
            }
            hiredBox.innerHTML = '';
            if (!Array.isArray(gigs) || gigs.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'bidder-empty';
                empty.textContent = 'You have not been hired for a gig yet.';
                hiredBox.append(empty);
            } else {
                gigs.forEach(function(gig) {
                    const card = document.createElement('div');
                    card.className = 'display';
                    card.innerHTML = gigHistoryHtml(gig);
                    hiredBox.append(card);
                });
            }
            hiredVisible = true;
            document.getElementById('hiredbutton').textContent = 'Hide Gigs I Was Hired For';
        } catch (err) {
            console.error(err);
        }
    });
}

async function deletePost(post_id, box) {
    const postsbox = document.getElementById('myposts');

    try {
        const response = await fetch('/api/deletepostbyid', {
            method: 'DELETE',
            headers: {
                'Content-type': 'application/json'
            },
            body: JSON.stringify({ postId: post_id })
        });

        if (!response.ok) {
            console.error('status: ', response.status);
            return;
        }

        await response.json();
        postsbox.removeChild(box);

        const posts = await getUserPosts();
        const remaining = Array.isArray(posts)
            ? posts.length
            : postsbox.querySelectorAll('.myposts').length;

        if (remaining === 0) {
            postsbox.innerHTML = '';
            showPostsButton();
        }
    } catch (err) {
        console.error(err);
    }
}