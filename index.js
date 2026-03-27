const { initializeWhatsApp } = require('./src/services/whatsapp');

console.log('Iniciando o Bot de WhatsApp...');

const client = initializeWhatsApp();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição não tratada em:', promise, 'razão:', reason);
});
