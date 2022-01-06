const log = require('why-is-node-running')
const {convert} = require("./convert");
const split = require('split');

const net = require("net");
const {handleInsert, handleDelete} = require("./str");

let client_data = {}
let ID, PORT, IP, server;
let sockets = []
let my_TS = 0;
let retrying = false;
let sentAll = false;
let goodbyes = 0;
let operation_history = []


const start = async () => {
    const parsed = convert(process.argv[2])
        .then(res => {
            client_data = res
        });
    await parsed;
}

start()
    .then(async () => {
            ID = client_data.id;
            PORT = client_data.port;
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
            connectTo(client_data.other_clients, ID, sockets)
            // mainLoop()
            await sleep(10000);
            // server.close(()=>  console.log("After close"));
            // setTimeout(function () {
            //     log() // logs out active handles that are keeping node running
            // }, 100)
        }
    );

function closeIfEnded() {
    if ((goodbyes >= client_data.other_clients.length) && sentAll) {
        console.log("Closing connections");
        closeConnection()
    }
}

const mainLoop = async () => {
    // TODO: Promise.all.then => Goodbye
    const operations = client_data.operations
    await Promise.all(operations.map(((operation) => {
            doAndSend(operation)
            console.log("sent an op");
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
    // const data = {
    //     id: ID,
    //     TS: my_TS + 1,
    //     op: operation
    // }
    // // const message = await handleOperation(operation.name, operation.elements, string)
    // // applyOnLastString(operation)
    // const replica = applyOnLastString(operation)
    // const tuple = {
    //     data: data,
    //     replica: replica
    // }
    // operation_history.push(tuple)
    sendUpdate(tuple.data)
    console.log(operation_history);
    // return operation
}

const handleOperation = (name, elements, replica) => {
    if (name === "delete")
        return handleDelete(replica, elements[0])
    else{
        console.log(name);
        return handleInsert(replica, elements)
    }


    // const my_TS = operation_history[operation_history.length - 1].data.TS + 1;
    //
    // const data = {
    //     id: ID,
    //     TS: my_TS,
    //     op: {
    //         name: name,
    //         elements: elements
    //     }
    // }
    // const tuple = {
    //     data: data,
    //     string: string
    // }
    // return tuple;
}

const sendUpdate = (message) => {
    sockets.forEach(socket => {
        // console.log("Sending: " + JSON.stringify(message));
        socket.write(JSON.stringify(message) + '\n');
    })
}

const handleMessage = (message) => {
    // const message = JSON.parse(buffer);
    if (message.op === "Goodbye") {
        goodbyes++;
        console.log("Received goodbye, total: " + goodbyes);
        console.log("Need to receive " + client_data.other_clients.length);
        closeIfEnded()
    } else
    {
        applyOperation(message);
        console.log("\nOperation history: ");
        console.log(operation_history);
        console.log("\n");
    }
}

const applyOnLastString = (operation) => {
    let prevString = operation_history[operation_history.length - 1].replica
    console.log(operation);
    return handleOperation(operation.name, operation.elements, prevString)
    // const tuple = handleOperation(operation.name, operation.elements, prevString)
    // operation_history.push(tuple)
    // return tuple.string;
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
const applyOperation = (data) => {
    const op_TS = data.TS;
    const my_TS = operation_history[operation_history.length - 1].data.TS;
    if (my_TS < op_TS) {
        return applyAndPush(data.id, op_TS, data.op);
    } else if (my_TS === op_TS) {
        if (data.id > ID) {
            return applyAndPush(data.id, op_TS, data.op);
        } else {
            const lastOp = operation_history.pop();
            applyAndPush(data.id, op_TS, data.op);
            return applyAndPush(lastOp.id, lastOp.data.TS, lastOp.data.op);
            // await applyOnLastString(operation)
            // return applyOnLastString(lastOp)
            // let prevString = operation_history[operation_history.length - 1].string
            // const tuple = await handleOperation(operation.name, operation.elements, prevString)
            // operation_history.push(tuple)
            // const tuple1 = await handleOperation(lastOp.name, lastOp.elements, tuple.string)
            // operation_history.push(tuple1)
        }
    }
    else {
        const prevOp = operation_history.pop();
        applyOperation(data);
        return applyAndPush(prevOp.id, prevOp.data.TS, prevOp.data.op);
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


///////////// CONNECTION //////////////

const startServer = () => {
    return net.createServer()
        .listen(PORT, IP, 100)
        .on('connection', socket => {
            console.log(`Server id: ${ID} received connection`);
            socket.setEncoding('utf8');
            sockets.push(socket);
            const stream = socket.pipe(split());
            // socket.write(`Hello from server id: ${ID}`)
            stream.on('data',  (buffer) => {
                const unTrimmedBuffer = buffer.toString('utf8')
                console.log("untrimmed: ");
                console.log(unTrimmedBuffer);
                const trimmedBuffer = unTrimmedBuffer.trim()
                if (trimmedBuffer) {
                    const message = JSON.parse(trimmedBuffer)
                    console.log(`Server id: ${ID} received messagefrom client id ${message.id}:`);
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

const connectEventHandler = (socket, port) => {
    socket.setEncoding('utf8');
    sockets.push(socket);
    console.log(`Client id ${ID} connected to client on port ${port}`);
    const stream = socket.pipe(split());
    stream.on('data', (buffer) => {
        const unTrimmedBuffer = buffer.toString('utf8')
        console.log("untrimmed: ");
        console.log(unTrimmedBuffer);
        const trimmedBuffer = unTrimmedBuffer.trim()
        console.log("Trimmed buffer:");
        console.log(trimmedBuffer);
        console.log("end")
        if (trimmedBuffer) {
            const message = JSON.parse(trimmedBuffer)
            console.log(`Client id ${ID} received message from client id ${message.id}:`);
            console.log(message);
            console.log();
            handleMessage(message);
            console.log(`Handled message from client id: ${message.id}`);
            console.log();
        }
        // socket.end();
    })
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
