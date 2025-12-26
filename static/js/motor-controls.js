const socket = io();

socket.on("connect", () => {
  console.log(`Connected: ${socket.id}`);
  socket.emit('json', {data: 'I\'m connected!'});
  setUIEnabled(true);
});

socket.on("disconnect", () => {
  console.log(`Disconnected: ${socket.id}`);
  setUIEnabled(false);
});

socket.on("error", (error) => {
    console.error(`Socket error: ${JSON.stringify(error)}`);
    const message = error.message;
    if (message) {
        toastMessage(`Error: ${message}`, "error");
    }
})

socket.on("current_brightness", (value) => {
    document.querySelector("#brightness_label").innerText = `${value} %`;
    document.querySelector("#brightness_slider").value = value;
});

socket.on("current_frequency", (value) => {
    document.querySelector("#frequency_label").innerText = `${value} Hz`;
    document.querySelector("#frequency_slider").value = value;
});

function setUIEnabled(enabled) {
    document.querySelectorAll(".controls input").forEach(input => {
        input.disabled = !enabled;
    });
    document.querySelectorAll(".controls button").forEach(button => {
        button.disabled = !enabled;
    });
}

function changeBrightness(value) {
    lazyChangeApiState("brightness", value);
}

function changeFrequency(value) {
    lazyChangeApiState("frequency", value);
}

function rotateCounterClockwise() {
    setUIEnabled(false);
    changeFrequency(-1000);
    setTimeout(() => {
        changeFrequency(0);
        setUIEnabled(true);
    }, 1000);
}

function rotateClockwise() {
    setUIEnabled(false);
    changeFrequency(1000);
    setTimeout(() => {
        changeFrequency(0);
        setUIEnabled(true);
    }, 1000);
}

let debounceTimer;

function lazyChangeApiState(key, value) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        changeApiState(key, value);
    }, 250);
}

function changeApiState(key, value) {
    console.log(`[WS] Change ${key} to: ${value}`);
    socket.emit(key, value);
}

// Legacy code for reference - replaced by socket.io implementation
// Server still supports the REST API, so feel free to play around :)
//
// async function changeApiState(key, value) {
//     console.log(`[API] Change ${key} to: ${value}`);
//     try {
//         const response = await fetch("api/state", {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json"
//             },
//             body: JSON.stringify({[key]: value})
//         });
//         if (!response.ok) {
//             if (response.status === 403) {
//                 toastMessage(`You don't have permission to set ${key}=${value}.`, "error");
//             } else if (response.status === 400) {
//                 const errorData = await response.json();
//                 toastMessage(`${key}=${value} is invalid: ${errorData.message}`, "error");
//             } else if (response.status >= 500) {
//                 toastMessage(`ServerError: Unable to set ${key}=${value}.`, "error");
//             } else {
//                 toastMessage(`Failed to set ${key}=${value}.`, "error");
//             }
//         }
//     } catch (error) {
//         toastMessage("NetworkError: Unable to reach the server.", "error");
//         console.error(error);
//     }
// }