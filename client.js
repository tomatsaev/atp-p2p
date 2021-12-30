const log = require('why-is-node-running') // should be your first require
const {convert} = require("./convert");

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
                operation_data: init_data,
                string: client_data.replica
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

const mainLoop = async () => {
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

}

const doAndSend = async (operation) => {
    await sleep(1000)
    let string = getRelevantReplica(operation)
    const message = await handleOperation(operation.name, operation.elements, string)

    operation_history.push(message)
    sendUpdate(message.data)
    return operation
}

const handleOperation = async (name, elements, string) => {
    if (name === "delete")
        string = handleDelete(string, elements[0])
    else
        string = handleInsert(string, elements)

    const data = {
        id: ID,
        TS: my_TS,
        op: name
    }
    const tuple = {
        data,
        string
    }
    return tuple;
}

const sendUpdate = (message) => {
    sockets.forEach(socket => {
        socket.write(message);
    })
}

const handleMessage = async (buffer) => {
    if (buffer.op === "Goodbye") {
        goodbyes++;
        if (goodbyes => client_data.other_clients.length && sentAll) {
            closeConnection()
        }
    } else {
        const replica = getRelevantReplica(buffer);
        const tuple = handleOperation(buffer.name, buffer.elements, replica)
        operation_history.push(tuple)
    }

}

const getRelevantReplica = async (operation) => {
    const TS = operation.TS;
    let returned;
    if(my_TS < TS){
        my_TS = TS;
        return operation_history[operation_history.length - 1].string
    }
    else if(my_TS === TS){
        if(operation.id > ID){
            return operation_history[operation_history.length - 1].string
        }
        else{
            const prevOp = operation_history.pop();
            let prevString = operation_history[operation_history.length - 1].string
            const tuple = await handleOperation(operation.name, operation.elements, prevString)
            operation_history.push(tuple)
            const tuple1 = await handleOperation(prevOp.name, prevOp.elements)

            // TODO
        }
    }
    else {
        const prevOp = operation_history.pop();
        const newString = getRelevantReplica(operation);
        const tuple = await handleOperation(prevOp.name, prevOp.elements, newString)
        operation_history.push(tuple)
        return tuple.string
        // for (let i = 1; i < operation_history.length; i++) {
        //     curr = operation_history[operation_history.length - 1]
        //     if (curr.TS >= my_TS)
        //         return curr.string;
        //     else {
        //         operation_history.pop()
        //     }
        // }
    }
}
const applyBeforeNumOps = (operation, count) => {

}

const endSession = async () => {
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
            console.log(`Client id ${ID} received connection`);
            sockets.push(socket);
            socket.write(`Hello from server ${ID}`)
            socket.on('data', buffer => {
                console.log(buffer.toString());
                // handleMessage(buffer)
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
    sockets.push(socket);
    console.log(`Client id ${ID} connected to client on port ${port}`);
    socket.on('data', buffer => {
        console.log(`Client id ${ID} received message`);
        console.log(buffer.toString());
        // handleMessage(buffer)
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
        socket.write("Hello from client " + ID);
    })
}

const closeConnection = () => {
    server.close()
    sockets.forEach(socket => socket.end())
}
