const form = document.getElementById("newPasswordForm");
form.addEventListener('submit', function(e) {
    e.preventDefault();
    const data = new FormData(this);

    const newPassword = data.get("change");
    const confirmPassword = data.get("confirm");
    
    handleChange(newPassword, confirmPassword);
});

function handleChange(newPW, confirmPW) {
    if (newPW != confirmPW) {
        handleMismatch();
        return;
    }

    const stored = JSON.parse(sessionStorage.getItem("user") || "null");
    const userId = sessionStorage.getItem("userId") || (stored && (stored.id || stored.user_id));
    if (!userId) {
        alert("Sign in again to change your password");
        return;
    }

    updatePassword(newPW, userId);
}

function handleMismatch() {
    alert("Passwords do not match")
}

async function updatePassword(newPW, uId) {
    try {
        const response = await fetch("/api/updatePassword", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                newPassword: newPW,
                userId: uId
            })
        });

        const update = await response.json().catch(() => ({}));
        if (!response.ok) {
            alert(update.error || "Failed to update password");
            return;
        }

        console.log("Password updated: ", update);
        alert("Password Changed");
        window.location.href = "profile.html";
    } catch (error) {
        console.log(error);
    }
}