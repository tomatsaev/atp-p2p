function handleDelete(string, index) {
    let local_index = index;
    const org_string = (' ' + string).slice(1);
    let new_string = org_string.substr(0, local_index);
    local_index++;
    new_string = new_string + org_string.substr(local_index);
    return new_string;
}

const handleInsert = (string, elements) => {
    let new_string;
    if (elements.length > 1) {
        new_string =  string.slice(0, elements[1]) + elements[0] + string.slice(elements[1])
    } else {
        new_string =  elements[0] + string.slice(0)
    }
    return new_string;
}

module.exports = {handleDelete, handleInsert}