document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('letSearchInput');
    const statusFilter = document.getElementById('letStatusFilter');
    const tableBody = document.getElementById('letoviTableBody');

    // STATUS_LABELS/STATUS_BADGE_CLASS/escapeHtml/formatDateTime: zajednička implementacija
    // iz shared/snimci-utils.js (učitano prije ove skripte).
    const STATUS_LABELS = SnimciUtils.STATUS_LABELS;
    const STATUS_BADGE_CLASS = SnimciUtils.STATUS_BADGE;
    const escapeHtml = SnimciUtils.escapeHtml;
    const formatDateTime = SnimciUtils.formatDateTime;

    let allFlights = [];

    async function loadFlights() {
        try {
            allFlights = await apiFetch('/letovi');
            renderFlights(allFlights);
        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#e15b5b;">Greška pri učitavanju letova: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    function renderFlights(flights) {
        const query = (searchInput.value || '').trim().toLowerCase();
        const status = statusFilter.value;

        const filtered = flights.filter(f => {
            const haystack = (f.operatorName + ' ' + f.droneName + ' ' + (f.location || '')).toLowerCase();
            const matchesQuery = query === '' || haystack.includes(query);
            const matchesStatus = status === '' || f.status === status;
            return matchesQuery && matchesStatus;
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#7a9bbf;">Nema letova koji odgovaraju pretrazi.</td></tr>';
            return;
        }

        tableBody.innerHTML = '';
        filtered.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(f.operatorName)}</td>
                <td>${escapeHtml(f.droneName)}</td>
                <td>${escapeHtml(f.location || '—')}</td>
                <td><span class="badge ${STATUS_BADGE_CLASS[f.status] || ''}">${STATUS_LABELS[f.status] || f.status}</span></td>
                <td class="row-time">${formatDateTime(f.flightDateTime)}</td>
                <td class="row-action">
                    <a href="#" class="edit-link" data-id="${f.id}">Izmijeni</a>
                    <a href="#" class="delete-link" data-id="${f.id}">Obriši</a>
                </td>
            `;
            tr.querySelector('.edit-link').addEventListener('click', (e) => {
                e.preventDefault();
                // Forma za izmjenu učitava svjež podatak sa servera po ID-u (vidi izvještaj
                // testiranja, nalaz #10), a ne zastarjeli "snapshot" sa ove liste.
                window.location.href = '../izmijeni-let/dashboard-admin-izmijeni-let.html?id=' + f.id;
            });
            tr.querySelector('.delete-link').addEventListener('click', async (e) => {
                e.preventDefault();
                if (!confirm('Da li sigurno želite obrisati ovaj let?')) return;
                try {
                    await apiFetch('/letovi/' + f.id, { method: 'DELETE' });
                    allFlights = allFlights.filter(x => x.id !== f.id);
                    renderFlights(allFlights);
                } catch (err) {
                    alert('Greška pri brisanju leta: ' + err.message);
                }
            });
            tableBody.appendChild(tr);
        });
    }

    searchInput.addEventListener('input', () => renderFlights(allFlights));
    statusFilter.addEventListener('change', () => renderFlights(allFlights));

    loadFlights();
});
