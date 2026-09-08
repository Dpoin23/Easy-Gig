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
    } else {
        const user = JSON.parse(sessionStorage.getItem("user"));
        updatePassword(newPW, user.id);
    }
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

        if (!response.ok) {
            console.log("Failed to update password");
        }

        const update = await response.json();
        console.log("Password updated: ", update);
        alert("Password Changed");
        window.location.href = "profile.html";
    } catch (error) {
        console.log(error);
    }
}