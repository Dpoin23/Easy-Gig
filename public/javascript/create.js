const form = document.getElementById("createacc-form");

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);
    createAccount(data.get("name"), data.get("email"), data.get("password"), data.get("confirm"));
});

async function createAccount(name, email, password, confirm) {
    if (sessionStorage.getItem("signedIn") === "true") {
        showCreateError("Error: you must first sign out before creating a new account");
        return;
    }

    if (password != confirm) {
        showCreateError("Error: passwords do not match");
        return;
    }

    const result = await updateDB(name, email, password);
    if (!result.ok) {
        showCreateError(result.message);
        return;
    }

    window.location.href = "signin.html";
}

async function updateDB(nm, em, pw) {
    try {
        const response = await fetch('/api/adduser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: nm,
                email: em,
                password: pw
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, message: data.error || 'Could not create account' };
        }

        return { ok: true };
    } catch (error) {
        console.error(error);
        return { ok: false, message: 'Could not create account' };
    }
}

function showCreateError(message) {
    const ul = document.getElementById("createacc-ul");
    let errorMsg = document.getElementById("create-error");

    if (!errorMsg) {
        errorMsg = document.createElement("li");
        errorMsg.id = "create-error";
        errorMsg.classList.add("create-error-message");
        const button = ul.querySelector(".createacc-button-div");
        button.style.marginTop = "0";
        ul.insertBefore(errorMsg, button);
    }

    errorMsg.textContent = message;
}
