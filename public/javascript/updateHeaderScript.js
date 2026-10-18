/* exported signin, signout */
function signin() {
    sessionStorage.setItem("signedIn", "true");
    sessionStorage.setItem('mypostsdisplay', 'false');
}

function clearSignedIn() {
    sessionStorage.setItem("signedIn", "false");
    sessionStorage.setItem('mypostsdisplay', 'false');
    sessionStorage.removeItem('user');
}

function signout() {
    clearSignedIn();
    return fetch('/api/signout', { method: 'POST' }).catch(function(error) {
        console.error(error);
    });
}

function accountItems(signedIn) {
    if (signedIn) {
        return [
            { href: 'profile.html', label: 'Profile' },
            { href: 'changePassword.html', label: 'Change Password' },
            { href: 'about.html', label: 'About' },
            { href: 'createacc.html', label: 'Create Account' },
            { href: 'signout.html', label: 'Sign Out' },
        ];
    }

    return [
        { href: 'signin.html', label: 'Sign In' },
        { href: 'createacc.html', label: 'Create Account' },
        { href: 'about.html', label: 'About' },
    ];
}

function closeAccountMenu(panel, toggle) {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
}

function renderAccountItems(signedIn) {
    const panel = document.getElementById('account-panel');
    if (!panel) {
        return;
    }

    panel.replaceChildren();
    accountItems(signedIn).forEach(function(item) {
        const link = document.createElement('a');
        link.href = item.href;
        link.textContent = item.label;
        panel.appendChild(link);
    });
}

function bindAccountMenu() {
    const panel = document.getElementById('account-panel');
    const toggle = document.getElementById('account-toggle');
    if (!panel || !toggle) {
        return;
    }

    toggle.addEventListener('click', function(event) {
        event.stopPropagation();
        const open = panel.hidden;
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', function(event) {
        if (!event.target.closest('#account-menu')) {
            closeAccountMenu(panel, toggle);
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAccountMenu(panel, toggle);
        }
    });
}

async function syncSession() {
    try {
        const response = await fetch('/api/me');
        if (response.status === 401) {
            clearSignedIn();
            renderAccountItems(false);
            return;
        }
        if (!response.ok) {
            return;
        }

        const user = await response.json();
        sessionStorage.setItem("signedIn", "true");
        sessionStorage.setItem('user', JSON.stringify(user));
        renderAccountItems(true);
    } catch (error) {
        console.error(error);
    }
}

renderAccountItems(sessionStorage.getItem("signedIn") === "true");
bindAccountMenu();
syncSession();