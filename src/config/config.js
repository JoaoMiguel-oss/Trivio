/**
 * Trivio Configuration
 * Configurações globais da aplicação
 */

const config = {
    // API Configuration
    api: {
        baseUrl: 'https://trivio.up.railway.app',
        version: 'v1',
        endpoints: {
            users: '/api/v1/users',
            empresas: '/api/v1/empresas',
            autenticacao: '/api/v1/auth',
            upload: '/api/v1/upload'
        }
    },

    // App Configuration
    app: {
        name: 'Trivio',
        version: '1.0.0',
        description: 'Plataforma de Recrutamento'
    },

    // Colors (matching CSS variables)
    colors: {
        primary: '#E91E63',
        accent: '#FF1493',
        darkBg: '#1A1A1A',
        surface: '#242424',
        text: '#FFFFFF',
        textMuted: '#9CA3AF'
    },

    // Feature Flags
    features: {
        enableDarkMode: true,
        enableNotifications: true,
        enableAnalytics: false
    }
};

export default config;
