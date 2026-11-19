#  Trivio - Plataforma de Triagem Técnica e Recrutamento

![Version](https://shields.io)
![License](https://shields.io)
[![Status](https://shields.io)](https://onrender.com)
[![Hosting](https://shields.io)](https://onrender.com)


> **Conectando Talentos às Oportunidades** — Uma solução moderna e ágil para processos de triagem técnica e gestão de recrutamento.

🌐 **Acesse a aplicação online:** [https://trivio-gz8l.onrender.com](https://trivio-gz8l.onrender.com)

---

## 📋 Sobre o Projeto

O **Trivio** é uma plataforma web focada em otimizar a triagem técnica e conectar candidatos a empresas de forma eficiente. Desenvolvido com uma arquitetura modular que separa claramente as responsabilidades entre interface e regras de negócio, o sistema oferece uma experiência fluida tanto para recrutadores quanto para profissionais em busca de novas oportunidades.

*(Nota: Como a aplicação está hospedada no plano gratuito do Render, o primeiro acesso após um período de inatividade pode levar alguns segundos para iniciar o servidor).*

---

##  Funcionalidades Principais

- 📊 **Dashboard Analítico:** Visualização rápida de métricas e estatísticas do processo seletivo.
- 🎯 **Triagem Técnica:** Fluxo estruturado para avaliação e filtragem de talentos.
- 👥 **Gestão de Candidatos (Usuários):** Cadastro, edição e acompanhamento de perfis profissionais.
- 🏢 **Portal de Empresas:** Gerenciamento de contas corporativas e oportunidades.
- 👤 **Perfil Personalizado:** Área dedicada para atualização de dados e portfólio.
- 🔔 **Central de Notificações:** Alertas em tempo real sobre atualizações nas etapas.
- 💳 **Módulo de Pagamentos:** Gestão de planos e assinaturas dentro da plataforma.
- ⚙️ **Configurações:** Personalização de preferências do sistema.

---

##  Tecnologias Utilizadas

### Frontend
- **HTML5 & CSS3:** Estruturação semântica e estilização responsiva.
- **JavaScript (ES6+):** Interatividade e consumo de APIs.
- **Tailwind CSS:** Estilização utilitária rápida (via CDN).
- **Lucide Icons:** Biblioteca de ícones modernos e consistentes.

### Backend & Banco de Dados
- **Node.js:** Ambiente de execução JavaScript no servidor.
- **Express:** Framework minimalista para construção de rotas e APIs REST.
- **SQLite:** Banco de dados relacional leve, rápido e embutido para persistência dos dados.

### Infraestrutura & Deploy
- **Render:** Plataforma de nuvem utilizada para hospedagem e deploy contínuo da aplicação.

---

## 📂 Estrutura do Projeto

```text
projeto/
├── public/
│   └── index.html         # Ponto de entrada HTML principal
├── src/
│   ├── assets/            # Recursos estáticos (imagens, fontes, etc.)
│   │   └── images/        
│   ├── components/        # Componentes reutilizáveis da interface
│   │   ├── component1.js  # Componente de navegação
│   │   └── component2.js  # Componente principal da aplicação
│   ├── config/            # Configurações de ambiente e banco de dados
│   │   └── config.js      
│   ├── pages/             # Páginas e visualizações do sistema
│   │   ├── index.js       # Página inicial
│   │   ├── user.js        # Gerenciamento de usuários/candidatos
│   │   └── empresa.js     # Gerenciamento de empresas
│   ├── styles/            # Folhas de estilo CSS
│   │   ├── global.css     # Estilos globais
│   │   ├── component1.css # Estilos da navegação
│   │   └── component2.css # Estilos do componente principal
│   └── index.js           # Inicialização do servidor e rotas
├── .gitignore             # Arquivos ignorados pelo controle de versão
├── package.json           # Dependências e scripts do projeto
└── README.md              # Documentação do projeto
```

---

##  Como Executar Localmente

### Pré-requisitos

Certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org) (versão 14 ou superior)
- Gerenciador de pacotes **npm** ou **yarn**

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com
   cd trivio
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie a aplicação:**
   ```bash
   # Para ambiente de desenvolvimento (com hot-reload, se configurado)
   npm run dev

   # Ou para ambiente de produção
   npm start
   ```

4. **Acesse no navegador:**
   Abra `http://localhost:3000` para visualizar o projeto rodando localmente.

---

## 🤝 Como Contribuir

Contribuições são muito bem-vindas! Se você deseja melhorar o **Trivio**, siga os passos abaixo:

1. Faça um **Fork** do projeto.
2. Crie uma nova branch para sua funcionalidade (`git checkout -b feature/MinhaNovaFeature`).
3. Faça o commit das suas alterações (`git commit -m 'feat: Adiciona nova funcionalidade'`).
4. Envie para o repositório remoto (`git push origin feature/MinhaNovaFeature`).
5. Abra um **Pull Request**.

---


---

## 👨‍💻 Autor

Desenvolvido por **Trivio Team** 🚀

---

⭐️ *Se este projeto te ajudou ou você gostou da proposta, considere deixar uma estrela no repositório!*
