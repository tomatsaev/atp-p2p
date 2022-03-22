const fs = require("fs");
const readline = require("readline");
const events = require("events");

class Operation {
    constructor(name, elements) {
        this.name = name;
        this.elements = elements;
    }
}

const convert = async (file) => {
    const stream = fs.createReadStream(file);
    const reader = readline.createInterface({
        input: stream
    });
    let array = [];
    reader.on("line", line => {
        if(line === "")
            array.push("\n");
        else
            array.push(line);
    });
    await events.once(reader, "close");
    return extractData(array);
};
const extractData = (result) => {
    const clientData = {};
    const first = result.indexOf("\n");
    const second = result.indexOf("\n", first + 1);
    let third = result.length;
    while (result[third -1] === "\n") {
        third--;
    }
    clientData.id = result[0];
    clientData.port = result[1];
    clientData.replica = result[2];
    // parse other clients
    clientData.otherClients = [];
    for (let i = first + 1; i < second; i++) {
        const data = result[i].split(" ");
        clientData.otherClients.push({
            id: data[0],
            address: data[1],
            port: data[2]
        });
    }
    // parse actions
    clientData.operations = [];
    for(let i = second + 1; i < third; i++){
        const data = result[i].split(" ");
        const [head, ...rest] = data;
        clientData.operations.push(
            new Operation(head, rest));
    }
    return clientData;
};

module.exports =  {convert};