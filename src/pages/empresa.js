/**
 * Empresa Page Module
 * Gerenciamento de empresas
 */

export function loadEmpresaPage() {
    return `
        <div class="empresa-page">
            <h1>Gerenciamento de Empresas</h1>
            <div id="empresa-list"></div>
        </div>
    `;
}

export function initEmpresaPage() {
    console.log('Empresa page initialized');
    loadEmpresas();
}

async function loadEmpresas() {
    try {
        const response = await fetch('/api/v1/empresas');
        const empresas = await response.json();
        console.log('Empresas loaded:', empresas);
    } catch (error) {
        console.error('Error loading empresas:', error);
    }
}

export default { loadEmpresaPage, initEmpresaPage };
