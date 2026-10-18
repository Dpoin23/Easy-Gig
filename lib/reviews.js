'use strict';

const { textField } = require('./sanitize');

const DESCRIPTION_MAX = 1000;
const DELETED_USER_LABEL = 'Deleted user';

const CREATE_REVIEW_PROMPTS_SQL = `CREATE TABLE IF NOT EXISTS review_prompts (
    post_id INT NOT NULL,
    post_title VARCHAR(255) NOT NULL,
    poster_id INT NOT NULL,
    worker_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id)
)`;

const CREATE_REVIEWS_SQL = `CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    post_title VARCHAR(255) NOT NULL,
    reviewer_id INT NOT NULL,
    reviewee_id INT NOT NULL,
    stars TINYINT NOT NULL,
    description VARCHAR(1000) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY one_review_per_side (post_id, reviewer_id),
    KEY reviews_about (reviewee_id, id)
)`;

const RATING_SQL = `SELECT COUNT(*) AS count, AVG(stars) AS average
 FROM reviews
 WHERE reviewee_id = ?`;

const REVIEWS_ABOUT_SQL = `SELECT reviews.id, reviews.stars, reviews.description, reviews.post_title,
        reviews.created_at, users.name AS author_name
 FROM reviews
 LEFT JOIN users ON users.id = reviews.reviewer_id
 WHERE reviews.reviewee_id = ?
 ORDER BY reviews.id DESC
 LIMIT 50`;

const REVIEW_BY_ID_SQL = `SELECT reviews.id, reviews.stars, reviews.description, reviews.post_title,
        reviews.created_at, users.name AS author_name
 FROM reviews
 LEFT JOIN users ON users.id = reviews.reviewer_id
 WHERE reviews.id = ?`;

const PENDING_SQL = `SELECT
  rp.post_id,
  rp.post_title,
  rp.poster_id,
  rp.worker_id,
  CASE WHEN rp.poster_id = ? THEN wu.name ELSE pu.name END AS reviewee_name,
  (
    SELECT c.id FROM conversations c
    WHERE c.post_id = rp.post_id AND c.worker_id = rp.worker_id
    ORDER BY c.id ASC
    LIMIT 1
  ) AS conversation_id
 FROM review_prompts rp
 LEFT JOIN users pu ON pu.id = rp.poster_id
 LEFT JOIN users wu ON wu.id = rp.worker_id
 WHERE (rp.poster_id = ? OR rp.worker_id = ?)
   AND NOT EXISTS (
     SELECT 1 FROM reviews r
     WHERE r.post_id = rp.post_id AND r.reviewer_id = ?
   )
 ORDER BY rp.created_at DESC, rp.post_id DESC`;

const PENDING_COUNT_SQL = `SELECT COUNT(*) AS pending
 FROM review_prompts rp
 WHERE (rp.poster_id = ? OR rp.worker_id = ?)
   AND NOT EXISTS (
     SELECT 1 FROM reviews r
     WHERE r.post_id = rp.post_id AND r.reviewer_id = ?
   )`;

function reviewStars(value) {
    if (typeof value !== 'number' && typeof value !== 'string') {
        return { status: 400, error: 'Rating must be from 1 to 5 stars' };
    }
    if (typeof value === 'string' && value.trim() === '') {
        return { status: 400, error: 'Rating must be from 1 to 5 stars' };
    }
    const stars = Number(value);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        return { status: 400, error: 'Rating must be from 1 to 5 stars' };
    }
    return { value: stars };
}

function reviewDescription(value) {
    const parsed = textField(value, 'Review', DESCRIPTION_MAX);
    if (parsed.error) {
        return { status: 400, error: parsed.error };
    }
    return { value: parsed.value };
}

function reviewParties(prompt, userId) {
    if (!prompt) {
        return { status: 404, error: 'This gig is not ready for a review' };
    }
    const uid = Number(userId);
    if (uid === Number(prompt.poster_id)) {
        return {
            reviewerId: uid,
            revieweeId: Number(prompt.worker_id),
            role: 'poster',
        };
    }
    if (uid === Number(prompt.worker_id)) {
        return {
            reviewerId: uid,
            revieweeId: Number(prompt.poster_id),
            role: 'worker',
        };
    }
    return { status: 403, error: 'You cannot review this gig' };
}

function reviewDecision(prompt, userId, alreadyReviewed) {
    const parties = reviewParties(prompt, userId);
    if (parties.error) {
        return parties;
    }
    if (alreadyReviewed) {
        return { status: 409, error: 'You already reviewed this gig' };
    }
    return parties;
}

function ratingFromStars(stars) {
    const values = (stars || []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
    if (values.length === 0) {
        return { average: null, count: 0 };
    }
    const total = values.reduce((sum, n) => sum + n, 0);
    return {
        average: Math.round((total / values.length) * 10) / 10,
        count: values.length,
    };
}

function ratingFromAggregate(row) {
    const count = Number(row && row.count) || 0;
    if (count <= 0 || row.average == null) {
        return { average: null, count: 0 };
    }
    return {
        average: Math.round(Number(row.average) * 10) / 10,
        count,
    };
}

function personName(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return DELETED_USER_LABEL;
    }
    return value.trim();
}

function publicReview(row) {
    return {
        id: Number(row.id),
        stars: Number(row.stars),
        description: row.description,
        postTitle: row.post_title || 'Gig',
        authorName: personName(row.author_name),
        createdAt: row.created_at,
    };
}

function publicPendingReview(row, userId) {
    const parties = reviewParties(row, userId);
    if (parties.error) {
        return null;
    }
    return {
        postId: Number(row.post_id),
        postTitle: row.post_title || 'Gig',
        revieweeName: personName(row.reviewee_name),
        role: parties.role,
        conversationId: row.conversation_id == null ? null : Number(row.conversation_id),
    };
}

function isOpenGig(post) {
    return Boolean(post) && (post.completed_at == null || post.completed_at === '');
}

function ensureCompletedColumn(db, done) {
    db.query(
        `SELECT COLUMN_NAME AS name
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts'`,
        (err, rows) => {
            if (err) {
                done(err);
                return;
            }
            if (!rows.length || rows.some((row) => row.name === 'completed_at')) {
                done();
                return;
            }
            db.query('ALTER TABLE posts ADD COLUMN completed_at DATETIME NULL', (alterErr) => {
                done(alterErr || null);
            });
        }
    );
}

function ensureReviews(db, done) {
    db.query(CREATE_REVIEW_PROMPTS_SQL, (promptErr) => {
        if (promptErr) {
            done(promptErr);
            return;
        }
        db.query(CREATE_REVIEWS_SQL, (reviewErr) => {
            if (reviewErr) {
                done(reviewErr);
                return;
            }
            ensureCompletedColumn(db, done);
        });
    });
}

module.exports = {
    DESCRIPTION_MAX,
    DELETED_USER_LABEL,
    CREATE_REVIEW_PROMPTS_SQL,
    CREATE_REVIEWS_SQL,
    RATING_SQL,
    REVIEWS_ABOUT_SQL,
    REVIEW_BY_ID_SQL,
    PENDING_SQL,
    PENDING_COUNT_SQL,
    reviewStars,
    reviewDescription,
    reviewParties,
    reviewDecision,
    ratingFromStars,
    ratingFromAggregate,
    publicReview,
    publicPendingReview,
    isOpenGig,
    ensureReviews,
};
