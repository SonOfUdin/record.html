// =========================================================================
// 1. DOM INTERFACE COMPONENT POINTERS
// =========================================================================
const btnRecord = document.getElementById('btn-record');
const btnStop = document.getElementById('btn-stop');
const btnDownload = document.getElementById('btn-download');
const timerDisplay = document.getElementById('timer');
const statusTag = document.getElementById('status-tag');
const previewSection = document.getElementById('preview-section');
const audioPreview = document.getElementById('audio-preview');
const canvas = document.getElementById('visualizer-canvas');
const canvasCtx = canvas ? canvas.getContext('2d') : null;

// =========================================================================
// 2. RECORDER & VISUALIZER STATE trackers
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
// 3. ACTION EVENT BINDINGS
// =========================================================================
if (btnRecord) btnRecord.addEventListener('click', startRecording);
if (btnStop) btnStop.addEventListener('click', stopRecording);

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); 

// =========================================================================
// 4. CORE ENGINE RETAINED LOGIC
// =========================================================================

async function startRecording() {
    audioChunks = []; // Clear historical buffer frames
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
        console.error('System Access Fault:', error);
        alert('Microphone Access Blocked! Make sure you are viewing this page on your live HTTPS GitHub Pages URL.');
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
    stopTimer(); // Halt timer text calculations instantly on click
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
        
        // Dynamically name file with timestamp to prevent students from overwriting takes
        btnDownload.setAttribute('download', `take_${Date.now()}.wav`);
    }
    if (previewSection) previewSection.classList.remove('hidden');
}

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
