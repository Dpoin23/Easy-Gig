/* exported signin, signout */
function signin() {
    sessionStorage.setItem("signedIn", "true");
    sessionStorage.setItem('mypostsdisplay', 'false');
}

function signout() {
    sessionStorage.setItem("signedIn", "false");
    sessionStorage.setItem('mypostsdisplay', 'false');
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

function renderAccountMenu(signedIn) {
    const panel = document.getElementById('account-panel');
    const toggle = document.getElementById('account-toggle');
    if (!panel || !toggle) {
        return;
    }

    panel.replaceChildren();
    accountItems(signedIn).forEach(function(item) {
        const link = document.createElement('a');
        link.href = item.href;
        link.textContent = item.label;
        panel.appendChild(link);
    });

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

const signedIn = sessionStorage.getItem("signedIn") === "true";
renderAccountMenu(signedIn);