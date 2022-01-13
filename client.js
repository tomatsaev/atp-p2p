const {convert} = require("./convert");
const split = require('split');
const net = require("net");
const {handleInsert, handleDelete} = require("./str");

let client_data = {}
let my_id, my_port, my_ip, server, servers_to_connect, clients_to_connect;
let my_ts = 0;
let curr_replica;
let servers_connected = 0;
let clients_connected = 0;
let sockets = []
let sentAll = false;
let goodbyes = 0;
let events_history = []

class EventData {
    constructor(id, ts, op) {
        this.id = id;
        this.ts = ts;
        this.op = op;
    }
}

class Operation {
    constructor(name, elements) {
        this.name = name;
        this.elements = elements;
    }
}

class Event {
    constructor(data, org_replica, edited_replica) {
        this.data = data;
        this.org_replica = org_replica;
        this.edited_replica = edited_replica;
    }
}

const start = async () => {
    client_data = await convert(process.argv[2]);
    my_id = client_data.id;
    my_port = client_data.port;
    curr_replica = client_data.replica;
    servers_to_connect = client_data.other_clients.filter((client) => client.id > my_id);
    clients_to_connect = client_data.other_clients.filter((client) => client.id < my_id);
    my_ip = "127.0.0.1"
    const init_data = new EventData(my_id, my_ts, null);
    const first_event = new Event(init_data, curr_replica, curr_replica);
    events_history.push(first_event)
    server = startServer();
    await sleep(10000)
    await connectTo(client_data.other_clients)
}

start()
    .then(() => {
        }
    );

function closeIfEnded() {
    if ((goodbyes >= client_data.other_clients.length) && sentAll) {
        console.log(`Client ${my_id} is exiting`)
        closeConnection()
        console.log(`DONE\nFinal Replica is: ${curr_replica}`);
    }
}

const mainLoop = async () => {
    const operations = client_data.operations
    await Promise.all(operations.map(((operation) => {
            const operation_ob = new Operation(operation.name, operation.elements)
            doAndSend(operation_ob)
        }
    )))
    console.log(`Client ${my_id} finished his local string modifications`);
    sentAll = true;
    await endSession();
    closeIfEnded();
}

const doAndSend = async (operation) => {
    await sleep(1000)
    my_ts++;
    let event = applyOperationAndMerge(my_id, my_ts, operation);
    sendUpdate(event.data)
}

const handleOperation = (name, elements, replica) => {
    if (name === "delete")
        return handleDelete(replica, elements[0])
    else {
        return handleInsert(replica, elements)
    }
}

const sendUpdate = (message) => {
    sockets.forEach(socket => {
        socket.write(JSON.stringify(message) + '\n');
    })
}

const handleMessage = (message) => {
    if (message.op.name === "Goodbye") {
        goodbyes++;
        closeIfEnded()
    } else {
        console.log(`Client ${my_id} received an update operation <${JSON.stringify(message.op)}, ${message.ts}> from client ${message.id}`)
        my_ts = Math.max(my_ts, message.ts) + 1;
        applyOperationAndMerge(message.id, message.ts, message.op);
    }
}

function applyAndPush(id, ts, operation) {
    const data = new EventData(id, ts, operation)
    const org_replica = curr_replica;
    const edited_replica = handleOperation(operation.name, operation.elements, org_replica)
    curr_replica = edited_replica;
    let event = new Event(data, org_replica, edited_replica)
    events_history.push(event)
    return event;
}

