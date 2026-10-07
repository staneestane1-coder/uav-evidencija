/* =====================================================
   MEDIA CAROUSEL + LIGHTBOX
   -----------------------------------------------------
   Zajednička komponenta za operater/admin/kontrola stranice
   "Snimci": prikaz fotografija/videa jedne prijave leta
   preko pune širine kartice (jedan snimak odjednom, sa
   navigacijom naprijed/nazad), i uvećani (lightbox) prikaz
   preko cijelog ekrana na klik - i za fotografije (sa zumom)
   i za video (dugme za proširenje). Video ima veliko dugme
   za pusti/pauziraj preko sredine dok je zaustavljen.
   Prazna kartica (bez snimaka) ima isti okvir kao kartica
   sa snimkom, da sve kartice u gridu ostanu iste visine.

   Upotreba:
       const mc = MediaCarousel.build(flight.mediaFiles, {
           onDelete: function (mediaId, onSuccess) { ... }  // opciono - admin brisanje pojedinačnog snimka
       });
       bodyContent.appendChild(mc.el);
       ...
       mc.addItems(saved);  // poslije uspješnog uploada, doda nove i skoči na njih

       MediaCarousel.wireDropZone(card, function (files) { ... });  // opciono - cijela kartica prima prevučene fajlove

   Očekuje da su shared/api.js (resolveMediaUrl) i
   shared/media-carousel.css već učitani na stranici.
   ===================================================== */
