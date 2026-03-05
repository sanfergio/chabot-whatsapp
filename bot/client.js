// bot/client.js
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const P = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs").promises;
const { Agent } = require('https'); // para proxy, se necessário

const { enviarMenu, responderOpcao } = require("./handlers");
const {
  iniciarTemporizador,
  usuariosAtendidos,
  atendimentoHumano
} = require("./state");

let sock = null;
let currentQR = null;
let isConnected = false;
let reconnectTimeout = null;
let isShuttingDown = false;
let tentativasReconexao = 0;

async function iniciarBot() {
  if (isShuttingDown) {
    console.log("⏳ Já existe uma tentativa de reconexão em andamento. Ignorando nova chamada.");
    return;
  }
  isShuttingDown = true;

  try {
    console.log("🔄 Iniciando bot... (tentativa " + (tentativasReconexao + 1) + ")");
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    // Configuração de proxy, se definido na variável de ambiente
    const proxyUrl = process.env.PROXY_URL;
    let agent = undefined;
    if (proxyUrl) {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      agent = new HttpsProxyAgent(proxyUrl);
      console.log("🔌 Usando proxy:", proxyUrl);
    }

    const socketConfig = {
      logger: P({ level: "silent" }),
      auth: state,
      printQRInTerminal: false,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      // Tenta com versão mobile? Não recomendado.
      // browser: Browsers.macOS, // pode ajudar?
      agent: agent, // passa o agente de proxy
    };

    sock = makeWASocket(socketConfig);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        currentQR = qr;
        isConnected = false;
        console.log("📲 QR Code gerado. Escaneie para conectar.");
        tentativasReconexao = 0; // reset ao gerar QR
      }

      if (connection === "open") {
        console.log("✅ Bot conectado com sucesso!");
        currentQR = null;
        isConnected = true;
        isShuttingDown = false;
        tentativasReconexao = 0;
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      }

      if (connection === "close") {
        isConnected = false;
        console.log("❌ Conexão fechada.");

        const statusCode = lastDisconnect?.error
          ? new Boom(lastDisconnect.error)?.output?.statusCode
          : null;
        const errorMessage = lastDisconnect?.error?.message || "Desconhecido";

        console.log(`🔍 Motivo: Código ${statusCode} - ${errorMessage}`);

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          tentativasReconexao++;
          // Backoff exponencial: 5s, 10s, 20s, 40s, max 60s
          const delay = Math.min(5000 * Math.pow(2, tentativasReconexao - 1), 60000);
          console.log(`🔄 Tentando reconectar em ${delay / 1000} segundos... (tentativa ${tentativasReconexao})`);
          reconnectTimeout = setTimeout(() => {
            isShuttingDown = false;
            iniciarBot();
          }, delay);
        } else {
          console.log("🚪 Deslogado permanentemente. Apagando sessão...");
          currentQR = null;
          isShuttingDown = false;
          tentativasReconexao = 0;

          try {
            await fs.rm("./auth", { recursive: true, force: true });
            console.log("🗑️ Pasta de autenticação removida.");
          } catch (err) {
            console.error("Erro ao apagar pasta de autenticação:", err);
          }

          // Reconecta após limpeza
          reconnectTimeout = setTimeout(() => {
            isShuttingDown = false;
            iniciarBot();
          }, 3000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      // ... (mesmo código de antes)
    });

  } catch (error) {
    console.error("💥 Erro crítico no iniciarBot:", error);
    isShuttingDown = false;
    tentativasReconexao++;
    const delay = Math.min(5000 * Math.pow(2, tentativasReconexao - 1), 60000);
    setTimeout(iniciarBot, delay);
  }
}

function getQR() {
  return currentQR;
}

function getStatus() {
  return isConnected;
}

module.exports = { iniciarBot, getQR, getStatus };