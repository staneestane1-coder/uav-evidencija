document.addEventListener('DOMContentLoaded', async function () {

    // Koordinate poznatih gradova/opština (BiH i okolina) za prikaz lokacije leta na karti.
    // Let u bazi čuva samo naziv mjesta (string), ne GPS koordinate drona, pa se
    // prikaz radi na nivou grada/opštine - vidi napomenu na stranici.
    // Ovo je samo BRZI lokalni prečac za najčešće gradove (bez mrežnog poziva) -
    // za sve ostale lokacije koristi se geocodeCity() ispod (OpenStreetMap Nominatim).
    var CITY_COORDS = {
        'banja luka': [44.7722, 17.1910],
        'istočno sarajevo': [43.7856, 18.3564],
        'istocno sarajevo': [43.7856, 18.3564],
        'sarajevo': [43.8563, 18.4131],
        'trebinje': [42.7096, 18.3441],
        'foča': [43.5044, 18.7738],
        'foca': [43.5044, 18.7738],
        'pale': [43.8158, 18.5736],
        'prijedor': [44.9797, 16.7147],
        'han pijesak': [43.9994, 18.9182],
        'bijeljina': [44.7581, 19.2144],
        'sokolac': [43.9394, 18.7961],
        'doboj': [44.7333, 18.0833],
        'mostar': [43.3438, 17.8078],
        'zenica': [44.2019, 17.9078],
        'tuzla': [44.5386, 18.6739],
        'bihać': [44.8125, 15.8700],
        'bihac': [44.8125, 15.8700],
        'goražde': [43.6675, 18.9789],
        'gorazde': [43.6675, 18.9789],
        'zvornik': [44.3861, 19.1028],
        'višegrad': [43.7864, 19.2947],
        'visegrad': [43.7864, 19.2947],
        'livno': [43.8286, 17.0075],
        'travnik': [44.2258, 17.6656],
        'bileća': [42.8747, 18.4344],
        'bileca': [42.8747, 18.4344],
        'rogatica': [43.7961, 19.0011],
        'čajniče': [43.5722, 19.0669],
        'cajnice': [43.5722, 19.0669],
        // Dodatne opštine/gradovi - proširen lokalni prečac da se rjeđe poziva Nominatim
        // (posebno korisno na demonstraciji/odbrani, kad internet konekcija zna biti nesigurna).
        'brčko': [44.8694, 18.8083],
        'brcko': [44.8694, 18.8083],
        'gradiška': [45.1439, 17.2517],
        'gradiska': [45.1439, 17.2517],
        'laktaši': [44.9169, 17.2953],
        'laktasi': [44.9169, 17.2953],
        'čelinac': [44.7297, 17.3181],
        'celinac': [44.7297, 17.3181],
        'kotor varoš': [44.6161, 17.3789],
        'kotor varos': [44.6161, 17.3789],
        'šipovo': [44.2661, 17.0328],
        'sipovo': [44.2661, 17.0328],
        'kupres': [43.9967, 17.2831],
        'konjic': [43.6553, 17.9592],
        'jajce': [44.3411, 17.2711],
        'kakanj': [44.1372, 18.1136],
        'visoko': [43.9878, 18.1783],
        'vareš': [44.1636, 18.3283],
        'vares': [44.1636, 18.3283],
        'kalesija': [44.4239, 18.7869],
        'lukavac': [44.5389, 18.5236],
        'gračanica': [44.7031, 18.3025],
        'gracanica': [44.7031, 18.3025],
        'srebrenik': [44.7061, 18.4906],
        'živinice': [44.4508, 18.6472],
        'zivinice': [44.4508, 18.6472],
        'cazin': [44.9683, 15.9411],
        'velika kladuša': [45.1836, 15.8067],
        'velika kladusa': [45.1836, 15.8067],
        'sanski most': [44.7683, 16.6653],
        'ključ': [44.5386, 16.7728],
        'kljuc': [44.5386, 16.7728],
        'bosanska krupa': [44.8853, 16.1519],
        'bosanski petrovac': [44.5561, 16.3689],
        'drvar': [44.3667, 16.3833],
        'glamoč': [44.0475, 16.8494],
        'glamoc': [44.0475, 16.8494],
        'nevesinje': [43.2586, 18.1131],
        'gacko': [43.1656, 18.5342],
        'kalinovik': [43.5306, 18.4467],
        'srebrenica': [44.1061, 19.2986],
        'bratunac': [44.1836, 19.3403],
        'milići': [44.1972, 19.0839],
        'milici': [44.1972, 19.0839],
        'vlasenica': [44.1808, 18.9425],
        'ugljevik': [44.6828, 19.1006],
        'lopare': [44.6394, 18.9994],
        'derventa': [44.9808, 17.9111],
        'modriča': [44.9522, 18.3011],
        'modrica': [44.9522, 18.3011],
        'srbac': [45.1042, 17.5231],
        'kozarska dubica': [45.1747, 16.8081],
        'novi grad': [45.0522, 16.3775],
        'čapljina': [43.1442, 17.6800],
        'capljina': [43.1442, 17.6800],
        'stolac': [43.0839, 17.9558],
        'ljubuški': [43.1958, 17.5461],
        'ljubuski': [43.1958, 17.5461],
        'široki brijeg': [43.3856, 17.5989],
        'siroki brijeg': [43.3856, 17.5989]
    };

    /* =====================================================
       GEOKODIRANJE ZA PROIZVOLJNE LOKACIJE (ne samo lista iznad)
       -----------------------------------------------------
       Koristi besplatni OpenStreetMap Nominatim servis (bez API
       ključa, bez naplate). Rezultati se čuvaju u localStorage
       kešu (traje između sesija) da se isto mjesto nikad ne
       geokodira dva puta. Nominatim politika korištenja traži
       max. 1 zahtjev u sekundi - zato se pozivi rade sekvencijalno
       sa pauzom, ne paralelno (vidi geocodeAllFlights niže).
       ===================================================== */
    var GEOCODE_CACHE_KEY = 'kontrolaKartaGeocodeCache_v1';

    function loadGeocodeCache() {
        try { return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function saveGeocodeCache(cache) {
        try { localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); }
        catch (e) { /* localStorage nedostupan/pun - nije kritično, samo gubimo keš */ }
    }
    var geocodeCache = loadGeocodeCache();

    function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

    // Vraća { coords: [lat, lon] | null, calledNetwork: bool }
    async function geocodeCity(location) {
        if (!location) return { coords: null, calledNetwork: false };
        var key = location.trim().toLowerCase();
        if (!key) return { coords: null, calledNetwork: false };

        if (CITY_COORDS[key]) {
            return { coords: CITY_COORDS[key], calledNetwork: false };
        }
        if (Object.prototype.hasOwnProperty.call(geocodeCache, key)) {
            return { coords: geocodeCache[key], calledNetwork: false };
        }

        try {
            var url = 'https://nominatim.openstreetmap.org/search'
                + '?format=json&limit=1&countrycodes=ba&q=' + encodeURIComponent(location);
            var res = await fetch(url, { headers: { 'Accept-Language': 'bs' } });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var data = await res.json();
            var coords = (data && data.length) ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
            geocodeCache[key] = coords; // keširamo i "nije pronađeno" (null) da se ne pita iznova
            saveGeocodeCache(geocodeCache);
            return { coords: coords, calledNetwork: true };
        } catch (err) {
            console.warn('Geokodiranje nije uspjelo za "' + location + '":', err.message);
            return { coords: null, calledNetwork: true };
        }
    }

    var filterStatus = document.getElementById('filterStatus');
    var filterOperater = document.getElementById('filterOperater');
    var filterOperaterSuggestions = document.getElementById('filterOperaterSuggestions');
    var flightList = document.getElementById('flightList');
    var unmatchedSection = document.getElementById('unmatchedSection');
    var unmatchedList = document.getElementById('unmatchedList');
    var resultCount = document.getElementById('resultCount');

    // ===== OPERATER (filter) - POLJE ZA KUCANJE SA PRIJEDLOZIMA (autocomplete) =====
    // Isti obrazac kao na "Dodaj dron": kuca se ime, ali se kao filter prihvata SAMO
    // ime koje se tacno poklapa sa postojecim korisnikom sa ulogom "operater" (provjereno
    // nad stvarnom bazom preko /korisnici, ne samo nad operaterima koji vec imaju let).
    // Prazno polje = "svi operateri" (nema filtriranja).
    var operateri = [];
    try {
        var korisnici = await apiFetch('/korisnici');
        operateri = korisnici.filter(function (k) { return k.role === 'operater'; });
    } catch (err) {
        console.warn('Nije moguće učitati operatere:', err.message);
    }

    function operatorFullName(op) {
        return op.firstName + ' ' + op.lastName;
    }

    function renderOperaterSuggestions(query) {
        var q = query.trim().toLowerCase();

        filterOperaterSuggestions.innerHTML = '';
        // Prazan upit ne prikazuje kompletnu listu operatera (suvisno prije nego
        // korisnik uopste pocne kucati) - prijedlozi se pojavljuju tek na prvo slovo.
        if (q === '') {
            filterOperaterSuggestions.classList.remove('visible');
            return;
        }

        var matches = operateri.filter(function (op) { return operatorFullName(op).toLowerCase().includes(q); });
        if (matches.length === 0) {
            filterOperaterSuggestions.classList.remove('visible');
            return;
        }

        matches.forEach(function (op) {
            var li = document.createElement('li');
            li.textContent = operatorFullName(op);
            // mousedown (ne click) - izvrsava se PRIJE blur eventa na inputu, inace bi
            // blur stigao prvi i sakrio listu prije nego se klik na stavku registruje.
            li.addEventListener('mousedown', function (e) {
                e.preventDefault();
                filterOperater.value = operatorFullName(op);
                filterOperaterSuggestions.classList.remove('visible');
                renderList();
            });
            filterOperaterSuggestions.appendChild(li);
        });
        filterOperaterSuggestions.classList.add('visible');
    }

    filterOperater.addEventListener('input', function () {
        renderOperaterSuggestions(filterOperater.value);
    });

    filterOperater.addEventListener('focus', function () {
        renderOperaterSuggestions(filterOperater.value);
    });

    filterOperater.addEventListener('blur', function () {
        // Da klik na prijedlog (mousedown handler iznad) stigne prije ovoga.
        setTimeout(function () {
            filterOperaterSuggestions.classList.remove('visible');
            var typed = filterOperater.value.trim();
            if (typed === '') {
                renderList();
                return;
            }
            var match = operateri.find(function (op) { return operatorFullName(op) === typed; });
            if (!match) {
                // Otkucano ime ne postoji medju operaterima - ne dozvoljavamo
                // proizvoljan/izmisljen unos, filter se vraca na "svi operateri".
                filterOperater.value = '';
            }
            renderList();
        }, 150);
    });

    // Leaflet (L) se ucitava sa vanjskog CDN-a (vidi <script> u .html) - ako u trenutku
    // demonstracije/odbrane nema internet konekcije, "L" ce ovdje biti undefined. Bez ove
    // provjere skripta bi pukla sa needocnom "L is not defined" greskom i cijela stranica
    // (ukljucujuci listu letova) bi ostala prazna, bez ikakvog objasnjenja korisniku.
    if (typeof L === 'undefined') {
        flightList.innerHTML =
            '<p style="color:#ff6b6b;padding:16px;">Karta se nije mogla učitati jer nedostaje internet konekcija ' +
            '(biblioteka za prikaz karte se učitava sa vanjskog servera). Provjerite konekciju i osvježite stranicu.</p>';
        resultCount.textContent = '0 / 0 letova';
        return;
    }

    var map = L.map('map', { zoomControl: true }).setView([44.0, 17.9], 8);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    function makeIcon(status) {
        var pulseClass = status === 'u-letu' ? ' marker-pulse' : '';
        return L.divIcon({
            className: '',
            html: '<div class="marker-dot ' + status + pulseClass + '"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            popupAnchor: [0, -8]
        });
    }

    // formatDateTime/escapeHtml: zajednička implementacija iz shared/snimci-utils.js
    // (učitano prije ove skripte).
    var formatDateTime = SnimciUtils.formatDateTime;
    var escapeHtml = SnimciUtils.escapeHtml;

    var flights = [];
    var matched = [];
    var unmatched = [];

    function renderList() {
        var status = filterStatus.value;
        var operater = filterOperater.value.trim();
        flightList.innerHTML = '';
        var visibleCount = 0;

        matched.forEach(function (flight) {
            var matchesStatus = status === 'svi' || flight.status === status;
            var matchesOperater = operater === '' || flight.operatorName === operater;
            var visible = matchesStatus && matchesOperater;

            if (visible) {
                if (!map.hasLayer(flight.marker)) flight.marker.addTo(map);
            } else {
                map.removeLayer(flight.marker);
            }

            if (!visible) return;
            visibleCount++;

            var item = document.createElement('div');
            item.className = 'flight-list-item';
            item.innerHTML =
                '<span class="status-dot ' + flight.status + '"></span>' +
                '<div class="flight-list-info">' +
                    '<div class="flight-list-location">' + escapeHtml(flight.location) + '</div>' +
                    '<div class="flight-list-meta">' + escapeHtml(flight.operatorName || '—') + ' · ' + escapeHtml(flight.droneName || '—') + ' · ' + formatDateTime(flight.flightDateTime) + '</div>' +
                '</div>';

            item.addEventListener('click', function () {
                document.querySelectorAll('.flight-list-item').forEach(function (el) {
                    el.classList.remove('selected');
                });
                item.classList.add('selected');
                map.flyTo(flight.coords, 11, { duration: 0.6 });
                flight.marker.openPopup();
            });

            flightList.appendChild(item);
        });

        resultCount.textContent = visibleCount + ' / ' + flights.length + ' letova';

        // Letovi bez prepoznate lokacije - prikazani samo u listi, ne na karti
        var unmatchedVisible = unmatched.filter(function (f) {
            var matchesStatus = status === 'svi' || f.status === status;
            var matchesOperater = operater === '' || f.operatorName === operater;
            return matchesStatus && matchesOperater;
        });

        unmatchedSection.style.display = unmatchedVisible.length === 0 ? 'none' : 'block';
        unmatchedList.innerHTML = '';
        unmatchedVisible.forEach(function (f) {
            var item = document.createElement('div');
            item.className = 'flight-list-item';
            item.innerHTML =
                '<span class="status-dot ' + f.status + '"></span>' +
                '<div class="flight-list-info">' +
                    '<div class="flight-list-location">' + escapeHtml(f.location || 'Nepoznata lokacija') + '</div>' +
                    '<div class="flight-list-meta">' + escapeHtml(f.operatorName || '—') + ' · ' + escapeHtml(f.droneName || '—') + ' · ' + formatDateTime(f.flightDateTime) + '</div>' +
                '</div>';
            unmatchedList.appendChild(item);
        });
    }

    filterStatus.addEventListener('change', renderList);

    // Dodaje let na kartu/listu na osnovu VEĆ poznatih koordinata - zajednička
    // logika za brzi put (lokalni rječnik/keš, ispod) i spori mrežni put
    // (resolveNetworkQueue, ispod), da se marker/popup ne pravi na dva mjesta.
    function addResolvedFlight(flight, coords) {
        flight.coords = coords;
        flight.marker = L.marker(coords, { icon: makeIcon(flight.status) });
        flight.marker.bindPopup(
            '<div class="map-popup-title">' + escapeHtml(flight.location) + '</div>' +
            '<div class="map-popup-row">Operater: ' + escapeHtml(flight.operatorName || '—') + '</div>' +
            '<div class="map-popup-row">Dron: ' + escapeHtml(flight.droneName || '—') + '</div>' +
            '<div class="map-popup-row">Vrijeme: ' + formatDateTime(flight.flightDateTime) + '</div>'
        );
        matched.push(flight);
    }

    // Rješava letove kojima je STVARNO potreban mrežni poziv ka Nominatim-u (nisu
    // u lokalnom rječniku CITY_COORDS niti već u kešu). Ovo MORA ostati sekvencijalno
    // (Nominatim politika korištenja: max 1 zahtjev/sekundi), ali se sada izvršava u
    // pozadini (nije "await"-ovano iz try bloka ispod) - ne blokira više prikaz karte,
    // koji se za lokalni rječnik/keš (velika većina letova) desi odmah, bez čekanja.
    // Karta/lista se ažuriraju uživo, red po red, kako se svaka lokacija riješi.
    async function resolveNetworkQueue(queue) {
        for (var i = 0; i < queue.length; i++) {
            var flight = queue[i];
            var result = await geocodeCity(flight.location);

            if (!result.coords) {
                unmatched.push(flight);
            } else {
                addResolvedFlight(flight, result.coords);
            }
            renderList();

            if (result.calledNetwork && i < queue.length - 1) {
                await sleep(1000);
            }
        }
    }

    try {
        var allFetchedFlights = await apiFetch('/letovi');
        // Letovi koji cekaju odobrenje ili su odbijeni jos uvijek nisu stvarna letacka
        // aktivnost (ne dešavaju se, ili se nikad nece desiti) - karta prikazuje SAMO
        // letove koji jesu/ce biti u vazduhu (planiran/u-letu/zavrsen), isto kao i legenda
        // ispod (koja te statuse uopste ne pominje).
        flights = allFetchedFlights.filter(function (f) { return f.status !== 'na-cekanju' && f.status !== 'odbijen'; });

        // Brzi put: lokalni rječnik gradova (CITY_COORDS) i već keširane lokacije se
        // rješavaju ODMAH, sinhrono, bez ikakvog čekanja - ovuda prolazi velika većina
        // letova (BiH gradovi/opštine), pa se karta u tom slučaju prikaže trenutno,
        // umjesto da čeka na sekvencijalni mrežni poziv za SVAKI let (stari, blokirajući
        // pristup). Samo letovi sa lokacijom koja nije prepoznata lokalno ni iz keša idu
        // u pozadinsku mrežnu obradu (resolveNetworkQueue) ispod.
        var networkQueue = [];
        flights.forEach(function (flight) {
            var key = (flight.location || '').trim().toLowerCase();
            if (!key) {
                unmatched.push(flight);
                return;
            }
            var cached = CITY_COORDS[key];
            if (cached === undefined && Object.prototype.hasOwnProperty.call(geocodeCache, key)) {
                cached = geocodeCache[key];
            }
            if (cached !== undefined) {
                if (cached) addResolvedFlight(flight, cached);
                else unmatched.push(flight);
            } else {
                networkQueue.push(flight);
            }
        });

        renderList();

        if (networkQueue.length > 0) {
            resolveNetworkQueue(networkQueue);
        }
    } catch (err) {
        flightList.innerHTML = '<p style="color:#ff6b6b;padding:16px;">Greška: ' + escapeHtml(err.message) + '</p>';
    }
});
