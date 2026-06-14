// =========================================================================
// 1. GLOBAL SUPABASE CREDENTIAL INITIALIZATION
// Make sure to replace these placeholder strings with your real project credentials
// =========================================================================
const SUPABASE_URL = "https://supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// =========================================================================
// 3. APPLICATION STATE TRACKERS
// =========================================================================
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;
let secondsElapsed = 0;
let audioBlob = null;

// Web Audio API context tracking nodes
let audioCtx = null;
let analyser = null;
let dataArray = null;
let source = null;
let animationFrameId = null;

// =========================================================================
// 4. CORE ENGINE EVENT LISTENERS
// =========================================================================
btnRecord.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);
metaForm.addEventListener('submit', handleFormSubmission);

// Recalculate canvas grid dimensions fluidly to prevent blurring
function resizeCanvas() {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Set dimensions on initial startup

// =========================================================================
// 5. FUNCTIONAL IMPLMENTATION WORKFLOWS
// =========================================================================

/**
 * Boots the audio loop capturing hardware stream nodes
 */
async function startRecording() {
    audioChunks = []; // Flush buffer history
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 } 
        });

        // Instantiate browser analytical environment pipeline
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128; // Keep frequency bar count stylised and visible
        
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        // Configure system native file package recording engine
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = processAudioOutput;
        
        mediaRecorder.start();

        updateUIState(true);
        startTimer();
        drawVisualizer(); // Launch rendering frame loops

    } catch (error) {
        console.error('Hardware profile capture fault:', error);
        alert('Could not open audio tracks. Please enable microphone permissions in your security panel.');
    }
}

/**
 * Real-Time Canvas Render Loop
 */
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

        // Custom Studio Gradient: Cyan fading upwards into Neon Crimson spikes
        const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#00f2fe');
        gradient.addColorStop(1, '#ff3366');

        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 4, barHeight);

        x += barWidth;
    }
}

/**
 * Halts ongoing hardware audio data ingestion
 */
function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop()); // Shuts off user browser privacy hardware light
    
    updateUIState(false);
    stopTimer();

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (audioCtx) audioCtx.close();
    
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height); // Clear remaining paint artifacts
}

/**
 * Prepares the audio artifact array compilation file references
 */
function processAudioOutput() {
    audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    audioPreview.src = audioUrl;
    btnDownload.href = audioUrl;
    
    // Assign proper cross-platform container tag extensions
    const extension = mediaRecorder.mimeType.includes('mp4') ? 'm4a' : 
                      mediaRecorder.mimeType.includes('webm') ? 'webm' : 'wav';
    btnDownload.setAttribute('download', `studio-take.${extension}`);

    previewSection.classList.remove('hidden');
}

/**
 * Secure Unified Database & Object Cloud Upload Entry Pipeline
 */
async function handleFormSubmission(event) {
    event.preventDefault(); // Halt standard site reloads

    if (!audioBlob) return alert('No recorded audio instance found.');

    const userName = document.getElementById('user-name').value.trim();
    const trackTitle = document.getElementById('track-title').value.trim();

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Processing...";

    const fileExtension = mediaRecorder.mimeType.includes('mp4') ? 'm4a' : 
                          mediaRecorder.mimeType.includes('webm') ? 'webm' : 'wav';
    const uniqueFilename = `track_${Date.now()}.${fileExtension}`;

    try {
        // LAYER A: Upload the raw binary file package to the cloud storage bucket
        btnSubmit.textContent = "Uploading audio asset...";
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('audio-recordings')
            .upload(uniqueFilename, audioBlob, { 
                cacheControl: '3600', 
                upsert: false, 
                contentType: audioBlob.type 
            });

        if (uploadError) throw uploadError;

        // LAYER B: Extract the permanent public web address url link for that file asset
        const { data: publicUrlData } = supabase.storage
            .from('audio-recordings')
            .getPublicUrl(uniqueFilename);

        const absoluteAudioUrl = publicUrlData.publicUrl;

        // LAYER C: Inject metadata schema row into the permanent database table logs
        btnSubmit.textContent = "Saving form entries...";
        const { data: dbData, error: dbError } = await supabase
            .from('submissions')
            .insert([
                { 
                    recorder_name: userName, 
                    track_title: trackTitle, 
                    audio_url: absoluteAudioUrl 
                }
            ]);

        if (dbError) throw dbError;

        alert(`Success!\nAudio and metadata saved permanently to your Supabase instance.`);
        
        metaForm.reset();
        previewSection.classList.add('hidden');

    } catch (err) {
        console.error("Pipeline breakdown:", err);
        alert(`Submission failed: ${err.message || err}`);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Submit Track";
    }
}

/**
 * UI State Transitions
 */
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

/**
 * Visual Display Timing Calculations
 */
function startTimer() {
    secondsElapsed = 0;
    timerDisplay.textContent = '00:00';
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const secs = String(secondsElapsed % 60).padStart(2, '0');
        timerDisplay.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }
