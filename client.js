const {convert} = require("./convert");
const split = require("split");
const net = require("net");
const {handleInsert, handleDelete} = require("./str");

let clientData = {};
let myId, myPort, myIP, server, serversToConnect, clientsToConnect;
let myTS = 0;
let currentReplica;
let connectedServersCount = 0;
let connectedClientsCount = 0;
let sockets = [];
let hasSentAll = false;
let goodbyesCount = 0;
let eventsHistory = [];

class EventData {
    constructor(id, timeStamp, operation) {
        this.id = id;
        this.timeStamp = timeStamp;
        this.operation = operation;
    }
}

class Operation {
    constructor(name, elements) {
        this.name = name;
        this.elements = elements;
    }
}

class Event {
    constructor(data, replica) {
        this.data = data;
        this.replica = replica;
    }
}

const start = async () => {
    clientData = await convert(process.argv[2]);
    init(clientData);
    server = startServer();
    await connectTo(clientData.otherClients);
};

void start();

const init = (data) => {
    myId = data.id;
    myPort = data.port;
    currentReplica = data.replica;
    serversToConnect = data.otherClients.filter((client) => client.id > myId);
    clientsToConnect = data.otherClients.filter((client) => client.id < myId);
    myIP = "127.0.0.1";
    const initData = new EventData(myId, myTS, null);
    const firstEvent = new Event(initData, currentReplica);
    eventsHistory.push(firstEvent);
};

function closeIfEnded() {
    if ((goodbyesCount >= clientData.otherClients.length) && hasSentAll) {
        console.log(`Client ${myId} is exiting`);
        closeConnection();
        console.log(`DONE\nFinal Replica is: ${currentReplica}`);
        process.send(currentReplica);
    }
}

const mainLoop = async () => {
    const operations = clientData.operations;
    await Promise.all(operations.map(((operation) => {
        // const newOperation = new Operation(operation.name, operation.elements);
        doAndSend(operation);
    }
    )));
    console.log(`Client ${myId} finished his local string modifications`);
    hasSentAll = true;
    await endSession();
    closeIfEnded();
};

const doAndSend = async (operation) => {
    await sleep(1000);
    myTS++;
    let event = applyOperationAndMerge(myId, myTS, operation);
    sendUpdate(event.data);
};

const handleOperation = (name, elements, replica) => {
    if (name === "delete")
        return handleDelete(replica, elements[0]);
    else {
        return handleInsert(replica, elements);
    }
};

const sendUpdate = (message) => {
    sockets.forEach(socket => {
        socket.write(JSON.stringify(message) + "\n");
    });
};

const handleMessage = (message) => {
    if (message.operation.name === "Goodbye") {
        goodbyesCount++;
        closeIfEnded();
    } else {
        console.log(`Client ${myId} received an update operation <${JSON.stringify(message.operation)}, ${message.timeStamp}> from client ${message.id}`);
        myTS = Math.max(myTS, message.timeStamp) + 1;
        applyOperationAndMerge(message.id, message.timeStamp, message.operation);
    }
};

function applyAndPush(id, timeStamp, operation) {
    const data = new EventData(id, timeStamp, operation);
    const replica = handleOperation(operation.name, operation.elements, currentReplica);
    currentReplica = replica;
    let event = new Event(data, replica);
    eventsHistory.push(event);
    return event;
}

const applyOperationAndMerge = (id, timeStamp, operation) => {
    let event = applyAndPush(id, timeStamp, operation);
    // sort history by timeStamp
    eventsHistory.sort((firstEvent, secondEvent) => {
        const ans = firstEvent.data.timeStamp - secondEvent.data.timeStamp;
        return ans === 0 ? firstEvent.data.id - secondEvent.data.id : ans;
    });

    // rearrange history by timeStamp and id, re-applying operations
    console.log(`Client ${myId} started merging, from ${myTS} time stamp, on ${currentReplica}`);
    const index = eventsHistory.indexOf(event);
    currentReplica = eventsHistory[index - 1].replica;
    for (let event of eventsHistory.slice(index)) {
        currentReplica = handleOperation(event.data.operation.name, event.data.operation.elements, currentReplica);
        event.replica = currentReplica;
        console.log(`Operation <${JSON.stringify(event.data.operation)}, ${event.data.timeStamp}>, string: ${event.replica}`);
    }
    console.log(`Client ${myId} ended merging with string ${currentReplica}, on timestamp ${myTS}`);
    return event;
};

const endSession = async () => {
    //TODO
    await sleep(1000);
    const eventData = new EventData(myId, myTS, new Operation("Goodbye", []));
    sendUpdate(eventData);
};

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};


///////////// CONNECTION //////////////

const startServer = () => {
    return net.createServer()
        .listen(myPort, myIP, 100)
        .on("connection", async (socket) => {
            connectedClientsCount++;
            console.log(`Server id: ${myId} received connection`);
            socket.setEncoding("utf8");
            sockets.push(socket);
            const stream = socket.pipe(split());
            stream.on("data", (buffer) => {
                const trimmedBuffer = buffer.toString("utf8").trim();
                if (trimmedBuffer) {
                    const message = JSON.parse(trimmedBuffer);
                    let eventData = new EventData(message.id, message.timeStamp, new Operation(message.operation.name, message.operation.elements));
                    handleMessage(eventData);
                }
            });
            socket.on("end", function () {
                console.log("socket closing...");
            });
            if ((connectedClientsCount === clientsToConnect.length) && connectedServersCount === serversToConnect.length) {
                await mainLoop();
            }
        });
};

const connectTo = (clients) => {
    clients.forEach(client => {
        if (client.id < myId)
            return;
        const port = client.port;
        const ip = client.address;
        connect(port, ip);
    });
};


const connect = (port, ip) => {
    const socket = new net.Socket();
    setTimeout(() => socket.connect(port, ip), 1000);
    socket.on("connect", () => connectEventHandler(socket, port));
    socket.on("end", function () {
        console.log("socket closing...");
    });
};

const connectEventHandler = async (socket, port) => {
    connectedServersCount++;
    socket.setEncoding("utf8");
    sockets.push(socket);
    console.log(`Client id ${myId} connected to client on port ${port}`);
    const stream = socket.pipe(split());
    stream.on("data", (buffer) => {
        const trimmedBuffer = buffer.toString("utf8").trim();
        if (trimmedBuffer) {
            const message = JSON.parse(trimmedBuffer);
            let eventData = new EventData(message.id, message.timeStamp, new Operation(message.operation.name, message.operation.elements));
            handleMessage(eventData);
        }
    });
    if ((connectedServersCount === serversToConnect.length) && clientsToConnect.length === connectedClientsCount) {
        await mainLoop();
    }
};

const closeConnection = () => {
    server.close();
    sockets.forEach(socket => socket.end());
};

