const form = document.getElementById('post-form');
const areaPicker = bindPlacePicker(document.getElementById('area-picker'), { mode: 'area' });
const addressPicker = bindPlacePicker(document.getElementById('address-picker'), { mode: 'address' });

form.addEventListener('submit', function(e) {
    e.preventDefault();

    if (sessionStorage.getItem('signedIn') !== 'true') {
        requireSignIn();
        return;
    }

    if (!areaPicker.isSelected()) {
        showPostStatus('Pick a city, neighborhood, or ZIP from the suggestions.', 'error');
        return;
    }

    const addressValue = document.getElementById('address').value.trim();
    if (addressValue && !addressPicker.isSelected()) {
        showPostStatus('Pick a street address from the suggestions, or clear that field.', 'error');
        return;
    }

    const data = new FormData(this);
    addPostToDB({
        title: data.get('title'),
        description: data.get('description'),
        pay: data.get('pay'),
        payType: data.get('payType'),
        areaPlaceId: areaPicker.getPlaceId(),
        areaSessionToken: areaPicker.getSessionToken(),
        addressPlaceId: addressPicker.getPlaceId() || null,
        addressSessionToken: addressPicker.getPlaceId() ? addressPicker.getSessionToken() : null,
        addressVisibility: data.get('addressVisibility') || 'after_hire',
    }).then((status) => {
        if (status === 'ok') {
            form.reset();
            areaPicker.clear();
            addressPicker.clear();
            showPostStatus('Post created!', 'ok');
        } else if (status === 'signin') {
            sessionStorage.setItem('signedIn', 'false');
            requireSignIn();
        } else if (status && status.message) {
            showPostStatus(status.message, 'error');
        }
    });
});

function addPostToDB(payload) {
    return fetch('/api/addpost', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    })
        .then((response) => {
            return response.json().then((body) => {
                if (response.status === 401) {
                    return 'signin';
                }
                if (!response.ok) {
                    return { message: body.error || 'Could not create the post.' };
                }
                return 'ok';
            }).catch(() => {
                if (response.status === 401) {
                    return 'signin';
                }
                return { message: 'Could not create the post.' };
            });
        })
        .catch((error) => {
            console.error(error);
            return { message: 'Could not create the post.' };
        });
}

function showPostStatus(message, kind) {
    const status = document.getElementById('post-status');
    status.hidden = false;
    status.textContent = message;
    status.style.color = kind === 'ok' ? 'rgb(21, 187, 21)' : 'red';
    status.style.fontSize = '16px';
    status.style.textAlign = 'center';
}

function requireSignIn() {
    showPostStatus('', 'error');
    const status = document.getElementById('post-status');
    status.hidden = false;
    status.innerHTML = "To create a post you must <a href='signin.html' class='Header-obj'>Sign In</a>";
    status.style.color = 'red';
    status.style.fontSize = '16px';
    status.style.textAlign = 'center';
}
