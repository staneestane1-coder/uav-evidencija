document.addEventListener('DOMContentLoaded', async () => {

    const tableBody = document.getElementById('letoviBody');
    const resultCount = document.getElementById('resultCount');
    const emptyState = document.getElementById('emptyState');
    const filterOperater = document.getElementById('filterOperater');
    const filterDrone = document.getElementById('filterDrone');
    const filterStatus = document.getElementById('filterStatus');
    const filterSearch = document.getElementById('filterSearch');

    // STATUS_LABELS/STATUS_BADGE/formatDateTime/escapeHtml: zajednička implementacija iz
    // shared/snimci-utils.js (učitano prije ove skripte).
    const STATUS_LABELS = SnimciUtils.STATUS_LABELS;
    const STATUS_BADGE = SnimciUtils.STATUS_BADGE;
    const formatDateTime = SnimciUtils.formatDateTime;
    const escapeHtml = SnimciUtils.escapeHtml;

    let allFlights = [];

    async function loadFlights() {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#7a9bbf;">Učitavanje...</td></tr>';
        try {
            allFlights = await apiFetch('/letovi');

            // Dinamički popuni filtere
            const operateri = [...new Set(allFlights.map(f => f.operatorName).filter(Boolean))];
            filterOperater.innerHTML = '<option value="svi">Svi operateri</option>';
            operateri.forEach(op => {
                const opt = document.createElement('option');
                opt.value = op;
                opt.textContent = op;
                filterOperater.appendChild(opt);
            });

            const dronovi = [...new Set(allFlights.map(f => f.droneName).filter(Boolean))];
            filterDrone.innerHTML = '<option value="svi">Svi dronovi</option>';
            dronovi.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                filterDrone.appendChild(opt);
            });

            renderFlights();
        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#e15b5b;">Greška: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    function renderFlights() {
        const operater = filterOperater.value;
        const drone = filterDrone.value;
        const status = filterStatus.value;
        const search = filterSearch.value.trim().toLowerCase();

        const filtered = allFlights.filter(f => {
            const matchesOperater = operater === 'svi' || f.operatorName === operater;
            const matchesDrone = drone === 'svi' || f.droneName === drone;
            const matchesStatus = status === 'svi' || f.status === status;
            const matchesSearch = !search || (f.location || '').toLowerCase().includes(search);
            return matchesOperater && matchesDrone && matchesStatus && matchesSearch;
        });

        tableBody.innerHTML = '';
        resultCount.textContent = filtered.length + ' / ' + allFlights.length + ' letova';
        emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

        filtered.forEach(f => tableBody.appendChild(buildRow(f)));
    }

    function buildRow(f) {
        const tr = document.createElement('tr');
        tr.dataset.status = f.status;
        tr.dataset.operater = f.operatorName || '';
        tr.dataset.drone = f.droneName || '';
        tr.innerHTML = `
            <td>${escapeHtml(f.operatorName || '—')}</td>
            <td>${escapeHtml(f.droneName || '—')}</td>
            <td>${escapeHtml(f.location || '—')}</td>
            <td><span class="badge ${STATUS_BADGE[f.status] || ''}">${STATUS_LABELS[f.status] || f.status}</span></td>
            <td>${f.durationMinutes ? f.durationMinutes + ' min' : '—'}</td>
            <td class="row-time">${formatDateTime(f.flightDateTime)}</td>
            <td class="row-action">${buildActionCell(f)}</td>
        `;

        // Let mora biti "u-letu" da bi se upozorenje uopšte moglo poslati (isto pravilo kao
        // na backendu - LetoviController.PosaljiUpozorenje) - za ostale statuse nema dugmeta.
        if (f.status === 'u-letu') {
            const warnBtn = tr.querySelector('[data-action="warn"]');
            if (warnBtn) warnBtn.addEventListener('click', () => toggleWarningRow(f, tr));
        }

        return tr;
    }

    function buildActionCell(f) {
        if (f.status !== 'u-letu') return '—';

        // Ako let već ima aktivno (nepotvrđeno) upozorenje, prikaži to vizuelno (badge) da
        // kontrola zna da ne šalje duplo bez potrebe - slanje novog upozorenja ostaje
        // dozvoljeno (prepisuje staro), samo dugme mijenja tekst.
        const hasActiveWarning = !!f.warning && !f.warningAcknowledged;
        const badge = hasActiveWarning
            ? '<span class="badge warning" title="Upozorenje poslano, čeka potvrdu operatera">⚠ Čeka potvrdu</span> '
            : '';
        const btnLabel = hasActiveWarning ? 'Pošalji novo upozorenje' : 'Pošalji upozorenje';

        return `${badge}<button type="button" class="btn-reject" data-action="warn">${btnLabel}</button>`;
    }

    // Klik na "Pošalji upozorenje" otvara red ispod sa OBAVEZNIM poljem za tekst poruke -
    // isti UI pattern kao inline razlog odbijanja na "Letovi na čekanju" (reject-reason-row),
    // ali dugme za slanje je disabled dok je input prazan (poruka je obavezna, za razliku
    // od razloga odbijanja koji je opcion). Samo jedan otvoren odjednom.
    function toggleWarningRow(f, tr) {
        const existing = tr.nextElementSibling;
        if (existing && existing.classList.contains('reject-reason-row')) {
            closeWarningRow(tr, existing);
            return;
        }

        document.querySelectorAll('.reject-reason-row').forEach(el => {
            const ownerRow = el.previousElementSibling;
            if (ownerRow) closeWarningRow(ownerRow, el);
        });

        const warnBtn = tr.querySelector('[data-action="warn"]');
        warnBtn.disabled = true;

        const warningRow = document.createElement('tr');
        warningRow.className = 'reject-reason-row';
        warningRow.innerHTML = `
            <td colspan="7">
                <div class="reject-reason-box">
                    <textarea placeholder="Poruka upozorenja (obavezno) - npr. „Spustite dron, ulazite u zabranjenu zonu”" required></textarea>
                    <div class="reject-reason-actions">
                        <button type="button" class="btn-cancel" data-action="cancel">Otkaži</button>
                        <button type="button" class="btn-danger" data-action="confirm" disabled>Pošalji upozorenje</button>
                    </div>
                </div>
            </td>
        `;
        tr.after(warningRow);

        const textarea = warningRow.querySelector('textarea');
        const confirmBtn = warningRow.querySelector('[data-action="confirm"]');
        textarea.focus();
        textarea.addEventListener('input', () => {
            confirmBtn.disabled = !textarea.value.trim();
        });

        warningRow.querySelector('[data-action="cancel"]').addEventListener('click', () => closeWarningRow(tr, warningRow));
        confirmBtn.addEventListener('click', (e) => {
            const poruka = textarea.value.trim();
            if (!poruka) return;
            handleSendWarning(f, tr, warningRow, poruka, e.currentTarget);
        });
    }

    function closeWarningRow(tr, warningRow) {
        warningRow.remove();
        const warnBtn = tr.querySelector('[data-action="warn"]');
        if (warnBtn) warnBtn.disabled = false;
    }

    async function handleSendWarning(f, tr, warningRow, poruka, clickedBtn) {
        const buttons = warningRow.querySelectorAll('button');
        buttons.forEach(b => b.disabled = true);
        const originalText = clickedBtn.textContent;
        clickedBtn.textContent = 'Šalje se…';

        try {
            const updated = await apiFetch('/letovi/' + f.id + '/upozorenje', {
                method: 'PUT',
                body: JSON.stringify({ poruka })
            });
            warningRow.remove();
            const idx = allFlights.findIndex(x => x.id === f.id);
            if (idx !== -1) allFlights[idx] = updated;
            const newRow = buildRow(updated);
            tr.replaceWith(newRow);
        } catch (err) {
            alert('Greška pri slanju upozorenja: ' + err.message);
            buttons.forEach(b => b.disabled = false);
            clickedBtn.textContent = originalText;
        }
    }

    filterOperater.addEventListener('change', renderFlights);
    filterDrone.addEventListener('change', renderFlights);
    filterStatus.addEventListener('change', renderFlights);
    filterSearch.addEventListener('input', renderFlights);

    await loadFlights();
});
