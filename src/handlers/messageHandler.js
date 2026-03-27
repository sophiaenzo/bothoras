const { getAiResponse } = require('../services/ai');
const { verificarTelefone, registrarApontamento, registrarTarefa } = require('../services/apiTramar');

const chatHistories = {};

const handle = async (message) => {
    const chat = await message.getChat();

    // Ignora grupos, newsletters, canais e mensagens de sistema
    if (
        chat.isGroup ||
        message.from.includes('status') ||
        message.from.includes('broadcast') ||
        message.from.includes('newsletter') ||
        message.from.includes('channel')
    ) {
        return;
    }

    // Tenta pegar o número real do remetente
    // Alguns usuários chegam com LID (Linked ID) em vez de número de telefone
    let fullNumber = message.from.split('@')[0];
    const fromDomain = message.from.split('@')[1] || '';



    // Se o domínio é 'lid' ou o número parece um LID (não começa com código de país válido),
    // tenta resolver o número real via getContact()
    if (fromDomain === 'lid' || !/^\d{10,14}$/.test(fullNumber)) {
        try {
            const contact = await message.getContact();
            const contactNumber = contact.number || contact.id?.user;

            if (contactNumber && /^\d{10,14}$/.test(contactNumber)) {
                fullNumber = contactNumber;
            } else {

                return;
            }
        } catch (err) {

            return;
        }
    }



    const senderNumber = fullNumber.startsWith('55') ? fullNumber.substring(2) : fullNumber;
    const userStatus = await verificarTelefone(senderNumber);

    if (!userStatus || userStatus.status !== 'ok' || !userStatus.cadastrado) {
        console.log(`Acesso negado para o número: ${senderNumber}`);
        return;
    }

    const userName = userStatus.usuario?.nome || userStatus.usuario?.name || 'você';
    const userId = userStatus.usuario?.id;
    console.log(`Acesso autorizado para: ${userName} (${senderNumber})`);

    if (!chatHistories[senderNumber]) {
        chatHistories[senderNumber] = [];
    }
    const history = chatHistories[senderNumber];

    const text = message.body ? message.body.toLowerCase() : '';

    if (text === '!ping') {
        return await message.reply('pong!');
    }

    await chat.sendStateTyping();

    const isAudio = message.hasMedia && (message.type === 'audio' || message.type === 'voice' || message.type === 'ptt');
    let aiResponse;

    const userProjects = userStatus.usuario?.projetos || [];

    try {
        if (isAudio) {
            console.log(`Recebido áudio do tipo: ${message.type}. Processando...`);
            const media = await message.downloadMedia();
            if (!media) {
                console.error('Falha ao baixar mídia.');
                await chat.clearState();
                return await message.reply('Não consegui baixar o áudio para processar.');
            }
            aiResponse = await getAiResponse('O usuário enviou um áudio. Por favor, entenda o que ele disse e responda adequadamente.', media, userName, history, userProjects);
        } else {
            if (!message.body || message.body.trim() === '') {
                await chat.clearState();
                return;
            }
            aiResponse = await getAiResponse(message.body, null, userName, history, userProjects);
        }

        await chat.clearState();

        if (aiResponse.type === 'functionCall') {
            const funcCall = aiResponse.content;
            if (funcCall.name === 'registrar_apontamento') {
                const args = funcCall.args;

                const payload = {
                    id_projeto: args.id_projeto,
                    id_tarefa: args.id_tarefa,
                    id_pessoa: userId,
                    data_movi: args.data_movi,
                    hora_ini: args.hora_ini,
                    hora_fim: args.hora_fim,
                    situacoes: [args.situacao],
                    observa: args.observa || "Apontamento via Assistente Virtual"
                };


                const result = await registrarApontamento(payload);

                let respostaConfirmacao = '';
                if (result && result.status !== 'error') {
                    respostaConfirmacao = `✅ Entendido! Registrei ${args.hora_ini} até ${args.hora_fim} na tarefa solicitada. O status foi atualizado.`;
                } else {
                    respostaConfirmacao = `❌ Houve um problema ao tentar registrar as horas na API. Erro: ${result?.message || 'Desconhecido'}`;
                }

                await message.reply(respostaConfirmacao);

                history.push({ role: 'user', text: isAudio ? '[Áudio enviado]' : message.body });
                history.push({ role: 'model', text: respostaConfirmacao });
            } else if (funcCall.name === 'criar_tarefa') {
                const args = funcCall.args;

                const payload = {
                    id_projeto: args.id_projeto,
                    titulo: args.titulo,
                    item: "1",
                    id_pessoa: userId,
                    descricao: args.descricao,
                    data_inicio: args.data_inicio,
                    data_fim: args.data_fim
                };


                const result = await registrarTarefa(payload);

                let respostaConfirmacao = '';
                if (result && result.status !== 'error') {
                    respostaConfirmacao = `✅ Tarefa "${args.titulo}" criada com sucesso no projeto!`;
                } else {
                    respostaConfirmacao = `❌ Erro ao criar tarefa: ${result?.message || 'Erro desconhecido'}`;
                }

                await message.reply(respostaConfirmacao);

                history.push({ role: 'user', text: isAudio ? '[Áudio enviado]' : message.body });
                history.push({ role: 'model', text: respostaConfirmacao });
            }
        } else {
            await message.reply(aiResponse.content);
            history.push({ role: 'user', text: isAudio ? '[Áudio enviado]' : message.body });
            history.push({ role: 'model', text: aiResponse.content });
        }

        if (history.length > 20) {
            chatHistories[senderNumber] = history.slice(-20);
        }

    } catch (err) {
        console.error('Erro ao processar mensagem:', err.message);
        await chat.clearState();
        return await message.reply('Desculpe, tive um problema ao processar sua mensagem.');
    }
};

module.exports = { handle };
