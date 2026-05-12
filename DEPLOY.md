# Guia de Deploy Manual para José

Para colocar o sistema no ar em `sistema-auditado.web.app` usando os seus ficheiros locais, siga estes passos no seu computador:

## Prerequisitos
Certifique-se de que tem o **Node.js** e o **Firebase CLI** instalados.
Se não tiver o Firebase CLI, instale com:
`npm install -g firebase-tools`

## Passos para o Deploy

1.  **Extrair o ficheiro ZIP** que descarregou do AI Studio.
2.  **Abrir o Terminal ou CMD** na pasta onde extraiu os ficheiros.
3.  **Instalar as dependências**:
    `npm install`
4.  **Gerar a versão de produção**:
    `npm run build`
5.  **Fazer login no Firebase** (se ainda não estiver):
    `firebase login`
6.  **Garantir que está no projeto correto**:
    `firebase use sistema-auditado`
7.  **Enviar para o ar**:
    `firebase deploy`

## Configuração Atual
- **Hosting**: O site será publicado em `sistema-auditado.web.app`.
- **Base de Dados**: O sistema continuará a ler e escrever na base de dados `ai-studio-applet-webapp-1f7ca` (conforme configurado em `firebase-applet-config.json`).

---
**Nota:** As regras de segurança (`firestore.rules`) também serão enviadas no comando `firebase deploy`. Certifique-se de que o Firestore está ativo no Console do projeto `ai-studio-applet-webapp-1f7ca`.
