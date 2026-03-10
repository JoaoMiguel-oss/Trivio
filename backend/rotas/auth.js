const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// POST /api/v1/auth/cadastro
router.post('/cadastro', authController.cadastrar);

// POST /api/v1/auth/login
router.post('/login', authController.login);

module.exports = router;
