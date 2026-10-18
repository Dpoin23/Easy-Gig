const POLL_MS = 5000;

const inboxList = document.getElementById('inbox-list');
const reviewPrompts = document.getElementById('review-prompts');
const threadReview = document.getElementById('thread-review');
const threadTitle = document.getElementById('thread-title');
const threadWith = document.getElementById('thread-with');
const threadMessages = document.getElementById('thread-messages');
const threadStatus = document.getElementById('thread-status');
const threadForm = document.getElementById('thread-form');
const threadBody = document.getElementById('thread-body');

let inbox = [];
let pendingReviews = [];
let openId = null;
let lastMessageId = 0;
let pollTimer = null;
let pollInFlight = false;

function stopThreadPoll() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function startThreadPoll() {
    stopThreadPoll();
    if (!openId) {
        return;
    }
    pollTimer = setInterval(function() {
        if (!document.hidden) {
            loadNewMessages();
        }
    }, POLL_MS);
}

function setThreadStatus(message) {
    threadStatus.hidden = !message;
    threadStatus.textContent = message || '';
}

function redirectToSignIn() {
    window.location.href = 'signin.html';
}

async function readJson(response) {
    return response.json().catch(function() {
        return {};
    });
}

function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return date.toLocaleString();
}

function renderMessage(message) {
    const item = document.createElement('article');
    item.className = message.mine ? 'message-bubble mine' : 'message-bubble theirs';
    item.dataset.id = String(message.id);

    const text = document.createElement('p');
    text.textContent = message.body;

    const time = document.createElement('time');
    if (message.createdAt) {
        time.dateTime = String(message.createdAt);
    }
    time.textContent = formatTime(message.createdAt);

    item.append(text, time);
    return item;
}

function appendMessages(messages) {
    let added = false;
    messages.forEach(function(message) {
        if (threadMessages.querySelector(`[data-id="${message.id}"]`)) {
            return;
        }
        threadMessages.appendChild(renderMessage(message));
        if (Number(message.id) > lastMessageId) {
            lastMessageId = Number(message.id);
        }
        added = true;
    });
    if (added) {
        if (threadStatus.textContent === 'No messages in this thread yet.') {
            setThreadStatus('');
        }
        threadMessages.scrollTop = threadMessages.scrollHeight;
    }
    return added;
}

function showHeading(id) {
    const item = inbox.find(function(row) {
        return row.id === id;
    });
    if (!item) {
        threadTitle.textContent = 'Conversation';
        threadWith.textContent = '';
        return;
    }
    threadTitle.textContent = item.postTitle;
    threadWith.textContent = item.otherName;
}

function markInboxOpen() {
    inboxList.querySelectorAll('.inbox-item').forEach(function(button) {
        button.classList.toggle('is-open', Number(button.dataset.id) === openId);
    });
}

function promptForConversation(id) {
    return pendingReviews.find(function(prompt) {
        return prompt.conversationId === id;
    }) || null;
}

function loosePrompts() {
    return pendingReviews.filter(function(prompt) {
        if (!prompt.conversationId) {
            return true;
        }
        return !inbox.some(function(item) {
            return item.id === prompt.conversationId;
        });
    });
}

function showThreadReview(id) {
    if (!threadReview) {
        return;
    }
    const prompt = promptForConversation(id);
    threadReview.hidden = !prompt;
    threadReview.replaceChildren();
    if (!prompt) {
        return;
    }
    mountReviewForm(threadReview, prompt, async function() {
        pendingReviews = pendingReviews.filter(function(item) {
            return item.postId !== prompt.postId;
        });
        showThreadReview(id);
        renderReviewPrompts();
        renderInbox();
        if (typeof refreshUnreadCount === 'function') {
            refreshUnreadCount();
        }
    });
}

function renderReviewPrompts() {
    if (!reviewPrompts) {
        return;
    }
    reviewPrompts.replaceChildren();
    const loose = loosePrompts();
    if (loose.length === 0 && pendingReviews.length === 0) {
        return;
    }

    if (pendingReviews.length > 0) {
        const note = document.createElement('p');
        note.className = 'review-inbox-note';
        note.textContent = pendingReviews.length === 1
            ? 'A finished gig is ready for your review.'
            : `${pendingReviews.length} finished gigs are ready for your review.`;
        reviewPrompts.append(note);
    }

    loose.forEach(function(prompt) {
        const card = document.createElement('div');
        card.className = 'review-prompt-card';
        mountReviewForm(card, prompt, function() {
            pendingReviews = pendingReviews.filter(function(item) {
                return item.postId !== prompt.postId;
            });
            renderReviewPrompts();
            renderInbox();
            if (typeof refreshUnreadCount === 'function') {
                refreshUnreadCount();
            }
        });
        reviewPrompts.append(card);
    });
}

