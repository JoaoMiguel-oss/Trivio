# Trivio - Plataforma de Recrutamento

![Trivio](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Descrição

Trivio é uma plataforma de recrutamento moderno desenvolvido com tecnologias web contemporâneas. O projeto utiliza uma arquitetura organizada com frontend e backend separados.

## Estrutura do Projeto

```
projeto/
├── src/
│   ├── components/        # Componentes reutilizáveis
│   │   ├── component1.js  # Componente de navegação
│   │   └── component2.js   # Componente principal da aplicação
│   ├── pages/             # Páginas da aplicação
│   │   ├── index.js       # Página inicial
│   │   ├── user.js        # Gerenciamento de usuários
│   │   └── empresa.js     # Gerenciamento de empresas
│   ├── styles/            # Estilos CSS
│   │   ├── global.css     # Estilos globais
│   │   ├── component1.css # Estilos do componente 1
│   │   └── component2.css # Estilos do componente 2
│   ├── assets/            # Recursos estáticos
│   │   └── images/        # Imagens
│   ├── config/            # Configurações
│   │   └── config.js      # Arquivo de configuração
│   └── index.js           # Ponto de entrada
├── public/
│   └── index.html         # HTML principal
├── .gitignore             # Arquivos ignorados pelo Git
├── package.json           # Dependências do projeto
└── README.md              # Este arquivo
```

## Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express
- **Frameworks**: Tailwind CSS (via CDN)
- **Ícones**: Lucide Icons

## Como Executar

### Pré-requisitos

- Node.js (v14 ou superior)
- npm ou yarn

### Instalação

```bash
# Instalar dependências
npm install
```

### Executar o Projeto

```bash
# Iniciar o servidor de desenvolvimento
npm run dev

# ou

# Iniciar o servidor de produção
npm start
```

O projeto estará disponível em `http://localhost:3000`

## Funcionalidades

- 📊 Dashboard com estatísticas
- 👥 Gerenciamento de usuários
- 🏢 Gerenciamento de empresas
- 💳 Sistema de pagamentos
- ⚙️ Configurações personalizáveis
- 👤 Perfil do usuário
- 🔔 Sistema de notificações

## Contributing

1. Fork o projeto
2. Crie sua branch de feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## Autor

Trivio Team

---

⭐️ Thanks for using Trivio!
