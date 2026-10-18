/* exported bindPlacePicker */

function newPlaceSessionToken() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bindPlacePicker(root, options) {
    const input = root.querySelector('input[type="text"]');
    const hidden = root.querySelector('input[type="hidden"]');
    const list = root.querySelector('.place-suggestions');
    const mode = options.mode || 'search';
    const minChars = options.minChars || 2;
    let sessionToken = newPlaceSessionToken();
    let detailsToken = sessionToken;
    let debounceId = 0;
    let activeIndex = -1;
    let suggestions = [];
    let selected = Boolean(hidden && hidden.value);

    function rotateSession() {
        sessionToken = newPlaceSessionToken();
    }

    function hideList() {
        list.hidden = true;
        list.innerHTML = '';
        activeIndex = -1;
    }

    function setSelected(place) {
        detailsToken = sessionToken;
        selected = Boolean(place && place.placeId);
        hidden.value = place ? place.placeId : '';
        if (place) {
            input.value = place.text || place.mainText || input.value;
        }
        root.dataset.selected = selected ? 'true' : 'false';
        if (typeof options.onSelect === 'function') {
            options.onSelect(place, detailsToken);
        }
        if (place) {
            rotateSession();
        }
    }

    function clearSelected() {
        if (selected) {
            setSelected(null);
        }
        hidden.value = '';
        selected = false;
        root.dataset.selected = 'false';
    }

    function render() {
        list.innerHTML = '';
        if (suggestions.length === 0) {
            hideList();
            return;
        }

        suggestions.forEach((place, index) => {
            const item = document.createElement('li');
            item.className = 'place-suggestion';
            item.setAttribute('role', 'option');
            item.id = `${input.id || 'place'}-opt-${index}`;
            item.innerHTML = `<span class="place-suggestion-main"></span><span class="place-suggestion-secondary"></span>`;
            item.querySelector('.place-suggestion-main').textContent = place.mainText || place.text;
            item.querySelector('.place-suggestion-secondary').textContent = place.secondaryText || '';
            item.addEventListener('mousedown', (event) => {
                event.preventDefault();
                setSelected(place);
                hideList();
            });
            list.appendChild(item);
        });

        const attribution = document.createElement('li');
        attribution.className = 'place-attribution';
        attribution.textContent = 'Powered by Google';
        list.appendChild(attribution);
        list.hidden = false;
        highlight(0);
    }

    function highlight(index) {
        const items = list.querySelectorAll('.place-suggestion');
        items.forEach((item) => item.classList.remove('is-active'));
        if (index < 0 || index >= items.length) {
            activeIndex = -1;
            return;
        }
        activeIndex = index;
        items[index].classList.add('is-active');
        input.setAttribute('aria-activedescendant', items[index].id);
    }

    async function lookup(query) {
        try {
            const response = await fetch('/api/places/autocomplete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: query,
                    mode,
                    sessionToken,
                    lat: options.lat || undefined,
                    lng: options.lng || undefined,
                }),
            });
            if (response.status === 503) {
                suggestions = [];
                list.innerHTML = '<li class="place-suggestion-empty">Location lookup is not configured.</li>';
                list.hidden = false;
                return;
            }
            if (!response.ok) {
                suggestions = [];
                hideList();
                return;
            }
            const data = await response.json();
            suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
            render();
        } catch (err) {
            console.error(err);
        }
    }

    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    list.setAttribute('role', 'listbox');

    input.addEventListener('input', () => {
        clearSelected();
        const query = input.value.trim();
        window.clearTimeout(debounceId);
        if (query.length < minChars) {
            suggestions = [];
            hideList();
            return;
        }
        debounceId = window.setTimeout(() => lookup(query), 250);
    });

    input.addEventListener('keydown', (event) => {
        if (list.hidden) {
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            highlight(Math.min(activeIndex + 1, suggestions.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            highlight(Math.max(activeIndex - 1, 0));
        } else if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            setSelected(suggestions[activeIndex]);
            hideList();
        } else if (event.key === 'Escape') {
            hideList();
        }
    });

    input.addEventListener('blur', () => {
        window.setTimeout(hideList, 120);
    });

    return {
        getPlaceId() {
            return hidden.value || '';
        },
        getSessionToken() {
            return detailsToken;
        },
        getQuery() {
            return input.value.trim();
        },
        isSelected() {
            return Boolean(hidden.value);
        },
        setBias(lat, lng) {
            options.lat = lat;
            options.lng = lng;
        },
        clear() {
            input.value = '';
            clearSelected();
            hideList();
            rotateSession();
        },
    };
}

window.bindPlacePicker = bindPlacePicker;
