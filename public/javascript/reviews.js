async function loadPendingReviews() {
    try {
        const response = await fetch('/api/reviews/pending');
        if (response.status === 401) {
            window.location.href = 'signin.html';
            return [];
        }
        const body = await response.json().catch(function() {
            return {};
        });
        if (!response.ok) {
            return [];
        }
        return body.prompts || [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

function renderRatingSummary(rating) {
    const summary = document.createElement('p');
    summary.className = 'rating-summary';
    const count = Number(rating && rating.count) || 0;
    if (count === 0 || rating.average == null) {
        summary.textContent = 'No reviews';
        return summary;
    }

    const stars = document.createElement('span');
    stars.className = 'rating-stars';
    stars.setAttribute('aria-hidden', 'true');
    const filled = Math.round(Number(rating.average));
    stars.textContent = '★★★★★'.slice(0, filled) + '☆☆☆☆☆'.slice(0, 5 - filled);

    const text = document.createElement('span');
    const label = count === 1 ? 'review' : 'reviews';
    text.textContent = ` ${Number(rating.average).toFixed(1)} out of 5 from ${count} ${label}`;

    summary.append(stars, text);
    return summary;
}

function renderReviewList(reviews, container) {
    if (!container) {
        return;
    }
    container.replaceChildren();
    (reviews || []).forEach(function(review) {
        const card = document.createElement('article');
        card.className = 'review-card';

        const stars = document.createElement('div');
        stars.className = 'review-stars';
        const count = Number(review.stars) || 0;
        stars.textContent = '★★★★★'.slice(0, count) + '☆☆☆☆☆'.slice(0, 5 - count);
        stars.setAttribute('aria-label', `${count} out of 5 stars`);

        const meta = document.createElement('p');
        meta.className = 'review-meta';
        meta.textContent = `${review.authorName} · ${review.postTitle}`;

        const body = document.createElement('p');
        body.className = 'review-body';
        body.textContent = review.description;

        card.append(stars, meta, body);
        container.append(card);
    });
}

function buildStarPicker() {
    const group = document.createElement('div');
    group.className = 'star-picker';
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', 'Rating from 1 to 5 stars');
    let selected = 0;
    const buttons = [];

    for (let n = 1; n <= 5; n += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'star-button';
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', 'false');
        button.setAttribute('aria-label', n === 1 ? '1 star' : `${n} stars`);
        button.textContent = '★';
        button.addEventListener('click', function() {
            selected = n;
            buttons.forEach(function(item, index) {
                const on = index < n;
                item.classList.toggle('is-on', on);
                item.setAttribute('aria-checked', index + 1 === n ? 'true' : 'false');
            });
        });
        buttons.push(button);
        group.append(button);
    }

    return {
        element: group,
        value: function() {
            return selected;
        },
    };
}

async function submitReview(postId, stars, description) {
    const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, stars, description }),
    });
    const body = await response.json().catch(function() {
        return {};
    });
    if (response.status === 401) {
        window.location.href = 'signin.html';
        return { redirected: true };
    }
    if (!response.ok) {
        return { error: body.error || 'Could not save that review.' };
    }
    return { review: body.review };
}

function mountReviewForm(container, prompt, onDone, extraButton) {
    container.replaceChildren();
    const form = document.createElement('form');
    form.className = 'review-form';

    const heading = document.createElement('h3');
    heading.className = 'review-form-title';
    heading.textContent = `Review ${prompt.revieweeName}`;

    const gig = document.createElement('p');
    gig.className = 'review-form-gig';
    gig.textContent = prompt.postTitle;

    const picker = buildStarPicker();
    const fieldId = `review-body-${prompt.postId}`;

    const label = document.createElement('label');
    label.htmlFor = fieldId;
    label.textContent = 'Description';

    const area = document.createElement('textarea');
    area.id = fieldId;
    area.name = 'description';
    area.maxLength = 1000;
    area.rows = 3;
    area.required = true;
    area.placeholder = 'How did the gig go?';

    const status = document.createElement('p');
    status.className = 'review-form-status';
    status.hidden = true;

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'display-input-button';
    submit.textContent = 'Submit review';

    const actions = document.createElement('div');
    actions.className = 'review-form-actions';
    actions.append(submit);
    if (extraButton) {
        actions.append(extraButton);
    }

    form.append(heading, gig, picker.element, label, area, status, actions);
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        const stars = picker.value();
        if (stars < 1) {
            status.hidden = false;
            status.textContent = 'Rating must be from 1 to 5 stars';
            return;
        }
        if (!area.value.trim()) {
            status.hidden = false;
            status.textContent = 'Review is required';
            return;
        }

        submit.disabled = true;
        if (extraButton) {
            extraButton.disabled = true;
        }
        status.hidden = true;
        try {
            const result = await submitReview(prompt.postId, stars, area.value);
            if (result.redirected) {
                return;
            }
            if (result.error) {
                status.hidden = false;
                status.textContent = result.error;
                submit.disabled = false;
                if (extraButton) {
                    extraButton.disabled = false;
                }
                return;
            }
            if (onDone) {
                onDone(result.review);
            }
        } catch (error) {
            console.error(error);
            status.hidden = false;
            status.textContent = 'Could not save that review.';
            submit.disabled = false;
            if (extraButton) {
                extraButton.disabled = false;
            }
        }
    });

    container.append(form);
}

function openReviewDialog(prompt) {
    return new Promise(function(resolve) {
        const dialog = document.createElement('dialog');
        dialog.className = 'review-dialog';
        dialog.setAttribute('aria-label', `Review ${prompt.revieweeName}`);

        const host = document.createElement('div');
        const later = document.createElement('button');
        later.type = 'button';
        later.className = 'display-input-button review-later';
        later.textContent = 'Not now';

        let settled = false;
        function close(result) {
            if (settled) {
                return;
            }
            settled = true;
            dialog.close();
            dialog.remove();
            resolve(result);
        }

        later.addEventListener('click', function() {
            close({ submitted: false });
        });
        dialog.addEventListener('cancel', function(event) {
            event.preventDefault();
            close({ submitted: false });
        });

        mountReviewForm(host, prompt, function() {
            close({ submitted: true });
        }, later);

        dialog.append(host);
        document.body.append(dialog);
        dialog.showModal();
    });
}

window.loadPendingReviews = loadPendingReviews;
window.renderRatingSummary = renderRatingSummary;
window.renderReviewList = renderReviewList;
window.mountReviewForm = mountReviewForm;
window.openReviewDialog = openReviewDialog;
