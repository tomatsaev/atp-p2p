
const fs = require('fs');
const readline = require('readline');

function doConvert(file) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(file);
        // Handle stream error (IE: file not found)
        stream.on('error', reject);

        const reader = readline.createInterface({
            input: stream
        });

        const array = [];

        reader.on('line', line => {
            if(line === '')
                array.push('\n');
            else
                array.push(line);
        });

            reader.on('close', () => resolve(array));
    });
}
async function convert(filename) {
    return doConvert(filename)
        .then(res => {
            const client_data = {};
            const first = res.indexOf('\n');
            const second = res.indexOf('\n', first+1);
            const third = res.indexOf('\n', second+1);
            client_data.id = res[0];
            client_data.port = res[1];
            client_data.replica = res[2];
            // parse other clients info
            client_data.other_clients = [];
            for (let i = first + 1; i < second; i++) {
                const data = res[i].split(' ');
                client_data.other_clients.push({
                    id: data[0],
                    address: data[1],
                    port: data[2]
                });
            }
            // parse actions info
            client_data.actions = []
            for(let i = second + 1; i < third; i++){
                const data = res[i].split(' ');
                const [head, ...rest] = data;
                client_data.actions.push({
                    name: head,
                    elements: rest
                });
            }
            // console.log(client_data)
            // console.log(res);
            return client_data;
        }).catch(err => console.error(err));
}

module.exports =  {convert}


//         const first = res.indexOf('\n')
//         const second = res.indexOf('\n', first+1)
//         const third = res.indexOf('\n', second+1)
//         client_data.id = res[0]
//         client_data.port = res[1]
//         client_data.replica = res[2]
//         // parse other clients info
//         client_data.other_clients = [];
//         for (let i = first + 1; i < second; i++) {
//             const data = res[i].split(' ');
//             client_data.other_clients.push({
//                 id: data[0],
//                 address: data[1],
//                 port: data[2]
//             })
//         }
//         // parse actions info
//         client_data.actions = []
//         for(let i = second + 1; i < third; i++){
//             const data = res[i].split(' ')
//             const [head, ...rest] = data;
//             client_data.actions.push({
//                 name: head,
//                 elements: rest
//             })
//         }
//         console.log(client_data)
//         console.log(res);
//
//     }).catch(err => console.error(err));


