const Redux = require('redux');
const prompts = require('prompts');

// Função para criar um novo cliente
const criarCliente = (nome) => {
  return {
    type: "CRIAR_CLIENTE",
    payload: { nome }
  };
};

// Função criadora de ação para criar novos contratos
const criarContrato = (nome, taxa) => {
  const dataAtual = new Date().toISOString().split('T')[0];
  return {
    type: "CRIAR_CONTRATO",
    payload: { nome, taxa, data: dataAtual }
  };
};

// Criar ação para cancelamento de contrato com multa calculada fora do reducer
const cancelarContrato = (nome, adicionarMulta) => {
  return {
    type: "CANCELAR_CONTRATO",
    payload: { nome, adicionarMulta }
  };
};

// Ação para solicitar cashback com status calculado fora do reducer
const solicitarCashback = (nome, valor, status) => {
  return {
    type: "CASHBACK",
    payload: { nome, valor, status }
  };
};

// Ação para comprar produto e acumular cashback
const comprarProduto = (nome, nomeProduto, valorProduto) => {
  return {
    type: "COMPRAR_PRODUTO",
    payload: { nome, nomeProduto, valorProduto }
  };
};

// Reducer para gerenciar clientes
const clientes = (estadoAtual = [], acao) => {
  switch (acao.type) {
    case "CRIAR_CLIENTE":
      if (estadoAtual.find(cliente => cliente.nome === acao.payload.nome)) {
        console.log(`Cliente ${acao.payload.nome} já existe.`);
        return estadoAtual;
      }
      return [...estadoAtual, { nome: acao.payload.nome }];
    default:
      return estadoAtual;
  }
};

// Reducer para o cashback dos clientes
const cashback = (estadoAtual = {}, acao) => {
  switch (acao.type) {
    case "COMPRAR_PRODUTO":
      const cashbackAtual = estadoAtual[acao.payload.nome] || 0;
      return {
        ...estadoAtual,
        [acao.payload.nome]: cashbackAtual + acao.payload.valorProduto * 0.1
      };
    case "CASHBACK":
      const saldoAtual = estadoAtual[acao.payload.nome] || 0;
      if (acao.payload.status === "ATENDIDO") {
        return {
          ...estadoAtual,
          [acao.payload.nome]: saldoAtual - acao.payload.valor
        };
      }
      return estadoAtual;
    default:
      return estadoAtual;
  }
};

// Reducer para lidar com o histórico de pedidos de cashback
const historicoDePedidosDeCashback = (historicoDePedidosDeCashbackAtual = [], acao) => {
  if (acao.type === "CASHBACK") {
    return [
      ...historicoDePedidosDeCashbackAtual,
      { nome: acao.payload.nome, valor: acao.payload.valor, status: acao.payload.status }
    ];
  }
  return historicoDePedidosDeCashbackAtual;
};

// Reducer para o caixa, com lógica de multa transferida para fora do reducer
const caixa = (dinheiroEmCaixa = 0, acao) => {
  switch (acao.type) {
    case "CASHBACK":
      return acao.payload.status === "ATENDIDO"
        ? dinheiroEmCaixa - acao.payload.valor
        : dinheiroEmCaixa;
    case "CRIAR_CONTRATO":
      return dinheiroEmCaixa + acao.payload.taxa;
    case "CANCELAR_CONTRATO":
      return acao.payload.adicionarMulta
        ? dinheiroEmCaixa + 100
        : dinheiroEmCaixa;
    default:
      return dinheiroEmCaixa;
  }
};

// Reducer para contratos
const contratos = (listaDeContratosAtual = [], acao) => {
  if (acao.type === "CRIAR_CONTRATO") {
    return [...listaDeContratosAtual, { ...acao.payload }];
  }
  if (acao.type === "CANCELAR_CONTRATO") {
    return listaDeContratosAtual.filter(c => c.nome !== acao.payload.nome);
  }
  return listaDeContratosAtual;
};

const { createStore, combineReducers } = Redux;

const todosOsReducers = combineReducers({
  clientes, historicoDePedidosDeCashback, caixa, contratos, cashback
});

const store = createStore(todosOsReducers);

// Função para listar clientes e retornar como opções de prompts
const obterOpcoesClientes = () => {
  const clientes = store.getState().clientes;
  return clientes.length
    ? clientes.map(cliente => ({ title: cliente.nome, value: cliente.nome }))
    : [{ title: "Nenhum cliente cadastrado", value: null }];
};

