/* exported gigLocationHtml, gigAreaLabel, escapeGigText */

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

window.escapeGigText = escapeGigText;
window.gigAreaLabel = gigAreaLabel;
window.gigLocationHtml = gigLocationHtml;
