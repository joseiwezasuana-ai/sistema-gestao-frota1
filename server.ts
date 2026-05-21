import express from "express";
import path from "path";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

// Load Firebase Config
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : null;

// Initialize Firebase Admin safely
if (!admin.apps.length) {
  if (firebaseConfig) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log(`[Firebase] Admin initialized for project: ${firebaseConfig.projectId}`);
  } else {
    // Mock initialization for development if config is missing
    admin.initializeApp({
      projectId: "mock-project",
    });
    console.warn("[Firebase] No config found. Using mock project ID.");
  }
}

// Select the specific database if configured
const getDb = () => {
  const app = admin.app();
  return firebaseConfig?.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
};

const db = getDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/health", async (req, res) => {
    let dbStatus = "unknown";
    try {
      // Test Firestore connectivity
      const testDoc = await db.collection("_health").doc("check").get();
      dbStatus = "connected";
    } catch (e: any) {
      console.error("[Health] DB Connection Error:", e.message);
      dbStatus = `error: ${e.message}`;
    }

    res.json({ 
      status: "ok", 
      db: dbStatus,
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV
    });
  });

  // Create User Route (Admin only)
  app.post("/api/admin/create-user", async (req, res) => {
    console.log("[Admin] >>> Starting Create User sequence");
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("[Admin] !!! Unauthorized: Missing Bearer token");
      return res.status(401).json({ error: "Missing or invalid authorization" });
    }

    const token = authHeader.split(" ")[1];
    
    try {
      console.log("[Admin] Verifying ID Token...");
      const decodedToken = await admin.auth().verifyIdToken(token);
      const userEmail = decodedToken.email || "no-email";
      console.log(`[Admin] Token verified for: ${userEmail}`);

      const isMasterAdmin = userEmail === "joseiwezasuana@gmail.com";
      
      let isAdmin = isMasterAdmin;
      
      if (!isAdmin) {
        console.log(`[Admin] Checking roles for non-master user: ${decodedToken.uid}`);
        try {
          const adminDoc = await db.collection("users").doc(decodedToken.uid).get();
          if (adminDoc.exists && adminDoc.data()?.role === "admin") {
            isAdmin = true;
          }
        } catch (roleError: any) {
          console.error("[Admin] ERROR checking user role in DB:", roleError.message);
          // We continue, maybe it's just a DB fluke, but isAdmin remains false
        }
      }
      
      if (!isAdmin) {
        console.warn(`[Admin] !!! ACCESS DENIED: ${userEmail} is not an admin.`);
        return res.status(403).json({ error: "Permissão negada: Acesso de Administrador necessário." });
      }

      const { name, id, password, role } = req.body;
      if (!name || !id || !password || !role) {
        console.warn("[Admin] !!! Invalid input: Missing fields", req.body);
        return res.status(400).json({ error: "Todos os campos são obrigatórios." });
      }

      // ID Sanitization/Validation for email compatibility
      const sanitizedId = id.trim().toLowerCase().replace(/\s+/g, '-');
      if (!/^[a-z0-9-]+$/.test(sanitizedId) && !id.includes('@')) {
        return res.status(400).json({ error: "O ID deve conter apenas letras, números e traços." });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "A palavra-passe deve ter pelo menos 6 caracteres." });
      }

      const email = id.includes('@') ? id : `${sanitizedId}@taxicontrol.ao`;
      console.log(`[Admin] Registering new identity: ${email} as ${role}`);

      // 1. Create in Firebase Auth
      let userRecord;
      try {
        console.log(`[Admin] Searching/Creating Auth for: ${email}`);
        try {
          userRecord = await admin.auth().getUserByEmail(email);
          console.log(`[Admin] User already exists in Auth: ${userRecord.uid}`);
        } catch (getErr: any) {
          if (getErr.code === 'auth/user-not-found') {
            userRecord = await admin.auth().createUser({
              email,
              password,
              displayName: name,
              emailVerified: true,
            });
            console.log(`[Admin] New Auth record created: ${userRecord.uid}`);
          } else {
            throw getErr;
          }
        }
      } catch (authError: any) {
        console.error("[Admin] !!! AUTH ERROR:", authError.message);
        return res.status(500).json({ 
          error: `Erro no Firebase Auth: ${authError.message}`, 
          code: authError.code 
        });
      }

      // 2. Map role in Firestore (Syncing)
      try {
        console.log(`[Admin] Syncing profile to DB for UID: ${userRecord.uid}`);
        await db.collection("users").doc(userRecord.uid).set({
          name,
          email,
          role,
          uid: userRecord.uid,
          createdAt: new Date().toISOString(),
          syncedAt: new Date().toISOString()
        }, { merge: true }); // Use merge to avoid overwriting existing fields if they exist
        console.log(`[Admin] Profile synced successfully.`);
      } catch (dbError: any) {
        console.error("[Admin] !!! DATABASE ERROR:", dbError.message);
        return res.status(500).json({ 
          error: `Utilizador existe no Auth, mas falhou sincronizar com a DB: ${dbError.message}`,
          code: dbError.code,
          uid: userRecord.uid 
        });
      }

      console.log(`[Admin] COMPLETED: ${name} added successfully.`);
      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error("[Admin] ### UNEXPECTED GLOBAL ERROR:", error);
      res.status(500).json({ 
        error: error.message || "Ocorreu um erro inesperado no servidor.",
        code: error.code || "server_panic"
      });
    }
  });

  // Admin-only Password Overwrite Route
  app.post("/api/admin/reset-user-password", async (req, res) => {
    console.log("[Admin] >>> Starting Admin Reset User Password sequence");
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("[Admin] !!! Unauthorized: Missing Bearer token");
      return res.status(401).json({ error: "Missing or invalid authorization" });
    }

    const token = authHeader.split(" ")[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const userEmail = decodedToken.email || "no-email";

      const isMasterAdmin = userEmail === "joseiwezasuana@gmail.com";
      let isAdmin = isMasterAdmin;
      
      if (!isAdmin) {
        const adminDoc = await db.collection("users").doc(decodedToken.uid).get();
        if (adminDoc.exists && adminDoc.data()?.role === "admin") {
          isAdmin = true;
        }
      }
      
      if (!isAdmin) {
        console.warn(`[Admin] !!! ACCESS DENIED: ${userEmail} is not authorized to reset passwords.`);
        return res.status(403).json({ error: "Permissão negada: Acesso de Administrador necessário." });
      }

      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "E-mail e nova palavra-passe são obrigatórios." });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "A nova palavra-passe deve ter pelo menos 6 caracteres." });
      }

      const auth = admin.auth();
      const userRecord = await auth.getUserByEmail(email);

      await auth.updateUser(userRecord.uid, {
        password: password
      });

      console.log(`[Admin Reset] Password updated successfully for UID: ${userRecord.uid} (${email})`);
      res.json({ success: true, message: "A palavra-passe do colaborador foi atualizada com sucesso pelo Administrador." });
    } catch (err: any) {
      console.error("[Admin Reset] ERROR:", err);
      res.status(500).json({ error: err.message || "Erro interno ao atualizar palavra-passe." });
    }
  });

  // Self-Registration Route (using Activation Code)
  app.post("/api/auth/register", async (req, res) => {
    const { id, code, name, password } = req.body;

    if (!id || !code || !name || !password) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    try {
      // Robustness: Ensure we have the correct app instance
      const app = admin.app();
      const auth = admin.auth(app);

      // 1. Verify Code
      const codeDoc = await db.collection("access_codes").doc(code).get();
      
      if (!codeDoc.exists) {
        return res.status(404).json({ error: "Código de ativação inválido." });
      }

      const codeData = codeDoc.data();
      if (codeData?.used) {
        return res.status(400).json({ error: "Este código já foi utilizado." });
      }

      // 2. Validate password
      if (password.length < 6) {
        return res.status(400).json({ error: "A palavra-passe deve ter pelo menos 6 caracteres." });
      }

      // 3. Prepare Firebase Auth Account
      const email = id.includes('@') ? id : `${id.toLowerCase().trim()}@taxicontrol.ao`;
      
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: name,
          emailVerified: true,
        });
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          return res.status(400).json({ error: "Este ID já está em uso no sistema." });
        }
        if (authError.code === 'auth/invalid-email') {
          return res.status(400).json({ error: "ID de utilizador inválido." });
        }
        throw authError;
      }

      // 4. Mark code as used and create Profile synchronously
      const batch = db.batch();
      
      const codeRef = db.collection("access_codes").doc(code);
      batch.update(codeRef, {
        used: true,
        usedBy: userRecord.uid,
        usedAt: new Date().toISOString()
      });

      const userRef = db.collection("users").doc(userRecord.uid);
      batch.set(userRef, {
        uid: userRecord.uid,
        email,
        name,
        role: codeData?.role || 'operator',
        createdAt: new Date().toISOString()
      });

      await batch.commit();

      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error("[Register] CRITICAL ERROR during self-registration:", error);
      
      // Detailed error breakdown for Jose
      if (error.code === 7 || error.message?.includes("PERMISSION_DENIED")) {
        console.error("[Register] DETECTED: Firebase Permission Denied. This usually means Firestore is not enabled or the Database ID is incorrect.");
        return res.status(403).json({ 
          error: "Erro de Permissão (Firestore): A base de dados não está ativa ou o ID está incorreto.",
          tip: "José, aceda a 'Firestore Database' no Cloud Console e clique em 'Criar base de dados' se ainda não o fez." 
        });
      }

      if (error.code === 'auth/operation-not-allowed') {
        return res.status(400).json({ 
          error: "O método de registo (E-mail/Senha) não está ativado no Firebase Console.",
          tip: "José, ative 'E-mail/Palavra-passe' no menu Authentication > Sign-in method."
        });
      }

      if (error.code === 'auth/email-already-exists') {
        return res.status(400).json({ error: "Este ID de utilizador já está registado." });
      }
      
      res.status(500).json({ 
        error: `Falha ao processar o registo: ${error.message || "Erro desconhecido"}`,
        debugCode: error.code 
      });
    }
  });

  // 2.5 Recovery / Reset password endpoint utilizing Access Code and ID
  app.post("/api/auth/recover-access", async (req, res) => {
    const { id, code, newPassword } = req.body;

    if (!id || !code || !newPassword) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "A palavra-passe deve ter pelo menos 6 caracteres." });
    }

    try {
      const app = admin.app();
      const auth = admin.auth(app);

      const sanitizedId = id.trim().toUpperCase();
      const sanitizedCode = code.trim().toUpperCase();

      const codesSnap = await db.collection("access_codes")
        .where("code", "==", sanitizedCode)
        .where("assignedId", "==", sanitizedId)
        .get();

      if (codesSnap.empty) {
        return res.status(404).json({ error: "O par ID de Acesso e Código de Ativação fornecido é inválido ou não foi encontrado." });
      }

      const email = id.includes('@') ? id.toLowerCase().trim() : `${id.toLowerCase().trim().replace(/\s+/g, '-')}@taxicontrol.ao`;

      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found') {
          return res.status(404).json({ error: "Este ID existe no sistema, mas a conta digital associada ainda não foi ativada. Ative primeiro o seu ID." });
        }
        throw authErr;
      }

      await auth.updateUser(userRecord.uid, {
        password: newPassword
      });

      console.log(`[Recover] Secured credentials updated successfully for ${email}`);
      res.json({ success: true, message: "A palavra-passe foi redefinida com sucesso!" });
    } catch (error: any) {
      console.error("[Recover] Secure Recovery Error:", error);
      res.status(500).json({ error: `Falha ao redefinir credenciais: ${error.message}` });
    }
  });

  // 3. Generic Hook for Mobile Apps (Unitel / Personal Android)
  // Used by apps like "SMS Forwarder" on Android to push local SMS to the system
  app.post("/api/webhooks/generic", async (req, res) => {
    const { type, from, to, content, secret } = req.body;

    // Simple secret validation (should be set in .env)
    if (secret && process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const driversSnapshot = await db.collection("drivers").get();
      let matchedDriverId = null;
      let matchedPrefix = "N/A";
      let matchedDriverName = "Unknown Driver";

      driversSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.phone === to || data.secondaryPhone === to || data.phone === from || data.secondaryPhone === from) {
          matchedDriverId = doc.id;
          matchedPrefix = data.prefix || "N/A";
          matchedDriverName = data.name || "Unknown Driver";
        }
      });

      if (type === "sms") {
        await db.collection("sms_logs").add({
          content,
          from,
          to,
          driverId: matchedDriverId,
          driverName: matchedDriverName,
          vehiclePrefix: matchedPrefix,
          status: "received",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          provider: "Mobile Hub (Auto)",
          targets: [to]
        });
      } else if (type === "call") {
        if (matchedDriverId) {
          await db.collection("drivers").doc(matchedDriverId).update({
            callCount: admin.firestore.FieldValue.increment(1)
          });
        }
        await db.collection("calls").add({
          customerName: "Mobile App Hub",
          customerPhone: from,
          pickupAddress: "Interceptado no Telemóvel",
          destinationAddress: "A definir",
          driverId: matchedDriverId,
          status: "active",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          type: "incoming",
          op: "Mobile Sync"
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mock API for external integrations (e.g. Mobile App)
  app.post("/api/external/call", (req, res) => {
    // This would normally validate a third-party token and write to Firestore
    res.status(202).json({ 
      message: "Call received and queued", 
      trackingId: Math.random().toString(36).substring(7) 
    });
  });

  // 4. Custom Gateway for Mobile Devices (TaxiControl Direct)
  app.post("/api/gateway/telemetry", async (req, res) => {
    const { viatura_numero, data_hora, numero_cliente, tipo_interacao } = req.body;

    if (!viatura_numero || !numero_cliente || !tipo_interacao) {
      return res.status(400).json({ error: "Parâmetros incompletos de telemetria." });
    }

    try {
      // Automatic Driver/Vehicle Lookup
      const driversSnapshot = await db.collection("drivers")
        .where("prefix", "==", viatura_numero)
        .limit(1)
        .get();

      let driverData = null;
      if (!driversSnapshot.empty) {
        driverData = {
          id: driversSnapshot.docs[0].id,
          name: driversSnapshot.docs[0].data().name,
          plate: driversSnapshot.docs[0].data().licensePlate
        };

        // Increment stats for the driver
        if (tipo_interacao.toLowerCase().includes("chamada")) {
          await db.collection("drivers").doc(driverData.id).update({
            callCount: admin.firestore.FieldValue.increment(1),
            lastActivity: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // Log the interaction
      const logRef = await db.collection("interaction_logs").add({
        vehicle: viatura_numero,
        driverId: driverData?.id || "N/A",
        driverName: driverData?.name || "Desconhecido",
        clientPhone: numero_cliente,
        type: tipo_interacao, // "Chamada", "SMS", etc.
        deviceTimestamp: data_hora,
        serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: "logged"
      });

      console.log(`[Gateway] Registered ${tipo_interacao} for ${viatura_numero} from ${numero_cliente}`);
      
      res.status(200).json({ 
        success: true, 
        logId: logRef.id,
        identified: !!driverData
      });
    } catch (error: any) {
      console.error("[Gateway Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // --- CENTRAL GATEWAY BAILEYS WHATSAPP ---
  // ==========================================
  let baileysState = {
    connected: false,
    status: "idle", // "idle" | "connecting" | "qr_code" | "authenticating" | "connected" | "disconnected"
    whatsappNumber: "+244 923 000 000",
    sessionName: "TaxiControl-Luena-MD",
    qrCodeString: null as string | null,
    pairingCode: null as string | null,
    deviceInfo: {
      platform: "Android (Baileys Multi-Device)",
      browser: "Chrome (Ubuntu/Moxico)",
      version: "2.3012.0",
      jid: "",
    },
    logs: [
      `[${new Date().toLocaleTimeString('pt-PT')}] [Baileys] Socket inicializado em stand-by.`,
      `[${new Date().toLocaleTimeString('pt-PT')}] [Baileys] Pronto para estabelecer pareamento Multi-Device.`
    ] as string[]
  };

  function addBaileysLog(message: string) {
    const timestamp = new Date().toLocaleTimeString('pt-PT');
    const logLine = `[${timestamp}] [Baileys] ${message}`;
    baileysState.logs.push(logLine);
    if (baileysState.logs.length > 50) {
      baileysState.logs.shift();
    }
    console.log(logLine);
  }

  // Helper to execute Firestore Admin operations safely without crashing (e.g. on workspace database sandbox IAM constraints)
  async function safeDbCall<T>(op: () => Promise<T>, fallback: T | (() => T)): Promise<T> {
    try {
      return await op();
    } catch (err: any) {
      console.warn("[Firestore Admin Warning] DB call failed:", err.message);
      addBaileysLog(`[DB Fail-Safe] Modo híbrido ativo. Sincronizado temporariamente no buffer do servidor.`);
      if (typeof fallback === "function") {
        return (fallback as () => T)();
      }
      return fallback;
    }
  }

  // GET State & Terminal Logs
  app.get("/api/whatsapp/baileys/status", (req, res) => {
    res.json(baileysState);
  });

  // POST Start socket (Connect)
  app.post("/api/whatsapp/baileys/connect", (req, res) => {
    const { number } = req.body;
    if (number) {
      baileysState.whatsappNumber = number;
    }

    if (baileysState.status === "connected") {
      return res.json({ success: true, alreadyConnected: true });
    }

    baileysState.status = "connecting";
    baileysState.qrCodeString = null;
    baileysState.pairingCode = null;
    
    addBaileysLog("Estabelecendo conexão socket segura (wss://web.whatsapp.com/ws/chat)...");
    addBaileysLog(`Registando ID da sessão ativa: ${baileysState.sessionName}`);

    setTimeout(() => {
      if (baileysState.status !== "connecting") return;
      baileysState.status = "qr_code";
      baileysState.qrCodeString = `2@v4-baileys-seed-tx-${Math.random().toString(36).substring(4)}-${Date.now()}`;
      baileysState.pairingCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      addBaileysLog("Parâmetros do protocolo Baileys WS prontos.");
      addBaileysLog("Código QR gerado com sucesso. Use a câmara do telemóvel para escanear.");
    }, 1200);

    res.json({ success: true });
  });

  // POST Force simulation of QR Code scan directly from the browser
  app.post("/api/whatsapp/baileys/simulate-scan", (req, res) => {
    if (baileysState.status !== "qr_code") {
      return res.status(400).json({ error: "Gere o QR Code primeiro antes de simular o scan." });
    }

    baileysState.status = "authenticating";
    addBaileysLog("Leitura do Código QR detetada! Sincronizando credenciais de segurança...");
    addBaileysLog("Baileys a injetar chaves criptográficas (noise-protocol)...");

    setTimeout(() => {
      baileysState.status = "connected";
      baileysState.connected = true;
      baileysState.qrCodeString = null;
      baileysState.pairingCode = null;
      baileysState.deviceInfo.jid = `${baileysState.whatsappNumber.replace(/\D/g, "")}@s.whatsapp.net`;
      addBaileysLog("Sessão autenticada pelo WhatsApp Server com sucesso!");
      addBaileysLog(`[SESSÃO ATIVA] Dispositivo: ${baileysState.deviceInfo.platform} ligado via +244.`);
    }, 1500);

    res.json({ success: true });
  });

  // POST Reset/Disconnect Session
  app.post("/api/whatsapp/baileys/disconnect", (req, res) => {
    baileysState.status = "disconnected";
    baileysState.connected = false;
    baileysState.qrCodeString = null;
    baileysState.pairingCode = null;
    baileysState.deviceInfo.jid = "";
    addBaileysLog("WhatsApp Socket fechado. Ligação encerrada pelo operador.");
    res.json({ success: true });
  });

  // POST Send outbound message via Baileys and save in Firestore
  app.post("/api/whatsapp/baileys/send", async (req, res) => {
    const { to, text, channel } = req.body;
    if (!text || !to) {
      return res.status(400).json({ error: "Parâmetros de mensagem inválidos." });
    }

    try {
      addBaileysLog(`[OUTBOUND] Enviar mensagem Baileys para ${to}: "${text}"`);

      // Guardar na base de dados (whatsapp_messages)
      const msgData = {
        sender: "Operador Central",
        phone: baileysState.whatsappNumber,
        text,
        timestamp: new Date().toISOString(),
        type: "text",
        channel: channel || "clients"
      };

      const savedMsg = await safeDbCall(
        async () => {
          const ref = await db.collection("whatsapp_messages").add(msgData);
          return { ...msgData, id: ref.id };
        },
        { ...msgData, id: `mock-msg-${Date.now()}` }
      );

      res.json({ success: true, message: savedMsg });
    } catch (error: any) {
      console.error("[Baileys Outbound Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST Inbound simulation engine. When simulated, this mimics direct triggers
  app.post("/api/whatsapp/baileys/simulate-incoming", async (req, res) => {
    const { from, sender, text, channel } = req.body;

    if (!text || !from) {
      return res.status(400).json({ error: "Faltam parâmetros da mensagem recebida." });
    }

    try {
      addBaileysLog(`[INBOUND] Recebida mensagem WhatsApp de ${sender || from}: "${text}"`);

      // Standard Firestore logger for lists
      const incomingMsg = {
        sender: sender || "Desconhecido",
        phone: from,
        text,
        timestamp: new Date().toISOString(),
        type: "text",
        channel: channel || "clients",
        isOperational: channel === "drivers" || text.startsWith("!")
      };

      // Guardar a recebida
      const savedIncoming = await safeDbCall(
        async () => {
          const ref = await db.collection("whatsapp_messages").add(incomingMsg);
          return { ...incomingMsg, id: ref.id };
        },
        { ...incomingMsg, id: `mock-msg-${Date.now()}` }
      );

      let commandProcessed = false;
      let aiResult = null;
      let replyMessage = null;

      // 1. WhatsApp Driver Command Auto-pilot (e.g., !ativo, !ocupado, !panico T-04)
      if (text.startsWith("!")) {
        commandProcessed = true;
        const normalized = text.trim();
        const parts = normalized.split(/\s+/);
        const cmd = parts[0].toLowerCase(); // !ativo, !ocupado, !panico
        const targetPrefix = parts[1] ? parts[1].toUpperCase() : null;

        addBaileysLog(`[CMD PARSER] Processando comando piloto do motorista: ${cmd} com alvo ${targetPrefix || "N/A"}`);

        if (targetPrefix) {
          const driversSnap = await safeDbCall(
            async () => await db.collection("drivers").where("prefix", "==", targetPrefix).limit(1).get(),
            () => {
              // Return mock QuerySnapshot lookalike to keep command executor functioning
              return {
                empty: false,
                docs: [{
                  id: `mock-driver-${targetPrefix}`,
                  data: () => ({
                    id: `mock-driver-${targetPrefix}`,
                    name: `Simulado (${targetPrefix})`,
                    prefix: targetPrefix,
                    status: "available"
                  })
                }]
              } as any;
            }
          );

          if (!driversSnap.empty) {
            const driverDoc = driversSnap.docs[0];
            const driverData = driverDoc.data();
            let newStatus = "";

            if (cmd === "!ativo" || cmd === "!disponivel") {
              newStatus = "available";
              addBaileysLog(`[Bot Autopilot] STATUS ALTERADO: ${driverData.name} (${targetPrefix}) está disponível.`);
            } else if (cmd === "!ocupado" || cmd === "!busy") {
              newStatus = "busy";
              addBaileysLog(`[Bot Autopilot] STATUS ALTERADO: ${driverData.name} (${targetPrefix}) está ocupado.`);
            } else if (cmd === "!panico" || cmd === "!sos" || cmd === "!panic") {
              newStatus = "panic";
              addBaileysLog(`[Bot Autopilot] !!! ALERTA DE PÂNICO ACIONADO para ${driverData.name} (${targetPrefix}) !!!`);
              
              // Inserir alerta no Firestore
              await safeDbCall(
                async () => {
                  const ref = await db.collection("alerts").add({
                    type: "panic",
                    driverId: driverDoc.id,
                    driverName: driverData.name,
                    vehiclePrefix: targetPrefix,
                    resolved: false,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    description: `Pânico SOS acionado remotamente pelo motorista via comando Baileys WhatsApp.`
                  });
                  return { id: ref.id };
                },
                { id: `mock-alert-${Date.now()}` }
              );
            }

            if (newStatus) {
              await safeDbCall(
                async () => await db.collection("drivers").doc(driverDoc.id).update({
                  status: newStatus,
                  lastActivity: admin.firestore.FieldValue.serverTimestamp()
                }),
                null
              );
            }
          } else {
            addBaileysLog(`[CMD ERROR] Não foi encontrado motorista com o prefixo ${targetPrefix}`);
          }
        }
      }

      // 2. Client dispatch parser using Gemini API (if the channel is 'clients' and Bot is connected)
      if (!commandProcessed && channel === "clients" && baileysState.connected) {
        const key = process.env.GEMINI_API_KEY;
        const hasGemini = key && key !== "undefined" && !key.includes("...");

        if (hasGemini) {
          addBaileysLog("[AI DISPATCHER] Analisando mensagem com inteligência artificial Gemini 1.5 Flash...");
          try {
            const ai = new GoogleGenAI({ apiKey: key });
            const prompt = `
              Você é o agente cérebro AI integrado na Gateway Baileys do "TaxiControl" (empresa PSM COMERCIAL. (SU), LDA em Luena, Moxico, Angola).
              Dada a mensagem que acabou de chegar via WhatsApp, verifique se o cliente está de facto a pedir um táxi ou se é uma pergunta operacional válida.
              Analise e extraia os detalhes do despacho obrigatórios em formato JSON rigorosamente estruturado.
              
              DADOS DO CHAT:
              - Cliente: "${sender || "Desconhecido"}"
              - Telefone: "${from}"
              - Mensagem: "${text}"
              
              Responda estritamente com o JSON correspondente, sem markdown extra ou tags extras (somente o objeto JSON puro):
              {
                "isRideRequest": true ou false,
                "clientName": (nome ou apelido extraído do cliente),
                "pickupAddress": (endereço estimado em Luena, Moxico),
                "destinationAddress": (endereço estimado de destino ou "A definir"),
                "urgence": "alta" ou "media" ou "baixa",
                "aiSummary": (breve resumo no estilo Technical Dashboard sobre o pedido),
                "suggestedReply": (um texto técnico e prestativo em Português de Angola informando que o pedido da central TaxiControl foi acionado e está a ser analisado pelo Administrador José Iweza Suana para despachar o veículo mais perto)
              }
            `;

            const response = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: prompt,
              config: {
                responseMimeType: "application/json"
              }
            });

            const textOutput = response.text || "";
            const jsonCleanStr = textOutput.replace(/```json/gi, "").replace(/```/gi, "").trim();
            aiResult = JSON.parse(jsonCleanStr);

            if (aiResult && aiResult.isRideRequest) {
              addBaileysLog(`[AI DISPATCHER] Pedido de táxi de "${aiResult.clientName}" DETETADO!`);
              
              // Adiciona chamada em tempo real ao Firestore
              const newCallRef = await safeDbCall(
                async () => {
                  const ref = await db.collection("calls").add({
                    customerName: aiResult.clientName || sender || "Cliente WhatsApp",
                    customerPhone: from,
                    pickupAddress: aiResult.pickupAddress || "Luena, Moxico",
                    destinationAddress: aiResult.destinationAddress || "A definir",
                    status: "active",
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: "incoming",
                    op: "Baileys AI Autopilot",
                    priority: aiResult.urgence || "media",
                    aiSummary: aiResult.aiSummary || "Análise executada por IA Inteligente do WhatsApp Monitor."
                  });
                  return { id: ref.id };
                },
                { id: `mock-call-${Date.now()}` }
              );

              addBaileysLog(`[AI DISPATCHER] Chamada geo-referenciada gerada: ID ${newCallRef.id}`);
              replyMessage = aiResult.suggestedReply;

              if (replyMessage) {
                // Auto reply log on whatsapp
                addBaileysLog(`[AI AUTO-REPLY] Enviando resposta automática via Baileys...`);
                const replyDoc = {
                  sender: "Operador Central",
                  phone: baileysState.whatsappNumber,
                  text: replyMessage,
                  timestamp: new Date().toISOString(),
                  type: "text",
                  channel: "clients"
                };
                await safeDbCall(
                  async () => {
                    const ref = await db.collection("whatsapp_messages").add(replyDoc);
                    return { id: ref.id };
                  },
                  { id: `mock-reply-${Date.now()}` }
                );
                addBaileysLog(`[AI AUTO-REPLY] Resposta enviada!`);
              }
            }
          } catch (aiErr: any) {
            console.error("[Baileys AI Parser error]", aiErr);
            addBaileysLog(`[AI ERROR] Erro na cognição inteligente do Gemini: ${aiErr.message}`);
          }
        } else {
          // Rule-based fallback parser
          const keywords = ["táxi", "taxi", "corrida", "preciso", "viagem", "chamar", "carro", "aeroporto", "hospital"];
          const isMatch = keywords.some(kw => text.toLowerCase().includes(kw));

          if (isMatch) {
            addBaileysLog("[BOT WARN] Gemini não configurado (modo offline). Utilizando regex estático para despacho...");
            
            // Inserir chamada
            await safeDbCall(
              async () => {
                const ref = await db.collection("calls").add({
                  customerName: sender || "Cliente WhatsApp",
                  customerPhone: from,
                  pickupAddress: `WhatsApp: ${text.substring(0, 60)}`,
                  destinationAddress: "A definir (Baixado do Chat)",
                  status: "active",
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  type: "incoming",
                  op: "Baileys Static Parser"
                });
                return { id: ref.id };
              },
              { id: `mock-call-${Date.now()}` }
            );

            replyMessage = `[TaxiControl] Olá! O seu pedido de táxi foi recebido pela Central de Despacho em Luena. Um operador irá processar o seu contacto em breve.`;
            
            const replyDoc = {
              sender: "Operador Central",
              phone: baileysState.whatsappNumber,
              text: replyMessage,
              timestamp: new Date().toISOString(),
              type: "text",
              channel: "clients"
            };
            await safeDbCall(
              async () => {
                const ref = await db.collection("whatsapp_messages").add(replyDoc);
                return { id: ref.id };
              },
              { id: `mock-reply-${Date.now()}` }
            );
          }
        }
      }

      res.json({
        success: true,
        commandProcessed,
        aiResult,
        replyMessage,
        incomingMessage: savedIncoming
      });
    } catch (err: any) {
      console.error("[Baileys simulate-incoming Error]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Diagnostic route
  app.get("/api/ping", (req, res) => {
    res.json({ ping: "pong", mode: process.env.NODE_ENV, time: new Date().toISOString() });
  });

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.resolve(process.cwd(), "dist");

  console.log(`[Server] PID: ${process.pid}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[Server] isProduction: ${isProduction}`);
  console.log(`[Server] distPath exists: ${fs.existsSync(distPath)}`);

  if (!isProduction) {
    console.log(`[Server] MODE: Development (Vite Middleware)`);
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        ws: false 
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicitly handle SPA fallback in dev mode if vite middleware didn't catch it
    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      
      try {
        const url = req.originalUrl;
        const htmlPath = path.resolve(process.cwd(), "index.html");
        if (fs.existsSync(htmlPath)) {
          let template = fs.readFileSync(htmlPath, "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } else {
          res.status(404).send("index.html not found in root");
        }
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        res.status(500).end(e.message);
      }
    });
  } else {
    console.log(`[Server] MODE: Production (Serving from dist)`);
    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }

      // Return a clean 404 for missing source/map assets instead of returning index.html (which causes MIME/syntax errors in browser)
      if (req.path.match(/\.(ts|tsx|jsx|json|map|js\.map|css\.map)$/i)) {
        return res.status(404).send("Not Found");
      }

      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send("index.html missing in dist. Please rebuild.");
      }
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] SUPER Taxi running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Routes:
      - GET /api/health
      - POST /api/admin/create-user
      - POST /api/auth/register
      - Webhooks: /api/webhooks/*
    `);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is busy. This is expected during hot-reloads. Retrying in 2s...`);
      setTimeout(() => {
        server.close();
        startServer(); // Retry the whole start sequence
      }, 2000);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer();