const applyOperationAndMerge = (id, ts, op) => {
    let event = applyAndPush(id, ts, op);
    events_history.sort((firstEv, secondEv) => { // sort history by ts
        const ans = firstEv.data.ts - secondEv.data.ts;
        return ans === 0 ? firstEv.data.id - secondEv.data.id : ans;
    });
    // shifting a no longer needed operation in history
    const [, ...rest] = events_history;
    if ((new Set(rest.map((e2) => e2.data.id).filter(id => id !== my_id)).size === client_data.other_clients.length)) {
        const event1 = events_history.shift();
        console.log(`Client ${my_id} removes operation <${JSON.stringify(event1.data.op)}, ${event1.data.ts}> from storage`);
    }
    // rearrange history by ts and id. and operate
    console.log(`Client ${my_id} started merging, from ${my_ts} time stamp, on ${curr_replica}`);
    const index = events_history.indexOf(event);
    if (index === 0)
        curr_replica = events_history.length > 1 ? events_history[1].org_replica : curr_replica;
    else
        curr_replica = events_history[index - 1].edited_replica;

    for (let event of events_history.slice(index)) {
        event.org_replica = curr_replica;
        curr_replica = handleOperation(event.data.op.name, event.data.op.elements, curr_replica);
        event.edited_replica = curr_replica;
        console.log(`Operation <${JSON.stringify(event.data.op)}, ${event.data.ts}>, string: ${event.edited_replica}`);
    }
    console.log(`Client ${my_id} ended merging with string ${curr_replica}, on timestamp ${my_ts}`);
    return event;
}

const endSession = async () => {
    await sleep(1000);
    const bye_event_data = new EventData(my_id, my_ts, new Operation("Goodbye", []))
    sendUpdate(bye_event_data)
}

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}


///////////// CONNECTION //////////////

const startServer = () => {
    return net.createServer()
        .listen(my_port, my_ip, 100)
        .on('connection', async (socket) => {
            clients_connected++;
            console.log(`Server id: ${my_id} received connection`);
            socket.setEncoding('utf8');
            sockets.push(socket);
            const stream = socket.pipe(split());
            stream.on('data', (buffer) => {
                const unTrimmedBuffer = buffer.toString('utf8')
                const trimmedBuffer = unTrimmedBuffer.trim()
                if (trimmedBuffer) {
                    const message = JSON.parse(trimmedBuffer)
                    let event_data = new EventData(message.id, message.ts, new Operation(message.op.name, message.op.elements));
                    handleMessage(event_data)
                }
            })
            socket.on('end', function () {
                console.log('socket closing...')
            })

            if ((clients_connected === clients_to_connect.length) && servers_connected === servers_to_connect.length) {
                await mainLoop();
            }
        })
}

const connectTo = (clients) => {
    clients.forEach(client => {
        if (client.id < my_id)
            return;
        const port = client.port
        const ip = client.address
        connect(port, ip)
    })

}


const connect = (port, ip) => {
    const socket = new net.Socket();
    setTimeout(() => connectSocket(socket, port, ip), 5000);
    socket.on('connect', () => connectEventHandler(socket, port));
    socket.on('end', function () {
        console.log('socket closing...')
    })
}

const connectEventHandler = async (socket, port) => {
    servers_connected++;
    socket.setEncoding('utf8');
    sockets.push(socket);
    console.log(`Client id ${my_id} connected to client on port ${port}`);
    const stream = socket.pipe(split());
    stream.on('data', (buffer) => {
        const unTrimmedBuffer = buffer.toString('utf8')
        const trimmedBuffer = unTrimmedBuffer.trim()
        if (trimmedBuffer) {
            const message = JSON.parse(trimmedBuffer)
            let event_data = new EventData(message.id, message.ts, new Operation(message.op.name, message.op.elements));
            // console.log("event_data:" + JSON.stringify(event_data.op));
            // if(message.ts !== undefined)
            handleMessage(event_data)
            // console.log(`Handled message from client id: ${message.id} \n`);
        }
        // socket.end();
    })
    if ((servers_connected === servers_to_connect.length) && clients_to_connect.length === clients_connected) {
        await mainLoop()
    }
}

const connectSocket = (socket, port, ip) => {
    socket.connect(port, ip, () => {
    })
}

const closeConnection = () => {
    server.close()
    sockets.forEach(socket => socket.end())
}
