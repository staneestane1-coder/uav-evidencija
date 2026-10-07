document.addEventListener('DOMContentLoaded', async () => {

    const statActiveFlights = document.getElementById('statActiveFlights');
    const statFlightsToday = document.getElementById('statFlightsToday');
    const statOperators = document.getElementById('statOperators');
    const statWarnings = document.getElementById('statWarnings');
    const flightsBody = document.getElementById('recentFlightsBody');
    const flightsEmpty = document.getElementById('recentFlightsEmpty');

    // STATUS_LABELS/STATUS_BADGE/formatDateTime/escapeHtml: zajednička implementacija iz
    // shared/snimci-utils.js (učitano prije ove skripte).
    const STATUS_LABELS = SnimciUtils.STATUS_LABELS;
    const STATUS_BADGE = SnimciUtils.STATUS_BADGE;
    const formatDateTime = SnimciUtils.formatDateTime;
    const escapeHtml = SnimciUtils.escapeHtml;
    function isToday(iso) {
        const d = new Date(iso);
        const today = new Date();
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    }

    try {
        const [flights, drones] = await Promise.all([
            apiFetch('/letovi'),
            apiFetch('/dronovi')
        ]);

        statActiveFlights.textContent = flights.filter(f => f.status === 'u-letu').length;
        statFlightsToday.textContent = flights.filter(f => isToday(f.flightDateTime)).length;
        statWarnings.textContent = drones.filter(d => d.status !== 'aktivan').length;

        // Kontrola leta nema pristup /api/korisnici (samo administrator), pa broj
        // operatera računamo iz onih koji se pojavljuju na letovima ili dodijeljenim dronovima
        const operatorNames = new Set();
        flights.forEach(f => { if (f.operatorName) operatorNames.add(f.operatorName); });
        drones.forEach(d => { if (d.operatorName) operatorNames.add(d.operatorName); });
        statOperators.textContent = operatorNames.size;

        flightsBody.innerHTML = '';
        const recent = flights.slice(0, 6);
        flightsEmpty.style.display = recent.length === 0 ? 'block' : 'none';

        recent.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(f.operatorName || '—')}</td>
                <td>${escapeHtml(f.droneName || '—')}</td>
                <td>${escapeHtml(f.location || '—')}</td>
                <td><span class="badge ${STATUS_BADGE[f.status] || ''}">${STATUS_LABELS[f.status] || f.status}</span></td>
                <td class="row-time">${formatDateTime(f.flightDateTime)}</td>
            `;
            flightsBody.appendChild(tr);
        });
    } catch (err) {
        [statActiveFlights, statFlightsToday, statOperators, statWarnings].forEach(el => el.textContent = '—');
        flightsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#ff6b6b;">Greška: ${escapeHtml(err.message)}</td></tr>`;
    }
});
