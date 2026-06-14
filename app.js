// =========================================================================
// 1. GLOBAL SUPABASE INITIALIZATION WITH ACCIDENT PREVENTATIVE FALLBACK
// =========================================================================
const SUPABASE_URL = "https://supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key";

let supabase = null;
// Prevent crashes if placeholder text strings are left unedited
if (SUPABASE_URL.includes("your-project-id") === false && typeof supabase !== 'undefined') {
    supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// =========================================================================
// 2. DOM ELEMENT UI REFERENCES
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
const canvasCtx = canvas.getContext('2d');

// Gain elements
const gainSlider = document.getElementById('gain-slider');
const gainValueDisplay = document.getElementById('gain-value');

// =========================================================================
// 3. STATE TRACKING MATRICES
// =========================================================================
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;
let secondsElapsed = 0;
let audioBlob = null;

// Audio context nodes
let audioCtx = null;
let analyser = null;
let gainNode = null; 
let streamDestination = null; 
let dataArray = null;
let source = null;
let animationFrameId = null;

// =========================================================================
// 4. EVENT LISTENERS
// =========================================================================
btnRecord.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);
metaForm.addEventListener('submit', handleFormSubmission);

gainSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    gainValueDisplay.textContent = val.toFixed(1) + 'x';
    // Dynamically adjust hardware audio amplification value if recording is live
    if (gainNode) {
        gainNode.gain.setValueAtTime(val, audioCtx.currentTime);
    }
});

function resizeCanvas() {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// =========================================================================
// 5. IMPLEMENTATION DRIVERS
// =========================================================================

async function startRecording() {
    audioChunks = [];
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 } 
        });

        // Initialize Audio context environment
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Setup nodes: Input Stream -> Gain Node -> Analyser -> Output Destination Stream
        source = audioCtx.createMediaStreamSource(stream);
        gainNode = audioCtx.createGain();
        analyser = audioCtx.createAnalyser();
        streamDestination = audioContextDestination = audioCtx.createMediaStreamDestination(); // Generates a clean output target stream

        analyser.fftSize = 128;
        
        // Set volume boost factor directly from current position on our HTML slider component
        gainNode.gain.setValueAtTime(parseFloat(gainSlider.value), audioCtx.currentTime);

        // Core graph routing connections
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(streamDestination); // Route amplified audio directly into the destination capture line

        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        // Map MediaRecorder targeting our clean amplified destination track line instead of raw mic
        mediaRecorder = new MediaRecorder(streamDestination.stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = processAudioOutput;
        
        mediaRecorder.start();

        updateUIState(true);
        startTimer();
        drawVisualizer();

    } catch (error) {
        console.error('Recording initialization failure context:', error);
        alert('Could not start recorder. Please check browser microphone security preferences.');
    }
}

function drawVisualizer() {
    animationFrameId = requestAnimationFrame(drawVisualizer);
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    analyser.getByteFrequencyData(dataArray);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 1.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#00f2fe');
        gradient.addColorStop(1, '#ff3366');
        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 4, barHeight);
        x += barWidth;
    }
}

function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    mediaRecorder.stop();
    
    // Disconnect active routing connections
    if (source) source.disconnect();
    
    updateUIState(false);
    stopTimer();

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (audioCtx) audioCtx.close();
    
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
}

function processAudioOutput() {
    audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    audioPreview.src = audioUrl;
    btnDownload.href = audioUrl;
    
    const extension = mediaRecorder.mimeType.includes('mp4') ? 'm4a' : 
                      mediaRecorder.mimeType.includes('webm') ? 'webm' : 'wav';
    btnDownload.setAttribute('download', `amplified-take.${extension}`);

    previewSection.classList.remove('hidden');
}

async function handleFormSubmission(event) {
    event.preventDefault();

    if (!audioBlob) return alert('No valid recording asset tracking available.');
    
    // Safety exit clause if database endpoints are unconfigured
    if (!supabase) {
        alert("Local simulation bypass: Audio captured successfully! Connect your actual Supabase credentials in app.js code configuration.");
        console.log("Local metadata package bypass execution:", {
            recorderName: document.getElementById('user-name').value,
            trackTitle: document.getElementById('track-title').value,
            blobSize: audioBlob.size
        });
        return;
    }

    const userName = document.getElementById('user-name').value.trim();
    const trackTitle = document.getElementById('track-title').value.trim();

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Processing Cloud Save...";

    const fileExtension = mediaRecorder.mimeType.includes('mp4') ? 'm4a' : 
                          mediaRecorder.mimeType.includes('webm') ? 'webm' : 'wav';
    const uniqueFilename = `track_${Date.now()}.${fileExtension}`;

    try {
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('audio-recordings')
            .upload(uniqueFilename, audioBlob, { cacheControl: '3600', upsert: false, contentType: audioBlob.type });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('audio-recordings').getPublicUrl(uniqueFilename);
        const absoluteAudioUrl = publicUrlData.publicUrl;

        const { error: dbError } = await supabase
            .from('submissions')
            .insert([{ recorder_name: userName, track_title: trackTitle, audio_url: absoluteAudioUrl }]);

        if (dbError) throw dbError;

        alert(`Success!\nAudio and metadata saved permanently to your Supabase cloud database.`);
        metaForm.reset();
        previewSection.classList.add('hidden');

    } catch (err) {
        alert(`Upload error context pipeline failure: ${err.message || err}`);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Submit Track";
    }
}

function updateUIState(isRecording) {
    if (isRecording) {
        document.body.classList.add('is-recording');
        statusTag.textContent = 'Recording';
        statusTag.className = 'status-tag recording';
        btnRecord.disabled = true;
        btnStop.disabled = false;
        previewSection.classList.add('hidden');
    } else {
        document.body.classList.remove('is-recording');
        statusTag.textContent = 'Ready';
        statusTag.className = 'status-tag idle';
        btnRecord.disabled = false;
        btnStop.disabled = true;
    }
}

function startTimer() {
    secondsElapsed = 0;
    timerDisplay.textContent = '00:00';
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');









                                const secs = String(secondsElapsed % 60).padStart(2, '0');timerDisplay.textContent = ${mins}:${secs};}, 1000);}function stopTimer() { clearInterval(timerInterval); }
