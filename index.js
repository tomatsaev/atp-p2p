// class Event {
//     constructor(data, org_replica, edited_replica) {
//         this.data = data;
//         this.org_replica = org_replica;
//         this.edited_replica = edited_replica;
//     }
// }
//
// class EventData {
//     constructor(id, ts, op) {
//         this.id = id;
//         this.ts = ts;
//         this.op = op;
//     }
// }
//
// class Operation {
//     constructor(name, elements) {
//         this.name = name;
//         this.elements = elements;
//     }
// }
//
// const buffer = JSON.stringify({
//     "data": {"id": "2", "ts": 1, "op": {"name": "insert", "elements": ["e"]}},
//     "org_replica": "abc",
//     "edited_replica": "eabc"
// })
// if (buffer) {
//     const message = JSON.parse(buffer)
//     console.log(message);
//     e = new Event(new EventData(message.data.id, message.data.ts, new Operation(message.data.op.name, message.data.op.elements)), message.org_replica, message.edited_replica)
//     console.log(e);
// }
let string = "dabc"
let index = 3
console.log(string.slice(index));