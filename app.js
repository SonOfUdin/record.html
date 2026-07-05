// =========================================================================
// 1. GOOGLE APPS SCRIPT WEB APP TARGET URL
// Paste your deployed script web app link between the double quotes below:
// =========================================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/library/d/12kQ3TflxL1bKDRdk1OmbxGMf1gINsrDiMbQyFIQUsEBwjaWOhIwNSuiG/1";

// =========================================================================
// 2. DOM INTERFACE COMPONENT POINTERS
// =========================================================================
const btnRecord = document.getElementById('btn-record');
const btnStop = document.getElementById('btn-stop');
const btnSubmit = document.getElementById('btn-submit');
const btnDownload = document.getElementById('btn-download');
const timerDisplay = document.getElementById('timer');
const statusTag = document.getElementById('status-tag');
const previewSection = document.getElementById('preview-section');
const audioPreview = document.getElementById('audio-preview');
const metaForm = document.getElementById('meta-form');
const canvas = document.getElementById('visualizer-canvas');
const canvasCtx = canvas ? canvas.getContext('2d') : null;

// =========================================================================
// 3. MASTER APPLICATION CONTAINER ENTRIES
// =========================================================================
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;
let secondsElapsed = 0;
let audioBlob = null;

let audioCtx = null;
let analyser = null;
let dataArray = null;
let source = null;
let animationFrameId = null;

// =========================================================================
// 4. BIND ACTION CAPTURE TRIGGERS
// =========================================================================
if (btnRecord) btnRecord.addEventListener('click', startRecording);
if (btnStop) btnStop.addEventListener('click', stopRecording);
if (metaForm) metaForm.addEventListener('submit', handleGoogleUpload);

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); 

// =========================================================================
// 5. INTERACTIVE FUNCTION CORE LOGIC
// =========================================================================

async function startRecording() {
    audioChunks = []; 
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true } 
        });

        if (canvasCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128; 
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            drawVisualizer(); 
        }

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = processAudioOutput;
        
        mediaRecorder.start();
        updateUIState(true);
        startTimer();

    } catch (error) {
        console.error('Microphone stream error:', error);
        alert('Microphone Access Blocked! Make sure you are testing on your secure HTTPS GitHub Pages link.');
    }
}

function drawVisualizer() {
    animationFrameId = requestAnimationFrame(drawVisualizer);
    if (!analyser || !canvasCtx) return;
    
    analyser.getByteFrequencyData(dataArray);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / analyser.frequencyBinCount) * 1.5;
    let x = 0;
    
    for (let i = 0; i < analyser.frequencyBinCount; i++) {
        let barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        canvasCtx.fillStyle = '#00f2fe';
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 4, barHeight);
        x += barWidth;
    }
}

function stopRecording() {
    stopTimer(); // Instantly freezes numbers on screen click
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop()); 
    updateUIState(false);

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (audioCtx) audioCtx.close();
}

function processAudioOutput() {
    audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    if (audioPreview) audioPreview.src = audioUrl;
    if (btnDownload) {
        btnDownload.href = audioUrl;
        btnDownload.setAttribute('download', 'recording.wav');
    }
    if (previewSection) previewSection.classList.remove('hidden');
}

// =========================================================================
// 6. GOOGLE APPS SCRIPT UPLOAD INTERFACE
// =========================================================================

async function handleGoogleUpload(event) {
    event.preventDefault(); 
    if (!audioBlob) return alert('Audio tracking target asset empty.');

    const userName = document.getElementById('user-name').value.trim();
    const trackTitle = document.getElementById('track-title').value.trim();
    const trackLanguage = document.getElementById('audio-language').value;

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Uploading to Google Drive...";

    // Helper reader to convert raw binary file bytes to string Base64 text formatting
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async function () {
        const base64String = reader.result.split(',')[1]; // Strip file meta headers

        // Package data payload structure cleanly
        const payload = {
            name: userName,
            title: trackTitle,
            language: trackLanguage,
            audioBase64: base64String,
            mimeType: audioBlob.type
        };

        // Locate this section inside handleGoogleUpload in your app.js file:
try {
    // Dispatch payload package to Google Apps Script Endpoint safely
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", // Bypasses browser strict network barriers
        redirect: "follow", // Mandatory rule for handling Google Apps Script responses
        headers: {
            "Content-Type": "text/plain;charset=utf-8" // Protects format transitions
        },
        body: JSON.stringify(payload)
    });

    // Because 'no-cors' limits response insights, give immediate success feedback
    alert(`Success!\nTrack data dispatched into your Google pipeline loop.`);
    metaForm.reset();
    if (previewSection) previewSection.classList.add('hidden');

} catch (err) {
    console.error("Google Pipeline Error:", err);
    alert(`Upload Failed: ${err.message || err}`);
}
 
        finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Submit Track";
        }
    };
}


// =========================================================================
// 7. INTERACTIVE DISPLAY ADJUSTMENTS
// =========================================================================

function updateUIState(isRecording) {
    if (isRecording) {
        document.body.classList.add('is-recording');
        if (statusTag) { statusTag.textContent = 'Recording'; statusTag.className = 'status-tag recording'; }
        if (btnRecord) btnRecord.disabled = true;
        if (btnStop) btnStop.disabled = false;
        if (previewSection) previewSection.classList.add('hidden');
    } else {
        document.body.classList.remove('is-recording');
        if (statusTag) { statusTag.textContent = 'Ready'; statusTag.className = 'status-tag idle'; }
        if (btnRecord) btnRecord.disabled = false;
        if (btnStop) btnStop.disabled = true;
    }
}

function startTimer() {
    secondsElapsed = 0;
    if (timerDisplay) timerDisplay.textContent = '00:00';
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const secs = String(secondsElapsed % 60).padStart(2, '0');
        if (timerDisplay) timerDisplay.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() { 
    clearInterval(timerInterval); 
}
