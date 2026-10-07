document.addEventListener('DOMContentLoaded', async () => {

    const grid = document.getElementById('snimciGrid');
    const emptyState = document.getElementById('snimciEmptyState');
    const searchInput = document.getElementById('snimciSearchInput');
    const operaterFilter = document.getElementById('snimciOperaterFilter');

    const { STATUS_BADGE, STATUS_LABELS, formatDate, formatTime, escapeHtml, debounce, moglaSeDogoditi } = SnimciUtils;
    let allFlights = [];

    // ===== UPLOAD NA BACKEND =====
    async function handleUpload(files, flightId, mc) {
        const fileArray = Array.from(files);
        if (!fileArray.length) return;

        const formData = new FormData();
        fileArray.forEach(f => formData.append('files', f));

        try {
            const saved = await apiFetch('/snimci/' + flightId, { method: 'POST', body: formData });
            mc.addItems(saved);
        } catch (err) {
            alert('Greška pri otpremanju: ' + err.message);
        }
    }

    // ===== BRISANJE POJEDINACNOG SNIMKA =====
    async function deleteMedia(mediaId, onSuccess) {
        if (!confirm('Obrisati ovaj snimak?')) return;
        try {
            await apiFetch('/snimci/' + mediaId, { method: 'DELETE' });
            onSuccess();
        } catch (err) {
            alert('Greška pri brisanju: ' + err.message);
        }
    }

    // ===== RENDEROVANJE KARTICE =====
    function renderCard(flight) {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.letId = flight.id;
        card.dataset.lokacija = flight.location || '';
        card.dataset.dron = flight.droneName || '';
        card.dataset.operater = flight.operatorName || '';

        card.innerHTML = `
            <div class="media-card-header">
                <div class="media-card-title">
                    <div class="media-icon-lg">🎬</div>
                    <div>
                        <h3>${escapeHtml(flight.location || '—')}</h3>
                    </div>
                </div>
                <span class="badge ${STATUS_BADGE[flight.status] || ''}">${STATUS_LABELS[flight.status] || flight.status}</span>
            </div>
            <div class="media-card-body">
                <div class="media-meta-row">
                    <div class="media-meta"><span class="media-meta-label">Operater</span><span class="media-meta-value">${escapeHtml(flight.operatorName || '—')}</span></div>
                    <div class="media-meta"><span class="media-meta-label">Datum leta</span><span class="media-meta-value">${formatDate(flight.flightDateTime)}</span></div>
                    <div class="media-meta"><span class="media-meta-label">Dron</span><span class="media-meta-value">${escapeHtml(flight.droneName || '—')}</span></div>
                    <div class="media-meta"><span class="media-meta-label">Vrijeme leta</span><span class="media-meta-value">${formatTime(flight.flightDateTime)}</span></div>
                </div>
                <div class="doc-section">
                    <div class="doc-section-title">Fotografije i video zapisi</div>
                    <div class="media-body-content"></div>
                </div>
                <div class="media-card-footer">
                    <span class="row-time"></span>
                    <div class="row-actions">
                        <button type="button" class="mc-add-btn">＋ Dodaj snimak</button>
                        <button class="icon-btn danger delete-card-btn" title="Obriši cijeli let i snimke" aria-label="Obriši cijeli let i snimke">🗑</button>
                    </div>
                </div>
            </div>`;

        const countLabel = card.querySelector('.row-time');
        const mc = MediaCarousel.build(flight.mediaFiles, {
            onDelete: (mediaId, onSuccess) => deleteMedia(mediaId, onSuccess),
            onCountChange: (count) => { countLabel.textContent = count + ' snimak(a)'; }
        });
        card.querySelector('.media-body-content').appendChild(mc.el);

        const input = document.createElement('input');
        input.type = 'file';
        input.className = 'upload-input';
        input.accept = 'image/*,video/*';
        input.multiple = true;
        input.style.display = 'none';
        input.addEventListener('change', () => {
            handleUpload(input.files, flight.id, mc);
            input.value = '';
        });
        card.appendChild(input);

        card.querySelector('.mc-add-btn').addEventListener('click', () => input.click());
        MediaCarousel.wireDropZone(card, (files) => handleUpload(files, flight.id, mc));

        card.querySelector('.delete-card-btn').addEventListener('click', () => {
            openDeleteConfirm(flight.id, flight.location, flight.operatorName, card);
        });

        return card;
    }

    // ===== UCITAVANJE LETOVA =====
    async function loadFlights() {
        grid.innerHTML = '<p style="color:#7a9bbf;padding:24px;">Učitavanje...</p>';
        try {
            // Admin ovdje stvarno moze dodati/obrisati snimke (vidi page-header - "dodavanje,
            // uređivanje i brisanje"), za razliku od kontrola/snimci koja je iskljucivo pregled
            // - zato isti filter kao operater/snimci (zavrsen/u-letu, i sa 0 snimaka), ne
            // imaSnimke(): admin bi inace izgubio jedini nacin da doda PRVI snimak letu.
            allFlights = (await apiFetch('/letovi')).filter(moglaSeDogoditi);

            // Popuni filter operatera dinamicki
            const operateri = [...new Set(allFlights.map(f => f.operatorName).filter(Boolean))];
            operaterFilter.innerHTML = '<option value="">Svi operateri</option>';
            operateri.forEach(op => {
                const opt = document.createElement('option');
                opt.value = op;
                opt.textContent = op;
                operaterFilter.appendChild(opt);
            });

            renderGrid();
        } catch (err) {
            grid.innerHTML = `<p class="state-error" style="padding:24px;">Greška: ${escapeHtml(err.message)}</p>`;
        }
    }

    function renderGrid() {
        grid.innerHTML = '';
        const query = searchInput.value.trim().toLowerCase();
        const operater = operaterFilter.value;

        const filtered = allFlights.filter(f => {
            const matchesQuery = !query ||
                (f.location || '').toLowerCase().includes(query) ||
                (f.droneName || '').toLowerCase().includes(query) ||
                (f.operatorName || '').toLowerCase().includes(query);
            const matchesOperater = !operater || f.operatorName === operater;
            return matchesQuery && matchesOperater;
        });

        emptyState.style.display = filtered.length === 0 ? 'block' : 'none';
        filtered.forEach(f => grid.appendChild(renderCard(f)));
    }

    searchInput.addEventListener('input', debounce(renderGrid, 200));
    operaterFilter.addEventListener('change', renderGrid);

    // ===== BRISANJE CIJELOG ZAPISA =====
    const deleteConfirm = document.getElementById('deleteConfirm');
    const deleteConfirmName = document.getElementById('deleteConfirmName');
    const deleteConfirmCancel = document.getElementById('deleteConfirmCancel');
    const deleteConfirmOk = document.getElementById('deleteConfirmOk');
    let pendingDeleteId = null;
    let pendingDeleteCard = null;

    function openDeleteConfirm(id, lokacija, operater, card) {
        pendingDeleteId = id;
        pendingDeleteCard = card;
        deleteConfirmName.textContent = (lokacija || '—') + ' — ' + (operater || '');
        deleteConfirm.classList.add('open');
    }

    deleteConfirmCancel.addEventListener('click', () => {
        deleteConfirm.classList.remove('open');
        pendingDeleteId = null;
        pendingDeleteCard = null;
    });

    deleteConfirmOk.addEventListener('click', async () => {
        if (!pendingDeleteId) return;
        try {
            await apiFetch('/letovi/' + pendingDeleteId, { method: 'DELETE' });
            pendingDeleteCard.remove();
            allFlights = allFlights.filter(f => f.id !== pendingDeleteId);
        } catch (err) {
            alert('Greška pri brisanju: ' + err.message);
        } finally {
            deleteConfirm.classList.remove('open');
            pendingDeleteId = null;
            pendingDeleteCard = null;
        }
    });

    // Dugme dodaj snimak – skroluje do prve upload zone
    const btnDodajSnimak = document.getElementById('btnDodajSnimak');
    if (btnDodajSnimak) {
        btnDodajSnimak.addEventListener('click', () => {
            const firstUpload = document.querySelector('.upload-input');
            if (firstUpload) {
                firstUpload.closest('.media-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => firstUpload.click(), 400);
            }
        });
    }

    await loadFlights();
});
