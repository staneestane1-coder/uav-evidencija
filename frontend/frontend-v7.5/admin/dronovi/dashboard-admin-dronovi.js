document.addEventListener('DOMContentLoaded', async () => {

    const grid = document.getElementById('droneGrid');
    const emptyState = document.getElementById('droneEmptyState');
    const searchInput = document.getElementById('droneSearchInput');
    const statusFilter = document.getElementById('droneStatusFilter');
    const modelFilter = document.getElementById('droneModelFilter');

    // ===== ESCAPE HELPER (sprječava XSS - podaci o dronu dolaze sa servera/od korisnika) =====
    // Zajednička implementacija iz shared/snimci-utils.js (učitano prije ove skripte).
    const escapeHtml = SnimciUtils.escapeHtml;

    // ===== BADGE HELPER =====
    function badgeHtml(status) {
        const map = { aktivan: 'status-enabled', servis: 'service', neaktivan: 'offline' };
        const label = { aktivan: 'Aktivan', servis: 'U servisu', neaktivan: 'Offline' };
        const cls = map[status] || 'offline';
        return `<span class="badge ${cls}">${label[status] || status}</span>`;
    }

    // ===== FOTOGRAFIJA DRONA =====
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

    // ===== RENDEROVANJE KARTICE =====
    function renderCard(d) {
        const card = document.createElement('div');
        card.className = 'drone-card' + (d.status === 'neaktivan' ? ' offline' : '');
        card.dataset.status = d.status;
        card.dataset.model = d.manufacturer || '';
        card.dataset.name = d.name;
        card.dataset.id = d.id;
        card.dataset.modelFull = d.model;
        card.dataset.manufacturer = d.manufacturer;
        card.dataset.serial = d.serialNumber;
        card.dataset.operator = d.operatorId || '';
        card.dataset.operatorName = d.operatorName || '';
        card.dataset.notes = d.notes || '';

        const photo = firstImage(d);

        card.innerHTML = `
            <div class="drone-photo">
                ${photoHtml(photo, d)}
                <div class="drone-photo-actions">
                    <button class="icon-btn docs-btn" title="Fotografije, snimci i dokumentacija" aria-label="Fotografije, snimci i dokumentacija">📎</button>
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
                    <div class="row-actions">
                        <button class="icon-btn edit-btn" title="Izmijeni" aria-label="Izmijeni">✎</button>
                        <button class="icon-btn danger delete-btn" title="Obriši" aria-label="Obriši">🗑</button>
                    </div>
                </div>
            </div>`;

        // Dokumentacija (fotografije/video/tehnička dokumentacija letjelice)
        card.querySelector('.docs-btn').addEventListener('click', () => {
            window.DroneDocsModal.open(d, 'admin');
        });

        // Izmijeni - forma za izmjenu učitava svjež podatak sa servera po ID-u (vidi
        // izvještaj testiranja, nalaz #10), a ne zastarjeli "snapshot" sa ove liste.
        card.querySelector('.edit-btn').addEventListener('click', () => {
            window.location.href = '../izmijeni-dron/dashboard-admin-izmijeni-dron.html?id=' + d.id;
        });

        // Obriši
        card.querySelector('.delete-btn').addEventListener('click', () => {
            openDeleteModal(d.id, d.name, card);
        });

        return card;
    }

    // ===== UCITAVANJE DRONOVA SA API =====
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
        const model = modelFilter.value;

        const filtered = allDrones.filter(d => {
            const matchesQuery = !query || d.name.toLowerCase().includes(query) || d.serialNumber.toLowerCase().includes(query);
            const matchesStatus = !status || d.status === status;
            const matchesModel = !model || (d.manufacturer || '').toLowerCase().includes(model.toLowerCase());
            return matchesQuery && matchesStatus && matchesModel;
        });

        if (filtered.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            filtered.forEach(d => grid.appendChild(renderCard(d)));
        }
    }

    searchInput.addEventListener('input', renderGrid);
    statusFilter.addEventListener('change', renderGrid);
    modelFilter.addEventListener('change', renderGrid);

    // ===== BRISANJE =====
    const deleteModal = document.getElementById('deleteModal');
    const deleteDroneName = document.getElementById('deleteDroneName');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    let pendingDeleteId = null;
    let pendingDeleteCard = null;

    function openDeleteModal(id, name, card) {
        pendingDeleteId = id;
        pendingDeleteCard = card;
        deleteDroneName.textContent = name;
        deleteModal.classList.add('open');
    }

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.remove('open');
        pendingDeleteId = null;
        pendingDeleteCard = null;
    });

    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) cancelDeleteBtn.click();
    });

    async function deleteDrone(id, potvrdi) {
        const query = potvrdi ? '?potvrdi=true' : '';
        return apiFetch(`/dronovi/${id}${query}`, { method: 'DELETE' });
    }

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!pendingDeleteId) return;
        try {
            await deleteDrone(pendingDeleteId, false);
            pendingDeleteCard.remove();
            allDrones = allDrones.filter(d => d.id !== pendingDeleteId);
        } catch (err) {
            if (err.status === 409) {
                // Dron ima povezane letove - traži se eksplicitna dodatna potvrda
                // jer brisanje kaskadno briše i te letove i njihove snimke.
                const potvrdjeno = confirm(err.message + '\n\nOvo se ne može poništiti. Nastaviti?');
                if (potvrdjeno) {
                    try {
                        await deleteDrone(pendingDeleteId, true);
                        pendingDeleteCard.remove();
                        allDrones = allDrones.filter(d => d.id !== pendingDeleteId);
                    } catch (err2) {
                        alert('Greška pri brisanju: ' + err2.message);
                    }
                }
            } else {
                alert('Greška pri brisanju: ' + err.message);
            }
        } finally {
            deleteModal.classList.remove('open');
            pendingDeleteId = null;
            pendingDeleteCard = null;
        }
    });

    await loadDrones();
});
