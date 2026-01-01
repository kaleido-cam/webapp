const socket = io();

socket.on("connect", () => {
  setUIEnabled(true);
  socket.emit("get_current_state");
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

socket.on("connected_clients", (count) => {
    document.querySelector("#connected_clients").innerText = count;
    if (count > 0) {
        document.querySelector('#icon-eye').style.display = 'inline';
        document.querySelector('#icon-eye-closed').style.display = 'none';
    } else {
        document.querySelector('#icon-eye').style.display = 'none';
        document.querySelector('#icon-eye-closed').style.display = 'inline';
    }
});

socket.on("current_brightness", (value) => {
    updateBrightnessLabel(value);
    document.querySelector("#brightness_slider").value = value;
});

socket.on("current_frequency", (value) => {
    updateFrequencyLabel(value);
    document.querySelector("#frequency_slider").value = value;
});

function updateBrightnessLabel(value) {
    document.querySelector("#brightness_label").innerText = `${value} %`;
}

function updateFrequencyLabel(value) {
    document.querySelector("#frequency_label").innerText = `${value} Hz`;
}

function setUIEnabled(enabled) {
    document.querySelectorAll(".controls input").forEach(input => {
        input.disabled = !enabled;
    });
    document.querySelectorAll(".controls button").forEach(button => {
        button.disabled = !enabled;
    });
}

function changeBrightness(value) {
    updateBrightnessLabel(value);
    lazyChangeApiState("brightness", value);
}

function changeFrequency(value) {
    updateFrequencyLabel(value);
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

function throttle(func, limit) {
    let isThrottled = false;
    let savedArgs = null;

    return function wrapper(...args) {
        if (isThrottled) {
            savedArgs = args;
            return;
        }

        func.apply(this, args);
        isThrottled = true;

        setTimeout(() => {
            isThrottled = false;
            if (savedArgs) {
                wrapper.apply(this, savedArgs);
                savedArgs = null;
            }
        }, limit);
    };
}

const lazyChangeApiState = throttle((key, value) => {
    changeApiState(key, value);
}, 150);

function changeApiState(key, value) {
    console.log(`[WS] Change ${key} to: ${value}`);
    socket.emit(key, value);
}

function toggleAdvancedControls() {
    const advControls = document.querySelector("#advanced_controls");
    const toggleButton = document.querySelector("#toggle_advanced_button");
    if (advControls.style.display === "none") {
        advControls.style.display = "block";
        toggleButton.innerText = "Hide Advanced Controls";
    } else {
        advControls.style.display = "none";
        toggleButton.innerText = "Show Advanced Controls";
    }
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