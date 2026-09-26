'use strict';

const PRIMARY_FIELD = {
    title: 'title',
    location: 'location',
    type: 'type_of_pay',
    pay: 'max_pay',
};

function normalize(value) {
    return String(value ?? '').toLowerCase();
}

function wordsOf(value) {
    return normalize(value).match(/[a-z0-9]+/g) || [];
}

function tokens(search) {
    return wordsOf(search).filter((word) => word.length >= 2);
}

function textHas(text, word) {
    const haystack = normalize(text);
    if (!word || !haystack) {
        return false;
    }
    if (haystack.includes(word)) {
        return true;
    }
    if (word.length < 3) {
        return false;
    }
    return wordsOf(haystack).some((part) => {
        if (part.length < 3) {
            return false;
        }
        return part.startsWith(word) || word.startsWith(part);
    });
}

function secondaryText(post, primaryKey) {
    return ['title', 'description', 'location', 'type_of_pay', 'max_pay']
        .filter((key) => key !== primaryKey)
        .map((key) => post[key])
        .join(' ');
}

function payCloseness(post, search) {
    const target = Number(String(search).replace(/[^0-9.]/g, ''));
    const pay = Number(post.max_pay);
    if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(pay)) {
        return 0;
    }
    if (pay === target) {
        return 40;
    }
    const ratio = Math.abs(pay - target) / target;
    if (ratio <= 0.25) {
        return 8;
    }
    return 0;
}

function rankPosts(posts, search, mode) {
    const query = normalize(search).trim();
    const words = tokens(query);
    const primaryKey = PRIMARY_FIELD[mode] || PRIMARY_FIELD.title;
    if (!query || words.length === 0) {
        return { relevant: [], related: [] };
    }

    const relevant = [];
    const related = [];

    for (const post of posts) {
        const primary = post[primaryKey];
        const secondary = secondaryText(post, primaryKey);
        let primaryScore = normalize(primary).includes(query) ? 40 : 0;
        let relatedScore = 0;
        let primaryHits = 0;

        for (const word of words) {
            if (textHas(primary, word)) {
                primaryHits += 1;
                primaryScore += 10;
            } else if (textHas(secondary, word)) {
                relatedScore += 5;
            }
        }

        if (words.length > 1 && primaryHits === words.length) {
            primaryScore += 15;
        }

        if (mode === 'pay') {
            const closeness = payCloseness(post, query);
            if (closeness >= 40) {
                primaryScore += closeness;
            } else {
                relatedScore += closeness;
            }
        }

        if (primaryScore > 0) {
            relevant.push({ post, score: primaryScore });
        } else if (relatedScore > 0) {
            related.push({ post, score: relatedScore });
        }
    }

    const byRelevance = (a, b) => b.score - a.score || Number(a.post.id) - Number(b.post.id);
    return {
        relevant: relevant.sort(byRelevance).map((entry) => entry.post),
        related: related.sort(byRelevance).map((entry) => entry.post),
    };
}

module.exports = {
    rankPosts,
};
