/* exported gigLocationHtml, gigAreaLabel, escapeGigText, formatGigMoney, gigHistoryHtml, gigImagesHtml */

function escapeGigText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function gigAreaLabel(point) {
    return point.location
        || [point.neighborhood, point.locality, point.admin_area].filter(Boolean).join(', ')
        || 'Location not set';
}

function gigLocationHtml(point, options) {
    const opts = options || {};
    const area = escapeGigText(gigAreaLabel(point));
    const parts = [`<div class="display-location"><div>Area: ${area}</div>`];

    if (point.distance_miles != null && point.distance_miles !== '') {
        parts.push(`<div class="display-distance">${escapeGigText(point.distance_miles)} miles from your search</div>`);
    }

    if (point.precise_address) {
        parts.push(`<div class="display-address">Address: ${escapeGigText(point.precise_address)}</div>`);
    } else if (point.has_precise_address) {
        const when = point.address_shared_when === 'now'
            ? 'Exact address is public on this listing.'
            : 'Exact address is shared after you are hired.';
        parts.push(`<div class="display-address-note">${escapeGigText(when)}</div>`);
    }

    if (opts.owner && point.has_precise_address && point.address_visibility === 'after_hire') {
        parts.push('<div class="display-address-note">Workers see this street address only after you hire them.</div>');
    }

    parts.push('</div>');
    return parts.join('');
}

function gigImagesHtml(point) {
    const images = Array.isArray(point.images) ? point.images : [];
    const photos = images.map((image) => {
        const url = image && typeof image.url === 'string' ? image.url : '';
        if (!/^\/uploads\/posts\/[a-f0-9]{32}\.(?:jpg|png|webp|gif)$/.test(url)) {
            return '';
        }
        const safeUrl = escapeGigText(url);
        return `<a class="display-photo-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer"><img class="display-photo" src="${safeUrl}" alt="Gig photo"></a>`;
    }).filter(Boolean);
    if (photos.length === 0) {
        return '';
    }
    return `<div class="display-photos">${photos.join('')}</div>`;
}

function formatGigMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
        return '';
    }
    return amount.toFixed(2);
}

function gigHistoryHtml(point) {
    const filled = point.was_filled
        ? '<div class="display-hired">This gig was filled.</div>'
        : '';
    return `<div class="display-title">${escapeGigText(point.title)}</div>
            <label><strong>Description</strong></label>
            <p class="display-description">${escapeGigText(point.description)}</p>
            ${gigImagesHtml(point)}
            <div class="display-info">
                ${gigLocationHtml(point)}
                <div class="display-type">Type of Pay: ${escapeGigText(point.type_of_pay)}</div>
                <div class="display-pay">Pay: $${escapeGigText(formatGigMoney(point.max_pay))}</div>
            </div>
            ${filled}
            <div class="display-bid">
                <div>Current Bid: $${escapeGigText(formatGigMoney(point.current_bid))}</div>
            </div>`;
}

window.escapeGigText = escapeGigText;
window.gigAreaLabel = gigAreaLabel;
window.gigLocationHtml = gigLocationHtml;
window.formatGigMoney = formatGigMoney;
window.gigHistoryHtml = gigHistoryHtml;
window.gigImagesHtml = gigImagesHtml;
