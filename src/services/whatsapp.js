const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const messageHandler = require('../handlers/messageHandler');

const initializeWhatsApp = () => {
    // Contornar erros de certificado SSL em ambientes corporativos
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
        }
    });

    client.on('qr', (qr) => {
        console.log('Utilize o código QR abaixo para se conectar:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('Bot de WhatsApp está pronto e conectado de forma estável!');
    });

    client.on('authenticated', () => {
        console.log('Autenticado com sucesso! Carregando sessão persistente...');
    });

    client.on('auth_failure', (msg) => {
        console.error('Falha na autenticação (possível sessão expirada):', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('O cliente foi desconectado:', reason);
        client.initialize();
    });

    client.on('change_state', (state) => {
        console.log('Mudança de estado da conexão:', state);
    });

    client.on('message', (message) => {
        messageHandler.handle(message);
    });

    client.initialize().catch(err => {
        console.error('Erro ao inicializar o cliente:', err);
    });

    return client;
};

module.exports = { initializeWhatsApp };
