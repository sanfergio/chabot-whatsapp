import os
import time
import threading
import qrcode
from flask import Flask, send_file, render_template_string
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from webdriver_manager.chrome import ChromeDriverManager

# ======================= CONFIGURAÇÕES =======================
TEMPO_INATIVIDADE = 300  # 5 minutos em segundos
SESSION_DIR = "./whatsapp_session"
STATIC_DIR = "static"
QR_CODE_PATH = os.path.join(STATIC_DIR, "qr_temp.png")
os.makedirs(STATIC_DIR, exist_ok=True)

# ======================= ESTADO DO BOT =======================
# Variáveis globais para controle
driver = None
current_qr = None
is_connected = False
keep_running = True
usuarios_ativos = set()
atendimento_humano = set()
temporizadores = {}

# ======================= FUNÇÕES AUXILIARES =======================
def _limpar_usuario(user_id):
    """Remove usuário por inatividade."""
    if user_id in usuarios_ativos:
        usuarios_ativos.remove(user_id)
    if user_id in atendimento_humano:
        atendimento_humano.remove(user_id)
    if user_id in temporizadores:
        del temporizadores[user_id]
    print(f"🧹 Usuário {user_id} removido por inatividade.")

def iniciar_temporizador(user_id):
    """Reinicia o temporizador para um usuário."""
    if user_id in temporizadores:
        temporizadores[user_id].cancel()
    timer = threading.Timer(TEMPO_INATIVIDADE, _limpar_usuario, args=[user_id])
    timer.daemon = True
    timer.start()
    temporizadores[user_id] = timer

def enviar_mensagem(destinatario, texto):
    """
    Envia uma mensagem pelo WhatsApp Web.
    Necessário que o driver esteja na página certa e a conversa esteja aberta.
    Esta é uma versão simplificada; para uso real, refine a localização dos elementos.
    """
    global driver
    try:
        # Tenta encontrar a caixa de texto e enviar
        caixa_texto = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//div[@data-testid='conversation-compose-box-input']"))
        )
        caixa_texto.click()
        caixa_texto.send_keys(texto)
        time.sleep(1)
        # Tenta enviar (botão de enviar)
        botao_enviar = driver.find_element(By.XPATH, "//button[@data-testid='compose-btn-send']")
        botao_enviar.click()
        print(f"📤 Mensagem enviada para {destinatario}: {texto[:30]}...")
        return True
    except Exception as e:
        print(f"❌ Erro ao enviar mensagem: {e}")
        return False

# ======================= MENU E RESPOSTAS =======================
MENU_PRINCIPAL = """
🔹 *Menu Principal - New Andrew's Suplementos* 🔹

1️⃣ - Como funciona?
2️⃣ - Promoções
3️⃣ - Benefícios
4️⃣ - Como comprar?
5️⃣ - Gostaria de ser Revendedor/Parceiro/Representante
6️⃣ - Ver catálogo de Suplementos
7️⃣ - Falar com atendente
8️⃣ - Problemas, reclamações ou insatisfações
9️⃣ - Encerrar conversa

Digite o número da opção desejada.
"""

