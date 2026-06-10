const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Chaves VAPID oficiais geradas para a identificação da Drevo
const PUBLIC_KEY = process.env.PUBLIC_KEY || "BI22n1UHfFpopcHR-ukPVuTBiansu3fYUHvbBCHobYO5Ektm0VvjjJIuJKT4x9mLaIwu4cih2d25m_ebCVMRYY4";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "PwYEqvGJnz5tFQcB68IH_plex2T1BnOT4wtFDdWhAHQ";

webpush.setVapidDetails(
  'mailto:suporte@drevo.com.br',
  PUBLIC_KEY,
  PRIVATE_KEY
);

// Rota da Página Inicial (Status)
app.get('/', (req, res) => {
  res.send('<h1>DREVO — Servidor de Web Push Ativo</h1><p>Este é o microsserviço de notificações do app de compras.</p>');
});

// Rota de Teste de Saúde
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor de Notificações Drevo ativo!' });
});

// Rota de Envio de Push
app.post('/send-push', async (req, res) => {
  const { subscription, title, body, tag } = req.body;
  
  if (!subscription) {
    return res.status(400).json({ error: 'Assinatura (subscription) ausente.' });
  }
  
  try {
    const payload = JSON.stringify({
      title: title || 'DREVO — Gestão de Compras',
      body: body || 'Atualização no seu pedido',
      tag: tag || 'general'
    });
    
    await webpush.sendNotification(subscription, payload);
    res.json({ success: true, message: 'Notificação Push enviada com sucesso!' });
  } catch (error) {
    console.error('Erro ao enviar push:', error);
    res.status(500).json({ error: 'Falha no envio do Push', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Relay de Web Push rodando na porta ${PORT}`);
});
