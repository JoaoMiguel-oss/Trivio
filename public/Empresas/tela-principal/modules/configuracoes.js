/**
 * Configurações - Módulo de Funcionalidade da Página de Configurações
 * Gerencia a navegação por abas e alternância de conteúdo
 */

// Variável para controlar a aba ativa
let activeTab = 'perfil';

/**
 * Busca as vagas resolvidas do candidato
 * @param {string} candidatoId - ID público do candidato
 * @returns {Promise<Array>} Lista de vagas resolvidas
 */
async function buscarVagasResolvidas(candidatoId) {
    try {
        const response = await fetch(`/api/v1/desafios/meus/${candidatoId}`);
        if (!response.ok) {
            throw new Error('Erro ao buscar vagas resolvidas');
        }
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('Erro ao buscar vagas resolvidas:', error);
        return [];
    }
}

/**
 * Renderiza a seção de vagas resolvidas
 * @param {Array} vagas - Lista de vagas resolvidas
 */
function renderizarVagasResolvidas(vagas) {
    const container = document.getElementById('vagas-resolvidas-container');
    if (!container) return;

    if (vagas.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700 flex items-center justify-center">
                    <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-medium text-gray-300 mb-2">Nenhuma vaga resolvida ainda</h3>
                <p class="text-gray-500">Quando você resolver desafios técnicos, eles aparecerão aqui.</p>
            </div>
        `;
        return;
    }

    const vagasHTML = vagas.map(vaga => {
        const statusClass = vaga.status === 'entregue' ? 'bg-blue-500' :
                          vaga.avancou_entrevista ? 'bg-green-500' : 'bg-gray-500';
        const statusText = vaga.status === 'entregue' ? 'Entregue' :
                          vaga.avancou_entrevista ? 'Avançou' : 'Em andamento';

        return `
            <div class="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-white mb-1">${vaga.titulo}</h3>
                        <p class="text-gray-400 text-sm mb-2">${vaga.empresa_nome}</p>
                        <div class="flex items-center gap-4 text-sm text-gray-500">
                            <span class="flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                                </svg>
                                ${vaga.stack}
                            </span>
                            <span class="flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                ${vaga.tempo_limite_h}h limite
                            </span>
                        </div>
                    </div>
                    <div class="text-right">
                        ${vaga.score_ia ? `
                            <div class="text-2xl font-bold ${vaga.score_ia >= 8 ? 'text-green-400' : vaga.score_ia >= 6 ? 'text-yellow-400' : 'text-red-400'}">
                                ${vaga.score_ia}/10
                            </div>
                            <div class="text-xs text-gray-500 mt-1">Avaliação IA</div>
                        ` : ''}
                    </div>
                </div>

                <div class="flex items-center justify-between">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusClass} text-white">
                        ${statusText}
                    </span>
                    <div class="text-sm text-gray-500">
                        Iniciado em ${new Date(vaga.iniciado_em).toLocaleDateString('pt-BR')}
                    </div>
                </div>

                ${vaga.bolsa_tecnica > 0 ? `
                    <div class="mt-4 pt-4 border-t border-gray-700">
                        <div class="flex items-center gap-2 text-green-400">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                            </svg>
                            <span class="font-medium">R$ ${vaga.bolsa_tecnica.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <span class="text-sm text-gray-400">bolsa técnica</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-2">Vagas Resolvidas</h3>
            <p class="text-gray-400">Seu histórico de desafios técnicos e avaliações realizadas</p>
        </div>
        <div class="grid gap-4">
            ${vagasHTML}
        </div>
    `;
}

/**
 * Inicializa os event listeners quando o DOM está pronto
 */
function initializeSettingsTabs() {
    // Define a primeira aba como ativa por padrão
    const firstTabButton = document.querySelector('.settings-nav-item');
    if (firstTabButton) {
        firstTabButton.classList.add('settings-nav-active');
    }
    
    // Exibe o conteúdo da aba inicial
    showTabContent('perfil');
}

/**
 * Carrega uma aba de configuração específica
 * @param {string} tabId - ID da aba a ser carregada
 * @param {HTMLElement} button - Botão que foi clicado
 */
function loadSettingsTab(tabId, button) {
    // Remove a classe active de todos os botões
    const allButtons = document.querySelectorAll('.settings-nav-item');
    allButtons.forEach(btn => {
        btn.classList.remove('settings-nav-active');
        btn.style.backgroundColor = '';
    });
    
    // Adiciona a classe active ao botão clicado
    button.classList.add('settings-nav-active');
    button.style.backgroundColor = 'var(--color-primary)';
    
    // Atualiza a variável de aba ativa
    activeTab = tabId;
    
    // Exibe o conteúdo da aba selecionada com animação
    showTabContent(tabId);
}

/**
 * Exibe o conteúdo da aba especificada e esconde os outros
 * @param {string} tabId - ID da aba a ser exibida
 */
function showTabContent(tabId) {
    // Esconde todos os conteúdos de abas
    const allTabContents = document.querySelectorAll('.settings-tab-content');
    allTabContents.forEach(content => {
        content.classList.remove('active');
        content.style.opacity = '0';
        content.style.transform = 'translateX(30px)';
    });

    // Exibe o conteúdo da aba selecionada
    const selectedContent = document.getElementById('tab-' + tabId);
    if (selectedContent) {
        // Pequeno delay para permitir a transição
        setTimeout(() => {
            selectedContent.classList.add('active');
            selectedContent.style.opacity = '1';
            selectedContent.style.transform = 'translateX(0)';

            // Carrega dados específicos da aba se necessário
            if (tabId === 'vagas-resolvidas') {
                carregarVagasResolvidas();
            }
        }, 50);
    }
}

/**
 * Carrega as vagas resolvidas do candidato atual
 */
async function carregarVagasResolvidas() {
    const usuario = JSON.parse(sessionStorage.getItem('usuario') || '{}');
    if (!usuario.public_id) {
        renderizarVagasResolvidas([]);
        return;
    }

    const container = document.getElementById('vagas-resolvidas-container');
    if (!container) return;

    // Mostra loading
    container.innerHTML = `
        <div class="text-center py-12">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700 flex items-center justify-center">
                <svg class="w-8 h-8 text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-300 mb-2">Carregando vagas resolvidas...</h3>
            <p class="text-gray-500">Aguarde enquanto buscamos seu histórico.</p>
        </div>
    `;

    // Busca as vagas
    const vagas = await buscarVagasResolvidas(usuario.public_id);

    // Inicializa os selects de filtro e ordenação
    const sortSelect = document.getElementById('vagas-sort-select');
    const filterSelect = document.getElementById('vagas-filter-select');
    if (sortSelect) sortSelect.value = 'data-desc';
    if (filterSelect) filterSelect.value = 'todas';

    renderizarVagasResolvidas(vagas);
}

/**
 * Ordena as vagas resolvidas
 */
function ordenarVagasResolvidas() {
    aplicarFiltrosOrdenacao();
}

/**
 * Filtra as vagas resolvidas
 */
function filtrarVagasResolvidas() {
    aplicarFiltrosOrdenacao();
}

/**
 * Aplica filtros e ordenação às vagas
 */
function aplicarFiltrosOrdenacao() {
    const usuario = JSON.parse(sessionStorage.getItem('usuario') || '{}');
    if (!usuario.public_id) return;

    // Re-busca as vagas e aplica filtros
    carregarVagasResolvidas();
}
        }, 50);
    }
}

