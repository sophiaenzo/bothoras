const axios = require('axios');
const { botInstructions } = require('../config/botConfig');
require('dotenv').config();

const getAiResponse = async (prompt, media = null, userName = null, history = [], userProjects = []) => {
    try {
        const parts = [];

        if (media) {
            const cleanMimeType = media.mimetype.split(';')[0];
            parts.push({
                inline_data: {
                    mime_type: cleanMimeType,
                    data: media.data
                }
            });
        }

        if (prompt && prompt.trim()) {
            parts.push({ text: prompt });
        }

        if (parts.length === 0 && history.length === 0) {
            return 'Por favor, envie uma mensagem ou áudio válido.';
        }

        const contents = history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        contents.push({
            role: 'user',
            parts: parts
        });

        const body = {
            contents: contents
        };

        let finalSystemInstruction = botInstructions.system;
        if (userName) {
            finalSystemInstruction += `\n\nNome do usuário atual: ${userName}. Use-o de forma natural quando apropriado.`;
        }

        const dateObj = new Date();
        const dataAtualSp = dateObj.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const horaAtualSp = dateObj.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

        finalSystemInstruction += `\n\n[INFORMAÇÃO DE TEMPO] Hoje é dia ${dataAtualSp} e agora são exatamente ${horaAtualSp} (Horário de Brasília). O campo 'data_movi' deve receber OBRIGATORIAMENTE a data ${dataAtualSp}, a menos que o usuário peça outro dia explícito.`;

        if (userProjects && userProjects.length > 0) {
            finalSystemInstruction += `\n\nAbaixo estão os projetos e tarefas ativos do usuário:\n`;
            userProjects.forEach(proj => {
                finalSystemInstruction += `- PROJETO: [ID: ${proj.id}] ${proj.nome}\n`;
                if (proj.tarefas && proj.tarefas.length > 0) {
                    finalSystemInstruction += `  TAREFAS:\n`;
                    proj.tarefas.forEach(task => {
                        finalSystemInstruction += `  * [ID: ${task.id}] ${task.titulo}\n`;
                    });
                } else {
                    finalSystemInstruction += `  (Nenhuma tarefa atribuída a este projeto no momento)\n`;
                }
            });
            finalSystemInstruction += `\nIMPORTANTE: Ao preencher id_projeto e id_tarefa nas chamadas de função, use EXCLUSIVAMENTE os IDs numéricos listados acima entre colchetes [ID: X]. NUNCA invente ou adivinhe um ID.`;

        }

        if (finalSystemInstruction) {
            body.system_instruction = {
                parts: [{ text: finalSystemInstruction }]
            };
        }

        body.tools = [
            {
                function_declarations: [
                    {
                        name: "registrar_apontamento",
                        description: "Registra ou aponta horas trabalhadas em uma tarefa de um projeto.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                id_projeto: { type: "INTEGER", description: "ID numérico do projeto, DEVE ser um dos IDs listados na instrução de sistema" },
                                id_tarefa: { type: "INTEGER", description: "ID numérico da tarefa, DEVE ser um dos IDs listados na instrução de sistema" },
                                data_movi: { type: "STRING", description: "Data do apontamento no formato YYYY-MM-DD" },
                                hora_ini: { type: "STRING", description: "Hora de início no formato HH:MM (24h)" },
                                hora_fim: { type: "STRING", description: "Hora de término no formato HH:MM (24h)" },
                                situacao: { type: "INTEGER", description: "Situação da tarefa: 1 (pendente), 2 (em andamento), 3 (cancelado), 4 (concluído)" },
                                observa: { type: "STRING", description: "Observação opcional sobre o trabalho" }
                            },
                            required: ["id_projeto", "id_tarefa", "data_movi", "hora_ini", "hora_fim", "situacao"]
                        }
                    },
                    {
                        name: "criar_tarefa",
                        description: "Cria uma nova tarefa dentro de um projeto específico.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                id_projeto: { type: "INTEGER", description: "ID numérico do projeto onde a tarefa será criada, DEVE ser um dos IDs listados na instrução de sistema" },
                                titulo: { type: "STRING", description: "Título ou nome curto da tarefa" },
                                descricao: { type: "STRING", description: "Descrição detalhada da tarefa" },
                                data_inicio: { type: "STRING", description: "Data de início da tarefa (YYYY-MM-DD)" },
                                data_fim: { type: "STRING", description: "Data de término prevista (YYYY-MM-DD)" }
                            },
                            required: ["id_projeto", "titulo", "descricao", "data_inicio", "data_fim"]
                        }
                    }
                ]
            }
        ];

        const response = await axios.post(`${process.env.GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, body);

        if (!response.data || !response.data.candidates) {
            console.error('Resposta inesperada da API:', JSON.stringify(response.data));
            return { type: 'text', content: 'Ocorreu um erro na IA ao processar sua solicitação.' };
        }

        const candidate = response.data.candidates[0];
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            console.error('Resposta inesperada da API (sem content/parts):', JSON.stringify(response.data));
            return { type: 'text', content: 'Desculpe, recebi uma resposta vazia ou bloqueada da IA.' };
        }

        const part = candidate.content.parts[0];

        if (part.functionCall) {
            return { type: 'functionCall', content: part.functionCall };
        }

        return { type: 'text', content: part.text };
    } catch (error) {
        if (error.response) {
            console.error('Erro na API Gemini:', error.response.status, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Erro de rede/configuração Gemini:', error.message);
        }
        return { type: 'text', content: 'Desculpe, tive um erro ao processar sua mensagem.' };
    }
};

module.exports = { getAiResponse };