(function () {

    // ---------- LIGHTBOX (singleton, jedan po stranici) ----------
    let lightboxEl, lightboxImg, lightboxVideo, lightboxCounter, lightboxPrevBtn, lightboxNextBtn;
    let lightboxItems = [];
    let lightboxIndex = 0;
    let savedScrollY = 0;

    function isVideo(item) {
        return item.contentType && item.contentType.indexOf('video') === 0;
    }

    function ensureLightbox() {
        if (lightboxEl) return;

        lightboxEl = document.createElement('div');
        lightboxEl.className = 'mc-lightbox';
        lightboxEl.innerHTML =
            '<button type="button" class="mc-lightbox-close" aria-label="Zatvori">✕</button>' +
            '<button type="button" class="mc-lightbox-nav mc-lightbox-prev" aria-label="Prethodni snimak">‹</button>' +
            '<div class="mc-lightbox-stage">' +
                '<img class="mc-lightbox-img" alt="">' +
                '<video class="mc-lightbox-video" controls></video>' +
            '</div>' +
            '<button type="button" class="mc-lightbox-nav mc-lightbox-next" aria-label="Sljedeći snimak">›</button>' +
            '<div class="mc-lightbox-counter"></div>';
        document.body.appendChild(lightboxEl);

        lightboxImg = lightboxEl.querySelector('.mc-lightbox-img');
        lightboxVideo = lightboxEl.querySelector('.mc-lightbox-video');
        lightboxCounter = lightboxEl.querySelector('.mc-lightbox-counter');
        lightboxPrevBtn = lightboxEl.querySelector('.mc-lightbox-prev');
        lightboxNextBtn = lightboxEl.querySelector('.mc-lightbox-next');

        lightboxEl.querySelector('.mc-lightbox-close').addEventListener('click', closeLightbox);
        lightboxEl.addEventListener('click', function (e) {
            if (e.target === lightboxEl) closeLightbox();
        });
        lightboxPrevBtn.addEventListener('click', function () { showLightbox(lightboxIndex - 1); });
        lightboxNextBtn.addEventListener('click', function () { showLightbox(lightboxIndex + 1); });
        lightboxImg.addEventListener('click', function () {
            lightboxImg.classList.toggle('zoomed');
        });

        document.addEventListener('keydown', function (e) {
            if (!lightboxEl.classList.contains('show')) return;
            if (e.key === 'Escape') closeLightbox();
            else if (e.key === 'ArrowLeft') showLightbox(lightboxIndex - 1);
            else if (e.key === 'ArrowRight') showLightbox(lightboxIndex + 1);
        });
    }

    function showLightbox(index) {
        if (!lightboxItems.length) return;
        lightboxIndex = (index + lightboxItems.length) % lightboxItems.length;
        const item = lightboxItems[lightboxIndex];

        lightboxVideo.pause();
        lightboxVideo.removeAttribute('src');
        lightboxImg.classList.remove('zoomed');

        if (isVideo(item)) {
            lightboxImg.style.display = 'none';
            lightboxVideo.style.display = '';
            lightboxVideo.src = resolveMediaUrl(item.url);
        } else {
            lightboxVideo.style.display = 'none';
            lightboxImg.style.display = '';
            lightboxImg.src = resolveMediaUrl(item.url);
            lightboxImg.alt = item.fileName || '';
        }

        lightboxCounter.textContent = (lightboxIndex + 1) + ' / ' + lightboxItems.length;
        const multi = lightboxItems.length > 1;
        lightboxPrevBtn.style.display = multi ? '' : 'none';
        lightboxNextBtn.style.display = multi ? '' : 'none';
        lightboxCounter.style.display = multi ? '' : 'none';
    }

    function openLightbox(items, startIndex) {
        ensureLightbox();
        lightboxItems = items;
        savedScrollY = window.scrollY;
        showLightbox(startIndex);
        lightboxEl.classList.add('show');
        document.body.classList.add('mc-noscroll');
    }

    function closeLightbox() {
        if (!lightboxEl) return;
        lightboxVideo.pause();
        lightboxVideo.removeAttribute('src');
        lightboxEl.classList.remove('show');
        document.body.classList.remove('mc-noscroll');
        window.scrollTo(0, savedScrollY);
    }

    // ---------- DRAG & DROP (opciono, cijela kartica) ----------
    function wireDropZone(el, onFiles) {
        let depth = 0;
        el.addEventListener('dragover', function (e) { e.preventDefault(); });
        el.addEventListener('dragenter', function (e) {
            e.preventDefault();
            depth++;
            el.classList.add('mc-drag-over');
        });
        el.addEventListener('dragleave', function (e) {
            e.preventDefault();
            depth = Math.max(0, depth - 1);
            if (depth === 0) el.classList.remove('mc-drag-over');
        });
        el.addEventListener('drop', function (e) {
            e.preventDefault();
            depth = 0;
            el.classList.remove('mc-drag-over');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                onFiles(e.dataTransfer.files);
            }
        });
    }

    // ---------- CAROUSEL ----------
    function build(initialItems, opts) {
        opts = opts || {};
        const items = (initialItems || []).slice();
        let index = 0;

        const root = document.createElement('div');
        root.className = 'mc-root';

        function render() {
            root.innerHTML = '';

            if (items.length === 0) {
                const slide = document.createElement('div');
                slide.className = 'mc-slide';
                const stage = document.createElement('div');
                stage.className = 'mc-stage mc-stage-empty';
                const empty = document.createElement('p');
                empty.className = 'preview-empty';
                empty.textContent = 'Nema otpremljenih snimaka.';
                stage.appendChild(empty);
                slide.appendChild(stage);
                root.appendChild(slide);
                return;
            }

            if (index >= items.length) index = items.length - 1;
            if (index < 0) index = 0;
            const item = items[index];

            const slide = document.createElement('div');
            slide.className = 'mc-slide';

            const stage = document.createElement('div');
            stage.className = 'mc-stage';

            if (isVideo(item)) {
                const video = document.createElement('video');
                video.src = resolveMediaUrl(item.url);
                video.controls = true;
                video.muted = true;
                stage.appendChild(video);

                const playOverlay = document.createElement('button');
                playOverlay.type = 'button';
                playOverlay.className = 'mc-play-overlay';
                playOverlay.setAttribute('aria-label', 'Pusti video');
                playOverlay.innerHTML = '▶';
                stage.appendChild(playOverlay);

                playOverlay.addEventListener('click', function () { video.play(); });
                video.addEventListener('play', function () { playOverlay.classList.add('hidden'); });
                video.addEventListener('pause', function () { playOverlay.classList.remove('hidden'); });

                const expandBtn = document.createElement('button');
                expandBtn.type = 'button';
                expandBtn.className = 'mc-expand-btn';
                expandBtn.title = 'Prikaži preko cijelog ekrana';
                expandBtn.setAttribute('aria-label', 'Prikaži video preko cijelog ekrana');
                expandBtn.innerHTML = '⛶';
                expandBtn.addEventListener('click', function () {
                    video.pause();
                    openLightbox(items, items.indexOf(item));
                });
                stage.appendChild(expandBtn);
            } else {
                const img = document.createElement('img');
                img.className = 'mc-img';
                img.loading = 'lazy';
                img.src = resolveMediaUrl(item.url);
                img.alt = item.fileName || '';
                stage.appendChild(img);

                img.addEventListener('click', function () {
                    openLightbox(items, items.indexOf(item));
                });

                const expandBtn = document.createElement('button');
                expandBtn.type = 'button';
                expandBtn.className = 'mc-expand-btn';
                expandBtn.title = 'Prikaži preko cijelog ekrana';
                expandBtn.setAttribute('aria-label', 'Prikaži fotografiju preko cijelog ekrana');
                expandBtn.innerHTML = '⛶';
                expandBtn.addEventListener('click', function () {
                    openLightbox(items, items.indexOf(item));
                });
                stage.appendChild(expandBtn);
            }

            if (opts.onDelete && item.id) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'mc-delete-btn';
                delBtn.title = 'Obriši snimak';
                delBtn.setAttribute('aria-label', 'Obriši snimak');
                delBtn.textContent = '✕';
                delBtn.addEventListener('click', function () {
                    opts.onDelete(item.id, function () {
                        const removedIdx = items.indexOf(item);
                        if (removedIdx !== -1) items.splice(removedIdx, 1);
                        renderAndNotify();
                    });
                });
                stage.appendChild(delBtn);
            }

            slide.appendChild(stage);

            if (items.length > 1) {
                const prev = document.createElement('button');
                prev.type = 'button';
                prev.className = 'mc-nav mc-prev';
                prev.setAttribute('aria-label', 'Prethodni snimak');
                prev.innerHTML = '‹';
                prev.addEventListener('click', function () {
                    index = (index - 1 + items.length) % items.length;
                    render();
                });

                const next = document.createElement('button');
                next.type = 'button';
                next.className = 'mc-nav mc-next';
                next.setAttribute('aria-label', 'Sljedeći snimak');
                next.innerHTML = '›';
                next.addEventListener('click', function () {
                    index = (index + 1) % items.length;
                    render();
                });

                slide.appendChild(prev);
                slide.appendChild(next);
            }

            root.appendChild(slide);

            const footer = document.createElement('div');
            footer.className = 'mc-footer';

            const label = document.createElement('span');
            label.className = 'mc-filename';
            label.textContent = item.fileName || '';
            footer.appendChild(label);

            if (items.length > 1) {
                const counter = document.createElement('span');
                counter.className = 'mc-counter';
                counter.textContent = (index + 1) + ' / ' + items.length;
                footer.appendChild(counter);
            }

            root.appendChild(footer);
        }

        function renderAndNotify() {
            render();
            if (opts.onCountChange) opts.onCountChange(items.length);
        }

        renderAndNotify();

        return {
            el: root,
            addItems: function (newItems) {
                items.push.apply(items, newItems);
                index = items.length - 1;
                renderAndNotify();
            }
        };
    }

    window.MediaCarousel = { build: build, wireDropZone: wireDropZone };
})();
