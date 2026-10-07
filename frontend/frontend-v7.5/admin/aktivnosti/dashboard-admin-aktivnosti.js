document.addEventListener('DOMContentLoaded', async () => {

    const searchInput = document.getElementById('activitySearchInput');
    const typeFilter = document.getElementById('activityTypeFilter');
    const statusFilter = document.getElementById('activityStatusFilter');
    const tableBody = document.getElementById('activitiesTableBody');
    const emptyState = document.getElementById('activitiesEmptyState');

    const STATUS_BADGE = { uspjesno: 'success', novo: 'info', upozorenje: 'warning', greska: 'danger' };
    const STATUS_LABELS = { uspjesno: 'Uspješno', novo: 'Informacija', upozorenje: 'Upozorenje', greska: 'Greška' };

    // formatDateTime/escapeHtml: zajednička implementacija iz shared/snimci-utils.js
    // (učitano prije ove skripte - vidi <script> u dashboard-admin-aktivnosti.html).
    const formatDateTime = SnimciUtils.formatDateTime;
    const escapeHtml = SnimciUtils.escapeHtml;

    let allActivities = [];

    function renderRows() {
        tableBody.innerHTML = '';

        allActivities.forEach(a => {
            const tr = document.createElement('tr');
            tr.dataset.type = a.activityType;
            tr.dataset.status = a.status;
            tr.innerHTML = `
                <td>${escapeHtml(a.actorName)}</td>
                <td>${escapeHtml(a.description)}</td>
                <td>${escapeHtml(a.relatedEntity || '—')}</td>
                <td><span class="badge ${STATUS_BADGE[a.status] || 'info'}">${STATUS_LABELS[a.status] || a.status}</span></td>
                <td class="row-time">${formatDateTime(a.timestamp)}</td>
            `;
            tableBody.appendChild(tr);
        });

        filterActivities();
    }

    function filterActivities() {
        const query = searchInput.value.trim().toLowerCase();
        const type = typeFilter.value;
        const status = statusFilter.value;
        let visibleCount = 0;

        tableBody.querySelectorAll('tr').forEach(row => {
            const text = row.textContent.toLowerCase();
            const rowType = row.dataset.type || '';
            const rowStatus = row.dataset.status || '';

            const matchesQuery = query === '' || text.includes(query);
            const matchesType = type === '' || rowType === type;
            const matchesStatus = status === '' || rowStatus === status;

            const visible = matchesQuery && matchesType && matchesStatus;
            row.style.display = visible ? '' : 'none';
            if (visible) visibleCount++;
        });

        emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    }

    searchInput.addEventListener('input', filterActivities);
    typeFilter.addEventListener('change', filterActivities);
    statusFilter.addEventListener('change', filterActivities);

    // Čišćenje fajlova na disku koji više nemaju odgovarajući red u bazi (npr. ostali poslije
    // ranijih brisanja letova/dronova prije nego je to popravljeno - vidi izvještaj testiranja,
    // nalazi #1 i #15).
    const btnOcisti = document.getElementById('btnOcistiFajlove');
    if (btnOcisti) {
        btnOcisti.addEventListener('click', async () => {
            if (!confirm('Ovo će trajno obrisati sve fajlove na disku koji više nisu povezani ni sa jednim snimkom u bazi. Nastaviti?')) return;

            btnOcisti.disabled = true;
            const originalText = btnOcisti.textContent;
            btnOcisti.textContent = 'Čišćenje...';

            try {
                const result = await apiFetch('/odrzavanje/ocisti-fajlove', { method: 'POST' });
                const mb = (result.oslobodjenoBajtova / 1024 / 1024).toFixed(1);
                alert(`Obrisano ${result.obrisanoFajlova} fajlova, oslobođeno ${mb} MB.`);
                allActivities = await apiFetch('/aktivnosti');
                renderRows();
            } catch (err) {
                alert('Greška pri čišćenju: ' + err.message);
            } finally {
                btnOcisti.disabled = false;
                btnOcisti.textContent = originalText;
            }
        });
    }

    try {
        allActivities = await apiFetch('/aktivnosti');
        renderRows();
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#ff6b6b;">Greška: ${escapeHtml(err.message)}</td></tr>`;
    }
});
