const form = document.getElementById("signin-form");

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);
    checkUser(data.get("email"), data.get("password"));
});

async function checkUser(email, password) {
    const match = await confirmPassword(email, password);
    if (match) { 
        signin();
        window.location.href = "index.html";
    } else {
        accountNotFound();
    }
}

function confirmPassword(em, pw) {
    return fetch(`http://localhost:3000/api/getuser?email=${em}`)
    .then(response => {

        if (!response.ok) {
            console.error('could not find email');
            return false;
        }
        return response.json();

    })
    .then(user => {

        const data = user[0];
        sessionStorage.setItem('userId', data.id);
        sessionStorage.setItem('user', JSON.stringify(data));
        return data.password == pw;

    })
    .catch(error => {

        console.error(error);
        return false;

    });
}

function accountNotFound() {
    const ul = document.getElementById("signin-ul");
    const notFound = document.createElement("li");
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    
    notFound.innerText = "Error, your email or password is incorrect"
    notFound.style.textAlign = "center";
    notFound.style.color = "red";
    notFound.style.fontSize = "16px";
    notFound.style.margin = "2%";

    email.style.border = "2px solid black";
    password.style.border = "2px solid black";

    ul.children[4].style.marginTop = "0";
    ul.insertBefore(notFound, ul.children[4]);
}