const log = require('why-is-node-running')
const {convert} = require("./convert");
const split = require('split');

const net = require("net");
const {handleInsert, handleDelete} = require("./str");

let client_data = {}
let ID, PORT, IP, server, servers_to_connect, clients_to_connect;
let servers_connected = 0;
let clients_connected = 0;
let sockets = []
let retrying = false;
let sentAll = false;
let goodbyes = 0;
let operation_history = []

const start = async () => {
    client_data = await convert(process.argv[2]);
    ID = client_data.id;
    PORT = client_data.port;
    servers_to_connect = client_data.other_clients.filter((client) => client.id > ID);
    clients_to_connect = client_data.other_clients.filter((client) => client.id < ID);
    console.log("servers_to_connect");
    console.log(servers_to_connect);
    console.log("clients_to_connect");
    console.log(clients_to_connect);
    console.log();
    IP = "127.0.0.1"
        let init_data = {
            id: ID,
            TS: 0,
            op: null
        }
        operation_history.push({
            data: init_data,
            replica: client_data.replica
        })
    server = startServer();
    await sleep(10000)
    await connectTo(client_data.other_clients)
    // await sleep(10000)
    // await mainLoop();
}

start()
    .then( () => {
        console.log("DONE\nFinal Replica is:" + operation_history[operation_history.length-1].replica);
        }
    );

function closeIfEnded() {
    if ((goodbyes >= client_data.other_clients.length) && sentAll) {
        console.log("Closing connections");
        closeConnection()
    }
}

const mainLoop = async () => {
    const operations = client_data.operations
    await Promise.all(operations.map(((operation) => {
            doAndSend(operation)
        }
    )))
    console.log(operation_history);
    sentAll = true;
    await endSession();
    closeIfEnded();
}

const doAndSend = async (operation) => {
    await sleep(1000)
    const my_TS = operation_history[operation_history.length - 1].data.TS;
    const tuple = applyAndPush(ID, my_TS + 1, operation);

    sendUpdate(tuple.data)
    console.log(operation_history);
}

const handleOperation = (name, elements, replica) => {
    if (name === "delete")
        return handleDelete(replica, elements[0])
    else{
        console.log(name);
        return handleInsert(replica, elements)
    }
}

const sendUpdate = (message) => {
    sockets.forEach(socket => {
        // console.log("Sending: " + JSON.stringify(message));
        socket.write(JSON.stringify(message) + '\n');
    })
}

const handleMessage = (message) => {
    if (message.op === "Goodbye") {
        goodbyes++;
        closeIfEnded()
    } else
    {
        applyOperation(message.id, message.TS + 1, message.op);
        console.log("\nOperation history: ");
        console.log(operation_history);
        console.log("\n");
    }
}

const applyOnLastString = (operation) => {
    let prevString = operation_history[operation_history.length - 1].replica
    console.log(operation);
    return handleOperation(operation.name, operation.elements, prevString)
}

function applyAndPush(id, ts, operation) {
    const data = {
        id: id,
        TS: ts,
        op: operation
    }
    const replica = applyOnLastString(operation)
    const tuple = {
        data: data,
        replica: replica
    }
    operation_history.push(tuple)
    return tuple;
}

// operation {}
const applyOperation = (id, ts, op) => {
    const op_TS = ts;
    const my_TS = operation_history[operation_history.length - 1].data.TS;
    if (my_TS < ts) {
        return applyAndPush(id, ts, op);
    } else if (my_TS === op_TS) {
        console.log("SAME TS");
        if (id > ID) {
            return applyAndPush(id, ts, op);
        } else {
            // const lastOp = operation_history.pop();
            // applyAndPush(data.id, op_TS, data.op);
            // return applyAndPush(lastOp.data.id, lastOp.data.TS, lastOp.data.op);
            const prevOp = operation_history.pop();
            console.log("Popped id: " + prevOp.data.id);
            applyOperation(id, ts, op);
            return applyAndPush(prevOp.data.id, prevOp.data.TS, prevOp.data.op);
            // await applyOnLastString(operation)
            // return applyOnLastString(lastOp)
            // let prevString = operation_history[operation_history.length - 1].string
            // const tuple = await handleOperation(operation.name, operation.elements, prevString)
            // operation_history.push(tuple)
            // const tuple1 = await handleOperation(lastOp.name, lastOp.elements, tuple.string)
            // operation_history.push(tuple1)
        }
    } else {
        const prevOp = operation_history.pop();
        console.log("Popped id: " + prevOp.data.id);
        applyOperation(id, ts, op);
        return applyAndPush(prevOp.data.id, prevOp.data.TS, prevOp.data.op);
        // const tuple = await handleOperation(prevOp.name, prevOp.elements, newString)
        // operation_history.push(tuple)
        // return tuple.string

    }
}