// Variável global para armazenar as vagas originais
let vagasOriginais = [];

/**
 * Carrega as vagas resolvidas do candidato atual
 */
async function carregarVagasResolvidas() {
    const usuario = JSON.parse(sessionStorage.getItem('usuario') || '{}');
    if (!usuario.public_id) {
        renderizarVagasResolvidas([]);
        return;
    }

    const container = document.getElementById('vagas-resolvidas-container');
    if (!container) return;

    // Mostra loading
    container.innerHTML = `
        <div class="text-center py-12">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700 flex items-center justify-center">
                <svg class="w-8 h-8 text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-300 mb-2">Carregando vagas resolvidas...</h3>
            <p class="text-gray-500">Aguarde enquanto buscamos seu histórico.</p>
        </div>
    `;

    // Busca as vagas
    vagasOriginais = await buscarVagasResolvidas(usuario.public_id);

    // Inicializa os selects de filtro e ordenação
    const sortSelect = document.getElementById('vagas-sort-select');
    const filterSelect = document.getElementById('vagas-filter-select');
    if (sortSelect) sortSelect.value = 'data-desc';
    if (filterSelect) filterSelect.value = 'todas';

    // Aplica filtros e ordenação iniciais
    aplicarFiltrosEOrdenacao();
}

/**
 * Aplica filtros e ordenação às vagas
 */
