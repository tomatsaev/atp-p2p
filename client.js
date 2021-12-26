const {convert} = require("./convert");
const net = require("net");

let client_data = {}
let ID, PORT, IP;
let sockets = []
let retrying = false;

async function start() {
    const parsed = convert(process.argv[2])
        .then(res => {
            client_data = res
        });
    await parsed;
}

start()
    .then(() => {
            // console.log(client_data);
            ID = client_data.id;
            PORT = client_data.port;
            IP = "127.0.0.1"
            startServer()
            connectTo(client_data.other_clients)
        }
    );

function startServer() {
    net.createServer()
        .listen(PORT, IP, 100)
        .on('connection', socket => {
                sockets.push(socket);
                socket.on('data', buffer => {
                    console.log(`Client id ${ID} Received connection`);
                    console.log(buffer.toString());
                    // makeTask(buffer)
                })
            }
        )
}

function connectTo(clients) {
    clients.forEach(client => {
        if (client.id < ID)
            return;

        const port = client.port
        const ip = client.address
        connect(port, ip)
    })
}


function connect(port, ip) {
    const socket = new net.Socket();
    setTimeout(() => connectSocket(socket, port, ip), 5000);
    // socket.on("error", ()=> reconnectSocket(socket, port, ip));
    socket.on('connect', () => connectEventHandler(socket, port));
}

const connectEventHandler = (socket, port) => {
    sockets.push(socket);
    console.log(`Client id ${ID} connected to client on port ${port}`);
}

const reconnectSocket = (socket, port, ip) => {
    if (!retrying) {
        retrying = true;
        console.log('Reconnecting...');
    }
    setTimeout(() => connectSocket(socket, port, ip), 5000);
}

function connectSocket(socket, port, ip) {
    socket.connect(port, ip, () => {
        socket.write("Hello from client " + ID);
    })
}
