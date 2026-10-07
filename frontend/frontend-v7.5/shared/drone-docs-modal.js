/* =====================================================
   DRONE DOCS MODAL
   Samostalna komponenta (ubrizgava svoj CSS i HTML pri prvom
   korištenju) za prikaz/otpremanje/brisanje fotografija,
   video zapisa i tehničke dokumentacije vezanih DIREKTNO za
   letjelicu (dron), neovisno od pojedinačnih letova.

   Koristi se sa admin/kontrola/operater "Dronovi" stranica:
       window.DroneDocsModal.open(drone, mode)
   mode:
     'admin'     - pregled + dodavanje + brisanje (svi dronovi)
     'kontrola'  - samo pregled (kontrola leta ima samo uvid)
     'operater'  - pregled + dodavanje, bez brisanja (samo za
                   dron koji je operateru dodijeljen - backend
                   ovo svakako provjerava i sam)
   ===================================================== */
(function () {

    var ALLOWED_ACCEPT = '.jpg,.jpeg,.png,.webp,.mp4,.mov,.avi,.pdf,.doc,.docx';

    function injectStylesOnce() {
        if (document.getElementById('ddm-styles')) return;
        var style = document.createElement('style');
        style.id = 'ddm-styles';
        style.textContent = [
            '.ddm-overlay{position:fixed;inset:0;background:rgba(8,14,24,0.72);display:none;align-items:center;justify-content:center;z-index:2000;}',
            '.ddm-overlay.show{display:flex;}',
            '.ddm-panel{background:#16293d;border:1px solid rgba(255,255,255,0.08);border-radius:14px;width:min(560px,92vw);max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.45);}',
            '.ddm-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.08);}',
            '.ddm-header h3{margin:0;font-size:17px;font-weight:700;color:#fff;}',
            '.ddm-close{background:transparent;border:1px solid transparent;border-radius:6px;color:#7a9bbf;font-size:16px;cursor:pointer;line-height:1;padding:4px 8px;transition:background 0.2s,color 0.2s,border-color 0.2s;}',
            '.ddm-close:hover{background:rgba(0,120,212,0.12);border-color:rgba(0,120,212,0.3);color:#5eb3f5;}',
            '.ddm-body{padding:18px 22px 22px;overflow-y:auto;}',
            '.ddm-hint{font-size:13px;color:#7a9bbf;margin:0 0 14px;}',
            '.ddm-list{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:8px;}',
            '.ddm-item{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:8px 10px;}',
            '.ddm-item-icon{font-size:18px;flex:none;}',
            '.ddm-item-name{flex:1;color:#e8f1fb;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:none;}',
            '.ddm-item-name:hover{text-decoration:underline;}',
            '.ddm-item-remove{background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:14px;flex:none;}',
            '.ddm-empty{color:#7a9bbf;font-size:13px;padding:10px 0;}',
            '.ddm-upload{border:1.5px dashed rgba(122,155,191,0.4);border-radius:10px;padding:16px;text-align:center;color:#9fb7d4;font-size:13px;cursor:pointer;display:block;}',
            '.ddm-upload:hover{border-color:#0078d4;color:#e8f1fb;}',
            '.ddm-upload input{display:none;}',
            '.ddm-error{color:#ff6b6b;font-size:13px;margin:8px 0 0;}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function iconFor(fileName, contentType) {
        var ext = (fileName.split('.').pop() || '').toLowerCase();
        if (contentType && contentType.indexOf('image') === 0) return '🖼';
        if (contentType && contentType.indexOf('video') === 0) return '🎞';
        if (ext === 'pdf' || ext === 'doc' || ext === 'docx') return '📄';
        return '📎';
    }

    function ensureModal() {
        injectStylesOnce();
        var overlay = document.getElementById('ddmOverlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.className = 'ddm-overlay';
        overlay.id = 'ddmOverlay';
        overlay.innerHTML =
            '<div class="ddm-panel">' +
                '<div class="ddm-header">' +
                    '<h3 id="ddmTitle">Dokumentacija drona</h3>' +
                    '<button type="button" class="ddm-close" id="ddmClose" aria-label="Zatvori">✕</button>' +
                '</div>' +
                '<div class="ddm-body">' +
                    '<p class="ddm-hint" id="ddmHint"></p>' +
                    '<ul class="ddm-list" id="ddmList"></ul>' +
                    '<label class="ddm-upload" id="ddmUploadZone">' +
                        '⬆ Prevuci fajlove ovdje ili klikni da odabereš (slike, video, PDF, Word)' +
                        '<input type="file" id="ddmUploadInput" accept="' + ALLOWED_ACCEPT + '" multiple>' +
                    '</label>' +
                    '<p class="ddm-error" id="ddmError"></p>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });
        document.getElementById('ddmClose').addEventListener('click', closeModal);

        // ESC zatvara modal - isti obrazac kao shared/media-carousel.js.
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('show')) closeModal();
        });

        return overlay;
    }

    function closeModal() {
        var overlay = document.getElementById('ddmOverlay');
        if (overlay) overlay.classList.remove('show');
    }

    function renderItem(media, canDelete) {
        var li = document.createElement('li');
        li.className = 'ddm-item';
        li.dataset.mediaId = media.id;

        var icon = document.createElement('span');
        icon.className = 'ddm-item-icon';
        icon.textContent = iconFor(media.fileName, media.contentType);

        var link = document.createElement('a');
        link.className = 'ddm-item-name';
        link.href = resolveMediaUrl(media.url);
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = media.fileName; // textContent - bez XSS rizika

        li.appendChild(icon);
        li.appendChild(link);

        if (canDelete) {
            var removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'ddm-item-remove';
            removeBtn.title = 'Obriši';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', function () {
                if (!confirm('Obrisati "' + media.fileName + '"?')) return;
                apiFetch('/snimci/' + media.id, { method: 'DELETE' })
                    .then(function () { li.remove(); })
                    .catch(function (err) { showError(err.message); });
            });
            li.appendChild(removeBtn);
        }

        return li;
    }

    function showError(message) {
        var errEl = document.getElementById('ddmError');
        if (errEl) errEl.textContent = message || '';
    }

    function loadAndRender(droneId, canDelete) {
        var list = document.getElementById('ddmList');
        list.innerHTML = '<li class="ddm-empty">Učitavanje...</li>';
        apiFetch('/snimci?droneId=' + droneId)
            .then(function (items) {
                list.innerHTML = '';
                if (!items.length) {
                    var empty = document.createElement('li');
                    empty.className = 'ddm-empty';
                    empty.textContent = 'Nema priloženih fotografija, video zapisa ni dokumenata.';
                    list.appendChild(empty);
                    return;
                }
                items.forEach(function (m) { list.appendChild(renderItem(m, canDelete)); });
            })
            .catch(function (err) {
                list.innerHTML = '';
                showError('Greška pri učitavanju: ' + err.message);
            });
    }

    function handleUpload(droneId, files, canDelete) {
        if (!files.length) return;
        showError('');
        var formData = new FormData();
        Array.prototype.forEach.call(files, function (f) { formData.append('files', f); });

        apiFetch('/snimci/dron/' + droneId, { method: 'POST', body: formData })
            .then(function (saved) {
                var list = document.getElementById('ddmList');
                var empty = list.querySelector('.ddm-empty');
                if (empty) empty.remove();
                saved.forEach(function (m) { list.appendChild(renderItem(m, canDelete)); });
            })
            .catch(function (err) { showError('Greška pri otpremanju: ' + err.message); });
    }

    window.DroneDocsModal = {
        open: function (drone, mode) {
            var overlay = ensureModal();
            var canUpload = (mode === 'admin' || mode === 'operater');
            var canDelete = (mode === 'admin');

            document.getElementById('ddmTitle').textContent = 'Dokumentacija — ' + (drone.name || '');
            document.getElementById('ddmHint').textContent =
                mode === 'kontrola'
                    ? 'Kontrola leta ima pristup samo za pregled dokumentacije drona.'
                    : 'Fotografije, video zapisi i tehnička dokumentacija (PDF/Word) vezani direktno za ovu letjelicu.';
            showError('');

            var uploadZone = document.getElementById('ddmUploadZone');
            var uploadInput = document.getElementById('ddmUploadInput');
            uploadZone.style.display = canUpload ? 'block' : 'none';

            // Zamijeni input da se izbjegnu duplirani listeneri iz prethodnog otvaranja
            var freshInput = uploadInput.cloneNode(true);
            uploadInput.parentNode.replaceChild(freshInput, uploadInput);
            freshInput.addEventListener('change', function () {
                handleUpload(drone.id, freshInput.files, canDelete);
                freshInput.value = '';
            });

            loadAndRender(drone.id, canDelete);
            overlay.classList.add('show');
        }
    };
})();
