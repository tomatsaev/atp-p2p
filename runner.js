const { fork } = require("child_process");
let clients = [];
let finalReplicas = [];
let clientsCounter = 0;
let inputFiles1 = [
    "input-file-1.txt",
    "input-file-2.txt",
    "input-file-3.txt",
    "input-file-4.txt",
    "input-file-5.txt",
    "input-file-6.txt",
    "input-file-7.txt",
    "input-file-8.txt",
    "input-file-9.txt",
    "input-file-10.txt",
]
let inputFiles2 = [
    "input-file-11.txt",
    "input-file-12.txt"
]
let inputFiles3 = [
    "input-file-31.txt",
    "input-file-32.txt",
    "input-file-33.txt"
]

inputFiles1.map(fileName => {
    const client = fork("client.js", [`inputs/${fileName}`])
    clientsCounter++;
    client.on("message", message => finalReplicas.push(message));
    clients.push(client);
})

clients.map(client =>
    client.on("close", code => {
        clientsCounter--;
        if (clientsCounter === 0)
            checkReplicas();
    })
)

const checkReplicas = () => {
    const result = finalReplicas.every((replica, index, arr) => replica === arr[0]);
    if (result)
        console.log("All replicas are equal! replica: " + finalReplicas[0]);
    else {
        console.log("Not all replicas are equal, replicas:");
        finalReplicas.map((replica, id) =>
            console.log(`Client ${id}: ${replica}`)
        )
    }
}
