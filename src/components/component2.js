/**
 * App Component
 * Inicialização principal da aplicação
 */

export function initApp() {
    console.log('Trivio App initialized');
    
    // Initialize navigation
    initNavigation();
}

function initNavigation() {
    const bugsButton = document.querySelector('button[onclick*="bugs"]');
    if (bugsButton) {
        loadSection('bugs', bugsButton);
    }
}

export function loadSection(sectionName, buttonElement) {
    fetch(`./modules/${sectionName}.html`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        })
        .then(html => {
            document.getElementById('main-content').innerHTML = html;
            updateNavState(buttonElement);
        })
        .catch(error => {
            console.error(`Erro ao carregar módulo ${sectionName}:`, error);
            showError(sectionName, error);
        });
}

function updateNavState(buttonElement) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('nav-item-active'));
    buttonElement.classList.add('nav-item-active');
    buttonElement.style.backgroundColor = 'var(--color-primary)';
    navItems.forEach(item => {
        if (item !== buttonElement) {
            item.style.backgroundColor = 'transparent';
        }
    });
}

function showError(sectionName, error) {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="p-6 rounded-lg" style="background-color: var(--color-surface);">
                <p class="text-red-400 font-semibold mb-2">⚠️ Erro ao carregar conteúdo</p>
                <p class="text-sm text-gray-400">Módulo: ${sectionName}</p>
                <p class="text-xs text-gray-500 mt-2">Erro: ${error.message}</p>
            </div>
        `;
    }
}

export default { initApp, loadSection };
