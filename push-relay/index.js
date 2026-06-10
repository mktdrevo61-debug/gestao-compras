const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Chaves VAPID
const PUBLIC_KEY = process.env.PUBLIC_KEY || "BI22n1UHfFpopcHR-ukPVuTBiansu3fYUHvbBCHobYO5Ektm0VvjjJIuJKT4x9mLaIwu4cih2d25m_ebCVMRYY4";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "PwYEqvGJnz5tFQcB68IH_plex2T1BnOT4wtFDdWhAHQ";

webpush.setVapidDetails(
  'mailto:suporte@drevo.com.br',
  PUBLIC_KEY,
  PRIVATE_KEY
);

// Armazena todas as assinaturas em memória
let subscriptions = {};

// Rota raiz
app.get('/', (req, res) => {
  res.send('<h1>DREVO — Servidor de Web Push Ativo</h1><p>Microsserviço de notificações.</p>');
});

// Rota de saúde
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor de Notificações Drevo ativo!', totalAssinaturas: Object.keys(subscriptions).length });
});

// Salvar assinatura de um usuário
app.post('/save-subscription', (req, res) => {
  const { requester, subscription } = req.body;
  if (!requester || !subscription) {
    return res.status(400).json({ error: 'requester e subscription são obrigatórios.' });
  }
  subscriptions[requester.toLowerCase().trim()] = subscription;
  console.log(`Assinatura salva para: ${requester} | Total: ${Object.keys(subscriptions).length}`);
  res.json({ success: true, message: `Assinatura de ${requester} salva!` });
});

// Notificar TODOS os usuários cadastrados
app.post('/notify-all', async (req, res) => {
  const { title, body, tag } = req.body;

  if (Object.keys(subscriptions).length === 0) {
    return res.status(400).json({ error: 'Nenhuma assinatura cadastrada no servidor.' });
  }

  const payload = JSON.stringify({
    title: title || 'DREVO — Gestão de Compras',
    body: body || 'Atualização no seu pedido',
    tag: tag || 'geral'
  });

  const results = [];
  for (const [user, subscription] of Object.entries(subscriptions)) {
    try {
      await webpush.sendNotification(subscription, payload);
      results.push({ user, status: 'enviado' });
      console.log(`Push enviado para: ${user}`);
    } catch (error) {
      console.error(`Erro ao enviar para ${user}:`, error.message);
      // Remove assinaturas expiradas automaticamente
      if (error.statusCode === 410 || error.statusCode === 404) {
        delete subscriptions[user];
        results.push({ user, status: 'expirado_removido' });
      } else {
        results.push({ user, status: 'erro', error: error.message });
      }
    }
  }

  res.json({ success: true, results });
});

// Envio de Push individual (mantido para compatibilidade)
app.post('/send-push', async (req, res) => {
  const { subscription, title, body, tag } = req.body;

  if (!subscription) {
    return res.status(400).json({ error: 'Assinatura ausente.' });
  }

  try {
    const payload = JSON.stringify({
      title: title || 'DREVO — Gestão de Compras',
      body: body || 'Atualização no seu pedido',
      tag: tag || 'geral'
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
