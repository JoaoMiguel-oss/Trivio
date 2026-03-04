/**
 * Trivio - Main Application Entry Point
 * Plataforma de Recrutamento
 */

import { loadSection } from '../components/navigation.js';
import { initApp } from '../components/app.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    loadSection('bugs');
});

export default { version: '1.0.0' };
