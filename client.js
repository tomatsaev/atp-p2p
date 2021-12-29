const {convert} = require("./convert");
const net = require("net");

let client_data = {}
let ID, PORT, IP;
let sockets = []
let retrying = false;
let myTimeStamp = 0;

// let tuple = {
//     id: 0,
//     timeStamp: 0,
//     op: 0
// }

let tuples = []
// [
//     {
//         tuple,
//         String
//     }
// ]


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
            mainLoop()
        }
    );

async function mainLoop(){
    // TODO: Promise.all.then => Goodbye
    const operations = client_data.operations

    await Promise.all(operations.map(((operation) =>
            doAndSend(operation)
    )))

    sockets.forEach(socket => endSession(socket))

    // const returnedOps = operations.map(op => doAndSend(op))

    // operations.forEach((operation) =>  {
    //     doAndSend(operation);
    //     // console.log(returnedOp);
    // })
    //
    // for await (const returned of operations.map(operation => doAndSend(operation))) {
    //     console.log(returned)
    // }

}

async function doAndSend(operation){
    await sleep(1000)
    const message = await handleOperation(operation.name, operation.elements)
    sendUpdate(message)
    return operation
}

async function handleOperation(name, elements){
    if(name === "delete"){
        // TODO
    }
    return "blabla";
}

function sendUpdate(message){
    sockets.forEach(socket => {
        socket.write(message);
    })
}

function handleMessage(buffer){

}

function startServer() {
    net.createServer()
        .listen(PORT, IP, 100)
        .on('connection', socket => {
                sockets.push(socket);
                socket.on('data', buffer => {
                    console.log(`Client id ${ID} Received connection`);
                    console.log(buffer.toString());
                    handleMessage(buffer)
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
    socket.on('data', buffer => {
        console.log(`Client id ${ID} Received connection`);
        console.log(buffer.toString());
        handleMessage(buffer)
    })
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