// Menu interativo
const menu = async () => {
  while (true) {
    const resposta = await prompts({
      type: 'select',
      name: 'value',
      message: 'Escolha uma opção:',
      choices: [
        { title: 'Criar cliente', value: '1' },
        { title: 'Realizar novo contrato', value: '2' },
        { title: 'Cancelar contrato existente', value: '3' },
        { title: 'Consultar saldo de cashback', value: '4' },
        { title: 'Fazer pedido de cashback', value: '5' },
        { title: 'Comprar produto', value: '6' },
        { title: 'Exibir saldo em caixa', value: '7' },
        { title: 'Sair', value: '0' }
      ]
    });

    switch (resposta.value) {
      case '1': // Criar cliente
        const novoCliente = await prompts({
          type: 'text',
          name: 'nome',
          message: 'Nome do cliente:'
        });
        if (novoCliente.nome) {
          store.dispatch(criarCliente(novoCliente.nome));
          console.log(`Cliente ${novoCliente.nome} criado com sucesso.`);
        } else {
          console.log("Nome de cliente inválido.");
        }
        break;

      case '2': // Realizar novo contrato
        const clientesContrato = obterOpcoesClientes();
        if (clientesContrato[0].value) {
          const { nome } = await prompts({
            type: 'select',
            name: 'nome',
            message: 'Selecione o cliente para o contrato:',
            choices: clientesContrato
          });
          const { taxa } = await prompts({
            type: 'number',
            name: 'taxa',
            message: 'Taxa do contrato:'
          });
          if (taxa && taxa > 0) {
            store.dispatch(criarContrato(nome, taxa));
            console.log(`Contrato de ${nome} criado com taxa de R$${taxa}.`);
          } else {
            console.log("Taxa de contrato inválida.");
          }
        } else {
          console.log("Nenhum cliente disponível para criar contrato.");
        }
        break;

      case '3': // Cancelar contrato existente
        const clientesCancelamento = obterOpcoesClientes();
        if (clientesCancelamento[0].value) {
          const { nome } = await prompts({
            type: 'select',
            name: 'nome',
            message: 'Selecione o cliente para cancelar o contrato:',
            choices: clientesCancelamento
          });

          const contrato = store.getState().contratos.find(c => c.nome === nome);
          if (contrato) {
            const dataAtual = new Date();
            const dataContrato = new Date(contrato.data);
            const diffEmMeses = (dataAtual - dataContrato) / (1000 * 60 * 60 * 24 * 30);
            const adicionarMulta = diffEmMeses < 3;

            store.dispatch(cancelarContrato(nome, adicionarMulta));
            console.log(`Contrato de ${nome} cancelado.`);
          } else {
            console.log(`Nenhum contrato encontrado para ${nome}.`);
          }
        } else {
          console.log("Nenhum cliente disponível para cancelar contrato.");
        }
        break;

      case '4': // Consultar saldo de cashback
        const clientesConsulta = obterOpcoesClientes();
        if (clientesConsulta[0].value) {
          const { nome } = await prompts({
            type: 'select',
            name: 'nome',
            message: 'Selecione o cliente para consultar saldo de cashback:',
            choices: clientesConsulta
          });
          const saldo = store.getState().cashback[nome] || 0;
          console.log(`Saldo de cashback de ${nome}: R$ ${saldo}`);
        } else {
          console.log("Nenhum cliente disponível para consulta de cashback.");
        }
        break;

      case '5': // Fazer pedido de cashback
        const clientesCashback = obterOpcoesClientes();
        if (clientesCashback[0].value) {
          const { nome } = await prompts({
            type: 'select',
            name: 'nome',
            message: 'Selecione o cliente para fazer o pedido de cashback:',
            choices: clientesCashback
          });
          const { valor } = await prompts({
            type: 'number',
            name: 'valor',
            message: 'Valor do cashback:'
          });
          const saldo = store.getState().cashback[nome] || 0;
          const status = saldo >= valor ? "ATENDIDO" : "NAO_ATENDIDO";

          store.dispatch(solicitarCashback(nome, valor, status));
          console.log(`Pedido de cashback de R$ ${valor} para ${nome} foi registrado com status: ${status}.`);
        } else {
          console.log("Nenhum cliente disponível para pedido de cashback.");
        }
        break;

      case '6': // Comprar produto
        const clientesCompra = obterOpcoesClientes();
        if (clientesCompra[0].value) {
          const { nome } = await prompts({
            type: 'select',
            name: 'nome',
            message: 'Selecione o cliente para a compra:',
            choices: clientesCompra
          });
          const { nomeProduto } = await prompts({
            type: 'text',
            name: 'nomeProduto',
            message: 'Nome do produto:'
          });
          const { valorProduto } = await prompts({
            type: 'number',
            name: 'valorProduto',
            message: 'Valor do produto:'
          });
          if (valorProduto && valorProduto > 0) {
            store.dispatch(comprarProduto(nome, nomeProduto, valorProduto));
            console.log(`Compra de ${nomeProduto} no valor de R$${valorProduto} registrada para ${nome}.`);
          } else {
            console.log("Valor do produto inválido.");
          }
        } else {
          console.log("Nenhum cliente disponível para realizar compra.");
        }
        break;

      case '7': 
        console.log(`Saldo em caixa: R$ ${store.getState().caixa}`);
        break;

      case '0':
        process.exit();
        break;

      default:
        console.log("Opção inválida.");
        break;
    }
  }
};

menu();