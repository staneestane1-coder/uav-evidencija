document.addEventListener('DOMContentLoaded', async () => {

    const grid = document.getElementById('snimciGrid');
    const emptyState = document.getElementById('snimciEmptyState');
    const searchInput = document.getElementById('snimciSearchInput');
    const droneFilter = document.getElementById('snimciDroneFilter');

    const { STATUS_BADGE, STATUS_LABELS, formatDate, formatTime, escapeHtml, debounce, moglaSeDogoditi } = SnimciUtils;

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

    // ===== RENDEROVANJE KARTICE =====
    function renderCard(flight) {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.letId = flight.id;
        card.dataset.lokacija = flight.location || '';
        card.dataset.dron = flight.droneName || '';

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
                    <button type="button" class="mc-add-btn">＋ Dodaj snimak</button>
                </div>
            </div>`;

        const bodyContent = card.querySelector('.media-body-content');
        const countLabel = card.querySelector('.row-time');

        const mc = MediaCarousel.build(flight.mediaFiles, {
            onCountChange: (count) => { countLabel.textContent = count + ' snimak(a)'; }
        });
        bodyContent.appendChild(mc.el);

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

        return card;
    }

    // ===== UCITAVANJE =====
    let allFlights = [];

    async function loadFlights() {
        grid.innerHTML = '<p style="color:#7a9bbf;padding:24px;">Učitavanje...</p>';
        try {
            // API automatski vraca samo letove ovog operatera. Prikazuju se samo letovi koji
            // su se desili ili su u toku (zavrsen/u-letu) - planiran/na-cekanju/odbijen let se
            // nije (ni mogao) desiti, pa nema šta da se snimi/uploaduje za njega.
            allFlights = (await apiFetch('/letovi')).filter(moglaSeDogoditi);

            // Dinamicki popuni filter dronova
            const dronovi = [...new Set(allFlights.map(f => f.droneName).filter(Boolean))];
            droneFilter.innerHTML = '<option value="">Svi dronovi</option>';
            dronovi.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                droneFilter.appendChild(opt);
            });

            renderGrid();
        } catch (err) {
            grid.innerHTML = `<p class="state-error" style="padding:24px;">Greška: ${escapeHtml(err.message)}</p>`;
        }
    }

    function renderGrid() {
        grid.innerHTML = '';
        const query = searchInput.value.trim().toLowerCase();
        const drone = droneFilter.value;

        const filtered = allFlights.filter(f => {
            const matchesQuery = !query ||
                (f.location || '').toLowerCase().includes(query) ||
                (f.droneName || '').toLowerCase().includes(query);
            const matchesDrone = !drone || f.droneName === drone;
            return matchesQuery && matchesDrone;
        });

        emptyState.style.display = filtered.length === 0 ? 'block' : 'none';
        filtered.forEach(f => grid.appendChild(renderCard(f)));
    }

    searchInput.addEventListener('input', debounce(renderGrid, 200));
    droneFilter.addEventListener('change', renderGrid);

    await loadFlights();
});
