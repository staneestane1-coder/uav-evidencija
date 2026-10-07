document.addEventListener('DOMContentLoaded', async () => {

    const tableBody = document.getElementById('letoviBody');
    const resultCount = document.getElementById('resultCount');
    const emptyState = document.getElementById('emptyState');
    const filterSearch = document.getElementById('filterSearch');

    // STATUS_LABELS/STATUS_BADGE/formatDateTime/escapeHtml: zajednička implementacija iz
    // shared/snimci-utils.js (učitano prije ove skripte).
    const STATUS_LABELS = SnimciUtils.STATUS_LABELS;
    const STATUS_BADGE = SnimciUtils.STATUS_BADGE;
    const formatDateTime = SnimciUtils.formatDateTime;
    const escapeHtml = SnimciUtils.escapeHtml;

    // GET /letovi ne podržava filter po statusu na serveru (isti obrazac kao ostale
    // "Letovi" stranice) - filtriranje na "na-cekanju" se radi na klijentu.
    let pendingFlights = [];

    async function loadFlights() {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#7a9bbf;">Učitavanje...</td></tr>';
        try {
            const allFlights = await apiFetch('/letovi');
            pendingFlights = allFlights.filter(f => f.status === 'na-cekanju');
            renderFlights();
        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#e15b5b;">Greška: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    // Puno ponovno crtanje tbody-a - koristi se SAMO kad se mijenja pretraga ili pri
    // početnom učitavanju. Uklanjanje pojedinačnog leta (nakon Odobri/Odbij) NE prolazi
    // kroz ovu funkciju (vidi removeFlightRow ispod) - inače bi svaki put obrisala i
    // eventualni otvoren red za razlog odbijanja NA DRUGOM letu, sa još neposlatim tekstom.
    function renderFlights() {
        const search = filterSearch.value.trim().toLowerCase();
        const filtered = pendingFlights.filter(f => {
            if (!search) return true;
            const haystack = ((f.operatorName || '') + ' ' + (f.droneName || '') + ' ' + (f.location || '')).toLowerCase();
            return haystack.includes(search);
        });

        tableBody.innerHTML = '';
        filtered.forEach(f => tableBody.appendChild(buildRow(f)));
        updateResultCount();
    }

    function updateResultCount() {
        const visible = tableBody.querySelectorAll('.flight-row').length;
        resultCount.textContent = visible + ' / ' + pendingFlights.length + ' zahtjeva';
        emptyState.style.display = visible === 0 ? 'block' : 'none';
    }

    function buildRow(f) {
        const tr = document.createElement('tr');
        tr.className = 'flight-row';
        tr.innerHTML = `
            <td>${escapeHtml(f.operatorName || '—')}</td>
            <td>${escapeHtml(f.droneName || '—')}</td>
            <td>${escapeHtml(f.location || '—')}</td>
            <td><span class="badge ${STATUS_BADGE[f.requestedStatus] || ''}">${STATUS_LABELS[f.requestedStatus] || f.requestedStatus || '—'}</span></td>
            <td class="row-time">${formatDateTime(f.flightDateTime)}</td>
            <td class="row-action">
                <button type="button" class="btn-approve" data-action="approve">Odobri</button>
                <button type="button" class="btn-reject" data-action="reject">Odbij</button>
            </td>
        `;

        tr.querySelector('[data-action="approve"]').addEventListener('click', () => handleApprove(f, tr));
        tr.querySelector('[data-action="reject"]').addEventListener('click', () => toggleRejectRow(f, tr));

        return tr;
    }

    async function handleApprove(f, tr) {
        const approveBtn = tr.querySelector('[data-action="approve"]');
        const rejectBtn = tr.querySelector('[data-action="reject"]');
        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        approveBtn.textContent = 'Šalje se…';

        try {
            await apiFetch('/letovi/' + f.id + '/odobri', { method: 'PUT' });
            removeFlightRow(f, tr);
        } catch (err) {
            alert('Greška pri odobravanju leta: ' + err.message);
            approveBtn.disabled = false;
            rejectBtn.disabled = false;
            approveBtn.textContent = 'Odobri';
        }
    }

    // Klik na "Odbij" otvara red ispod sa poljem za (opcioni) razlog - "Otkaži" ga
    // zatvara bez slanja zahtjeva. Samo jedan otvoren odjednom. Dok je red otvoren,
    // Odobri/Odbij na TOM redu se onemogućavaju (ne samo dugmad unutar otvorenog reda) -
    // inače bi se odobrenje i odbijanje mogli poslati istovremeno za isti let.
    function toggleRejectRow(f, tr) {
        const existing = tr.nextElementSibling;
        if (existing && existing.classList.contains('reject-reason-row')) {
            closeRejectRow(tr, existing);
            return;
        }

        document.querySelectorAll('.reject-reason-row').forEach(el => {
            const ownerRow = el.previousElementSibling;
            if (ownerRow) closeRejectRow(ownerRow, el);
        });

        const approveBtn = tr.querySelector('[data-action="approve"]');
        const rejectBtn = tr.querySelector('[data-action="reject"]');
        approveBtn.disabled = true;
        rejectBtn.disabled = true;

        const reasonRow = document.createElement('tr');
        reasonRow.className = 'reject-reason-row';
        reasonRow.innerHTML = `
            <td colspan="6">
                <div class="reject-reason-box">
                    <textarea placeholder="Razlog odbijanja (opcionalno)"></textarea>
                    <div class="reject-reason-actions">
                        <button type="button" class="btn-cancel" data-action="cancel">Otkaži</button>
                        <button type="button" class="btn-danger" data-action="confirm">Potvrdi odbijanje</button>
                    </div>
                </div>
            </td>
        `;
        tr.after(reasonRow);
        reasonRow.querySelector('textarea').focus();

        reasonRow.querySelector('[data-action="cancel"]').addEventListener('click', () => closeRejectRow(tr, reasonRow));
        reasonRow.querySelector('[data-action="confirm"]').addEventListener('click', (e) => {
            const razlog = reasonRow.querySelector('textarea').value.trim();
            handleReject(f, tr, reasonRow, razlog, e.currentTarget);
        });
    }

    function closeRejectRow(tr, reasonRow) {
        reasonRow.remove();
        tr.querySelector('[data-action="approve"]').disabled = false;
        tr.querySelector('[data-action="reject"]').disabled = false;
    }

    async function handleReject(f, tr, reasonRow, razlog, clickedBtn) {
        const buttons = reasonRow.querySelectorAll('button');
        buttons.forEach(b => b.disabled = true);
        const originalText = clickedBtn.textContent;
        clickedBtn.textContent = 'Šalje se…';

        try {
            await apiFetch('/letovi/' + f.id + '/odbij', {
                method: 'PUT',
                body: JSON.stringify({ razlog: razlog || null })
            });
            reasonRow.remove();
            removeFlightRow(f, tr);
        } catch (err) {
            alert('Greška pri odbijanju leta: ' + err.message);
            buttons.forEach(b => b.disabled = false);
            clickedBtn.textContent = originalText;
        }
    }

    // Optimistic UI - odobren/odbijen zahtjev nestaje iz liste odmah nakon uspješne akcije
    // (backend ga i dalje čuva, samo više nije "na-cekanju"). Uklanja SAMO taj jedan red
    // (ne cijeli tbody - vidi napomenu uz renderFlights) da eventualno otvoren red za
    // razlog odbijanja na DRUGOM letu ostane netaknut.
    function removeFlightRow(f, tr) {
        pendingFlights = pendingFlights.filter(x => x.id !== f.id);
        tr.remove();
        updateResultCount();
    }

    filterSearch.addEventListener('input', renderFlights);

    await loadFlights();
});
