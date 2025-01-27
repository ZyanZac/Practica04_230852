//Exportación de librerías necesarias
import express from 'express'
import session from 'express-session'
import { v4 as uuidv4 } from 'uuid'; //versión 4 de uuid
import os, { networkInterfaces } from 'os';

const sessions = new Map();

const app = express();
const PORT = 3500;


app.use(express.json());
app.use(express.urlencoded({extended: true}));

//Sesiones almacenadas en Memoria(RAM) - Cuando Express cae, todo cae.
//const sessions = {};

app.use(
    session({
        secret: "P4-ZAZP#Soundwave-SesionesHTTP-VariablesDeSesion",
        resave: false,
        saveUninitialized: false,
        cookie: {maxAge: 5* 60 * 1000 } //mil milisegundos
    })
)

// Función para obtener la IP y MAC del servidor
const getServerInfo = () => {
    const networkInterfaces = os.networkInterfaces();
    let serverInfo = {
        ip: null,
        mac: null
    };

    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            // Buscamos la primera interfaz IPv4 no interna
            if (iface.family === 'IPv4' && !iface.internal) {
                serverInfo.ip = iface.address;
                serverInfo.mac = iface.mac;
                return serverInfo;
            }
        }
    }
    return serverInfo;
};

// Función para obtener la IP del cliente
const getClientInfo = (req) => {
    return {
        ip: req.ip || 
            req.connection.remoteAddress || 
            req.socket.remoteAddress || 
            req.connection.socket?.remoteAddress || 
            '0.0.0.0'
    };
};



//Función de utilidad que nos permitiera acceder a la información de la interfaz de red

/*const getLocalIp = () => {
    const newtworkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const interfaces = newtworkInterfaces[interfaceName];
        for (const iface of interfaces) {
            //IPv4 y no interna (no localhost)
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null; //Retorna null si no encuentra una IP válida
}*/

/*const getClientIP = (request) => {
    return (
        request.headers["x-forwarded-for"] ||
        request.connection.remoteAddress ||
        request.socket.remoteAddress ||
        request.connection.socket?.remoteAddress
    );
};*/


app.get('/', (request, response) => {
    return response.status(200).json({message: "Bienvenid@ al API de Control de Sesiones", 
                                                    author: "Zyanya Ahuachtli Zacatenco Pedroza"})
})



app.post('/login', (request, response) => {
    const {email, nickname, macAddress} = request.body;

    if(!email || !nickname || !macAddress) {
        return response.status(400).json({message: "Se esperan campos requeridos"});
    }

    const sessionId = uuidv4();
    const now = new Date();
    const serverInfo = getServerInfo();
    const clientInfo = getClientInfo(request);

    const sessionData = {
        sessionId,
        email,
        nickname,
        clientInfo: {
            ip: clientInfo.ip,
            mac: macAddress
        },
        serverInfo: {
            ip: serverInfo.ip,
            mac: serverInfo.mac
        },
        createAt: now,
        lastAccesed: now
    };

    sessions.set(sessionId, sessionData);
    request.session.userSession = sessionData;

    console.log('Sesion creada', sessionData);

    response.status(200).json({
        message: "Se ha logueado exitosamente",
        sessionId,
        sessionData
    });
});



app.post("/logout", (request, response) => {
    const {sessionId} = request.body;

    if(!sessionId || !sessions.has(sessionId)) {
        return response.status(404).json({message: "No se ha encontrado una sesión activa."});
    }

    sessions.delete(sessionId);
    request.session.destroy((err) => {
        if(err) {
            return response.status(500).json({message: 'Error al cerrar sesión'});
        }
        response.status(200).json({message: "Logout successful"});
    });
});



app.put("/update", (request, response) => {
    const { sessionId } = request.body;

    if(!sessionId || !sessions.has(sessionId)) {
        return response.status(404).json({message: "No existe una sesión activa"});
    }

    const sessionData = sessions.get(sessionId);
    const serverInfo = getServerInfo();
    const clientInfo = getClientInfo(request);

    sessionData.lastAccesed = new Date();
    sessionData.clientInfo.ip = clientInfo.ip;
    sessionData.serverInfo = {
        ip: serverInfo.ip,
        mac: serverInfo.mac
    };

    sessions.set(sessionId, sessionData);
    request.session.userSession = sessionData;

    return response.status(200).json({
        message: "Sesión actualizada correctamente",
        session: sessionData
    });
});




app.get("/status", (request, response) => {
    const { sessionId } = request.body;
    
    if (!sessionId) {
        return response.status(400).json({message: "Se requiere un sessionId"});
    }
    
    const sessionData = sessions.get(sessionId);
    if (!sessionData) {
        return response.status(404).json({message: "No se encontró la sesión"});
    }

    // Actualizar información de IP y MAC del servidor
    const serverInfo = getServerInfo();
    sessionData.serverInfo = serverInfo;
    
    // Actualizar IP del cliente
    const clientInfo = getClientInfo(request);
    sessionData.clientInfo.ip = clientInfo.ip;
    
    return response.status(200).json({
        message: "Sesión Activa",
        session: sessionData
    });
});



app.get("/listCurrentSessions", (request, response) => {
    if (sessions.size === 0) {
        return response.status(200).json({
            message: "No hay sesiones activas",
            count: 0,
            sessions: []
        });
    }

    const serverInfo = getServerInfo();
    const clientInfo = getClientInfo(request);

    const activeSessions = Array.from(sessions.values()).map(session => ({
        sessionId: session.sessionId,
        email: session.email,
        nickname: session.nickname,
        clientInfo: {
            ip: clientInfo.ip,
            mac: session.clientInfo.mac
        },
        serverInfo: {
            ip: serverInfo.ip,
            mac: serverInfo.mac
        },
        createAt: session.createAt,
        lastAccesed: session.lastAccesed
    }));

    return response.status(200).json({
        message: "Sesiones activas encontradas",
        count: activeSessions.length,
        sessions: activeSessions
    });
});



app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
    const serverInfo = getServerInfo();
    console.log(`Información del servidor:`, serverInfo);
});


