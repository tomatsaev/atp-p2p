function handleDelete(string, index){
    if(index === 0)
        return string.slice(1);
    else {
        return string.slice(0, index) + string.slice(index)
    }
}

const handleInsert = (string, elements) => {
    if(elements.length > 1){
        return string.slice(0, elements[1]) + elements[0] + string.slice(elements[1])
    }
    else{
        return elements[0] + string.slice(0)
    }
}

module.exports =  {handleDelete, handleInsert}