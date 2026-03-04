/**
 * User Page Module
 * Gerenciamento de usuários
 */

export function loadUserPage() {
    return `
        <div class="user-page">
            <h1>Gerenciamento de Usuários</h1>
            <div id="user-list"></div>
        </div>
    `;
}

export function initUserPage() {
    console.log('User page initialized');
    loadUsers();
}

async function loadUsers() {
    try {
        const response = await fetch('/api/v1/users');
        const users = await response.json();
        console.log('Users loaded:', users);
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

export default { loadUserPage, initUserPage };
