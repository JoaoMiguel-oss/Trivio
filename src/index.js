/**
 * Trivio - Main Application Entry Point
 * Plataforma de Recrutamento
 * 
 * @version 1.0.0
 * @author Trivio Team
 */

import './styles/global.css';
import { initApp, loadSection } from './components/component2.js';
import config from './config/config.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log(`Iniciando ${config.app.name} v${config.app.version}`);
    initApp();
    
    // Load default section
    const bugsButton = document.querySelector('button[onclick*="bugs"]');
    if (bugsButton) {
        loadSection('bugs', bugsButton);
    }
});

// Export for debugging
window.Trivio = {
    config,
    version: config.app.version
};

export default config;
