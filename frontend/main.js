let swingData = [];
let swingStarted = false;
let lastPose = null;
const SWING_PHASES = {
    SETUP: 'setup',
    CONTACT: 'contact',
    FOLLOW_THROUGH: 'follow_through'
};

// Add recording state variables
let isRecording = false;
let currentSwing = [];
let recordedSwings = [];

async function setupPoseDetection() {
    const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.BlazePose,
        {
            runtime: 'tfjs',
            enableSmoothing: true,
            modelType: 'full'
        }
    );

    const video = document.getElementById('video');
    const outputCanvas = document.getElementById('outputCanvas');
    const ctx = outputCanvas.getContext('2d');
    const analysisResults = document.getElementById('analysisResults');

    // Set up video stream
    const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
        }
    });
    video.srcObject = stream;

    // Resize canvas to match video
    outputCanvas.width = video.videoWidth;
    outputCanvas.height = video.videoHeight;

    // Add UI elements for recording and playback
    const recordingButton = document.createElement('button');
    recordingButton.textContent = 'Start Recording';
    recordingButton.onclick = toggleRecording;
    document.body.insertBefore(recordingButton, document.querySelector('.analysis-panel'));

    const playbackContainer = document.createElement('div');
    playbackContainer.className = 'playback-container';
    document.body.insertBefore(playbackContainer, document.querySelector('.analysis-panel'));

    function toggleRecording() {
        isRecording = !isRecording;
        recordingButton.textContent = isRecording ? 'Stop Recording' : 'Start Recording';
        
        if (isRecording) {
            currentSwing = [];
        }
    }

    async function processFrame() {
        const poses = await detector.estimatePoses(video);
        
        if (poses.length > 0) {
            const pose = poses[0];
            
            // Record swing if recording is active
            if (isRecording) {
                currentSwing.push({
                    timestamp: Date.now(),
                    pose,
                    phase: detectSwingPhase(pose)
                });
            } else if (currentSwing.length > 0) {
                handleRecordingComplete();
            }
            
            // Store pose data with timestamp
            swingData.push({
                timestamp: Date.now(),
                pose,
                phase: detectSwingPhase(pose)
            });
            
            // Draw poses
            ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
            drawPoses(poses, ctx);
            
            // Update analysis
            updateAnalysis(analysisResults, pose);
        }

        requestAnimationFrame(processFrame);
    }

    function detectSwingPhase(pose) {
        if (!lastPose) return SWING_PHASES.SETUP;

        // Calculate angles and positions
        const rightElbowAngle = calculateAngle(
            pose.keypoints[12], // right shoulder
            pose.keypoints[14], // right elbow
            pose.keypoints[16]  // right wrist
        );
        
        const rightShoulderHeight = pose.keypoints[12].y;
        const rightHipHeight = pose.keypoints[24].y;
        
        // Simple phase detection logic
        if (rightElbowAngle < 90 && rightShoulderHeight < rightHipHeight) {
            return SWING_PHASES.CONTACT;
        } else if (rightElbowAngle > 120) {
            return SWING_PHASES.FOLLOW_THROUGH;
        }
        
        return SWING_PHASES.SETUP;
    }

    function calculateAngle(p1, p2, p3) {
        const a = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const b = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));
        const c = Math.sqrt(Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2));
        
        return Math.acos((a*a + b*b - c*c) / (2*a*b)) * (180/Math.PI);
    }

    function drawPoses(poses, ctx) {
        poses.forEach(pose => {
            // Draw keypoints
            pose.keypoints.forEach(keypoint => {
                ctx.beginPath();
                ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#00FF00';
                ctx.fill();
            });

            // Draw connections
            drawBodyConnections(pose, ctx);
        });
    }

    function drawBodyConnections(pose, ctx) {
        const connections = [
            [12, 14], // right shoulder to elbow
            [14, 16], // right elbow to wrist
            [12, 24], // right shoulder to hip
            [24, 26], // right hip to knee
            [26, 28], // right knee to ankle
        ];

        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        
        connections.forEach(([a, b]) => {
            const p1 = pose.keypoints[a];
            const p2 = pose.keypoints[b];
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        });
    }

    function updateAnalysis(resultsElement, pose) {
        const currentPhase = detectSwingPhase(pose);
        const rightElbowAngle = calculateAngle(
            pose.keypoints[12],
            pose.keypoints[14],
            pose.keypoints[16]
        );
        
        resultsElement.innerHTML = `
            <h3>Current Analysis</h3>
            <p>Phase: ${currentPhase}</p>
            <p>Right Elbow Angle: ${rightElbowAngle.toFixed(1)}°</p>
            <p>Swing Count: ${swingData.length}</p>
            <p>Recording: ${isRecording ? 'Active' : 'Inactive'}</p>
            <p>Recorded Swings: ${recordedSwings.length}</p>
        `;
    }

    // Add playback functionality
    function playSwing(swingData) {
        let currentIndex = 0;
        const playbackCanvas = document.createElement('canvas');
        playbackCanvas.width = video.videoWidth;
        playbackCanvas.height = video.videoHeight;
        playbackContainer.appendChild(playbackCanvas);
        const playbackCtx = playbackCanvas.getContext('2d');

        const playbackInterval = setInterval(() => {
            if (currentIndex < swingData.length) {
                const pose = swingData[currentIndex].pose;
                playbackCtx.clearRect(0, 0, playbackCanvas.width, playbackCanvas.height);
                drawPoses([pose], playbackCtx);
                currentIndex++;
            } else {
                clearInterval(playbackInterval);
                playbackContainer.removeChild(playbackCanvas);
            }
        }, 100); // Play at 10 FPS
    }

    // Add swing comparison
    function compareSwings(swing1, swing2) {
        const comparisonCanvas = document.createElement('canvas');
        comparisonCanvas.width = video.videoWidth * 2;
        comparisonCanvas.height = video.videoHeight;
        playbackContainer.appendChild(comparisonCanvas);
        const comparisonCtx = comparisonCanvas.getContext('2d');

        let index1 = 0;
        let index2 = 0;

        const comparisonInterval = setInterval(() => {
            if (index1 < swing1.length && index2 < swing2.length) {
                const pose1 = swing1[index1].pose;
                const pose2 = swing2[index2].pose;

                comparisonCtx.clearRect(0, 0, comparisonCanvas.width, comparisonCanvas.height);
                
                // Draw first swing on left
                comparisonCtx.save();
                comparisonCtx.translate(0, 0);
                drawPoses([pose1], comparisonCtx);
                comparisonCtx.restore();

                // Draw second swing on right
                comparisonCtx.save();
                comparisonCtx.translate(video.videoWidth, 0);
                drawPoses([pose2], comparisonCtx);
                comparisonCtx.restore();

                index1++;
                index2++;
            } else {
                clearInterval(comparisonInterval);
                playbackContainer.removeChild(comparisonCanvas);
            }
        }, 100);
    }

    // Add recording completion handler
    function handleRecordingComplete() {
        if (currentSwing.length > 0) {
            recordedSwings.push(currentSwing);
            
            // Add playback button for this swing
            const playbackButton = document.createElement('button');
            playbackButton.textContent = `Play Swing ${recordedSwings.length}`;
            playbackButton.onclick = () => playSwing(currentSwing);
            playbackContainer.appendChild(playbackButton);

            // Add comparison buttons if we have more than one swing
            if (recordedSwings.length > 1) {
                const compareButton = document.createElement('button');
                compareButton.textContent = `Compare with Previous`;
                compareButton.onclick = () => compareSwings(currentSwing, recordedSwings[recordedSwings.length - 2]);
                playbackContainer.appendChild(compareButton);
            }
        }
    }

    // Start processing frames
    processFrame();
}

// Start the pose detection when the page loads
window.addEventListener('load', setupPoseDetection);