function aplicarFiltrosEOrdenacao() {
    let vagasFiltradas = [...vagasOriginais];

    // Aplica filtro
    const filtroSelecionado = document.getElementById('vagas-filter-select')?.value || 'todas';
    if (filtroSelecionado !== 'todas') {
        switch (filtroSelecionado) {
            case 'entregue':
                vagasFiltradas = vagasFiltradas.filter(v => v.status === 'entregue');
                break;
            case 'avancou':
                vagasFiltradas = vagasFiltradas.filter(v => v.avancou_entrevista);
                break;
            case 'avaliadas':
                vagasFiltradas = vagasFiltradas.filter(v => v.score_ia);
                break;
        }
    }

    // Aplica ordenação
    const ordenacaoSelecionada = document.getElementById('vagas-sort-select')?.value || 'data-desc';
    vagasFiltradas.sort((a, b) => {
        switch (ordenacaoSelecionada) {
            case 'data-desc':
                return new Date(b.iniciado_em) - new Date(a.iniciado_em);
            case 'data-asc':
                return new Date(a.iniciado_em) - new Date(b.iniciado_em);
            case 'score-desc':
                return (b.score_ia || 0) - (a.score_ia || 0);
            case 'score-asc':
                return (a.score_ia || 0) - (b.score_ia || 0);
            case 'status':
                // Prioriza: avançou > entregue > outros
                const statusA = a.avancou_entrevista ? 3 : a.status === 'entregue' ? 2 : 1;
                const statusB = b.avancou_entrevista ? 3 : b.status === 'entregue' ? 2 : 1;
                return statusB - statusA;
            default:
                return 0;
        }
    });

    renderizarVagasResolvidas(vagasFiltradas);
}

/**
 * Ordena as vagas resolvidas
 */
function ordenarVagasResolvidas() {
    aplicarFiltrosEOrdenacao();
}

/**
 * Filtra as vagas resolvidas
 */
function filtrarVagasResolvidas() {
    aplicarFiltrosEOrdenacao();
}

/**
 * Alterna a visibilidade da sidebar (mobile)
 */
function toggleSettingsSidebar() {
    const sidebar = document.getElementById('settings-sidebar');
    const overlay = document.getElementById('settings-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
        
        // Impede scroll do body quando sidebar está aberta
        document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
    }
}

/**
 * Salva as configurações do formulário ativo
 * @param {string} tabId - ID da aba atual
 */
function saveSettings(tabId) {
    // Feedback visual de salvamento
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.textContent.includes('Salvar') || btn.textContent.includes('Salvar')) {
            const originalText = btn.textContent;
            btn.textContent = 'Salvando...';
            btn.style.opacity = '0.7';
            
            setTimeout(() => {
                btn.textContent = '✓ Salvo!';
                btn.style.opacity = '1';
                
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1500);
            }, 800);
        }
    });
}

// Exporta funções para uso global
window.loadSettingsTab = loadSettingsTab;
window.toggleSettingsSidebar = toggleSettingsSidebar;
window.saveSettings = saveSettings;
