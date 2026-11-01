export function post(postBody) {
    return {
        method: "POST",
        body: postBody
    };
}

export function del() {
    return {
        method: "DELETE"
    };
}

export function put(putBody) {
    return {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(putBody)
    };
}

export function favorite(isFavorite) {
    return put({
            isFavorite: isFavorite,
            title: null,
            description: null
        }
    );
}