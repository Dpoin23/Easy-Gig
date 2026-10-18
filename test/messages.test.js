const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    DELETED_USER_LABEL,
    RETENTION_MONTHS,
    MESSAGES_AFTER_SQL,
    INBOX_SQL,
    PURGE_STALE_CONVERSATIONS_SQL,
    messageBody,
    rejectOwnPost,
    conversationAccess,
    afterMessageId,
    messagesNewerThan,
    inboxItem,
} = require('../lib/messages');

const thread = { id: 9, post_id: 4, poster_id: 1, worker_id: 2 };

describe('messages', () => {
    it('hides a conversation from someone who is not in it', () => {
        const missing = conversationAccess(null, 2);
        assert.equal(missing.status, 404);

        const stranger = conversationAccess(thread, 3);
        assert.equal(stranger.status, 404);
        assert.equal(stranger.error, 'Conversation not found');

        assert.equal(conversationAccess(thread, 1).conversation.id, 9);
        assert.equal(conversationAccess(thread, 2).conversation.id, 9);
    });

    it('rejects an empty or oversized message', () => {
        assert.equal(messageBody('').status, 400);
        assert.equal(messageBody('   ').error, 'Message is required');
        assert.equal(messageBody('x'.repeat(2001)).status, 400);
        assert.equal(messageBody('x'.repeat(2001)).error, 'Message is too long');
        assert.equal(messageBody('x'.repeat(2000)).value, 'x'.repeat(2000));
        assert.equal(messageBody(12).status, 400);
    });

    it('returns only messages newer than after', () => {
        const rows = [
            { id: 4, body: 'first' },
            { id: 5, body: 'second' },
            { id: 8, body: 'third' },
        ];

        assert.deepEqual(messagesNewerThan(rows, 5).map((row) => row.id), [8]);
        assert.deepEqual(messagesNewerThan(rows, 0).map((row) => row.id), [4, 5, 8]);
        assert.equal(afterMessageId(undefined).value, 0);
        assert.equal(afterMessageId('5').value, 5);
        assert.equal(afterMessageId('-1').status, 400);
        assert.match(MESSAGES_AFTER_SQL, /id > \?/);
        assert.match(MESSAGES_AFTER_SQL, /convo_order|conversation_id/);
    });

    it('rejects messaging your own post', () => {
        const rejected = rejectOwnPost(7, 7);
        assert.equal(rejected.status, 400);
        assert.equal(rejected.error, 'You cannot message your own post');
        assert.equal(rejectOwnPost(7, 8), null);
    });

    it('keeps a thread after the other account is deleted', () => {
        const item = inboxItem({
            id: 3,
            post_id: 4,
            poster_id: 1,
            worker_id: 2,
            post_title: 'Move a couch',
            other_name: null,
            last_body: 'I can do Tuesday',
            unread_count: '2',
            last_message_at: '2026-10-01',
        }, 1);

        assert.equal(item.otherName, DELETED_USER_LABEL);
        assert.equal(item.unreadCount, 2);
        assert.equal(item.lastMessage, 'I can do Tuesday');
        assert.equal(item.role, 'poster');
        assert.doesNotMatch(INBOX_SQL, /email|password/i);
    });

    it('treats a year of silence as the retention window', () => {
        assert.equal(RETENTION_MONTHS, 12);
        assert.match(PURGE_STALE_CONVERSATIONS_SQL, /INTERVAL 12 MONTH/);
    });
});
