const video = document.getElementById('stream');
const statusInd = document.getElementById('liveIndicator');
const statusText = document.getElementById('statusText');
const offlineOverlay = document.getElementById('offlineOverlay');

let peerConnection = null;
let reconnectTimer = null;
let isReconnecting = false;

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
            break;
        case 'reconnecting':
            statusInd.classList.add('reconnecting');
            statusText.innerText = "Connection lost. Retrying...";
            break;
        case 'connecting':
            statusInd.classList.add('reconnecting');
            statusText.innerText = "Connecting...";
            break;
        default:
            statusInd.classList.add('error');
            statusText.innerText = "Offline";
            offlineOverlay.style.display = "flex";
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
