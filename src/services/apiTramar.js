const axios = require('axios');
require('dotenv').config();

const verificarTelefone = async (telefone) => {
    try {
        const url = `${process.env.TRAMAR_API_URL}/verificar-telefone/${telefone}`;
        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.TRAMAR_API_KEY
            }
        });
        return response.data;
    } catch (error) {
        console.error('Erro ao verificar telefone na API Tramar:', error.message);
        return null;
    }
};

const registrarApontamento = async (dadosApontamento) => {
    try {
        const url = `${process.env.TRAMAR_API_URL}/api/registrar-apontamento`;
        const response = await axios.post(url, dadosApontamento, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.TRAMAR_API_KEY
            }
        });
        return response.data;
    } catch (error) {
        console.error('Erro ao registrar apontamento na API Tramar:', error.message);
        return { status: 'error', message: error.message };
    }
};

const registrarTarefa = async (dadosTarefa) => {
    try {
        const url = `${process.env.TRAMAR_API_URL}/api/registrar-tarefa`;
        const response = await axios.post(url, dadosTarefa, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.TRAMAR_API_KEY
            }
        });
        return response.data;
    } catch (error) {
        console.error('Erro ao registrar tarefa na API Tramar:', error.message);
        return { status: 'error', message: error.message };
    }
};

module.exports = { verificarTelefone, registrarApontamento, registrarTarefa };
