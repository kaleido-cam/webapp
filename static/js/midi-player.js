const dropInvitation = document.getElementById('midi-filedrop');
let dragCounter = 0;

window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropInvitation.style.display = 'flex';
});

window.addEventListener('dragover', (e) => {
    e.preventDefault();
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
        dropInvitation.style.display = 'none';
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropInvitation.style.display = 'none';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileDrop(files[0]);
    }
});

async function handleFileDrop(file) {
    if (!file.name.endsWith('.mid') && !file.name.endsWith('.midi')) {
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);

        console.log(midi);
        console.log("MIDI Loaded:", midi.name);
        console.log("Tracks:", midi.tracks.length);
        const player = document.getElementById("midi-player");

        isRunning = false;
        player.innerHTML = "";
        player.style.display = "flex";

        const template = document.querySelector("#midi-track");

        midi.tracks.forEach(track => {
            const row = document.importNode(template.content, true);
            row.querySelector(".midi-track-number").textContent = midi.tracks.indexOf(track) + 1;
            row.querySelector(".midi-track-name").textContent = track.name || "Unnamed Track";
            const playButton = row.querySelector("button.btn-play");
            const stopButton = row.querySelector("button.btn-stop");
            playButton.addEventListener("click", async () => {
                if (isRunning) return;
                isRunning = true;
                document.querySelectorAll("#midi-player button").forEach(btn => btn.disabled = true);
                playButton.disabled = true;
                stopButton.disabled = false;
                await playNotes(track["notes"]);
            });
            stopButton.addEventListener("click", () => {
                isRunning = false;
                document.querySelectorAll("#midi-player button.btn-play").forEach(btn => btn.disabled = false);
                playButton.disabled = false;
                stopButton.disabled = true;
                changeApiState("frequency", 0);
            });
            player.appendChild(row);
        });

    } catch (error) {
        toastMessage(`Error parsing MIDI: ${error}`, "error");
    }
}

async function playNotes(notes) {
    // const notes = instructions["tracks"][track]["notes"];
    const songStartedAt = performance.now();
    for (const noteObj of notes) {
        const startTime = songStartedAt + noteObj["time"] * 1000;
        const now = performance.now();
        if (startTime > now) {
            await playNote("-", startTime - now);
        }
        const note = noteObj["name"];
        const duration = noteObj["duration"] * 1000;
        await playNote(note, duration);
    }
    changeApiState("frequency", 0);
}