const form = document.getElementById("post-form");

form.addEventListener("submit", function(e) {
    e.preventDefault();
    const data = new FormData(this);
    post(data.get("title"), data.get("description"), data.get("location"), data.get("payType"), data.get("pay"));
});

function post(title, description, location, payType, pay) {
    alert("Post: " + title + description + location + payType + pay);
}