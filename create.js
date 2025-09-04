const form = document.getElementById("createacc-form");
const userSignedIn = sessionStorage.getItem("signedIn") === "true";

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);
    
    if (userSignedIn) {
        signedInWhileCreating();
    } else {
        createAccount(data.get("name"), data.get("email"), data.get("password"), data.get("confirm"));
    }
});

function createAccount(name, email, password, confirm) {
    if (password != confirm) {
        passwordsDoNotMatch();
    } else {
        updateDB(name, email, password);
        window.location.href = "signin.html";
    }
}

function updateDB(nm, em, pw) {
    const data = {
        name: nm,
        email: em,
        password: pw
    };

    fetch('http://localhost:3000/api/adduser', {

        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
        
    })
    .then(response => {

        if (!response.ok) {
            console.error('Status: ', response.status);
        }
        console.log(response);
        return response.json();

    })
    .then(data => {
        console.log(`data inserted successfully: ${data}`);
    })
    .catch(error => {
        throw error;
    });
}

function passwordsDoNotMatch() {
    const ul = document.getElementById("createacc-ul");
    const errorMsg = document.createElement("li");
    const passwordBox = document.getElementById("password");
    const confirmBox = document.getElementById("confirm");

    errorMsg.classList.add("create-error-message");
    errorMsg.textContent = "Error: passwords do not match";

    passwordBox.style.border = "2px solid black";
    confirmBox.style.border = "2px solid black";

    ul.children[8].style.marginTop = "0";
    ul.insertBefore(errorMsg, ul.children[8]);
}

function signedInWhileCreating() {
    const ul = document.getElementById("createacc-ul");
    const errorMsg = document.createElement("li");

    errorMsg.classList.add("create-error-message");
    errorMsg.textContent = "Error: you must first signout before creating a new account";

    ul.children[8].style.marginTop = "0";
    ul.insertBefore(errorMsg, ul.children[8]);
}