// delete account?

localStorage.setItem('editing', 'false');
const userData = JSON.parse(sessionStorage.getItem('user'));
const userId = sessionStorage.getItem('userId');
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

                                <li class="createacc-li"><strong>Password</strong></li>
                                <li class="createacc-li profile-notediting-li" id="password-li">
                                    ${userData.password}
                                </li>

                                <li class="createacc-button-div profile-buttons">
                                    <button class="createacc-button" type="submit" id="button-li">Edit</button>
                                </li>

                                <li class="createacc-button-div profile-buttons">
                                    <button class="createacc-button" id="delete-li" type="button" onclick="deleteAccount()">Delete Account</button>
                                </li>
                            </ul>
                        </form>`;

const editForm = document.getElementById('edit-profile-form');
editForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const status = localStorage.getItem('editing') === 'false';
    const nameLi = document.getElementById('name-li');
    const emailLi = document.getElementById('email-li');
    const passwordLi = document.getElementById('password-li');
    const button = document.getElementById('button-li');

    const newUserData = JSON.parse(sessionStorage.getItem('user'));
    
    if (status) {
        alert('now editing');
        localStorage.setItem('editing', 'true');

        nameLi.classList.remove('profile-notediting-li');
        emailLi.classList.remove('profile-notediting-li');
        passwordLi.classList.remove('profile-notediting-li');

        nameLi.innerHTML = `<input type="text" id="name" name="name" required value="${newUserData.name}">`;
        emailLi.innerHTML = `<input type="text" id="email" name="email" required value="${newUserData.email}">`;
        passwordLi.innerHTML = `<input type="password" id="password" name="password" minlength="8" maxlength="64" value="${newUserData.password}">`;
        button.innerText = 'Save';
    } else {
        localStorage.setItem('editing', 'false');

        const data = new FormData(this);
        const newData = {
            name: data.get('name'),
            email: data.get('email'),
            password: data.get('password'),
            user_id: userId
        };

        if (newData.name != newUserData.name || newData.email != newUserData.email || newData.password != newUserData.password) {
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
        passwordLi.classList.add('profile-notediting-li');

        nameLi.innerHTML = `${newData.name}`;
        emailLi.innerHTML = `${newData.email}`;
        passwordLi.innerHTML = `${newData.password}`;
        button.innerText = 'Edit';
    }
});

const postsform = document.getElementById('mypostsform');
sessionStorage.setItem('mypostsdisplay', 'false');
document.getElementById('myposts').innerHTML = '';

postsform.addEventListener('submit', async function(event) {
    event.preventDefault();
    const myPostsDisplayed = sessionStorage.getItem('mypostsdisplay') === 'true';

    if (myPostsDisplayed) {
        updateDisplayButton(myPostsDisplayed);
        const postsbox = document.getElementById('myposts');
        postsbox.innerHTML = '';
        sessionStorage.setItem('mypostsdisplay', 'false');
    } else {
        const posts = await getUserPosts();
        updateDisplayButton(myPostsDisplayed);
        displayPosts(posts);
        sessionStorage.setItem('mypostsdisplay', 'true');
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
    } else {
        alert('No posts to display');
    }
}

function updateDisplayButton(display) {
    if (display) {
        const button = document.getElementById('mypostsbutton');
        button.innerText = 'Show My Posts'; 
    } else {
        const button = document.getElementById('mypostsbutton');
        button.innerText = 'Hide My Posts';
    }
}

function deletePost(post_id) {
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
}

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