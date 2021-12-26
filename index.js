
students = ["Tom", "Or"]

function does(){
    for (const s of students) {
        something(s).then(() =>
            console.log(s + " then is async?"))
        console.log("I should be printed first")
    }
}

async function something(s){
    // return new Promise((r, e) => {
    await sleep(1000)
        console.log(s + " is async?");
    // })
}

does()

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}