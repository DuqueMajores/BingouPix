# Plano — carteira durável, prêmios e saques BingouPix

## Abordagem

Manter o backend como autoridade única de identidade, saldo, cadastro Pix, compras, recargas e pagamentos. Quando um jogador real vencer, o servidor credita o prêmio uma única vez ao saldo do mesmo ID autenticado. O crédito não é transferido automaticamente; o jogador pode solicitar saque explícito para o e-mail Pix cadastrado. O servidor reserva o saldo antes de chamar o provedor. Rejeições definitivas geram devolução idempotente; respostas ambíguas permanecem pendentes e são reconciliadas com a mesma chave.

Guardar transações de carteira num ledger append-only, em centavos inteiros, com referência idempotente, versão por conta e saldo posterior. O snapshot é atômico e sincronizado. Na inicialização, validar a sequência integral do ledger e falhar fechado se houver lacunas, perda do arquivo ou snapshot mais novo que o ledger; reproduzir transações posteriores ao snapshot antes de liberar APIs autenticadas. Escrita/sincronização crítica indisponível bloqueia operações de carteira.

Compras usam UUID de idempotência gerado no cliente e ordem durável `preparing` com cartelas pré-geradas. O servidor grava a ordem, debita uma única vez e conclui a emissão das mesmas cartelas. Se houver reinício em qualquer ponto, recupera a ordem antes de habilitar APIs; repetir a solicitação retorna a compra original. A arrecadação e o prêmio contam apenas cartelas de jogadores reais pagantes, não bots.

Saques exigem sessão assinada, valor de pelo menos R$ 1,00 dentro do saldo disponível, chave Pix e-mail previamente cadastrada e UUID de idempotência. A ordem é armazenada antes do envio e pendências são retomadas após reinício. O Mercado Pago recebe `type: "pix"` com `pix: { type: "EMAIL", chave: <e-mail Pix> }`. Em produção, assinar o corpo Ed25519 em `X-signature`, exigir assinatura e usar credenciais APP_USR; em desenvolvimento, aceitar somente credencial TEST com cabeçalhos de sandbox. HTTP 202/`created`, `approved` ou `success/in_progress` não comprovam crédito; consultar transação individual e aprovar somente após estado terminal de crédito. Rejeição definitiva reembolsa; status transitório continua pendente.

A interface reutiliza o visual do projeto: botão e modal “Sacar”, saldo autoritativo, destino fixado à solicitação e acompanhamento de status. A celebração do vencedor indica crédito no saldo, não transferência imediata.

## Estrutura e entrega

`server.ts` contém sessões, estado, ledger, ordens de compra, crédito de prêmio, API de saque e reconciliador. `src/services/apiSession.ts` guarda apenas o token assinado no navegador; `src/services/bingoWebService.ts` usa o backend para o perfil e saldo e implementa requests idempotentes. `src/components/Header.tsx`, `src/App.tsx` e `src/components/PixWithdrawModal.tsx` expõem o saque. `PAYOUTS_SETUP.md` e `.env.example` documentam as variáveis sem segredos reais.

O backend de produção exige um **Persistent Disk real** do Render montado em `BINGO_DATA_DIR` (por exemplo `/var/data`) e backups externos. O código pode impedir zerar após falha isolada de snapshot/ledger, mas não pode restaurar dados se o provedor ou administrador apagar todo o volume. O workflow `.github/workflows/deploy.yml` compila e publica GitHub Pages ao receber push em `main`/`master`; não publica o backend Render. A configuração de auto-deploy do serviço Render depende do painel externo.

## Limites restantes

Não há cadastro, login por e-mail ou recuperação de conta: a sessão anônima assinada no navegador é a única credencial do ID; apagar o token torna a conta inacessível e um token obtido por terceiro permite operar nessa conta. O app ainda não tem um e-mail de cadastro separado e verificado; em depósitos, `payer.email` usa o e-mail Pix. Confirmar se deve ser adicionado cadastro/validação de identidade antes de afirmar que o pagador usa um e-mail cadastrado distinto.

Payouts reais dependem de habilitação na conta do Mercado Pago, credenciais, chave pública cadastrada e disk/backup no Render. Os testes deste código usaram apenas API simulada local e não enviaram pagamento real.
