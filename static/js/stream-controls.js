const STREAM_URL = 'https://stream.kaleido.cam/kaleido-01/kaleidoscope/whep';

const video = document.getElementById('video');
const statusInd = document.getElementById('liveIndicator');
const statusText = document.getElementById('statusText');

let peerConnection = null;
let reconnectTimer = null;
let isReconnecting = false;

async function startStream() {
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
            attemptReconnect();
        }
    };

    try {
        // 4. Create Offer (WHEP)
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // 5. Send Offer to MediaMTX
        const response = await fetch(STREAM_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/sdp'},
            body: offer.sdp
        });

        if (!response.ok) throw new Error(`Server returned ${response.status}`);

        // 6. Handle Answer
        const answerSdp = await response.text();
        await peerConnection.setRemoteDescription({
            type: 'answer',
            sdp: answerSdp
        });

    } catch (err) {
        console.error("Connection failed:", err);
        attemptReconnect();
    }
}

function attemptReconnect() {
    if (isReconnecting) return;
    isReconnecting = true;

    updateStatus('reconnecting');

    // Clear any existing timer to avoid overlaps
    if (reconnectTimer) clearTimeout(reconnectTimer);

    reconnectTimer = setTimeout(() => {
        isReconnecting = false;
        console.log("Attempting to reconnect...");
        startStream();
    }, 2000); // Retry every 2 seconds
}

function updateStatus(state) {
    statusInd.className = 'status-indicator';

    switch (state) {
        case 'connected':
            statusInd.classList.add('connected');
            statusText.innerText = "Live";
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

function changeApiState(key, value) {
    console.log(`[API] Change ${key} to: ${value}`);
    fetch("api/state", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({[key]: value})
    });
}

let debounceTimer;

function lazyChangeApiState(key, value) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        changeApiState(key, value);
    }, 250);
}

// Start immediately on load
startStream();

