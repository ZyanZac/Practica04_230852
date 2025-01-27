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


const getCDMXDateTime = () => {
    const date = new Date();
    const options = {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'short'
    };
    
    return date.toLocaleString('es-MX', options).replace(',', '').replace(/\//g, '-');
};


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

const calculateInactivityTime = (lastAccesed) => {
    try {
        const now = new Date();
        // Convertir el formato "DD-MM-YYYY HH:mm:ss CST" a formato que JS pueda parsear
        const [datePart, timePart] = lastAccesed.split(' ');
        const [day, month, year] = datePart.split('-');
        const [hours, minutes, seconds] = timePart.split(':');
        
        const lastAccess = new Date(year, month - 1, day, hours, minutes, seconds);
        const diff = now - lastAccess;
        
        if (isNaN(diff)) {
            throw new Error('Invalid date calculation');
        }
        
        // Convertir milisegundos a formato legible
        const totalSeconds = Math.floor(diff / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        
        return {
            hours: totalHours % 24,
            minutes: totalMinutes % 60,
            seconds: totalSeconds % 60,
            formatted: `${totalHours % 24}h ${totalMinutes % 60}m ${totalSeconds % 60}s`
        };
    } catch (error) {
        console.error('Error calculating inactivity time:', error);
        return {
            hours: 0,
            minutes: 0,
            seconds: 0,
            formatted: '0h 0m 0s'
        };
    }
};

// Función para obtener la IP del cliente
const getClientInfo = (req) => {
    let clientIP = req.ip || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress || 
                  req.connection.socket?.remoteAddress || 
                  '0.0.0.0';
    
    // Si la IP es ::1 (localhost IPv6) o 127.0.0.1 (localhost IPv4), usar la IP del servidor
    if (clientIP === '::1' || clientIP === '127.0.0.1') {
        const serverInfo = getServerInfo();
        clientIP = serverInfo.ip;
    }
    
    // Si la IP incluye IPv6 prefix ::ffff:, removemos ese prefix
    if (clientIP.includes('::ffff:')) {
        clientIP = clientIP.replace('::ffff:', '');
    }

    return {
        ip: clientIP
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
    const now = getCDMXDateTime();
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

    sessionData.lastAccesed = getCDMXDateTime();
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

    // Calcular tiempo de inactividad
    const inactivityTime = calculateInactivityTime(sessionData.lastAccesed);
    sessionData.inactivityTime = {
        hours: inactivityTime.hours,
        minutes: inactivityTime.minutes,
        seconds: inactivityTime.seconds,
        formatted: `${inactivityTime.hours}h ${inactivityTime.minutes}m ${inactivityTime.seconds}s`
    };
    
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

    const activeSessions = Array.from(sessions.values()).map(session => {
        const inactivityTime = calculateInactivityTime(session.lastAccesed);
        return {
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
            lastAccesed: session.lastAccesed,
            inactivityTime: {
                hours: inactivityTime.hours,
                minutes: inactivityTime.minutes,
                seconds: inactivityTime.seconds,
                formatted: `${inactivityTime.hours}h ${inactivityTime.minutes}m ${inactivityTime.seconds}s`
            }
        };
    });

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


