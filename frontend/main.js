async function setupPoseDetection() {
    const detector = await setupPoseDetection.createDetector(
        setupPoseDetection.SupportModels.BlazePose,
        {
            runtime: "tfjs",
            enableSmoothing: true,
        }
    );

    const video = document.getElementById('video');
    const outputCanvas = document.getElementById('outputCanvas');
    const ctx = outputCanvas.getContext('2d');

    // Set up video stream
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    // Resize canvas to match video
    outputCanvas.width = video.videoWidth;
    outputCanvas.height = video.videoHeight;

    async function processFrame() {
        const poses = await detector.estimatePoses(video);

        // Draw poses
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        if (poses.length > 0) {
            drawPoses(poses, ctx);
            analyzeSwing(poses[0]);
        }

        requestAnimationFrame(processFrame);
    }

    function drawPoses(poses, ctx) {
        //
    }

    function analyzeSwing(pose) {
        //
    }

    processFrame();
}

setupPoseDetection();