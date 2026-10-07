document.addEventListener('DOMContentLoaded', async () => {

    const grid = document.getElementById('droneGrid');
    const emptyState = document.getElementById('droneEmptyState');
    const searchInput = document.getElementById('droneSearchInput');
    const statusFilter = document.getElementById('droneStatusFilter');

    // ===== ESCAPE HELPER (sprječava XSS - podaci o dronu dolaze sa servera/od korisnika) =====
    // Zajednička implementacija iz shared/snimci-utils.js (učitano prije ove skripte).
    const escapeHtml = SnimciUtils.escapeHtml;

    function badgeHtml(status) {
        const map = { aktivan: 'status-enabled', servis: 'service', neaktivan: 'offline' };
        const label = { aktivan: 'Aktivan', servis: 'U servisu', neaktivan: 'Offline' };
        return `<span class="badge ${map[status] || 'offline'}">${label[status] || status}</span>`;
    }

    // Redoslijed d.mediaFiles nije garantovano hronoloski (backend ga ne sortira) - sortiramo
    // po uploadedAt da "prva slika" pouzdano bude ona najranije otpremljena (konvencija za cover).
    function firstImage(d) {
        return (d.mediaFiles || [])
            .filter(m => m.contentType && m.contentType.indexOf('image') === 0)
            .sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt))[0];
    }

    function photoHtml(photo, d) {
        return photo
            ? `<img src="${resolveMediaUrl(photo.url)}" alt="${escapeHtml(d.model)}" loading="lazy">`
            : '<div class="drone-photo-placeholder">🛰</div>';
    }

    function renderCard(d) {
        const card = document.createElement('div');
        card.className = 'drone-card' + (d.status === 'neaktivan' ? ' offline' : '');
        card.dataset.status = d.status;
        card.dataset.name = d.name;
        card.dataset.serial = d.serialNumber;
        card.dataset.operator = d.operatorName || '';

        const photo = firstImage(d);

        card.innerHTML = `
            <div class="drone-photo">
                ${photoHtml(photo, d)}
                <div class="drone-photo-actions">
                    <button class="icon-btn docs-btn" title="Fotografije, snimci i dokumentacija (samo pregled)" aria-label="Fotografije, snimci i dokumentacija (samo pregled)">📎</button>
                </div>
            </div>
            <div class="drone-card-body">
                <div class="drone-card-top">
                    <h3 class="drone-name">${escapeHtml(d.name)}</h3>
                    ${badgeHtml(d.status)}
                </div>
                <p class="drone-serial">SN: ${escapeHtml(d.serialNumber)}</p>
                <div class="drone-stats">
                    <div class="drone-stat">
                        <span class="stat-label">Model</span>
                        <span class="stat-value">${escapeHtml(d.model)}</span>
                    </div>
                    <div class="drone-stat">
                        <span class="stat-label">Operater</span>
                        <span class="stat-value">${escapeHtml(d.operatorName || '—')}</span>
                    </div>
                </div>
                <div class="drone-card-footer">
                    <span class="row-time">${escapeHtml(d.manufacturer)}</span>
                </div>
            </div>`;

        card.querySelector('.docs-btn').addEventListener('click', () => {
            window.DroneDocsModal.open(d, 'kontrola');
        });

        return card;
    }

    let allDrones = [];

    async function loadDrones() {
        grid.innerHTML = '<p style="color:#7a9bbf;padding:24px;">Učitavanje...</p>';
        try {
            allDrones = await apiFetch('/dronovi');
            renderGrid();
        } catch (err) {
            grid.innerHTML = `<p style="color:#ff6b6b;padding:24px;">Greška: ${escapeHtml(err.message)}</p>`;
        }
    }

    function renderGrid() {
        grid.innerHTML = '';
        const query = searchInput.value.trim().toLowerCase();
        const status = statusFilter.value;

        const filtered = allDrones.filter(d => {
            const matchesQuery = !query || d.name.toLowerCase().includes(query) ||
                d.serialNumber.toLowerCase().includes(query) ||
                (d.operatorName || '').toLowerCase().includes(query);
            const matchesStatus = !status || d.status === status;
            return matchesQuery && matchesStatus;
        });

        emptyState.style.display = filtered.length === 0 ? 'block' : 'none';
        filtered.forEach(d => grid.appendChild(renderCard(d)));
    }

    searchInput.addEventListener('input', renderGrid);
    statusFilter.addEventListener('change', renderGrid);

    await loadDrones();
});
