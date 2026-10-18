const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    MAX_IMAGE_BYTES,
    MAX_POST_IMAGES,
    PHOTO_LIMIT_MESSAGE,
    PHOTO_SIZE_MESSAGE,
    PHOTO_TYPE_MESSAGE,
    attachImages,
    detectImageType,
    imageFilePath,
    publicImageList,
    removeStoredFiles,
    reviewUploads,
    writeImages,
} = require('../lib/postImages');

function jpeg(size = 16) {
    const buffer = Buffer.alloc(size, 0x11);
    buffer[0] = 0xff;
    buffer[1] = 0xd8;
    buffer[2] = 0xff;
    return buffer;
}

function png() {
    const buffer = Buffer.alloc(16, 0x22);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
    return buffer;
}

function gif() {
    const buffer = Buffer.alloc(16, 0x33);
    Buffer.from('GIF89a').copy(buffer);
    return buffer;
}

function webp() {
    const buffer = Buffer.alloc(16, 0x44);
    Buffer.from('RIFF').copy(buffer, 0);
    Buffer.from('WEBP').copy(buffer, 8);
    return buffer;
}

describe('postImages', () => {
    it('recognizes jpeg, png, gif, and webp from the file header', () => {
        assert.equal(detectImageType(jpeg()).ext, 'jpg');
        assert.equal(detectImageType(png()).ext, 'png');
        assert.equal(detectImageType(gif()).ext, 'gif');
        assert.equal(detectImageType(webp()).mime, 'image/webp');
        assert.equal(detectImageType(Buffer.from('<html></html>')), null);
        assert.equal(detectImageType(Buffer.from([0xff, 0xd8])), null);
    });

    it('rejects more than four photos, oversized files, and non-images', () => {
        const five = Array.from({ length: 5 }, () => ({ buffer: jpeg() }));
        assert.equal(reviewUploads(five, 0).error, PHOTO_LIMIT_MESSAGE);

        const roomForOne = reviewUploads([{ buffer: jpeg() }, { buffer: png() }], 3);
        assert.equal(roomForOne.error, PHOTO_LIMIT_MESSAGE);

        const huge = jpeg(MAX_IMAGE_BYTES + 1);
        assert.equal(reviewUploads([{ buffer: huge }], 0).error, PHOTO_SIZE_MESSAGE);

        const exact = reviewUploads([{ buffer: jpeg(MAX_IMAGE_BYTES) }], 0);
        assert.equal(exact.value.length, 1);
        assert.equal(exact.value[0].ext, 'jpg');

        assert.equal(reviewUploads([{ buffer: Buffer.from('<html></html>pad') }], 0).error, PHOTO_TYPE_MESSAGE);
        assert.deepEqual(reviewUploads([], 0).value, []);
        assert.equal(MAX_POST_IMAGES, 4);
    });

    it('publishes only generated photo urls and keeps sort order', () => {
        const safe = `${'ab'.repeat(16)}.png`;
        assert.deepEqual(publicImageList([
            { stored_name: safe },
            { stored_name: '../server.js' },
            { url: 'https://evil.example/a.png' },
            { url: `/uploads/posts/${safe}` },
        ]), [
            { url: `/uploads/posts/${safe}` },
            { url: `/uploads/posts/${safe}` },
        ]);

        const posts = attachImages(
            [{ id: 2, title: 'Later' }, { id: 1, title: 'First' }],
            [
                { id: 9, post_id: 1, stored_name: `${'cd'.repeat(16)}.jpg`, sort_order: 1 },
                { id: 8, post_id: 1, stored_name: `${'ef'.repeat(16)}.jpg`, sort_order: 0 },
            ]
        );
        assert.deepEqual(posts.find((post) => post.id === 1).images.map((image) => image.sort_order), [0, 1]);
        assert.deepEqual(posts.find((post) => post.id === 2).images, []);
    });

    it('keeps photo files inside the upload directory', () => {
        const dir = path.join(os.tmpdir(), 'easy-gig-photo-path');
        const safe = `${'a1'.repeat(16)}.jpg`;
        const full = imageFilePath(dir, safe);
        assert.equal(full, path.join(path.resolve(dir), safe));
        assert.equal(imageFilePath(dir, `../${safe}`), null);
        assert.equal(imageFilePath(dir, `${safe}.html`), null);
    });

    it('writes photos and deletes those files again', async () => {
        const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'easy-gig-photos-'));
        const reviewed = reviewUploads([{ buffer: jpeg() }, { buffer: png() }], 0);
        const written = await writeImages(dir, reviewed.value, 0);
        assert.equal(written.value.length, 2);
        assert.deepEqual(written.value.map((image) => image.sort_order), [0, 1]);

        const onDisk = await fs.promises.readFile(imageFilePath(dir, written.value[0].stored_name));
        assert.equal(onDisk[0], 0xff);
        removeStoredFiles(dir, written.value.map((image) => image.stored_name));
        await assert.rejects(fs.promises.stat(imageFilePath(dir, written.value[0].stored_name)));
        await fs.promises.rmdir(dir);
    });
});
