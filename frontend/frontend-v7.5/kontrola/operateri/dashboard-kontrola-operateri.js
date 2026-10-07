document.addEventListener('DOMContentLoaded', async function () {

    var filterSearch = document.getElementById('filterSearch');
    var filterStatus = document.getElementById('filterStatus');
    var sortBy = document.getElementById('sortBy');
    var grid = document.getElementById('operateriGrid');
    var emptyState = document.getElementById('emptyState');

    var modalOverlay = document.getElementById('modalOverlay');
    var modalClose = document.getElementById('modalClose');
    var modalName = document.getElementById('modalName');
    var modalFlights = document.getElementById('modalFlights');
    var modalHours = document.getElementById('modalHours');
    var modalDrones = document.getElementById('modalDrones');
    var modalFlightList = document.getElementById('modalFlightList');

    // formatDateTime/escapeHtml: zajednička implementacija iz shared/snimci-utils.js
    // (učitano prije ove skripte).
    var formatDateTime = SnimciUtils.formatDateTime;
    var escapeHtml = SnimciUtils.escapeHtml;
    function initials(ime) {
        return ime.split(' ').map(function (p) { return p.charAt(0); }).join('').toUpperCase();
    }
    function statusLabel(status) {
        return status === 'aktivan' ? 'Aktivan' : 'Neaktivan';
    }

    var operateri = [];

    function buildOperators(users, flights, drones) {
        return users
            .filter(function (u) { return u.role === 'operater'; })
            .map(function (u) {
                var ime = u.firstName + ' ' + u.lastName;
                var mojiLetovi = flights.filter(function (f) { return f.operatorId === u.id; });
                var totalMinutes = mojiLetovi.reduce(function (sum, f) { return sum + (f.durationMinutes || 0); }, 0);
                var mojiDronovi = drones.filter(function (d) { return d.operatorId === u.id; });

                return {
                    id: u.id,
                    ime: ime,
                    email: u.email,
                    status: u.status,
                    letova: mojiLetovi.length,
                    sati: Math.round((totalMinutes / 60) * 10) / 10,
                    dronovi: mojiDronovi.length,
                    posljednjiLetovi: mojiLetovi.slice(0, 3)
                };
            });
    }

    function render() {
        var search = filterSearch.value.trim().toLowerCase();
        var status = filterStatus.value;

        var results = operateri.filter(function (op) {
            var matchesSearch = search === '' || op.ime.toLowerCase().indexOf(search) !== -1;
            var matchesStatus = status === 'svi' || op.status === status;
            return matchesSearch && matchesStatus;
        });

        results.sort(function (a, b) {
            if (sortBy.value === 'letovi') return b.letova - a.letova;
            if (sortBy.value === 'sati') return b.sati - a.sati;
            return a.ime.localeCompare(b.ime);
        });

        grid.innerHTML = '';

        results.forEach(function (op) {
            var card = document.createElement('div');
            card.className = 'operater-card';
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', 'Prikaži detalje za ' + op.ime);
            card.innerHTML =
                '<div class="operater-card-top">' +
                    '<div class="operater-avatar">' + escapeHtml(initials(op.ime)) + '</div>' +
                    '<div class="operater-name-block">' +
                        '<div class="operater-name">' + escapeHtml(op.ime) + '</div>' +
                        '<div class="operater-email">' + escapeHtml(op.email) + '</div>' +
                    '</div>' +
                    '<span class="operater-status-dot ' + op.status + '" title="' + statusLabel(op.status) + '"></span>' +
                '</div>' +
                '<div class="operater-stats-row">' +
                    '<div class="operater-stat"><span class="operater-stat-value">' + op.letova + '</span><span class="operater-stat-label">Letova</span></div>' +
                    '<div class="operater-stat"><span class="operater-stat-value">' + op.sati + 'h</span><span class="operater-stat-label">Sati</span></div>' +
                    '<div class="operater-stat"><span class="operater-stat-value">' + op.dronovi + '</span><span class="operater-stat-label">Dronova</span></div>' +
                '</div>';

            card.addEventListener('click', function () { openModal(op); });
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModal(op);
                }
            });
            grid.appendChild(card);
        });

        emptyState.style.display = results.length === 0 ? 'block' : 'none';
    }

    function openModal(op) {
        modalName.textContent = op.ime;
        modalFlights.textContent = op.letova;
        modalHours.textContent = op.sati + 'h';
        modalDrones.textContent = op.dronovi;

        modalFlightList.innerHTML = '';
        if (op.posljednjiLetovi.length === 0) {
            var li = document.createElement('li');
            li.className = 'modal-flight-item';
            li.textContent = 'Nema evidentiranih letova.';
            modalFlightList.appendChild(li);
        } else {
            op.posljednjiLetovi.forEach(function (f) {
                var li = document.createElement('li');
                li.className = 'modal-flight-item';
                li.innerHTML =
                    '<span class="modal-flight-location">' + escapeHtml(f.location || '—') + '</span>' +
                    '<span class="modal-flight-time">' + formatDateTime(f.flightDateTime) + '</span>';
                modalFlightList.appendChild(li);
            });
        }

        modalOverlay.classList.add('show');
    }

    function closeModal() {
        modalOverlay.classList.remove('show');
    }

    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModal();
    });

    filterSearch.addEventListener('input', render);
    filterStatus.addEventListener('change', render);
    sortBy.addEventListener('change', render);

    try {
        var results3 = await Promise.all([
            apiFetch('/korisnici'),
            apiFetch('/letovi'),
            apiFetch('/dronovi')
        ]);
        operateri = buildOperators(results3[0], results3[1], results3[2]);
        render();
    } catch (err) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        emptyState.textContent = 'Greška pri učitavanju operatera: ' + err.message;
    }
});
