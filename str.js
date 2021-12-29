function handleDelete(string, index){
    if(index === 0)
        string = string.slice(1);
    else {
        string = string.slice(0, index) + string.slice(index)
    }
    return string;
}

function handleInsert(string, elements){
    if(elements.length > 1){
        string = string.slice(0, elements[1]) + elements[0] + string.slice(elements[1])
    }
    else{
        string = elements[0] + string
    }
    return string;
}

module.exports =  {handleDelete, handleInsert}