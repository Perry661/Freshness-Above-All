(function initFreshTrackerScan(global) {
  let stream = null;
  let detector = null;
  let videoElement = null;
  let frameHandle = 0;
  let active = false;
  let onDetectedHandler = null;
  let onStatusHandler = null;

  function isSupported() {
    return Boolean(global.BarcodeDetector && navigator.mediaDevices?.getUserMedia);
  }

  async function start(options = {}) {
    const video = document.getElementById(options.videoId || "barcode-video");
    if (!video) {
      options.onStatus?.("Scanner preview is not available.");
      return;
    }

    stop();

    videoElement = video;
    onDetectedHandler = options.onDetected || null;
    onStatusHandler = options.onStatus || null;

    if (!isSupported()) {
      onStatusHandler?.("Barcode scanning is not supported in this browser. Use manual barcode entry below.");
      return;
    }

    try {
      detector = new global.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"]
      });
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        },
        audio: false
      });
      videoElement.srcObject = stream;
      await videoElement.play();
      active = true;
      onStatusHandler?.("Scanning... point the barcode inside the frame.");
      scanFrame();
    } catch (error) {
      onStatusHandler?.(`Unable to start camera scan: ${error.message}`);
      stop();
    }
  }

  function stop() {
    active = false;
    if (frameHandle) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (videoElement) {
      videoElement.pause?.();
      videoElement.srcObject = null;
    }
  }

  async function scanFrame() {
    if (!active || !detector || !videoElement || videoElement.readyState < 2) {
      frameHandle = requestAnimationFrame(scanFrame);
      return;
    }

    try {
      const barcodes = await detector.detect(videoElement);
      const code = barcodes.find((item) => item.rawValue)?.rawValue;
      if (code) {
        onStatusHandler?.(`Scanned barcode: ${code}`);
        onDetectedHandler?.(code);
        stop();
        return;
      }
    } catch (error) {
      onStatusHandler?.(`Scan failed: ${error.message}`);
      stop();
      return;
    }

    frameHandle = requestAnimationFrame(scanFrame);
  }

  global.FreshTrackerScan = {
    isSupported,
    start,
    stop
  };
})(window);
