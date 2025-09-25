const form = document.getElementById("post-form");

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);

    if (sessionStorage.getItem("signedIn") == "true") {
        addPostToDB(data.get("title"), data.get("description"), data.get("location"), data.get("payType"), data.get("pay"));
        e.target.reset();
        postAdded();
    } else {
        requireSignIn();
    }

});

function addPostToDB(ti, dsp, loc, pT, p) {
    const uID = sessionStorage.getItem('userId');
    data = {
        title: ti,
        description: dsp,
        location: loc,
        pay: p,
        payType: pT,
        user_id: uID
    };

    fetch('http://localhost:3000/api/addpost', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        
        if(!response.ok) {
            console.error('Status: ', response.status);
        }
        console.log(response);
        return response.json();

    })
    .then(data => { console.log('Data inserted successfully: ', data); })
    .catch(error => { throw error; })
}

function requireSignIn() {
    const ul = document.getElementById("post-ul");
    const required = document.createElement("li");

    required.innerHTML = "To create a post you must <a href='signin.html' class='Header-obj'>Sign In</a>";
    required.style.fontSize = "16px";
    required.style.textAlign = "center";
    required.style.color = "red";
    required.style.margin = "2%";

    ul.children[10].style.marginTop = "0";
    ul.insertBefore(required, ul.children[10]);
}

function postAdded() {
    const ul = document.getElementById("post-ul");
    const added = document.createElement("li");

    added.innerText = "Post Created!";
    added.style.fontSize = "16px";
    added.style.textAlign = "center";
    added.style.color = "rgb(21, 187, 21)";
    added.style.margin = "2%";

    if (ul.children[10].innerText == "Post Created!") {
        ul.replaceChild(added, ul.children[10]);
    } else {
        ul.children[10].style.marginTop = "0";
        ul.insertBefore(added, ul.children[10]);
    }
}
