document.addEventListener('DOMContentLoaded', () => {

    const searchInput = document.getElementById('userSearchInput');
    const roleFilter = document.getElementById('userRoleFilter');
    const statusFilter = document.getElementById('userStatusFilter');
    const tableBody = document.getElementById('usersTableBody');
    const emptyState = document.getElementById('usersEmptyState');

    const usersCountLabel = document.getElementById('usersCountLabel');

    const deleteModal = document.getElementById('deleteModal');
    const deleteUserName = document.getElementById('deleteUserName');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    let userIdToDelete = null;

    const ROLE_LABELS = { administrator: 'Administrator', kontrola_leta: 'Kontrola leta', operater: 'Operater' };
    const ROLE_BADGE_CLASS = { administrator: 'admin', kontrola_leta: 'kontrola', operater: 'operater' };

    let allUsers = [];

    // escapeHtml: zajednička implementacija iz shared/snimci-utils.js (učitano prije
    // ove skripte - vidi <script> u dashboard-admin-korisnici.html).
    const escapeHtml = SnimciUtils.escapeHtml;

    function initials(firstName, lastName) {
        return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase();
    }

    async function loadUsers() {
        try {
            allUsers = await apiFetch('/korisnici');
            renderUsers(allUsers);
        } catch (err) {
            tableBody.innerHTML = '';
            emptyState.textContent = 'Greška pri učitavanju korisnika: ' + err.message;
            emptyState.style.display = 'block';
        }
    }

    function renderUsers(users) {
        const query = searchInput.value.trim().toLowerCase();
        const role = roleFilter.value;
        const status = statusFilter.value;

        const filtered = users.filter(u => {
            const fullName = (u.firstName + ' ' + u.lastName).toLowerCase();
            const matchesQuery = query === '' || fullName.includes(query) || u.email.toLowerCase().includes(query);
            const matchesRole = role === '' || u.role === role;
            const matchesStatus = status === '' || u.status === status;
            return matchesQuery && matchesRole && matchesStatus;
        });

        tableBody.innerHTML = '';
        emptyState.style.display = filtered.length === 0 ? 'block' : 'none';
        emptyState.textContent = 'Nema korisnika koji odgovaraju pretrazi.';

        filtered.forEach(user => tableBody.appendChild(buildRow(user)));

        if (usersCountLabel) {
            usersCountLabel.textContent = `Prikazano ${filtered.length} od ${users.length} korisnika`;
        }
    }

    function buildRow(user) {
        const tr = document.createElement('tr');
        const statusBadge = user.status === 'aktivan' ? 'status-enabled' : 'inactive';
        const isSelf = user.userName === sessionStorage.getItem('username');
        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="avatar">${initials(user.firstName, user.lastName)}</div>
                    <div>
                        <div class="user-name">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}${isSelf ? ' <span class="badge" style="margin-left:6px;">Vi</span>' : ''}</div>
                        <div class="user-email">${escapeHtml(user.email)}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge ${ROLE_BADGE_CLASS[user.role] || ''}">${ROLE_LABELS[user.role] || user.role}</span></td>
            <td><span class="badge ${statusBadge}">${user.status === 'aktivan' ? 'Aktivan' : 'Neaktivan'}</span></td>
            <td>${escapeHtml(user.userName)}</td>
            <td>
                <div class="row-actions">
                    <button class="icon-btn edit-btn" title="Izmijeni" aria-label="Izmijeni">✎</button>
                    <button class="icon-btn danger delete-btn" title="${isSelf ? 'Ne možete obrisati sopstveni nalog' : 'Obriši'}" aria-label="${isSelf ? 'Ne možete obrisati sopstveni nalog' : 'Obriši'}" ${isSelf ? 'disabled' : ''}>🗑</button>
                </div>
            </td>
        `;

        tr.querySelector('.edit-btn').addEventListener('click', () => {
            window.location.href = '../izmijeni-korisnika/dashboard-admin-izmijeni-korisnika.html?id=' + user.id;
        });

        if (!isSelf) {
            tr.querySelector('.delete-btn').addEventListener('click', () => {
                userIdToDelete = user.id;
                deleteUserName.textContent = user.firstName + ' ' + user.lastName;
                deleteModal.classList.add('open');
            });
        }

        return tr;
    }

    searchInput.addEventListener('input', () => renderUsers(allUsers));
    roleFilter.addEventListener('change', () => renderUsers(allUsers));
    statusFilter.addEventListener('change', () => renderUsers(allUsers));

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.remove('open');
        userIdToDelete = null;
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        if (userIdToDelete != null) {
            try {
                await apiFetch('/korisnici/' + userIdToDelete, { method: 'DELETE' });
                allUsers = allUsers.filter(u => u.id !== userIdToDelete);
                renderUsers(allUsers);
            } catch (err) {
                alert('Greška pri brisanju korisnika: ' + err.message);
            }
        }
        deleteModal.classList.remove('open');
        userIdToDelete = null;
    });

    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            deleteModal.classList.remove('open');
            userIdToDelete = null;
        }
    });

    loadUsers();
});
