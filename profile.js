/*
Profile Box Section
*/
localStorage.setItem('editing', 'false');
const userId = sessionStorage.getItem('userId');
const userData = JSON.parse(sessionStorage.getItem("user"));
const profileBox = document.getElementById('profile-box');
profileBox.innerHTML = `<form id="edit-profile-form">
                            <ul class="createacc-ul" id="profile-ul">
                                <li class="createacc-li"><strong>Name</strong></li>
                                <li class="createacc-li profile-notediting-li" id="name-li">
                                    ${userData.name}
                                </li>

                                <li class="createacc-li"><strong>Email Address</strong></li>
                                <li class="createacc-li profile-notediting-li" id="email-li">
                                    ${userData.email}
                                </li>

                                <li class="createacc-button-div profile-buttons">
                                    <button class="createacc-button" type="submit" id="button-li">Edit</button>
                                </li>
                            </ul>
                        </form>`;

const editForm = document.getElementById('edit-profile-form');
editForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const status = localStorage.getItem('editing') === 'false';
    const nameLi = document.getElementById('name-li');
    const emailLi = document.getElementById('email-li');
    const button = document.getElementById('button-li');
    const ul = document.getElementById("profile-ul");

    const newUserData = JSON.parse(sessionStorage.getItem('user'));
    
    if (status) {
        alert('now editing');
        localStorage.setItem('editing', 'true');

        const deleteButton = document.createElement("li");
        deleteButton.classList.add("createacc-button-div");
        deleteButton.classList.add("profile-buttons");
        deleteButton.id = "profile-delete-button";
        deleteButton.innerHTML = '<button class="createacc-button" id="delete-li" type="button" onclick="deleteAccount()">Delete Account</button>';

        const editpassword = document.createElement("li");
        editpassword.classList.add("createacc-button-div");
        editpassword.classList.add("profile-buttons");
        editpassword.id = "profile-changepw";
        editpassword.innerHTML = '<button class="createacc-button" id="change-password" type="button" onclick="editPassword()">Change Password</button>';

        ul.appendChild(editpassword);
        ul.appendChild(deleteButton);

        nameLi.classList.remove('profile-notediting-li');
        emailLi.classList.remove('profile-notediting-li');

        nameLi.innerHTML = `<input type="text" id="name" name="name" required value="${newUserData.name}">`;
        emailLi.innerHTML = `<input type="text" id="email" name="email" required value="${newUserData.email}">`;
        button.innerText = 'Save';
    } else {
        localStorage.setItem('editing', 'false');

        const data = new FormData(this);
        const newData = {
            name: data.get('name'),
            email: data.get('email'),
            user_id: userId
        };

        if (newData.name != newUserData.name || newData.email != newUserData.email) {
            fetch('http://localhost:3000/api/updateuser', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newData)
            })
            .then(response => {
                if (!response.ok) {
                    console.error('Status: ', response.status);
                }
                console.log(response);
                return response.json();
            })
            .then(data => {
                console.log('Data inserted successfully: ', data);
                sessionStorage.setItem('user', JSON.stringify(newData));
                alert('saved');
            })
            .catch(error => {
                console.error(error);
            }) 
        } else {
            alert('No changes made');
        }

        nameLi.classList.add('profile-notediting-li');
        emailLi.classList.add('profile-notediting-li');

        ul.removeChild(document.getElementById("profile-delete-button"));
        ul.removeChild(document.getElementById("profile-changepw"));

        nameLi.innerHTML = `${newData.name}`;
        emailLi.innerHTML = `${newData.email}`;
        button.innerText = 'Edit';
    }
});

function deleteAccount() {
    alert('deleting account. . .');
    fetch('http://localhost:3000/api/deleteaccountbyid', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
    })
    .then(response => {
        if(!response.ok) {
            console.error('Status: ', response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log('Delete successful: ', data);
        deleteSignout();
        deleteUsersPosts(userId);
    })
    .catch(err => {
        console.error(err);
    })
}

function deleteSignout() {
    sessionStorage.setItem("signedIn", "false");
    sessionStorage.setItem('mypostsdisplay', 'false');
    window.location.href = "index.html";
}

function editPassword() {
    alert("editing password");
}

/*
User Posts Section
*/
const postsform = document.getElementById('mypostsform');
sessionStorage.setItem('mypostsdisplay', 'false');
document.getElementById('myposts').innerHTML = '';

postsform.addEventListener('submit', async function(event) {
    event.preventDefault();
    const myPostsDisplayed = sessionStorage.getItem('mypostsdisplay') === 'true';

    if (myPostsDisplayed) {
        updateDisplayButton();
        const postsbox = document.getElementById('myposts');
        postsbox.innerHTML = '';
        sessionStorage.setItem('mypostsdisplay', 'false');
    } else {
        const posts = await getUserPosts();
        displayPosts(posts);
    }
});

async function getUserPosts() {
    try {
        const response = await fetch(`http://localhost:3000/api/getpostsbyuserid?user_id=${userId}`);

        if (!response.ok) {
            console.error(response.status);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
    }
}

function displayPosts(posts) {
    if (posts.length != 0) {
        const postsbox = document.getElementById('myposts');
        posts.forEach(function(post) {
            const box = document.createElement('div');

            box.classList.add('display');
            box.classList.add('myposts');
            box.innerHTML = `<div class="display-title">${post.title}</div>
                            <label><strong>Description</strong></label>
                            <p class="display-description">${post.description}</p>
                            <div class="display-info">
                                <div class="display-location">Location: ${post.location}</div>
                                <div class="display-type">Type of Pay: ${post.type_of_pay}</div>
                                <div class="display-pay">Pay: $${post.max_pay}</div>
                            </div>
                            <div class="display-bid">
                                <div>Current Bid: $${post.current_bid}</div>
                                <div>
                                    <form class="bid-form">
                                        <button class="display-input-button" type="submit">Delete</button>
                                    </form>
                                </div>
                            </div>`;

            postsbox.append(box);

            const delete_form = box.querySelector('form');
            delete_form.addEventListener('submit', function(event) {
                event.preventDefault();
                alert('deleting post. . .');
                deletePost(post.id);
                postsbox.removeChild(box);

            });
        });
        updateDisplayButton();
        sessionStorage.setItem("mypostsdisplay", "true");
    } else {
        alert('No posts to display');
        sessionStorage.setItem('mypostsdisplay', 'false');
    }
}

function updateDisplayButton() {
    const display = sessionStorage.getItem("mypostsdisplay") === 'true';
    if (display) {
        const button = document.getElementById('mypostsbutton');
        button.innerText = 'Show My Posts'; 
    } else {
        const button = document.getElementById('mypostsbutton');
        button.innerText = 'Hide My Posts';
    }
}

async function deletePost(post_id) {
    fetch('http://localhost:3000/api/deletepostbyid', {
        method: 'DELETE',
        headers: {
            'Content-type': 'application/json'
        },
        body: JSON.stringify({ postId: post_id})
    })
    .then(response => {
        if (!response.ok) {
            console.error('status: ', response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log('Delete successful: ', data);
    })
    .catch(err => {
        console.error(err);
    })

    const posts = await getUserPosts();
    if (posts.length == 0) {
        updateDisplayButton();
        sessionStorage.setItem("mypostsdisplay", "false");
    }
}

function deleteUsersPosts(userId) {
    fetch('http://localhost:3000/api/deletealluserposts', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
    })
    .then(response => {
        if (!response.ok) {
            console.error('Status: ', response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log('Posts deleted successfully: ', data);
    })
    .catch(error => {
        console.error(error);
    }) 
}