RESPOSTAS = {
    "1": "🔹 *Como funciona?*\n\nA New Andrew's é uma loja online especializada em suplementos de alta qualidade. Você pode navegar pelo nosso catálogo no site, escolher os produtos desejados e finalizar a compra com entrega rápida para todo o Brasil.\n\n➡️ Acesse: www.newandrews.com.br\n\n*Digite \"menu\" para voltar ao início.*",
    "2": "🎉 *Promoções*\n\nNo momento estamos com *frete grátis* em todas as compras! Também possuímos a promoção: Pague 3 e leve o 4º produto de *GRAÇA!* Além disso, diversos produtos com descontos especiais. Fique de olho no site para não perder nenhuma oferta.\n\n➡️ Confira: www.newandrews.com.br\n\n*Digite \"menu\" para voltar ao início.*",
    "3": "💪 *Benefícios*\n\n✅ Suplementos aprovados pela Anvisa\n✅ Matéria-prima importada\n✅ Entrega rápida e segura\n✅ Atendimento personalizado\n✅ Produtos com alta pureza e eficácia\n\nSaiba mais em www.newandrews.com.br\n\n*Digite \"menu\" para voltar ao início.*",
    "4": "🛒 *Como comprar?*\n\nÉ muito simples:\n1. Acesse www.newandrews.com.br\n2. Navegue pelo catálogo e escolha seus produtos\n3. Adicione ao carrinho\n4. Escolha a forma de pagamento (cartão, boleto ou pix)\n5. Finalize o pedido e aguarde a entrega\n\nQualquer dúvida, estamos aqui!\n\n*Digite \"menu\" para voltar ao início.*",
    "5": "🤝 *Seja um Revendedor / Parceiro / Representante*\n\nQuer fazer parte do time New Andrew's? Entre em contato pelo WhatsApp comercial: (21) 98052-0003 ou clique no link abaixo:\n\nhttps://api.whatsapp.com/send/?phone=5521979089061&text=Ol%C3%A1%21+Tenho+interesse+em+me+tornar+revendedor+ou+parceiro+da+New+Andrew%27s+Suplementos&app_absent=0\n\nOferecemos condições especiais e suporte completo.\n\n*Digite \"menu\" para voltar ao início.*",
    "6": "📘 *Catálogo de Suplementos*\n\nConfira todos os nossos produtos no site:\n👉 https://www.canva.com/design/DAGvooWyDFw/de1huLlR35ZpAAo_OiJgZQ/view?utm_content=DAGvooWyDFw&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hde51656e4f\n\nTemos creatina, aminoácidos, vitaminas e muito mais!\n\n*Digite \"menu\" para voltar ao início.*",
    "7": "👩‍💼 *Falar com atendente*\n\nNo momento não há nenhum atendente online disponível. Por favor, tente mais tarde ou envie sua dúvida por e-mail: produtosnewandrews@newandrews.com.br\n\nOu pelo nosso número de telefone comercial:\n\nhttps://api.whatsapp.com/send/?phone=5521979089061&text=Ol%C3%A1%21+Tenho+interesse+em+me+tornar+revendedor+ou+parceiro+da+New+Andrew%27s+Suplementos&app_absent=0\n\n*Digite \"menu\" para voltar ao início.*",
    "8": "⚠️ *Problemas, reclamações ou insatisfações*\n\nLamentamos por qualquer inconveniente. Para registrar sua reclamação de forma oficial e acompanhar a resolução, acesse nossa página no Reclame Aqui:\n🔗 https://www.reclameaqui.com.br/empresa/produtos-new-andrews/\n\nTambém estamos à disposição pelo e-mail: suporte@newandrews.com.br\n\n*Digite \"menu\" para voltar ao início.*",
    "9": "✅ *Conversa encerrada.*\n\nObrigado por falar com a New Andrew's Suplementos! Sempre que precisar, é só mandar uma mensagem. Para reiniciar, digite qualquer número."
}

def processar_mensagem(remetente, mensagem):
    """Processa a mensagem recebida e decide a resposta."""
    global usuarios_ativos, atendimento_humano
    texto = mensagem.strip().lower()

    # Inicia temporizador de inatividade
    iniciar_temporizador(remetente)

    # Se estiver em atendimento humano (simulado)
    if remetente in atendimento_humano:
        print(f"🔁 Mensagem para atendente de {remetente}: {mensagem}")
        # Não responder automaticamente
        return

    # Se for novo usuário
    if remetente not in usuarios_ativos:
        usuarios_ativos.add(remetente)
        enviar_mensagem(remetente, "🤖 *Olá! Seja bem-vindo(a) à New Andrew's Suplementos!*\n\nAntes de começarmos, um aviso importante: nosso sistema de atendimento funciona apenas por *mensagens de texto*. Não respondemos a áudios, imagens, vídeos ou ligações.\n\nEscolha uma opção abaixo:")
        enviar_mensagem(remetente, MENU_PRINCIPAL)
        return

    # Comando "menu"
    if texto == "menu":
        enviar_mensagem(remetente, MENU_PRINCIPAL)
        return

    # Verifica se é uma opção válida
    if texto in RESPOSTAS:
        enviar_mensagem(remetente, RESPOSTAS[texto])
        if texto == "9":
            # Encerra conversa
            if remetente in usuarios_ativos:
                usuarios_ativos.remove(remetente)
            if remetente in atendimento_humano:
                atendimento_humano.remove(remetente)
    else:
        enviar_mensagem(remetente, "❓ Opção inválida. Digite um número de 1 a 9 ou *menu* para ver as opções novamente.")

# ======================= CONFIGURAÇÃO DO DRIVER =======================
def setup_driver():
    """Configura e retorna o driver do Chrome."""
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")  # Executa sem interface gráfica
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1280,720")
    chrome_options.add_argument(f"user-data-dir={SESSION_DIR}")  # Salva a sessão

    # Preferências para evitar notificações e salvar senhas
    chrome_options.add_experimental_option("excludeSwitches", ["enable-logging"])
    chrome_options.add_experimental_option('prefs', {
        'profile.default_content_setting_values.notifications': 2,
        'credentials_enable_service': False,
        'profile.password_manager_enabled': False,
    })

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.set_page_load_timeout(60)
    driver.set_script_timeout(60)
    return driver

def check_login(driver):
    """Verifica se já está logado (painel de conversas carregado)."""
    try:
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//div[@data-testid='chat-list']"))
        )
        return True
    except TimeoutException:
        return False