function renderInbox() {
    inboxList.replaceChildren();
    if (inbox.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'messages-empty';
        empty.textContent = 'No messages yet. Open a gig from search and choose Message.';
        inboxList.appendChild(empty);
        return;
    }

    inbox.forEach(function(item) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'inbox-item';
        button.dataset.id = String(item.id);
        if (item.id === openId) {
            button.classList.add('is-open');
        }

        const name = document.createElement('span');
        name.className = 'inbox-name';
        name.textContent = item.otherName;

        const title = document.createElement('span');
        title.className = 'inbox-title';
        title.textContent = item.postTitle;

        const preview = document.createElement('span');
        preview.className = 'inbox-preview';
        preview.textContent = item.lastMessage || 'No messages yet';

        button.append(name, title, preview);
        if (promptForConversation(item.id)) {
            const review = document.createElement('span');
            review.className = 'inbox-review';
            review.textContent = 'Review';
            button.append(review);
        }
        if (item.unreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'inbox-unread';
            badge.textContent = String(item.unreadCount);
            button.appendChild(badge);
        }

        button.addEventListener('click', function() {
            openThread(item.id);
        });
        inboxList.appendChild(button);
    });
}

async function loadInbox() {
    const response = await fetch('/api/conversations');
    if (response.status === 401) {
        redirectToSignIn();
        return false;
    }
    const body = await readJson(response);
    if (!response.ok) {
        setThreadStatus(body.error || 'Could not load messages.');
        return false;
    }
    inbox = body.conversations || [];
    pendingReviews = await loadPendingReviews();
    renderReviewPrompts();
    renderInbox();
    if (openId) {
        showHeading(openId);
    }
    return true;
}

async function markRead(id, messages) {
    const unread = messages.some(function(message) {
        return !message.mine && !message.readAt;
    });
    if (!unread || !id) {
        return;
    }
    const response = await fetch(`/api/conversations/${id}/read`, { method: 'PUT' });
    if (openId !== id) {
        return;
    }
    if (response.status === 401) {
        redirectToSignIn();
        return;
    }
    if (!response.ok) {
        return;
    }
    await loadInbox();
    if (typeof refreshUnreadCount === 'function') {
        refreshUnreadCount();
    }
}

async function loadNewMessages() {
    if (!openId || document.hidden || pollInFlight) {
        return;
    }
    const id = openId;
    const after = lastMessageId;
    pollInFlight = true;
    try {
        const response = await fetch(`/api/conversations/${id}/messages?after=${after}`);
        if (openId !== id) {
            return;
        }
        if (response.status === 401) {
            stopThreadPoll();
            redirectToSignIn();
            return;
        }
        const body = await readJson(response);
        if (!response.ok || openId !== id) {
            return;
        }
        const messages = body.messages || [];
        appendMessages(messages);
        await markRead(id, messages);
    } catch (error) {
        console.error(error);
    } finally {
        pollInFlight = false;
    }
}

async function openThread(id) {
    openId = id;
    lastMessageId = 0;
    stopThreadPoll();
    threadMessages.replaceChildren();
    threadForm.hidden = false;
    showThreadReview(id);
    setThreadStatus('');
    showHeading(id);
    markInboxOpen();

    const url = new URL(window.location.href);
    url.searchParams.set('conversation', String(id));
    history.replaceState(null, '', url);

    const response = await fetch(`/api/conversations/${id}/messages`);
    if (openId !== id) {
        return;
    }
    if (response.status === 401) {
        redirectToSignIn();
        return;
    }
    const body = await readJson(response);
    if (openId !== id) {
        return;
    }
    if (!response.ok) {
        threadForm.hidden = true;
        setThreadStatus(body.error || 'Conversation not found.');
        return;
    }

    const messages = body.messages || [];
    if (messages.length === 0) {
        setThreadStatus('No messages in this thread yet.');
    }
    appendMessages(messages);
    await markRead(id, messages);
    if (openId !== id) {
        return;
    }
    startThreadPoll();
}

threadForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    if (!openId) {
        return;
    }
    const text = threadBody.value;
    if (!text.trim()) {
        setThreadStatus('Message is required');
        return;
    }

    const id = openId;
    const button = threadForm.querySelector('button');
    button.disabled = true;
    try {
        const response = await fetch(`/api/conversations/${id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: text }),
        });
        if (openId !== id) {
            return;
        }
        if (response.status === 401) {
            redirectToSignIn();
            return;
        }
        const body = await readJson(response);
        if (openId !== id) {
            return;
        }
        if (!response.ok) {
            setThreadStatus(body.error || 'Could not send that message.');
            return;
        }
        threadBody.value = '';
        setThreadStatus('');
        appendMessages([body]);
        await loadInbox();
    } catch (error) {
        console.error(error);
        setThreadStatus('Could not send that message.');
    } finally {
        button.disabled = false;
    }
});

document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopThreadPoll();
        return;
    }
    if (openId) {
        loadNewMessages();
        startThreadPoll();
    }
});

loadInbox().then(function(ok) {
    if (!ok) {
        return;
    }
    const requested = Number(new URLSearchParams(window.location.search).get('conversation'));
    if (Number.isInteger(requested) && requested > 0) {
        openThread(requested);
    }
});
