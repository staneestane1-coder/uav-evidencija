document.addEventListener('DOMContentLoaded', async () => {

    const tableBody = document.getElementById('letoviBody');
    const resultCount = document.getElementById('resultCount');
    const emptyState = document.getElementById('emptyState');
    const filterStatus = document.getElementById('filterStatus');
    const filterDrone = document.getElementById('filterDrone');
    const filterSearch = document.getElementById('filterSearch');

    // STATUS_LABELS/STATUS_BADGE/formatDateTime/escapeHtml: zajednička implementacija iz
    // shared/snimci-utils.js (učitano prije ove skripte).
    const STATUS_LABELS = SnimciUtils.STATUS_LABELS;
    const STATUS_BADGE = SnimciUtils.STATUS_BADGE;
    const formatDateTime = SnimciUtils.formatDateTime;
    const escapeHtml = SnimciUtils.escapeHtml;

    // Operater sam vodi svoj let kroz stanja (Zadatak 3) - uske, jednosmjerne tranzicije,
    // isti princip kao Odobri/Odbij kod kontrole. Svaka akcija se potvrđuje kroz confirm()
    // (isti obrazac kao brisanje na admin stranicama).
    const ACTION_CONFIG = {
        pokreni: { confirmMsg: 'Pokrenuti ovaj let?', busyText: 'Pokretanje…' },
        zavrsi: { confirmMsg: 'Označiti ovaj let kao završen?', busyText: 'Označavanje…' },
        otkazi: { confirmMsg: 'Otkazati ovaj let? Ova akcija se ne može poništiti.', busyText: 'Otkazivanje…' }
    };

    let allFlights = [];

    async function loadFlights() {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#7a9bbf;">Učitavanje...</td></tr>';
        try {
            allFlights = await apiFetch('/letovi');

            // Dinamički popuni filter za dronove
            const allDroneNames = new Set();
            allFlights.forEach(f => { if (f.droneName) allDroneNames.add(f.droneName); });
            filterDrone.innerHTML = '<option value="svi">Svi dronovi</option>';
            allDroneNames.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                filterDrone.appendChild(opt);
            });

            renderFlights();
        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#e15b5b;">Greška: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    function renderFlights() {
        const status = filterStatus.value;
        const drone = filterDrone.value;
        const search = filterSearch.value.trim().toLowerCase();

        const filtered = allFlights.filter(f => {
            const matchesStatus = status === 'svi' || f.status === status;
            const matchesDrone = drone === 'svi' || f.droneName === drone;
            const matchesSearch = !search || (f.location || '').toLowerCase().includes(search);
            return matchesStatus && matchesDrone && matchesSearch;
        });

        tableBody.innerHTML = '';
        resultCount.textContent = filtered.length + ' / ' + allFlights.length + ' letova';
        emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

        filtered.forEach(f => {
            const tr = buildRow(f);
            tableBody.appendChild(tr);
            // Upozorenje mora biti UOČLJIVO, ne samo tiho polje u tabeli - istaknut alert
            // red se umeće ODMAH ispod leta na koji se odnosi (samo dok nije potvrđeno).
            if (f.warning && !f.warningAcknowledged) {
                tableBody.appendChild(buildWarningRow(f, tr));
            }
            // Isti obrazac za odbijanje (Zadatak 4) - poseban alert red, nezavisan od
            // upozorenja (let može teoretski imati oba, iz ranijih prijava/pokušaja).
            if (f.status === 'odbijen' && !f.rejectionAcknowledged) {
                tableBody.appendChild(buildRejectionRow(f, tr));
            }
        });
    }

    function buildRow(f) {
        const tr = document.createElement('tr');
        tr.dataset.status = f.status;
        tr.dataset.drone = f.droneName || '';
        // <button>, ne <span> - fokusabilno tastaturom (Tab + Enter/Space otvara title
        // tooltip preko browsera), za razliku od span-a koji miš-only korisnik ne bi
        // mogao doseći bez hovera.
        const rejectionTooltip = (f.status === 'odbijen' && f.rejectionReason)
            ? `<button type="button" class="reason-hint" title="${escapeHtml(f.rejectionReason)}" aria-label="Razlog odbijanja: ${escapeHtml(f.rejectionReason)}">ⓘ</button>`
            : '';
        tr.innerHTML = `
            <td>${escapeHtml(f.droneName || '—')}</td>
            <td>${escapeHtml(f.location || '—')}</td>
            <td><span class="badge ${STATUS_BADGE[f.status] || ''}">${STATUS_LABELS[f.status] || f.status}</span> ${rejectionTooltip}</td>
            <td>${f.durationMinutes ? f.durationMinutes + ' min' : '—'}</td>
            <td class="row-time">${formatDateTime(f.flightDateTime)}</td>
            <td class="row-action">${buildActionButtons(f)}</td>
        `;

        wireActionButtons(f, tr);

        return tr;
    }

    // planiran -> "Pokreni let" i "Otkaži let" (dva dugmeta); u-letu -> "Označi kao završen";
    // na-cekanju -> samo "Otkaži let". zavrsen/odbijen/otkazan nemaju akciju - odbijen je
    // potpuno terminalan (operater nad njim nema nikakvu akciju), otkazan i zavrsen su
    // konačna stanja.
    function buildActionButtons(f) {
        const buttons = [];
        if (f.status === 'planiran') {
            buttons.push('<button type="button" class="btn-flight-action btn-flight-start" data-action="pokreni">Pokreni let</button>');
            buttons.push('<button type="button" class="btn-flight-action btn-flight-cancel" data-action="otkazi">Otkaži let</button>');
        } else if (f.status === 'u-letu') {
            buttons.push('<button type="button" class="btn-flight-action btn-flight-finish" data-action="zavrsi">Označi kao završen</button>');
        } else if (f.status === 'na-cekanju') {
            buttons.push('<button type="button" class="btn-flight-action btn-flight-cancel" data-action="otkazi">Otkaži let</button>');
        }
        return buttons.length > 0 ? buttons.join('') : '—';
    }

    function wireActionButtons(f, tr) {
        tr.querySelectorAll('[data-action]').forEach(btn => {
            const config = ACTION_CONFIG[btn.dataset.action];
            if (!config) return;
            btn.addEventListener('click', () => handleTransition(f, tr, btn, btn.dataset.action, config));
        });
    }

    async function handleTransition(f, tr, clickedBtn, action, config) {
        if (!confirm(config.confirmMsg)) return;

        const buttons = tr.querySelectorAll('[data-action]');
        buttons.forEach(b => b.disabled = true);
        const originalText = clickedBtn.textContent;
        clickedBtn.textContent = config.busyText;

        try {
            const updated = await apiFetch('/letovi/' + f.id + '/' + action, { method: 'PUT' });
            const idx = allFlights.findIndex(x => x.id === f.id);
            if (idx !== -1) allFlights[idx] = updated;
            // Puni re-render (ne samo zamjena reda) - tranzicija mijenja i dostupne akcije i
            // eventualno prisustvo upozorenja ispod reda, jednostavnije je ponovo izgraditi.
            renderFlights();
        } catch (err) {
            alert('Greška: ' + err.message);
            buttons.forEach(b => b.disabled = false);
            clickedBtn.textContent = originalText;
        }
    }

    function buildWarningRow(f, flightRow) {
        const warningRow = document.createElement('tr');
        warningRow.className = 'flight-warning-row';
        warningRow.innerHTML = `
            <td colspan="6">
                <div class="flight-warning-alert">
                    <span class="flight-warning-text">⚠ <strong>Upozorenje od kontrole:</strong> ${escapeHtml(f.warning)}</span>
                    <button type="button" class="btn-ack-warning" data-action="ack">Potvrđujem da sam pročitao</button>
                </div>
            </td>
        `;

        warningRow.querySelector('[data-action="ack"]').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = 'Potvrđivanje…';
            try {
                const updated = await apiFetch('/letovi/' + f.id + '/potvrdi-upozorenje', { method: 'PUT' });
                const idx = allFlights.findIndex(x => x.id === f.id);
                if (idx !== -1) allFlights[idx] = updated;
                warningRow.remove();
            } catch (err) {
                alert('Greška pri potvrđivanju upozorenja: ' + err.message);
                btn.disabled = false;
                btn.textContent = 'Potvrđujem da sam pročitao';
            }
        });

        return warningRow;
    }

    // Isti vizuelni obrazac kao buildWarningRow iznad (Zadatak 2) - reuse-uje iste CSS klase
    // (.flight-warning-row/.flight-warning-alert/.btn-ack-warning). Razlog odbijanja je
    // OPCION (kontrola i dalje može odbiti bez razloga) - alert ne smije ostati bez teksta u
    // tom slučaju, pa se eksplicitno ispisuje da razlog nije naveden.
    function buildRejectionRow(f, flightRow) {
        const rejectionRow = document.createElement('tr');
        rejectionRow.className = 'flight-warning-row';
        const reasonText = f.rejectionReason
            ? `Razlog: ${escapeHtml(f.rejectionReason)}`
            : 'Kontrola nije navela razlog.';
        rejectionRow.innerHTML = `
            <td colspan="6">
                <div class="flight-warning-alert">
                    <span class="flight-warning-text">✕ <strong>Kontrola je odbila ovaj let.</strong> ${reasonText}</span>
                    <button type="button" class="btn-ack-warning" data-action="ack-rejection">Potvrđujem da sam pročitao</button>
                </div>
            </td>
        `;

        rejectionRow.querySelector('[data-action="ack-rejection"]').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = 'Potvrđivanje…';
            try {
                const updated = await apiFetch('/letovi/' + f.id + '/potvrdi-odbijanje', { method: 'PUT' });
                const idx = allFlights.findIndex(x => x.id === f.id);
                if (idx !== -1) allFlights[idx] = updated;
                rejectionRow.remove();
            } catch (err) {
                alert('Greška pri potvrđivanju odbijanja: ' + err.message);
                btn.disabled = false;
                btn.textContent = 'Potvrđujem da sam pročitao';
            }
        });

        return rejectionRow;
    }

    filterStatus.addEventListener('change', renderFlights);
    filterDrone.addEventListener('change', renderFlights);
    filterSearch.addEventListener('input', renderFlights);

    await loadFlights();
});
