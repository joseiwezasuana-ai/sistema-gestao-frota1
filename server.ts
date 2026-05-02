import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

// Load Firebase Config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "firebase-applet-config.json");
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

// Lazy initialization for Twilio
let twilioClient: twilio.Twilio | null = null;
function getTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  if (!twilioClient) {
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

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

  // Real SMS Sending Route (Twilio Only)
  app.post("/api/sms/send", async (req, res) => {
    const { phoneNumbers, message } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || !message) {
      return res.status(400).json({ error: "Invalid request payload" });
    }

    try {
      const client = getTwilio();
      if (!client) {
        return res.status(503).json({ 
          success: false, 
          error: "Twilio credentials not configured. Please check Settings > Secrets.",
          simulated: true 
        });
      }

      const from = process.env.TWILIO_PHONE_NUMBER || "+244920010026";

      const results = await Promise.all(
        phoneNumbers.map(to => 
          client.messages.create({
            body: message,
            to: to.startsWith('+') ? to : `+${to}`,
            from: from
          })
        )
      );

      res.json({ 
        success: true, 
        provider: "Twilio",
        deliveredCount: results.length,
        messageIds: results.map(r => r.sid)
      });
    } catch (error: any) {
      console.error("[Twilio Provider Error]", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to send SMS via Twilio" 
      });
    }
  });

  /**
   * WEBHOOKS: Automatic Registration of Calls and SMS
   * These endpoints receive data from external providers (Twilio, Mobile Apps, Gateways)
   */

  // 1. Twilio SMS Webhook
  app.post("/api/webhooks/twilio/sms", express.urlencoded({ extended: false }), async (req, res) => {
    const { From, To, Body, MessageSid } = req.body;
    console.log(`[Twilio SMS] Received from ${From}: ${Body}`);

    try {
      // Find driver/vehicle associated with either From or To number
      const driversSnapshot = await db.collection("drivers").get();
      let matchedDriverId = null;
      let matchedPrefix = "N/A";
      let matchedDriverName = "Unknown Driver";

      driversSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.phone === To || data.secondaryPhone === To || data.phone === From || data.secondaryPhone === From) {
          matchedDriverId = doc.id;
          matchedPrefix = data.prefix || "N/A";
          matchedDriverName = data.name || "Unknown Driver";
        }
      });

      await db.collection("sms_logs").add({
        content: Body,
        from: From,
        to: To,
        driverId: matchedDriverId,
        driverName: matchedDriverName,
        vehiclePrefix: matchedPrefix,
        status: "received",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        provider: "Twilio (Auto)",
        sid: MessageSid,
        targets: [To]
      });

      const response = new twilio.twiml.MessagingResponse();
      res.type("text/xml").send(response.toString());
    } catch (error) {
      console.error("[Webhook Error]", error);
      res.status(500).send("Error logging message");
    }
  });

  // 2. Twilio Voice Webhook (Incoming Call)
  app.post("/api/webhooks/twilio/voice", express.urlencoded({ extended: false }), async (req, res) => {
    const { From, To, CallSid } = req.body;
    console.log(`[Twilio Voice] Incoming call from ${From} to ${To}`);

    try {
      const driversSnapshot = await db.collection("drivers").get();
      let matchedDriverId = null;

      driversSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.phone === To || data.secondaryPhone === To) {
          matchedDriverId = doc.id;
        }
      });

      if (matchedDriverId) {
        // Increment call count for driver
        await db.collection("drivers").doc(matchedDriverId).update({
          callCount: admin.firestore.FieldValue.increment(1)
        });
      }

      await db.collection("calls").add({
        customerName: "Chamada Automática",
        customerPhone: From,
        pickupAddress: "Detectado via Gateway",
        destinationAddress: "A definir",
        driverId: matchedDriverId,
        status: "pending",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        type: "incoming",
        sid: CallSid,
        op: "Twilio Auto"
      });

      const response = new twilio.twiml.VoiceResponse();
      response.say({ language: 'pt-PT' }, "Olá, a sua chamada está a ser encaminhada para a nossa central. Por favor aguarde.");
      // Here you could dial the driver's real phone or a central agent
      res.type("text/xml").send(response.toString());
    } catch (error) {
      console.error("[Voice Webhook Error]", error);
      res.status(500).send("Error logging call");
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

  // Diagnostic route
  app.get("/api/ping", (req, res) => {
    res.json({ ping: "pong", mode: process.env.NODE_ENV, time: new Date().toISOString() });
  });

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.resolve(__dirname, "dist");

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
        const htmlPath = path.resolve(__dirname, "index.html");
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
      - POST /api/sms/send
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
