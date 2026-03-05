// bot/client.js
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const P = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs").promises;

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

async function iniciarBot() {
  // Se já estiver tentando reconectar, aguarda
  if (isShuttingDown) {
    console.log("⏳ Já existe uma tentativa de reconexão em andamento. Ignorando nova chamada.");
    return;
  }
  isShuttingDown = true;

  try {
    console.log("🔄 Iniciando bot...");
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    sock = makeWASocket({
      logger: P({ level: "silent" }),
      auth: state,
      printQRInTerminal: false,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      // Aumenta o tempo de espera para conexão
      connectTimeoutMs: 60000,
      // Desabilita keep-alive manual (já incluso)
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        currentQR = qr;
        isConnected = false;
        console.log("📲 QR Code gerado. Escaneie para conectar.");
      }

      if (connection === "open") {
        console.log("✅ Bot conectado com sucesso!");
        currentQR = null;
        isConnected = true;
        isShuttingDown = false; // libera para futuras reconexões
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      }

      if (connection === "close") {
        isConnected = false;
        console.log("❌ Conexão fechada.");

        // Analisa o motivo
        const statusCode = lastDisconnect?.error
          ? new Boom(lastDisconnect.error)?.output?.statusCode
          : null;
        const errorMessage = lastDisconnect?.error?.message || "Desconhecido";

        console.log(`🔍 Motivo da desconexão: Código ${statusCode} - ${errorMessage}`);

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log("🔄 Tentando reconectar em 5 segundos...");
          reconnectTimeout = setTimeout(() => {
            isShuttingDown = false; // permite nova tentativa
            iniciarBot();
          }, 5000);
        } else {
          console.log("🚪 Deslogado permanentemente. Apagando sessão...");
          currentQR = null;
          isShuttingDown = false;

          try {
            await fs.rm("./auth", { recursive: true, force: true });
            console.log("🗑️ Pasta de autenticação removida.");
          } catch (err) {
            console.error("Erro ao apagar pasta de autenticação:", err);
          }

          // Reconecta para gerar novo QR
          reconnectTimeout = setTimeout(() => {
            isShuttingDown = false;
            iniciarBot();
          }, 3000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const sender = msg.key.remoteJid;
      const texto =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      const entrada = texto.trim().toLowerCase();

      if (atendimentoHumano.has(sender)) {
        iniciarTemporizador(sender);
        return;
      }

      iniciarTemporizador(sender);

      if (!usuariosAtendidos.has(sender)) {
        usuariosAtendidos.add(sender);
        await sock.sendMessage(sender, {
          text: `🤖 *Olá! Seja bem-vindo(a) à New Andrew's Suplementos!*\n\nAntes de começarmos, um aviso importante: nosso sistema de atendimento funciona apenas por *mensagens de texto*. Não respondemos a áudios, imagens, vídeos ou ligações.\n\nEscolha uma opção abaixo:`
        });
        return enviarMenu(sock, sender);
      }

      return responderOpcao(sock, entrada, sender);
    });

  } catch (error) {
    console.error("💥 Erro crítico no iniciarBot:", error);
    isShuttingDown = false;
    // Tenta novamente após erro
    setTimeout(iniciarBot, 10000);
  }
}

function getQR() {
  return currentQR;
}

function getStatus() {
  return isConnected;
}

module.exports = { iniciarBot, getQR, getStatus };