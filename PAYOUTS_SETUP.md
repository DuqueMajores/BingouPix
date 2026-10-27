# Ativar saques Pix via Mercado Pago

O BingouPix cria uma retirada autenticada para o e-mail Pix salvo no perfil, reserva o valor na carteira, envia uma transação `type: "pix"` e só a marca como aprovada após consultar o status final da transação. O provedor pode aceitar a solicitação com HTTP 202; isso significa apenas que o lote foi recebido, não que o Pix foi creditado.

## Configuração obrigatória no Render

No serviço backend, configure `MERCADO_PAGO_ACCESS_TOKEN` com uma credencial de produção autorizada para a API Payouts e `MERCADO_PAGO_PAYOUT_PRIVATE_KEY` com a chave privada Ed25519 da integração. A chave privada fica somente nos secrets do Render; não a coloque no GitHub, no frontend ou em um arquivo `.env` versionado. Cadastre a chave pública correspondente com a equipe/painel de integrações do Mercado Pago. O backend assina o corpo do payout e envia `X-signature` e `X-enforce-signature: true` em produção.

O serviço Mercado Pago que origina os repasses precisa ter saldo suficiente e a conta/app precisa estar habilitada para Payouts. A documentação indica que transferências Pix usam uma chave Pix cadastrada e disponível para recebimento. Este projeto aceita e-mail; o payload enviado usa `type: "pix"` e `pix: { "type": "EMAIL", "chave": "..." }`.

Configure também um **Persistent Disk real** do Render montado, por exemplo, em `/var/data`, com `BINGO_DATA_DIR=/var/data`. A aplicação agora bloqueia operações autenticadas quando a persistência falha e falha ao iniciar em produção se o snapshot desaparecer enquanto o volume ainda contém o ledger ou o segredo de sessão. Isso evita continuar com saldo zerado após perda isolada do snapshot. Nenhuma aplicação consegue recuperar dados se o provedor ou um administrador apagar o volume inteiro; mantenha backups do diretório persistente.

## Verificação

Use o modo de desenvolvimento com credencial `TEST-` e o ambiente de testes do Mercado Pago antes de mudar para produção, seguindo o processo oficial de habilitação. Em modo local, credenciais `APP_USR-` são bloqueadas para saque. Os testes locais deste repositório usam um interceptor que bloqueia a rede externa e **não** enviam pagamentos reais. A confirmação em conta real depende da permissão Payouts, da chave pública cadastrada e dos secrets corretos no Render.

## Referências oficiais

- [Visão geral de Payouts](https://www.mercadopago.com.br/developers/en/docs/payouts/overview): condições gerais, conta de origem e habilitação.
- [Configurar transferências](https://www.mercadopago.com.br/developers/en/docs/payouts/integration-configuration/money-transfers): payload Pix, tipos de chave, idempotência e resposta HTTP 202.
- [Ir para produção](https://www.mercadopago.com.br/developers/en/docs/payouts/go-to-production): assinatura Ed25519, envio da chave pública e ativação das credenciais de produção.
- [Listar transações de um payout](https://www.mercadopago.com.br/developers/en/reference/online-payments/payouts/get-transaction-list/get): consulta dos status individuais.
- [Status de transações e erros](https://www.mercadopago.com.br/developers/en/docs/payouts/resources/transaction-status-and-errors): `success` só comprova crédito quando `status_detail=accredited`; `success/in_progress`, `created`, `approved` e falhas de resolução transitórias continuam pendentes. `processed/approved` indica conclusão; erros definitivos, rejeições, cancelamentos e reembolsos liberam a reserva do jogador.
