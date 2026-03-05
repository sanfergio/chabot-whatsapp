const usuariosAtendidos = new Set();
const atendimentoHumano = new Set();
const temporizadores = new Map();

const tempoInatividade = 5 * 60 * 1000; // 5 minutos

function iniciarTemporizador(userId) {
  if (temporizadores.has(userId)) {
    clearTimeout(temporizadores.get(userId));
  }

  const timeout = setTimeout(() => {
    usuariosAtendidos.delete(userId);
    atendimentoHumano.delete(userId);
    temporizadores.delete(userId);
  }, tempoInatividade);

  temporizadores.set(userId, timeout);
}

module.exports = {
  iniciarTemporizador,
  usuariosAtendidos,
  atendimentoHumano
};