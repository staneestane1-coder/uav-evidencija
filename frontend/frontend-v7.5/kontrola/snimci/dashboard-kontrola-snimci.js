document.addEventListener('DOMContentLoaded', async () => {

    const grid = document.getElementById('snimciGrid');
    const emptyState = document.getElementById('snimciEmptyState');
    const searchInput = document.getElementById('snimciSearchInput');
    const operaterFilter = document.getElementById('snimciOperaterFilter');

    const { STATUS_BADGE, STATUS_LABELS, formatDate, formatTime, escapeHtml, debounce, imaSnimke } = SnimciUtils;

    // Kontrola leta – samo pregled, bez uploada i brisanja
    function buildMediaPreview(mediaFiles) {
        return MediaCarousel.build(mediaFiles).el;
    }

    function renderCard(flight) {
        const card = document.createElement('div');
        card.className = 'media-card';
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
                    <div class="doc-section-title">Fotografije i video zapisi <span style="font-size:11px;color:#3d5a73;">(samo za pregled)</span></div>
                    <div class="media-body-content"></div>
                </div>
                <div class="media-card-footer">
                    <span class="row-time">${flight.mediaFiles.length} snimak(a)</span>
                </div>
            </div>`;

        card.querySelector('.media-body-content').appendChild(buildMediaPreview(flight.mediaFiles));
        return card;
    }

    let allFlights = [];

    async function loadFlights() {
        grid.innerHTML = '<p style="color:#7a9bbf;padding:24px;">Učitavanje...</p>';
        try {
            // Iskljucivo pregledna stranica - prikazuje se let SAMO ako vec ima bar jedan
            // otpremljen snimak (prazna "0 snimak(a)" kartica ovdje nema smisla ni za jedan
            // status, uploada nema na ovoj stranici).
            allFlights = (await apiFetch('/letovi')).filter(imaSnimke);

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

    await loadFlights();
});
