const { menuPrincipal } = require("./menu");
const { usuariosAtendidos, atendimentoHumano } = require("./state");

async function enviarMenu(sock, chat) {
  await sock.sendMessage(chat, { text: menuPrincipal });
}

async function responderOpcao(sock, entrada, chat) {
  const opcao = entrada.trim();

  const respostas = {
    "1": `🔹 *Como funciona?*\n\nA New Andrew's é uma loja online especializada em suplementos de alta qualidade. Você pode navegar pelo nosso catálogo no site, escolher os produtos desejados e finalizar a compra com entrega rápida para todo o Brasil.\n\n➡️ Acesse: www.newandrews.com.br\n\n*Digite "menu" para voltar ao início.*`,
    "2": `🎉 *Promoções*\n\nNo momento estamos com *frete grátis* em todas as compras! Também temos a promoção: Pague 3 e leve o 4º produto de *GRAÇA!* Além disso, diversos produtos com descontos especiais. Fique de olho no site para não perder nenhuma oferta.\n\n➡️ Confira: www.newandrews.com.br\n\n*Digite "menu" para voltar ao início.*`,
    "3": `💪 *Benefícios*\n\n✅ Suplementos aprovados pela Anvisa\n✅ Matéria-prima importada\n✅ Entrega rápida e segura\n✅ Atendimento personalizado\n✅ Produtos com alta pureza e eficácia\n\nSaiba mais em www.newandrews.com.br\n\n*Digite "menu" para voltar ao início.*`,
    "4": `🛒 *Como comprar?*\n\nÉ muito simples:\n1. Acesse www.newandrews.com.br\n2. Navegue pelo catálogo e escolha seus produtos\n3. Adicione ao carrinho\n4. Escolha a forma de pagamento (cartão, boleto ou pix)\n5. Finalize o pedido e aguarde a entrega\n\nQualquer dúvida, estamos aqui!\n\n*Digite "menu" para voltar ao início.*`,
    "5": `🤝 *Seja um Revendedor / Parceiro / Representante*\n\nQuer fazer parte do time New Andrew's? Entre em contato pelo WhatsApp comercial: (21) 98052-0003 ou clique no link abaixo:\n\nhttps://api.whatsapp.com/send/?phone=5521979089061&text=Ol%C3%A1%21+Tenho+interesse+em+me+tornar+revendedor+ou+parceiro+da+New+Andrew%27s+Suplementos&app_absent=0\n\nOferecemos condições especiais e suporte completo.\n\n*Digite "menu" para voltar ao início.*`,
    "6": `📘 *Catálogo de Suplementos*\n\nConfira todos os nossos produtos no site:\n👉 https://www.canva.com/design/DAGvooWyDFw/de1huLlR35ZpAAo_OiJgZQ/view?utm_content=DAGvooWyDFw&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hde51656e4f\n\nTemos creatina, aminoácidos, vitaminas e muito mais!\n\n*Digite "menu" para voltar ao início.*`,
    "7": `👩‍💼 *Falar com atendente*\n\nNo momento não há nenhum atendente online disponível. Por favor, tente mais tarde ou envie sua dúvida por e-mail: produtosnewandrews@newandrews.com.br\n\nOu pelo nosso número de telefone comercial:\n\nhttps://api.whatsapp.com/send/?phone=5521979089061&text=Ol%C3%A1%21+Tenho+interesse+em+me+tornar+revendedor+ou+parceiro+da+New+Andrew%27s+Suplementos&app_absent=0\n\n*Digite "menu" para voltar ao início.*`,
    "8": `⚠️ *Problemas, reclamações ou insatisfações*\n\nLamentamos por qualquer inconveniente. Para registrar sua reclamação de forma oficial e acompanhar a resolução, acesse nossa página no Reclame Aqui:\n🔗 https://www.reclameaqui.com.br/empresa/produtos-new-andrews/\n\nTambém estamos à disposição pelo e-mail: suporte@newandrews.com.br\n\n*Digite "menu" para voltar ao início.*`,
    "9": `✅ *Conversa encerrada.*\n\nObrigado por falar com a New Andrew's Suplementos! Sempre que precisar, é só mandar uma mensagem.`
  };

  if (opcao === "menu") {
    return enviarMenu(sock, chat);
  }

  if (respostas[opcao]) {
    await sock.sendMessage(chat, { text: respostas[opcao] });
    if (opcao === "9") {
      usuariosAtendidos.delete(chat);
      atendimentoHumano.delete(chat);
    }
    return;
  }

  await sock.sendMessage(chat, {
    text: "❓ Opção inválida. Digite um número de 1 a 9 ou *menu* para ver as opções novamente."
  });
}

module.exports = { enviarMenu, responderOpcao };