const {convert} = require("./convert");
let client_data = {}

async function start() {
    const parsed = convert('input-file-1.txt')
        .then(res => {
            client_data = res
        });
    await parsed;
}

start()
    .then(() => {
        console.log(client_data);
    }
);
