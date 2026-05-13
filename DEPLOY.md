# Guia de Deploy Manual para José

Para colocar o sistema no ar em `sistema-auditado.web.app` usando os seus ficheiros locais, siga estes passos no seu computador:

## Prerequisitos
Certifique-se de que tem o **Node.js** e o **Firebase CLI** instalados.
Se não tiver o Firebase CLI, instale com:
`npm install -g firebase-tools`

## Configuração da IA e Mapas
Para que as análises operacionais e o mapa satélite funcionem no site, precisa de definir as chaves antes de gerar a versão de produção.

No **Windows (CMD)**:
```cmd
set GEMINI_API_KEY=AIzaSyCtQB8mNuc3C9R4Vx84maWW2FZNJ_XrX5Q
set VITE_GOOGLE_MAPS_API_KEY=AIzaSyB4JC9DV84f5zmeKqKONNkb6T_P4HYozX0
```

No **Linux/Mac/PowerShell**:
```bash
export GEMINI_API_KEY=AIzaSyCtQB8mNuc3C9R4Vx84maWW2FZNJ_XrX5Q
export VITE_GOOGLE_MAPS_API_KEY=AIzaSyB4JC9DV84f5zmeKqKONNkb6T_P4HYozX0
```

Depois disso, execute o `npm run build` e o `firebase deploy` normalmente.

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

## Resolução de Erros Comuns

### 1. Erro: `InvalidKeyMapError` ou `ApiProjectMapError` (Google Maps)
Estes erros significam que a chave está mal configurada ou bloqueada.
1. **Verifique se a chave está correta**: Ela deve começar com `AIzaSy`.
2. **Ative a API**: Aceda ao [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/library), pesquise por **"Maps JavaScript API"** e clique em **ATIVAR**.
3. **Faturação**: O Google Maps exige um cartão de crédito associado à conta (Billing), mesmo que use apenas o crédito gratuito mensal.
4. **Restrições**: No menu "Credentials", garanta que a chave não tem restrições que bloqueiem o domínio `sistema-auditado.web.app`.

### 2. Erro: Erro 404 `/src/components/...`
Se vir erros no console mencionados caminhos da pasta `/src/`, isto acontece geralmente porque o site está a tentar carregar ficheiros de código fonte que não devem estar no site final.
- **IMPORTANTE**: Após qualquer mudança no código ou nas chaves (GEMINI/MAPS), tem de correr obrigatoriamente o `npm run build` antes do `firebase deploy`.
- O comando `firebase deploy` vai enviar a pasta `dist` (que o Vite criou). Se o erro persistir, apague a pasta `dist` e corra o build novamente.
- Note que alguns erros de 404 em ficheiros `.tsx` no console podem ser apenas o navegador a tentar encontrar os "Source Maps" para ajudar no debug; se o site estiver a funcionar, pode ignorar esse detalhe.

---
**Dica Mestre:** Se mudar alguma chave API (Gemini ou Google Maps), tem de correr novamente o `npm run build` e o `firebase deploy` para que as novas chaves sejam incluídas no site.
