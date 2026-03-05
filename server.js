const express = require("express");
const QRCode = require("qrcode");
const { iniciarBot, getQR, getStatus } = require("./bot/client");

const app = express();
const PORT = 5000;

app.get("/", async (req, res) => {
  const qr = getQR();
  const conectado = getStatus();

  if (conectado) {
    return res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h2>✅ Bot conectado com sucesso!</h2>
        <p>A API do WhatsApp está online e operando.</p>
      </div>
    `);
  }

  if (qr) {
    const qrImage = await QRCode.toDataURL(qr);
    return res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1>📱 Escaneie o QR Code</h1>
        <img src="${qrImage}" alt="QR Code WhatsApp" style="width: 250px; height: 250px;" />
        <p>Aguardando escaneamento... O QR Code se atualiza sozinho.</p>
      </div>
      <script>
        setTimeout(() => location.reload(), 15000);
      </script>
    `);
  }

  res.send(`
    <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
      <h2>🔄 Iniciando o sistema ou limpando sessão anterior...</h2>
      <p>Aguarde um momento, o QR Code aparecerá em instantes.</p>
    </div>
    <script>
      setTimeout(() => location.reload(), 3000);
    </script>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando em: http://localhost:${PORT}`);
  iniciarBot(); // Única chamada para iniciar o bot
});