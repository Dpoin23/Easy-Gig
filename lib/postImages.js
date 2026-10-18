'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAX_POST_IMAGES = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const PHOTO_LIMIT_MESSAGE = `You can add up to ${MAX_POST_IMAGES} photos`;
const PHOTO_SIZE_MESSAGE = 'Each photo must be 2 MB or smaller';
const PHOTO_TYPE_MESSAGE = 'Photos must be JPEG, PNG, WebP, or GIF';

const STORED_NAME = /^[a-f0-9]{32}\.(jpg|png|webp|gif)$/;
const PUBLIC_IMAGE_URL = /^\/uploads\/posts\/([a-f0-9]{32}\.(?:jpg|png|webp|gif))$/;

const MIME_BY_EXT = {
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
};

const CREATE_POST_IMAGES_SQL = `CREATE TABLE IF NOT EXISTS post_images (
    id INT AUTO_INCREMENT,
    post_id INT NOT NULL,
    stored_name VARCHAR(48) NOT NULL,
    sort_order TINYINT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY post_images_name (stored_name),
    KEY post_images_post (post_id, sort_order)
)`;

function imageDirectory(projectRoot) {
    return path.join(projectRoot, 'data', 'post-images');
}

function detectImageType(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
        return null;
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { ext: 'jpg', mime: 'image/jpeg' };
    }
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.subarray(0, 8).equals(png)) {
        return { ext: 'png', mime: 'image/png' };
    }
    const gif = buffer.subarray(0, 6).toString('ascii');
    if (gif === 'GIF87a' || gif === 'GIF89a') {
        return { ext: 'gif', mime: 'image/gif' };
    }
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return { ext: 'webp', mime: 'image/webp' };
    }
    return null;
}

function isStoredImageName(name) {
    return typeof name === 'string' && STORED_NAME.test(name);
}

function imageFilePath(directory, storedName) {
    if (!isStoredImageName(storedName)) {
        return null;
    }
    const root = path.resolve(directory);
    const full = path.resolve(root, storedName);
    if (full !== path.join(root, storedName)) {
        return null;
    }
    return full;
}

function imageUrl(storedName) {
    if (!isStoredImageName(storedName)) {
        return null;
    }
    return `/uploads/posts/${storedName}`;
}

function contentTypeForName(storedName) {
    if (!isStoredImageName(storedName)) {
        return null;
    }
    return MIME_BY_EXT[storedName.split('.').pop()] || null;
}

function publicImageList(images) {
    if (!Array.isArray(images)) {
        return [];
    }
    const list = [];
    for (const image of images) {
        if (!image || typeof image !== 'object') {
            continue;
        }
        const fromName = imageUrl(image.stored_name);
        if (fromName) {
            list.push({ url: fromName });
            continue;
        }
        const match = typeof image.url === 'string' ? PUBLIC_IMAGE_URL.exec(image.url) : null;
        if (match) {
            list.push({ url: `/uploads/posts/${match[1]}` });
        }
    }
    return list;
}

function attachImages(posts, rows) {
    const byPost = new Map();
    const sorted = [...(rows || [])].sort((a, b) => (
        Number(a.post_id) - Number(b.post_id)
        || Number(a.sort_order) - Number(b.sort_order)
        || Number(a.id) - Number(b.id)
    ));
    for (const row of sorted) {
        const postId = Number(row.post_id);
        if (!byPost.has(postId)) {
            byPost.set(postId, []);
        }
        byPost.get(postId).push(row);
    }
    return (posts || []).map((post) => ({
        ...post,
        images: byPost.get(Number(post.id)) || [],
    }));
}

function reviewUploads(files, existingCount) {
    const list = Array.isArray(files) ? files : null;
    if (!list) {
        return { error: PHOTO_TYPE_MESSAGE, status: 400 };
    }
    const existing = Number.isInteger(existingCount) && existingCount > 0 ? existingCount : 0;
    if (list.length === 0) {
        return { value: [] };
    }
    if (existing >= MAX_POST_IMAGES || existing + list.length > MAX_POST_IMAGES) {
        return { error: PHOTO_LIMIT_MESSAGE, status: 400 };
    }

    const planned = [];
    for (const file of list) {
        const buffer = file && file.buffer;
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            return { error: PHOTO_TYPE_MESSAGE, status: 400 };
        }
        if (buffer.length > MAX_IMAGE_BYTES) {
            return { error: PHOTO_SIZE_MESSAGE, status: 400 };
        }
        const kind = detectImageType(buffer);
        if (!kind) {
            return { error: PHOTO_TYPE_MESSAGE, status: 400 };
        }
        planned.push({ buffer, ext: kind.ext, mime: kind.mime });
    }
    return { value: planned };
}

function newStoredName(ext) {
    return `${crypto.randomBytes(16).toString('hex')}.${ext}`;
}

async function writeImages(directory, planned, startOrder = 0) {
    const saved = [];
    try {
        await fs.promises.mkdir(directory, { recursive: true });
        for (let index = 0; index < planned.length; index += 1) {
            const storedName = newStoredName(planned[index].ext);
            const full = imageFilePath(directory, storedName);
            if (!full) {
                throw new Error('invalid photo name');
            }
            await fs.promises.writeFile(full, planned[index].buffer);
            saved.push({ stored_name: storedName, sort_order: startOrder + index });
        }
        return { value: saved };
    } catch (err) {
        console.error('Could not save photos', err.message);
        removeStoredFiles(directory, saved.map((item) => item.stored_name));
        return { error: 'Could not save photos' };
    }
}

function removeStoredFiles(directory, names) {
    for (const name of names || []) {
        const full = imageFilePath(directory, name);
        if (!full) {
            continue;
        }
        try {
            fs.unlinkSync(full);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('Could not remove photo', err.message);
            }
        }
    }
}

function ensurePostImagesTable(db, done) {
    db.query(CREATE_POST_IMAGES_SQL, (err) => done(err || null));
}

module.exports = {
    MAX_POST_IMAGES,
    MAX_IMAGE_BYTES,
    PHOTO_LIMIT_MESSAGE,
    PHOTO_SIZE_MESSAGE,
    PHOTO_TYPE_MESSAGE,
    CREATE_POST_IMAGES_SQL,
    imageDirectory,
    detectImageType,
    isStoredImageName,
    imageFilePath,
    imageUrl,
    contentTypeForName,
    publicImageList,
    attachImages,
    reviewUploads,
    writeImages,
    removeStoredFiles,
    ensurePostImagesTable,
};
