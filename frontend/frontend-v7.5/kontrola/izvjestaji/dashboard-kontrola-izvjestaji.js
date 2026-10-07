document.addEventListener('DOMContentLoaded', async function () {

    var dateFrom = document.getElementById('dateFrom');
    var dateTo = document.getElementById('dateTo');
    var reportOperater = document.getElementById('reportOperater');
    var reportDrone = document.getElementById('reportDrone');
    var reportStatus = document.getElementById('reportStatus');
    var generateBtn = document.getElementById('generateBtn');
    var rangeLabel = document.getElementById('rangeLabel');
    var reportBody = document.getElementById('reportBody');
    var emptyState = document.getElementById('emptyState');

    var statTotal = document.getElementById('statTotal');
    var statHours = document.getElementById('statHours');
    var statSuccess = document.getElementById('statSuccess');
    var statPlanned = document.getElementById('statPlanned');

    var exportCsvBtn = document.getElementById('exportCsvBtn');
    var printBtn = document.getElementById('printBtn');

    var printPeriod = document.getElementById('printPeriod');
    var printGeneratedBy = document.getElementById('printGeneratedBy');
    var printGeneratedAt = document.getElementById('printGeneratedAt');

    // STATUS_LABELS/STATUS_BADGE: zajednička implementacija iz shared/snimci-utils.js
    // (učitano prije ove skripte).
    var STATUS_LABELS = SnimciUtils.STATUS_LABELS;
    var STATUS_BADGE = SnimciUtils.STATUS_BADGE;

    var allFlights = [];
    var currentResults = [];

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    function formatDateBs(isoDate) {
        var parts = isoDate.split('-');
        return parts[2] + '.' + parts[1] + '.' + parts[0] + '.';
    }

    function toISODate(d) {
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    // VAŽNO: flightDateTime dolazi sa backenda kao UTC ISO string (npr. "...T23:30:00Z").
    // Raniji kod je radio iso.split('T')[0], što uzima UTC datum - za korisnike u vremenskoj
    // zoni BiH (UTC+1/+2) let evidentiran kasno uveče lokalno (npr. 00:30 lokalno) bi u UTC-u
    // i dalje pripadao PRETHODNOM danu, pa bi filter Od/Do (koji koristi lokalni datum -
    // vidi toISODate/setDefaultRange) taj let neispravno izostavio ili uvrstio u pogrešan dan.
    // new Date(iso) + lokalni getFullYear/getMonth/getDate rješava to - datum se računa u
    // TIMEZONE PREGLEDAOCA, isto kao i dateFrom/dateTo vrijednosti sa kojima se poredi.
    function flightDateOnly(iso) {
        var d = new Date(iso);
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function formatTime(iso) {
        var d = new Date(iso);
        return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }

    // escapeHtml: zajednička implementacija iz shared/snimci-utils.js (učitano prije
    // ove skripte). NAPOMENA: pad2/formatDateBs/toISODate/flightDateOnly/formatTime
    // OSTAJU ovdje - namjerno rade sa lokalnim (ne UTC) datumom i/ili plain
    // "YYYY-MM-DD" stringom bez new Date(), vidi komentar iznad flightDateOnly - nisu
    // duplikat SnimciUtils.formatDate/formatDateTime nego drugačija, timezone-sigurna
    // implementacija za ovu stranicu.
    var escapeHtml = SnimciUtils.escapeHtml;

    function setDefaultRange() {
        var today = new Date();
        var monthAgo = new Date();
        monthAgo.setDate(today.getDate() - 30);
        dateFrom.value = toISODate(monthAgo);
        dateTo.value = toISODate(today);
    }

    function populateFilters() {
        var operateri = [...new Set(allFlights.map(function (f) { return f.operatorName; }).filter(Boolean))];
        reportOperater.innerHTML = '<option value="svi">Svi operateri</option>';
        operateri.forEach(function (op) {
            var opt = document.createElement('option');
            opt.value = op;
            opt.textContent = op;
            reportOperater.appendChild(opt);
        });

        var dronovi = [...new Set(allFlights.map(function (f) { return f.droneName; }).filter(Boolean))];
        reportDrone.innerHTML = '<option value="svi">Svi dronovi</option>';
        dronovi.forEach(function (d) {
            var opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            reportDrone.appendChild(opt);
        });
    }

    function updateRangeLabel() {
        var from = dateFrom.value;
        var to = dateTo.value;
        rangeLabel.textContent = from && to
            ? 'Period: ' + formatDateBs(from) + ' – ' + formatDateBs(to)
            : '';
    }

    function generateReport() {
        var from = dateFrom.value;
        var to = dateTo.value;
        var operater = reportOperater.value;
        var drone = reportDrone.value;
        var status = reportStatus.value;

        currentResults = allFlights.filter(function (f) {
            var flightDate = flightDateOnly(f.flightDateTime);
            var inRange = (!from || flightDate >= from) && (!to || flightDate <= to);
            var matchesOperater = operater === 'svi' || f.operatorName === operater;
            var matchesDrone = drone === 'svi' || f.droneName === drone;
            var matchesStatus = status === 'svi' || f.status === status;
            return inRange && matchesOperater && matchesDrone && matchesStatus;
        });

        renderTable();
        renderStats();
        updateRangeLabel();
    }

    function renderTable() {
        reportBody.innerHTML = '';

        currentResults.forEach(function (f) {
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + escapeHtml(f.operatorName || '—') + '</td>' +
                '<td>' + escapeHtml(f.droneName || '—') + '</td>' +
                '<td>' + escapeHtml(f.location || '—') + '</td>' +
                '<td><span class="badge ' + (STATUS_BADGE[f.status] || '') + '">' + (STATUS_LABELS[f.status] || f.status) + '</span></td>' +
                '<td>' + (f.durationMinutes ? f.durationMinutes + ' min' : '—') + '</td>' +
                '<td class="row-time">' + formatDateBs(flightDateOnly(f.flightDateTime)) + ' ' + formatTime(f.flightDateTime) + '</td>';
            reportBody.appendChild(tr);
        });

        emptyState.style.display = currentResults.length === 0 ? 'block' : 'none';
    }

    function renderStats() {
        var totalMinutes = currentResults.reduce(function (sum, f) { return sum + (f.durationMinutes || 0); }, 0);
        var success = currentResults.filter(function (f) { return f.status === 'zavrsen'; }).length;
        var planned = currentResults.filter(function (f) { return f.status === 'planiran'; }).length;

        statTotal.textContent = currentResults.length;
        statHours.textContent = (totalMinutes / 60).toFixed(1) + 'h';
        statSuccess.textContent = success;
        statPlanned.textContent = planned;
    }

    // Zastita od "formula injekcije" - iako ExcelJS upisuje PRAVE tipizirane celije (string
    // vrijednost se u .xlsx zapisu cuva eksplicitno kao tekst, ne kao sirovi red koji Excel
    // sam nagadja/parsira kao kod CSV-a, pa formula-injection ovdje nije stvaran rizik na isti
    // nacin), zadrzavamo istu provjeru kao dodatnu sigurnosnu mjeru za tekstualna polja - ako
    // polje pocinje sa =, +, -, @ dodajemo apostrof ispred, isto kao ranije za CSV.
    function safeText(value) {
        var str = value === null || value === undefined ? '' : String(value);
        if (/^[=+\-@]/.test(str)) {
            str = "'" + str;
        }
        return str;
    }

    // Boje po statusu za Excel celije - IZVEDENE iz postojece mape (SnimciUtils/CSS badge
    // boje), ne izmisljene. Fill je ista rgba pozadina koju badge koristi (npr. success:
    // rgba(50,180,100,0.15)), izracunata "preko bijele" (pretpostavljeni list u Excelu) da
    // dobijemo puna ARGB boja koju .xlsx fill zahtijeva - to je matematicki isti rezultat
    // kao ta ista rgba definicija prikazana na bijeloj podlozi. Font je TAcAN badge tekst-hex,
    // bez izmjene, podebljan radi citljivosti na svijetloj podlozi (badge boje su
    // dizajnirane za tamnu pozadinu aplikacije).
    var STATUS_XLSX_COLORS = {
        planiran: { fill: 'FFF4F0FA', font: 'FFB39DDB' },
        'u-letu': { fill: 'FFE7F4FE', font: 'FF5EB3F5' },
        zavrsen: { fill: 'FFE4FAEC', font: 'FF4ADE80' },
        'na-cekanju': { fill: 'FFFEF5E7', font: 'FFF5B95E' },
        odbijen: { fill: 'FFFFE9E9', font: 'FFFF6B6B' },
        otkazan: { fill: 'FFF1F4F7', font: 'FF9FB3C8' }
    };

    var THIN_GRAY_BORDER = { style: 'thin', color: { argb: 'FFC7CFD9' } };
    var CELL_BORDER = { top: THIN_GRAY_BORDER, left: THIN_GRAY_BORDER, bottom: THIN_GRAY_BORDER, right: THIN_GRAY_BORDER };

    // Otkriveno testiranjem: ExcelJS 4.4.0 (browser bundle) potpuno ISPUSTI <col width=.../>
    // za bilo koju kolonu cija je izracunata sirina TACNO cijeli broj 9 (potvrdjeno
    // round-trip testom - write pa ponovo load isog fajla vraca width:null SAMO za sirinu
    // 9, dok 8, 9.1, 10 itd. rade ispravno). Kolona onda pada na Excel-ov default (uska,
    // siječe tekst). Bag u samoj biblioteci, ne u nasoj logici - zaobilazimo ga tako sto
    // sirinu tacno 9 blago pomjerimo na 9.1 (vizuelno neprimjetno, izvan cijelog broja).
    function safeColumnWidth(width) {
        return width === 9 ? 9.1 : width;
    }

    var XLSX_COLUMNS = [
        { header: 'Operater', key: 'operater', minWidth: 14 },
        { header: 'Dron', key: 'dron', minWidth: 12 },
        { header: 'Lokacija', key: 'lokacija', minWidth: 14 },
        { header: 'Status', key: 'status', minWidth: 12 },
        { header: 'Trajanje (min)', key: 'trajanje', minWidth: 14 },
        { header: 'Datum', key: 'datum', minWidth: 12 },
        { header: 'Vrijeme', key: 'vrijeme', minWidth: 9 }
    ];

    async function exportToXlsx() {
        if (currentResults.length === 0) return;

        exportCsvBtn.disabled = true;
        var originalLabel = exportCsvBtn.innerHTML;
        exportCsvBtn.innerHTML = '<span>\u2B07</span> Generisanje...';

        try {
            var workbook = new ExcelJS.Workbook();
            workbook.creator = 'UAV Evidencija';
            workbook.created = new Date();

            var sheet = workbook.addWorksheet('Letovi', {
                views: [{ state: 'frozen', ySplit: 1 }]
            });

            sheet.columns = XLSX_COLUMNS.map(function (c) { return { header: c.header, key: c.key }; });

            // Prati najduzi sadrzaj po koloni (ukljucujuci zaglavlje) da se sirina kolone na
            // kraju podesi prema stvarnom sadrzaju, ne fiksno.
            var maxLen = {};
            XLSX_COLUMNS.forEach(function (c) { maxLen[c.key] = c.header.length; });
            function trackWidth(key, text) {
                var len = (text || '').length;
                if (len > maxLen[key]) maxLen[key] = len;
            }

            currentResults.forEach(function (f) {
                var statusLabel = STATUS_LABELS[f.status] || f.status;
                var dateOnly = flightDateOnly(f.flightDateTime);
                var dateParts = dateOnly.split('-'); // [YYYY, MM, DD]
                // new Date(Date.UTC(...)) - da ExcelJS upise TACAN kalendarski datum bez obzira
                // na vremensku zonu masine na kojoj se .xlsx kasnije otvara (vidi napomenu uz
                // flightDateOnly iznad - datum je vec izracunat u lokalnoj zoni pregledaoca).
                var dateValue = new Date(Date.UTC(
                    parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10)
                ));
                var timeText = formatTime(f.flightDateTime);
                var operaterText = safeText(f.operatorName || '\u2014');
                var dronText = safeText(f.droneName || '\u2014');
                var lokacijaText = safeText(f.location || '\u2014');

                var row = sheet.addRow({
                    operater: operaterText,
                    dron: dronText,
                    lokacija: lokacijaText,
                    status: statusLabel,
                    trajanje: f.durationMinutes || 0,
                    datum: dateValue,
                    vrijeme: timeText
                });

                row.getCell('trajanje').numFmt = '0';
                row.getCell('datum').numFmt = 'dd.mm.yyyy.';

                var colors = STATUS_XLSX_COLORS[f.status];
                var statusCell = row.getCell('status');
                if (colors) {
                    statusCell.font = { bold: true, color: { argb: colors.font } };
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } };
                }

                row.eachCell({ includeEmpty: true }, function (cell) { cell.border = CELL_BORDER; });

                trackWidth('operater', operaterText);
                trackWidth('dron', dronText);
                trackWidth('lokacija', lokacijaText);
                trackWidth('status', statusLabel);
                trackWidth('trajanje', String(f.durationMinutes || 0));
                trackWidth('datum', formatDateBs(dateOnly));
                trackWidth('vrijeme', timeText);
            });

            // Zaglavlje - podebljano, tamno-navy pozadina (ista nijansa kao ostale tamne
            // komponente aplikacije, npr. .filter-select option { background: #10233a }),
            // svijetao tekst za kontrast, zamrznut red (views.state:'frozen' iznad).
            var headerRow = sheet.getRow(1);
            headerRow.eachCell(function (cell) {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10233A' } };
                cell.alignment = { vertical: 'middle' };
                cell.border = CELL_BORDER;
            });

            XLSX_COLUMNS.forEach(function (c, idx) {
                sheet.getColumn(idx + 1).width = safeColumnWidth(Math.max(c.minWidth, maxLen[c.key] + 2));
            });

            sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: XLSX_COLUMNS.length } };

            // Sumarni red - isti brojevi kao kartice na vrhu stranice (statTotal/statHours/
            // statSuccess/statPlanned su vec izracunati u renderStats, ovdje se samo cita
            // njihov trenutni prikazani sadrzaj da izvjestaj tacno odgovara onome sto
            // korisnik vidi na ekranu u trenutku preuzimanja). Prazan red iznad + podebljano
            // vizuelno odvaja sumarni red od podataka.
            sheet.addRow({});
            var summaryRow = sheet.addRow({
                operater: 'Ukupno letova: ' + statTotal.textContent,
                dron: 'Ukupno sati: ' + statHours.textContent,
                lokacija: 'Zavr\u0161enih: ' + statSuccess.textContent,
                status: 'Planirano: ' + statPlanned.textContent
            });
            summaryRow.eachCell(function (cell) { cell.font = { bold: true }; });

            var buffer = await workbook.xlsx.writeBuffer();
            var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'izvjestaj-letovi-' + dateFrom.value + '-do-' + dateTo.value + '.xlsx';
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            exportCsvBtn.disabled = false;
            exportCsvBtn.innerHTML = originalLabel;
        }
    }

    function preparePrintHeader() {
        var from = dateFrom.value;
        var to = dateTo.value;
        printPeriod.textContent = 'Period: ' + (from && to ? formatDateBs(from) + ' – ' + formatDateBs(to) : 'svi letovi');

        var displayName = sessionStorage.getItem('displayName') || 'Kontrola leta';
        printGeneratedBy.textContent = 'Generisao: ' + displayName;

        var now = new Date();
        printGeneratedAt.textContent = 'Datum generisanja: ' + pad2(now.getDate()) + '.' + pad2(now.getMonth() + 1) + '.' + now.getFullYear() + '. u ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    }

    generateBtn.addEventListener('click', generateReport);
    exportCsvBtn.addEventListener('click', exportToXlsx);
    printBtn.addEventListener('click', function () {
        preparePrintHeader();
        window.print();
    });
    dateFrom.addEventListener('change', updateRangeLabel);
    dateTo.addEventListener('change', updateRangeLabel);
    dateFrom.addEventListener('input', updateRangeLabel);
    dateTo.addEventListener('input', updateRangeLabel);

    setDefaultRange();
    updateRangeLabel();

    try {
        allFlights = await apiFetch('/letovi');
        populateFilters();
        generateReport();
    } catch (err) {
        reportBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#ff6b6b;">Greška: ' + escapeHtml(err.message) + '</td></tr>';
    }
});
