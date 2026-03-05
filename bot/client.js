// bot/client.js
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");
const P = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs").promises;

let sock = null;
let currentQR = null;
let isConnected = false;
let reconnectTimeout = null;
let isShuttingDown = false;
let tentativas = 0;

async function iniciarBot() {
  if (isShuttingDown) {
    console.log("⏳ Reconexão já em andamento.");
    return;
  }
  isShuttingDown = true;

  try {
    console.log(`🔄 Tentativa ${tentativas + 1} de conectar...`);
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    // Proxy opcional via variável de ambiente
    let agent = undefined;
    if (process.env.PROXY_URL) {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      agent = new HttpsProxyAgent(process.env.PROXY_URL);
      console.log("🔌 Usando proxy");
    }

    sock = makeWASocket({
      logger: P({ level: "silent" }),
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      agent: agent,
      version: [2, 3000, 1015901307], // versão específica
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        currentQR = qr;
        isConnected = false;
        console.log("📲 QR Code gerado.");
        tentativas = 0;
      }

      if (connection === "open") {
        console.log("✅ Conectado!");
        currentQR = null;
        isConnected = true;
        isShuttingDown = false;
        tentativas = 0;
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
      }

      if (connection === "close") {
        isConnected = false;
        console.log("❌ Conexão fechada.");

        const statusCode = lastDisconnect?.error
          ? new Boom(lastDisconnect.error)?.output?.statusCode
          : null;
        console.log(`🔍 Código: ${statusCode} - ${lastDisconnect?.error?.message}`);

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          tentativas++;
          const delay = Math.min(5000 * Math.pow(2, tentativas - 1), 60000);
          console.log(`🔄 Reconectar em ${delay / 1000}s`);
          reconnectTimeout = setTimeout(() => {
            isShuttingDown = false;
            iniciarBot();
          }, delay);
        } else {
          console.log("🚪 Deslogado. Apagando sessão...");
          currentQR = null;
          isShuttingDown = false;
          tentativas = 0;
          await fs.rm("./auth", { recursive: true, force: true });
          setTimeout(() => {
            isShuttingDown = false;
            iniciarBot();
          }, 3000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      // ... handlers
    });

  } catch (err) {
    console.error("💥 Erro:", err);
    isShuttingDown = false;
    tentativas++;
    const delay = Math.min(5000 * Math.pow(2, tentativas - 1), 60000);
    setTimeout(iniciarBot, delay);
  }
}

module.exports = { iniciarBot, getQR: () => currentQR, getStatus: () => isConnected };