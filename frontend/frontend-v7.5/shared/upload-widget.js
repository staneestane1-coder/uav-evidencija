/* =====================================================
   UPLOAD WIDGET (ponašanje)
   Automatski oživljava svaku ".upload-zone" na stranici:
   klik za odabir fajlova, drag & drop, i dodavanje u listu
   pored zone (id iz data-list atributa inputa).

   Fajlovi se čuvaju u memoriji (window.UploadWidget) po
   id-ju input elementa, tako da stranica koja radi submit
   forme može da ih pokupi i pošalje na backend (multipart/
   form-data) preko UploadWidget.getFiles(inputId).
   ===================================================== */
window.UploadWidget = {
    _store: {},   // { inputId: [ { uid, file } ] }
    _uidCounter: 0,

    getFiles: function (inputId) {
        return (this._store[inputId] || []).map(function (entry) { return entry.file; });
    },

    clearFiles: function (inputId) {
        this._store[inputId] = [];

        var input = document.getElementById(inputId);
        var list = input && input.dataset.list ? document.getElementById(input.dataset.list) : null;
        if (list) list.innerHTML = '';
    }
};

document.addEventListener('DOMContentLoaded', function () {

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function fileIcon(file) {
        if (file.type.indexOf('image') === 0) return '🖼';
        if (file.type.indexOf('video') === 0) return '🎞';
        return '📄';
    }

    document.querySelectorAll('.upload-input').forEach(function (input) {
        var zone = input.closest('.upload-zone');
        var list = document.getElementById(input.dataset.list);
        if (!zone || !list) return;

        var inputId = input.id;
        if (!window.UploadWidget._store[inputId]) window.UploadWidget._store[inputId] = [];

        function addFiles(fileList) {
            Array.prototype.forEach.call(fileList, function (file) {
                var uid = 'f' + (++window.UploadWidget._uidCounter);
                window.UploadWidget._store[inputId].push({ uid: uid, file: file });

                var li = document.createElement('li');
                li.className = 'file-item';
                li.dataset.uid = uid;

                var iconSpan = document.createElement('span');
                iconSpan.className = 'file-icon';
                iconSpan.textContent = fileIcon(file);

                var nameSpan = document.createElement('span');
                nameSpan.className = 'file-name';
                nameSpan.textContent = file.name; // textContent - siguran od XSS-a, za razliku od innerHTML

                var sizeSpan = document.createElement('span');
                sizeSpan.className = 'file-size';
                sizeSpan.textContent = formatFileSize(file.size);

                var removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'file-remove';
                removeBtn.title = 'Ukloni fajl';
                removeBtn.textContent = '✕';

                li.appendChild(iconSpan);
                li.appendChild(nameSpan);
                li.appendChild(sizeSpan);
                li.appendChild(removeBtn);
                list.appendChild(li);
            });
        }

        input.addEventListener('change', function () {
            if (input.files.length) {
                addFiles(input.files);
                input.value = '';
            }
        });

        ['dragenter', 'dragover'].forEach(function (evt) {
            zone.addEventListener(evt, function (e) {
                e.preventDefault();
                zone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(function (evt) {
            zone.addEventListener(evt, function (e) {
                e.preventDefault();
                zone.classList.remove('dragover');
            });
        });

        zone.addEventListener('drop', function (e) {
            if (e.dataTransfer.files.length) {
                addFiles(e.dataTransfer.files);
            }
        });

        list.addEventListener('click', function (e) {
            if (e.target.classList.contains('file-remove')) {
                var item = e.target.closest('.file-item');
                if (!item) return;
                var uid = item.dataset.uid;
                window.UploadWidget._store[inputId] = window.UploadWidget._store[inputId].filter(function (entry) {
                    return entry.uid !== uid;
                });
                item.remove();
            }
        });
    });
});