def generate_fake_qr():
    """Gera um QR code de exemplo (já que não conseguimos extrair o real)."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data("https://web.whatsapp.com")  # Placeholder
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(QR_CODE_PATH)
    return QR_CODE_PATH

def monitorar_mensagens():
    """Loop principal que monitora novas mensagens não lidas."""
    global driver, is_connected, keep_running
    wait = WebDriverWait(driver, 30)

    while keep_running and is_connected:
        try:
            # Tenta encontrar conversas não lidas
            chats_nao_lidos = driver.find_elements(By.XPATH, "//div[@data-testid='chat-list']/div[contains(@class, 'unread')]")
            for chat in chats_nao_lidos:
                # Clica na conversa
                chat.click()
                time.sleep(2)

                # Pega informações do remetente (simplificado)
                # Em um cenário real, você precisaria extrair o número do contato
                # Vamos usar um remetente fixo para teste
                remetente = "5511999999999@c.us"

                # Pega a última mensagem não lida
                mensagens = driver.find_elements(By.XPATH, "//div[@data-testid='msg-container']")
                if mensagens:
                    ultima_msg = mensagens[-1]
                    texto_msg = ultima_msg.text
                    print(f"📩 Mensagem recebida de {remetente}: {texto_msg}")
                    # Processa a mensagem
                    processar_mensagem(remetente, texto_msg)

                    # Marcar como lida? O próprio clique já deve fazer isso.
                time.sleep(1)
            time.sleep(3)
        except Exception as e:
            print(f"⚠️ Erro no monitoramento: {e}")
            time.sleep(5)

def iniciar_bot():
    """Inicia o bot e gerencia a conexão."""
    global driver, current_qr, is_connected, keep_running
    print("🚀 Iniciando bot WhatsApp (Python)...")

    try:
        driver = setup_driver()
        driver.get("https://web.whatsapp.com")
        print("🌐 Página do WhatsApp Web carregada.")

        # Verifica se já está logado
        if check_login(driver):
            print("✅ Sessão existente encontrada. Conectado!")
            is_connected = True
            current_qr = None
            # Inicia thread de monitoramento
            monitor_thread = threading.Thread(target=monitorar_mensagens, daemon=True)
            monitor_thread.start()
            return
        else:
            print("📲 Nenhuma sessão ativa. Aguardando QR Code...")
            is_connected = False

            # Loop aguardando o QR e o scan
            while keep_running and not is_connected:
                # Tenta detectar o QR na página (simulado: geramos um fake)
                # Em uma implementação real, você precisaria capturar a imagem do canvas
                # Por simplicidade, geramos um QR estático e atualizamos a cada 20s
                if not os.path.exists(QR_CODE_PATH):
                    generate_fake_qr()
                current_qr = QR_CODE_PATH
                print("🔔 QR Code gerado (simulado). Escaneie pelo navegador.")

                # Aguarda o login por até 2 minutos
                try:
                    WebDriverWait(driver, 120).until(
                        EC.presence_of_element_located((By.XPATH, "//div[@data-testid='chat-list']"))
                    )
                    print("✅ QR Escaneado! Conectado.")
                    is_connected = True
                    current_qr = None
                    # Remove QR fake
                    if os.path.exists(QR_CODE_PATH):
                        os.remove(QR_CODE_PATH)
                    monitor_thread = threading.Thread(target=monitorar_mensagens, daemon=True)
                    monitor_thread.start()
                except TimeoutException:
                    print("⏰ Tempo de espera do QR excedido. Gerando novo QR...")
                    # Atualiza o QR (recarregar a página? ou apenas gerar nova imagem)
                    driver.refresh()
                    time.sleep(5)
                    continue
    except Exception as e:
        print(f"❌ Erro fatal no bot: {e}")
        is_connected = False

# ======================= SERVIDOR FLASK =======================
app = Flask(__name__)

@app.route('/')
def index():
    if is_connected:
        return render_template_string('''
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h2>✅ Bot conectado com sucesso!</h2>
                <p>O bot do WhatsApp está online e operando.</p>
            </div>
        ''')

    if current_qr and os.path.exists(current_qr):
        return render_template_string('''
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h1>📱 Escaneie o QR Code</h1>
                <img src="/static/qr_temp.png" alt="QR Code WhatsApp" style="width: 250px; height: 250px;" />
                <p>Aguardando escaneamento... O QR Code é atualizado a cada 20 segundos.</p>
            </div>
            <script>
                setTimeout(() => location.reload(), 5000);
            </script>
        ''')

    return render_template_string('''
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h2>🔄 Iniciando o sistema...</h2>
            <p>Aguarde, o QR Code aparecerá em instantes.</p>
        </div>
        <script>
            setTimeout(() => location.reload(), 3000);
        </script>
    ''')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_file(os.path.join(STATIC_DIR, filename))

# ======================= MAIN =======================
if __name__ == "__main__":
    # Inicia o bot em thread separada
    bot_thread = threading.Thread(target=iniciar_bot, daemon=True)
    bot_thread.start()

    # Inicia o Flask
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)