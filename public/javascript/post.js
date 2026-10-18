const form = document.getElementById('post-form');
const areaPicker = bindPlacePicker(document.getElementById('area-picker'), { mode: 'area' });
const addressPicker = bindPlacePicker(document.getElementById('address-picker'), { mode: 'address' });
const photoInput = document.getElementById('post-images');
const submitButton = form.querySelector('.post-button');

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
let selectedPhotos = [];

photoInput.addEventListener('change', function() {
    addSelectedPhotos(photoInput.files);
    photoInput.value = '';
});

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

    if (selectedPhotos.length > MAX_PHOTOS) {
        showPhotoNote('You can add up to 4 photos');
        return;
    }

    const data = new FormData(this);
    const body = new FormData();
    body.append('title', data.get('title') || '');
    body.append('description', data.get('description') || '');
    body.append('pay', data.get('pay') || '');
    body.append('payType', data.get('payType') || '');
    body.append('areaPlaceId', areaPicker.getPlaceId() || '');
    body.append('areaSessionToken', areaPicker.getSessionToken() || '');
    if (addressPicker.getPlaceId()) {
        body.append('addressPlaceId', addressPicker.getPlaceId());
        body.append('addressSessionToken', addressPicker.getSessionToken() || '');
    }
    body.append('addressVisibility', data.get('addressVisibility') || 'after_hire');
    selectedPhotos.forEach(function(photo) {
        body.append('images', photo.file, photo.file.name);
    });

    submitButton.disabled = true;
    addPostToDB(body).then((status) => {
        submitButton.disabled = false;
        if (status === 'ok') {
            form.reset();
            areaPicker.clear();
            addressPicker.clear();
            clearSelectedPhotos();
            showPostStatus('Post created!', 'ok');
        } else if (status === 'signin') {
            sessionStorage.setItem('signedIn', 'false');
            requireSignIn();
        } else if (status && status.message) {
            showPostStatus(status.message, 'error');
        }
    });
});

function addPostToDB(body) {
    return fetch('/api/addpost', {
        method: 'POST',
        body,
    })
        .then((response) => {
            return response.json().then((payload) => {
                if (response.status === 401) {
                    return 'signin';
                }
                if (!response.ok) {
                    return { message: payload.error || 'Could not create the post.' };
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

function samePhoto(file, other) {
    return file.name === other.name && file.size === other.size && file.lastModified === other.lastModified;
}

function isAllowedPhoto(file) {
    if (PHOTO_TYPES.has(file.type)) {
        return true;
    }
    return /\.(jpe?g|png|webp|gif)$/i.test(file.name || '');
}

function addSelectedPhotos(fileList) {
    let note = '';
    Array.from(fileList || []).forEach(function(file) {
        if (selectedPhotos.length >= MAX_PHOTOS) {
            note = 'You can add up to 4 photos';
            return;
        }
        if (selectedPhotos.some(function(photo) { return samePhoto(photo.file, file); })) {
            return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            note = 'Each photo must be 2 MB or smaller';
            return;
        }
        if (!isAllowedPhoto(file)) {
            note = 'Photos must be JPEG, PNG, WebP, or GIF';
            return;
        }
        selectedPhotos.push({
            file,
            previewUrl: URL.createObjectURL(file),
        });
    });
    renderPhotoPreviews(note);
}

function clearSelectedPhotos() {
    selectedPhotos.forEach(function(photo) {
        URL.revokeObjectURL(photo.previewUrl);
    });
    selectedPhotos = [];
    renderPhotoPreviews('');
}

function renderPhotoPreviews(note) {
    const list = document.getElementById('post-image-previews');
    list.replaceChildren();
    selectedPhotos.forEach(function(photo, index) {
        const item = document.createElement('li');
        item.className = 'post-image-preview';

        const img = document.createElement('img');
        img.src = photo.previewUrl;
        img.alt = `Selected photo ${index + 1}`;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'post-image-remove';
        remove.setAttribute('aria-label', `Remove photo ${index + 1}`);
        remove.textContent = 'Remove';
        remove.addEventListener('click', function() {
            URL.revokeObjectURL(photo.previewUrl);
            selectedPhotos.splice(index, 1);
            renderPhotoPreviews('');
        });

        item.append(img, remove);
        list.append(item);
    });
    showPhotoNote(note);
}

function showPhotoNote(message) {
    const note = document.getElementById('post-image-note');
    const text = message || (selectedPhotos.length
        ? `${selectedPhotos.length} of ${MAX_PHOTOS} photos`
        : '');
    note.hidden = !text;
    note.textContent = text;
    note.classList.toggle('post-image-note-error', Boolean(message));
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
