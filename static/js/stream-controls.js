const video = document.getElementById('stream');
const statusInd = document.getElementById('liveIndicator');
const statusText = document.getElementById('statusText');
const offlineOverlay = document.getElementById('offlineOverlay');

let peerConnection = null;
let reconnectTimer = null;
let isReconnecting = false;

// TODO: file contains motor control stuff. Get rid of it. Ideally move to websocket control.

async function startStream(stream_url) {
    if (peerConnection) {
        peerConnection.close();
    }

    updateStatus('connecting');

    peerConnection = new RTCPeerConnection();

    peerConnection.addTransceiver('video', {direction: 'recvonly'});

    peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
            video.srcObject = event.streams[0];
            updateStatus('connected');
        }
    };

    // 3. Monitor connection state for auto-reconnect
    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log("ICE State:", state);
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            attemptReconnect(stream_url);
        }
    };

    try {
        // 4. Create Offer (WHEP)
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // 5. Send Offer to MediaMTX
        const response = await fetch(stream_url, {
            method: 'POST',
            headers: {'Content-Type': 'application/sdp'},
            body: offer.sdp
        });

        if (!response.ok) {
            if (response.status === 404) {
                updateStatus("offline")
                setTimeout(() => attemptReconnect(stream_url), 15000);
                return
            }
            throw new Error(`Server returned ${response.status}`);
        }

        // 6. Handle Answer
        const answerSdp = await response.text();
        await peerConnection.setRemoteDescription({
            type: 'answer',
            sdp: answerSdp
        });

    } catch (err) {
        console.error("Connection failed:", err);
        attemptReconnect(stream_url);
    }
}

function attemptReconnect(stream_url) {
    if (isReconnecting) return;
    isReconnecting = true;

    updateStatus('reconnecting');

    // Clear any existing timer to avoid overlaps
    if (reconnectTimer) clearTimeout(reconnectTimer);

    reconnectTimer = setTimeout(() => {
        isReconnecting = false;
        console.log("Attempting to reconnect...");
        startStream(stream_url);
    }, 2000); // Retry every 2 seconds
}

function updateStatus(state) {
    statusInd.className = 'status-indicator';

    switch (state) {
        case 'connected':
            statusInd.classList.add('connected');
            statusText.innerText = "Live";
            offlineOverlay.style.display = "none";
            setUIEnabled(true);
            break;
        case 'reconnecting':
            statusInd.classList.add('reconnecting');
            statusText.innerText = "Connection lost. Retrying...";
            setUIEnabled(false);
            break;
        case 'connecting':
            statusInd.classList.add('reconnecting');
            statusText.innerText = "Connecting...";
            setUIEnabled(false);
            break;
        default:
            statusInd.classList.add('error');
            statusText.innerText = "Offline";
            offlineOverlay.style.display = "flex";
            setUIEnabled(false);
    }
}

function toggleFullscreen() {
    let container = document.querySelector(".video-wrapper");
    if (document.fullscreenElement) {
        document.exitFullscreen();
        return
    }
    if (container.requestFullscreen) {
        container.requestFullscreen();
    }
}

addEventListener("fullscreenchange", (event) => {
    if (!document.fullscreenElement) {
        document.querySelector(".maximize-video").style.display = "block";
        document.querySelector(".minimize-video").style.display = "none";
    } else {
        document.querySelector(".maximize-video").style.display = "none";
        document.querySelector(".minimize-video").style.display = "block";
    }
})

function setUIEnabled(enabled) {
    document.querySelectorAll(".controls input").forEach(input => {
        input.disabled = !enabled;
    });
    document.querySelectorAll(".controls button").forEach(button => {
        button.disabled = !enabled;
    });
}

function changeBrightness(value) {
    document.querySelector("#brightness_label").innerText = `${value} %`;
    lazyChangeApiState("brightness", value);
    document.querySelector("#brightness_slider").value = value;
}

function changeFrequency(value) {
    document.querySelector("#frequency_label").innerText = `${value} Hz`;
    lazyChangeApiState("frequency", value);
    document.querySelector("#frequency_slider").value = value;
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

async function changeApiState(key, value) {
    console.log(`[API] Change ${key} to: ${value}`);
    try {
        const response = await fetch("api/state", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({[key]: value})
        });
        if (!response.ok) {
            if (response.status === 403) {
                toastMessage(`You don't have permission to set ${key}=${value}.`, "error");
            } else if (response.status === 400) {
                const errorData = await response.json();
                toastMessage(`${key}=${value} is invalid: ${errorData.message}`, "error");
            } else if (response.status >= 500) {
                toastMessage(`ServerError: Unable to set ${key}=${value}.`, "error");
            } else {
                toastMessage(`Failed to set ${key}=${value}.`, "error");
            }
        }
    } catch (error) {
        toastMessage("NetworkError: Unable to reach the server.", "error");
        console.error(error);
    }
}

function toastMessage(message, category="") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${category}`;
    toast.innerText = message;
    const toastContainer = document.querySelector("#toast-container");
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("visible");
    }, 100);
    setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, 3000);
}

let debounceTimer;

function lazyChangeApiState(key, value) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        changeApiState(key, value);
    }, 250);
}
