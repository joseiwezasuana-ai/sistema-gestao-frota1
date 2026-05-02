# Guia de Operação: Gateway Nativo TaxiControl

O sistema **TaxiControl** funciona agora como um Gateway Ativo. Quando instalado no smartphone da viatura, ele monitoriza chamadas e SMS sem necessidade de apps de terceiros.

## 1. Vinculação Obrigatória
Para que a monitorização funcione, o terminal deve estar "Vínculado":
1. Vá ao **Master Viatura** no Painel Central.
2. Certifique-se que o prefixo da viatura (ex: `TX-01`) está registado.
3. No smartphone, ao fazer login, o sistema detetará o prefixo associado.

## 2. Funcionamento do Gateway
- **Automático**: Uma vez logado, o sistema interceta chamadas recebidas, perdidas e SMS.
- **Sincronização**: Os dados são enviados instantaneamente para o "Painel de Monitorização" na Central.
- **Segurança**: Apenas terminais com prefixos autorizados pela **PSM COMERCIAL** podem enviar dados.

## 3. Verificação de Status
No terminal (Smartphone):
- Verifique o badge **"Vínculo Ativo"** no Dashboard móvel.
- Use o botão **"Simular Chamada"** para testar a comunicação com a central.

## 4. Requisitos do Sistema Android
Para o funcionamento pleno, a App TaxiControl solicitará permissões de:
- `READ_CALL_LOG` (Para registar chamadas)
- `RECEIVE_SMS` (Para registar mensagens de clientes)
- `READ_PHONE_STATE` (Para identificar o estado da ligação)

---
**Nota para José:** O sistema está agora 100% sincronizado. A validação ocorre na origem (terminal) e no destino (Firestore), garantindo que apenas a sua frota oficial seja monitorizada.