const endSession = async () => {
    await sleep(1000);
    sendUpdate({
        id: ID,
        op: "Goodbye"
    })
}

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}


///////////// CONNECTION //////////////

const startServer = () => {
    return net.createServer()
        .listen(PORT, IP, 100)
        .on('connection', async (socket) => {
            clients_connected++;
            console.log("servers connected: " + servers_connected);
            console.log("servers total: " + servers_to_connect.length);
            console.log("clients connected: " + clients_connected);
            console.log("clients total: " + clients_to_connect.length);
            console.log(`Server id: ${ID} received connection`);
            socket.setEncoding('utf8');
            sockets.push(socket);
            const stream = socket.pipe(split());
            // socket.write(`Hello from server id: ${ID}`)
            stream.on('data',  (buffer) => {
                const unTrimmedBuffer = buffer.toString('utf8')
                const trimmedBuffer = unTrimmedBuffer.trim()
                if (trimmedBuffer) {
                    const message = JSON.parse(trimmedBuffer)
                    console.log(`Server id: ${ID} received message from client id ${message.id}:`);
                    console.log("buffer: " + trimmedBuffer);
                    console.log(message);
                    console.log();
                    handleMessage(message)
                    console.log(`Handled message from client id: ${message.id}`);
                    console.log();
                }
            })
            socket.on('end', function () {
                console.log('socket closing...')
            })

            if ((clients_connected === clients_to_connect.length) && servers_connected === servers_to_connect.length) {
                console.log("starting main");
                await mainLoop();
            }
        })
}

const connectTo = (clients) => {
    clients.forEach(client => {
        if (client.id < ID)
            return;
        const port = client.port
        const ip = client.address
        connect(port, ip)
    })

}


const connect = (port, ip) => {
    const socket = new net.Socket();
    setTimeout(() => connectSocket(socket, port, ip), 5000);
    // socket.on("error", ()=> reconnectSocket(socket, port, ip));
    socket.on('connect', () => connectEventHandler(socket, port));
    socket.on('end', function () {
        console.log('socket closing...')
    })
}

const connectEventHandler = async (socket, port) => {
    servers_connected++;
    socket.setEncoding('utf8');
    sockets.push(socket);
    console.log(`Client id ${ID} connected to client on port ${port}`);
    const stream = socket.pipe(split());
    stream.on('data', (buffer) => {
        const unTrimmedBuffer = buffer.toString('utf8')
        const trimmedBuffer = unTrimmedBuffer.trim()
        if (trimmedBuffer) {
            const message = JSON.parse(trimmedBuffer)
            console.log(`Client id ${ID} received message from client id ${message.id}:`);
            console.log("buffer: " + trimmedBuffer);
            console.log(message);
            console.log();
            handleMessage(message);
            console.log(`Handled message from client id: ${message.id} \n`);
        }
        // socket.end();
    })
    console.log("servers connected: " + servers_connected);
    console.log("servers total: " + servers_to_connect.length);
    console.log("clients connected: " + clients_connected);
    console.log("clients total: " + clients_to_connect.length);
    if((servers_connected === servers_to_connect.length) && clients_to_connect.length === clients_connected) {
        console.log("before mainLoop");
        await mainLoop()
    }
}

const reconnectSocket = (socket, port, ip) => {
    if (!retrying) {
        retrying = true;
        console.log('Reconnecting...');
    }
    setTimeout(() => connectSocket(socket, port, ip), 5000);
}

const connectSocket = (socket, port, ip) => {
    socket.connect(port, ip, () => {
        // socket.write("Hello from client " + ID);
    })
}

const closeConnection = () => {
    server.close()
    sockets.forEach(socket => socket.end())
}
