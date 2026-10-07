document.addEventListener('DOMContentLoaded', async () => {

    const statFlightsMonth = document.getElementById('statFlightsMonth');
    const statDrones = document.getElementById('statDrones');
    const statHours = document.getElementById('statHours');
    const statWarnings = document.getElementById('statWarnings');
    const flightsBody = document.getElementById('recentFlightsBody');
    const flightsEmpty = document.getElementById('recentFlightsEmpty');
    const droneList = document.getElementById('myDroneList');

    // STATUS_LABELS/STATUS_BADGE (status leta): zajednička implementacija iz
    // shared/snimci-utils.js (učitano prije ove skripte).
    const STATUS_LABELS = SnimciUtils.STATUS_LABELS;
    const STATUS_BADGE = SnimciUtils.STATUS_BADGE;
    const DRONE_STATUS_LABELS = { aktivan: 'Ispravan', servis: 'U servisu', neaktivan: 'Neaktivan' };
    const DRONE_STATUS_BADGE = { aktivan: 'success', servis: 'warning', neaktivan: 'danger' };

    // formatDateTime/escapeHtml: zajednička implementacija iz shared/snimci-utils.js
    // (učitano prije ove skripte).
    const formatDateTime = SnimciUtils.formatDateTime;
    const escapeHtml = SnimciUtils.escapeHtml;
    function isThisMonth(iso) {
        const d = new Date(iso);
        const today = new Date();
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    }

    try {
        // API automatski vraća samo letove/dronove dodijeljene ovom operateru
        const [flights, drones] = await Promise.all([
            apiFetch('/letovi'),
            apiFetch('/dronovi')
        ]);

        statFlightsMonth.textContent = flights.filter(f => isThisMonth(f.flightDateTime)).length;
        statDrones.textContent = drones.length;
        statWarnings.textContent = drones.filter(d => d.status !== 'aktivan').length;

        const totalMinutes = flights.reduce((sum, f) => sum + (f.durationMinutes || 0), 0);
        statHours.textContent = (totalMinutes / 60).toFixed(1) + 'h';

        flightsBody.innerHTML = '';
        const recent = flights.slice(0, 5);
        flightsEmpty.style.display = recent.length === 0 ? 'block' : 'none';

        recent.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(f.droneName || '—')}</td>
                <td>${escapeHtml(f.location || '—')}</td>
                <td><span class="badge ${STATUS_BADGE[f.status] || ''}">${STATUS_LABELS[f.status] || f.status}</span></td>
                <td class="row-time">${formatDateTime(f.flightDateTime)}</td>
            `;
            flightsBody.appendChild(tr);
        });

        droneList.innerHTML = '';
        if (drones.length === 0) {
            droneList.innerHTML = '<p class="empty-state">Nemate dodijeljenih dronova.</p>';
        } else {
            drones.forEach(d => {
                const item = document.createElement('div');
                item.className = 'drone-item';
                item.innerHTML = `
                    <div class="drone-icon">🛰</div>
                    <div class="drone-info">
                        <div class="drone-name">${escapeHtml(d.name)}</div>
                        <div class="drone-meta">${escapeHtml(d.model)}</div>
                    </div>
                    <span class="badge ${DRONE_STATUS_BADGE[d.status] || 'warning'}">${DRONE_STATUS_LABELS[d.status] || d.status}</span>
                `;
                droneList.appendChild(item);
            });
        }
    } catch (err) {
        [statFlightsMonth, statDrones, statHours, statWarnings].forEach(el => el.textContent = '—');
        flightsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#ff6b6b;">Greška: ${escapeHtml(err.message)}</td></tr>`;
        droneList.innerHTML = `<p class="empty-state" style="color:#ff6b6b;">Greška: ${escapeHtml(err.message)}</p>`;
    }
});
