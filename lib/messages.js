'use strict';

const { textField } = require('./sanitize');

const DELETED_USER_LABEL = 'Deleted user';
const RETENTION_MONTHS = 12;
const MESSAGE_MAX = 2000;

const CREATE_CONVERSATIONS_SQL = `CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  poster_id INT NOT NULL,
  worker_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_thread_per_post_worker (post_id, worker_id),
  KEY poster_recent (poster_id, last_message_at),
  KEY worker_recent (worker_id, last_message_at)
)`;

const CREATE_MESSAGES_SQL = `CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  KEY convo_order (conversation_id, id)
)`;

const MESSAGES_AFTER_SQL = `SELECT id, sender_id, body, created_at, read_at
 FROM messages
 WHERE conversation_id = ? AND id > ?
 ORDER BY id ASC`;

const INBOX_SQL = `SELECT
  c.id,
  c.post_id,
  c.poster_id,
  c.worker_id,
  c.last_message_at,
  p.title AS post_title,
  CASE
    WHEN c.poster_id = ? THEN wu.name
    ELSE pu.name
  END AS other_name,
  (
    SELECT m.body FROM messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.id DESC
    LIMIT 1
  ) AS last_body,
  (
    SELECT COUNT(*) FROM messages m
    WHERE m.conversation_id = c.id
      AND m.sender_id <> ?
      AND m.read_at IS NULL
  ) AS unread_count
 FROM conversations c
 LEFT JOIN posts p ON p.id = c.post_id
 LEFT JOIN users pu ON pu.id = c.poster_id
 LEFT JOIN users wu ON wu.id = c.worker_id
 WHERE c.poster_id = ? OR c.worker_id = ?
 ORDER BY c.last_message_at DESC, c.id DESC`;

const UNREAD_COUNT_SQL = `SELECT COUNT(*) AS unread
 FROM messages m
 INNER JOIN conversations c ON c.id = m.conversation_id
 WHERE (c.poster_id = ? OR c.worker_id = ?)
   AND m.sender_id <> ?
   AND m.read_at IS NULL`;

const PURGE_STALE_CONVERSATIONS_SQL = `SELECT id, post_id, poster_id, worker_id, last_message_at
 FROM conversations
 WHERE last_message_at < DATE_SUB(NOW(), INTERVAL ${RETENTION_MONTHS} MONTH)
 ORDER BY last_message_at ASC, id ASC`;

function messageBody(value) {
    const parsed = textField(value, 'Message', MESSAGE_MAX);
    if (parsed.error) {
        return { status: 400, error: parsed.error };
    }
    return { value: parsed.value };
}

function rejectOwnPost(posterId, userId) {
    if (Number(posterId) === Number(userId)) {
        return { status: 400, error: 'You cannot message your own post' };
    }
    return null;
}

function conversationAccess(conversation, userId) {
    const uid = Number(userId);
    const inThread = conversation
        && (Number(conversation.poster_id) === uid || Number(conversation.worker_id) === uid);
    if (!inThread) {
        return { status: 404, error: 'Conversation not found' };
    }
    return { conversation };
}

function afterMessageId(value) {
    if (value == null || value === '') {
        return { value: 0 };
    }
    const id = Number(value);
    if (!Number.isInteger(id) || id < 0) {
        return { status: 400, error: 'Message is invalid' };
    }
    return { value: id };
}

function messagesNewerThan(rows, afterId) {
    const after = Number(afterId) || 0;
    return (rows || []).filter((row) => Number(row.id) > after);
}

function otherPartyName(name) {
    if (typeof name !== 'string' || name.trim() === '') {
        return DELETED_USER_LABEL;
    }
    return name;
}

function inboxItem(row, userId) {
    return {
        id: Number(row.id),
        postId: Number(row.post_id),
        postTitle: row.post_title || 'Removed gig',
        otherName: otherPartyName(row.other_name),
        lastMessage: row.last_body || '',
        unreadCount: Number(row.unread_count) || 0,
        lastMessageAt: row.last_message_at,
        role: Number(row.poster_id) === Number(userId) ? 'poster' : 'worker',
    };
}

function publicMessage(row, userId) {
    return {
        id: Number(row.id),
        senderId: Number(row.sender_id),
        body: row.body,
        createdAt: row.created_at,
        readAt: row.read_at || null,
        mine: Number(row.sender_id) === Number(userId),
    };
}

function publicConversation(row) {
    return {
        id: Number(row.id),
        postId: Number(row.post_id),
        posterId: Number(row.poster_id),
        workerId: Number(row.worker_id),
    };
}

function positiveIds(ids) {
    return [...new Set((ids || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

function deleteThreadsForPosts(db, postIds, done) {
    const ids = positiveIds(postIds);
    if (ids.length === 0) {
        done(null);
        return;
    }
    const marks = ids.map(() => '?').join(', ');
    db.query(
        `DELETE messages FROM messages
         INNER JOIN conversations ON conversations.id = messages.conversation_id
         WHERE conversations.post_id IN (${marks})`,
        ids,
        (messageErr) => {
            if (messageErr) {
                done(messageErr);
                return;
            }
            db.query(
                `DELETE FROM conversations WHERE post_id IN (${marks})`,
                ids,
                (conversationErr) => done(conversationErr || null)
            );
        }
    );
}

function ensureMessageTables(db, done) {
    db.query(CREATE_CONVERSATIONS_SQL, (conversationErr) => {
        if (conversationErr) {
            done(conversationErr);
            return;
        }
        db.query(CREATE_MESSAGES_SQL, (messageErr) => done(messageErr || null));
    });
}

module.exports = {
    DELETED_USER_LABEL,
    RETENTION_MONTHS,
    MESSAGE_MAX,
    CREATE_CONVERSATIONS_SQL,
    CREATE_MESSAGES_SQL,
    MESSAGES_AFTER_SQL,
    INBOX_SQL,
    UNREAD_COUNT_SQL,
    PURGE_STALE_CONVERSATIONS_SQL,
    messageBody,
    rejectOwnPost,
    conversationAccess,
    afterMessageId,
    messagesNewerThan,
    otherPartyName,
    inboxItem,
    publicMessage,
    publicConversation,
    deleteThreadsForPosts,
    ensureMessageTables,
};
