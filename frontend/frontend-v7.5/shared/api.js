/* =====================================================
   ZAJEDNICKI API HELPER
   -----------------------------------------------------
   Centralizuje:
   - citanje/pisanje JWT tokena u sessionStorage
   - slanje Authorization: Bearer <token> headera
   - parsiranje JSON odgovora i gresaka sa backenda

   Koristi se na svim stranicama koje pozivaju API:
   <script src=".../shared/api-config.js"></script>
   <script src=".../shared/api.js"></script>
   ===================================================== */

function getToken() {
    return sessionStorage.getItem('token');
}

function setAuthSession(data) {
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('role', data.role);
    sessionStorage.setItem('username', data.userName);
    sessionStorage.setItem('displayName', data.displayName);
}

function clearAuthSession() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('displayName');
}

/**
 * Poziva backend API. Automatski dodaje Authorization header
 * (ako token postoji) i Content-Type: application/json
 * (osim kad je body FormData - npr. upload fajlova).
 *
 * @param {string} path - npr. '/dronovi' ili '/letovi/5'
 * @param {object} options - isto sto i fetch() options (method, body...)
 */
async function apiFetch(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const isFormData = options.body instanceof FormData;

    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    const token = getToken();
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    const response = await fetch(API_BASE_URL + path, { ...options, headers });

    // Token istekao ili nevazeci -> nazad na login (sa porukom da je sesija istekla)
    if (response.status === 401) {
        clearAuthSession();
        sessionStorage.setItem('sessionExpired', '1');
        window.location.href = getLoginRedirectPath();
        return null;
    }

    if (!response.ok) {
        let message = 'Greška prilikom komunikacije sa serverom.';
        let body = null;
        try {
            body = await response.json();
            if (body && body.message) message = body.message;
        } catch { /* odgovor nije JSON */ }
        const error = new Error(message);
        error.status = response.status; // npr. 409 = potrebna dodatna potvrda (vidi DronoviController.Delete)
        error.body = body;
        throw error;
    }

    if (response.status === 204) return null; // No Content (npr. DELETE)
    return response.json();
}

/**
 * Gradi punu, direktno otvorivu adresu za snimak/dokument (koristi se u <a href>,
 * <img src>, <video src>...). Fajlovi se sada serviraju kroz autentifikovanu rutu
 * (GET /api/snimci/{id}/file na backendu), a <a>/<img> ne mogu poslati Authorization
 * header, pa se token dodaje kao ?access_token= (backend to prihvata SAMO za tu rutu).
 *
 * @param {string} url - relativna (npr. '/api/snimci/5/file') ili apsolutna adresa iz API odgovora
 */
function resolveMediaUrl(url) {
    if (!url) return '';
    const origin = API_BASE_URL.replace(/\/api$/, '');
    const full = url.startsWith('http') ? url : origin + url;
    const token = getToken();
    if (!token) return full;
    const separator = full.indexOf('?') === -1 ? '?' : '&';
    return full + separator + 'access_token=' + encodeURIComponent(token);
}

/* Putanja do login stranice se racuna na osnovu dubine trenutne
   stranice u odnosu na korijen frontenda (isti princip kao auth.js) */
function getLoginRedirectPath() {
    const depth = window.location.pathname.split('/').filter(Boolean).length;
    // fallback: koristi postojeci auth.js princip ako je dostupan data atribut
    const authScript = document.querySelector('script[data-login-path]');
    if (authScript) return authScript.getAttribute('data-login-path');
    return '../login/login.html';
}
