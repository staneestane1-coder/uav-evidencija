document.addEventListener('DOMContentLoaded', async () => {

    const statUsers = document.getElementById('statUsers');
    const statDrones = document.getElementById('statDrones');
    const statFlightsToday = document.getElementById('statFlightsToday');
    const statWarnings = document.getElementById('statWarnings');
    const activityBody = document.getElementById('recentActivityBody');
    const activityEmpty = document.getElementById('recentActivityEmpty');

    const STATUS_BADGE = { uspjesno: 'success', novo: 'info', upozorenje: 'warning', greska: 'danger' };
    const STATUS_LABELS = { uspjesno: 'Uspješno', novo: 'Informacija', upozorenje: 'Upozorenje', greska: 'Greška' };

    // formatDateTime/escapeHtml: zajednička implementacija iz shared/snimci-utils.js
    // (učitano prije ove skripte - vidi <script> u dashboard-admin.html), da se isti
    // kod ne ponavlja u svakoj dashboard stranici zasebno.
    const formatDateTime = SnimciUtils.formatDateTime;
    const escapeHtml = SnimciUtils.escapeHtml;
    function isToday(iso) {
        const d = new Date(iso);
        const today = new Date();
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    }

    try {
        const [users, drones, flights] = await Promise.all([
            apiFetch('/korisnici'),
            apiFetch('/dronovi'),
            apiFetch('/letovi')
        ]);

        statUsers.textContent = users.length;
        statDrones.textContent = drones.length;
        statFlightsToday.textContent = flights.filter(f => isToday(f.flightDateTime)).length;
        statWarnings.textContent = drones.filter(d => d.status !== 'aktivan').length;
    } catch (err) {
        [statUsers, statDrones, statFlightsToday, statWarnings].forEach(el => el.textContent = '—');
        console.error('Greška pri učitavanju statistike:', err.message);
    }

    try {
        const activities = await apiFetch('/aktivnosti?limit=5');

        activityBody.innerHTML = '';
        activityEmpty.style.display = activities.length === 0 ? 'block' : 'none';

        activities.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(a.actorName)}</td>
                <td>${escapeHtml(a.description)}</td>
                <td>${escapeHtml(a.relatedEntity || '—')}</td>
                <td><span class="badge ${STATUS_BADGE[a.status] || 'info'}">${STATUS_LABELS[a.status] || a.status}</span></td>
                <td class="row-time">${formatDateTime(a.timestamp)}</td>
            `;
            activityBody.appendChild(tr);
        });
    } catch (err) {
        activityBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#ff6b6b;">Greška: ${escapeHtml(err.message)}</td></tr>`;
    }
});
