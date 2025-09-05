import { useState, useRef, useCallback, useEffect } from 'react';

export interface CameraState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
}

export const useCamera = () => {
  const [cameraState, setCameraState] = useState<CameraState>({
    isActive: false,
    isLoading: false,
    error: null,
    hasPermission: false
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    setCameraState(prev => ({ ...prev, isLoading: true, error: null }));


    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready before marking as active
        const video = videoRef.current;
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Video playback started successfully');
              console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
            })
            .catch(error => {
              console.error('Video playback failed:', error);
            });
        }
      }

      streamRef.current = stream;
      console.log('Camera stream active:', stream.getVideoTracks().length, 'video tracks');
      console.log('Video track settings:', stream.getVideoTracks()[0]?.getSettings());
      
      setCameraState({
        isActive: true,
        isLoading: false,
        error: null,
        hasPermission: true
      });
    } catch (error) {
      console.error('Error accessing camera:', error);
      
      let errorMessage = 'Unable to access camera.';
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'Camera permission denied. Please allow camera access and try again.';
            break;
          case 'NotFoundError':
            errorMessage = 'No camera found on this device.';
            break;
          case 'NotReadableError':
            errorMessage = 'Camera is being used by another application.';
            break;
          default:
            errorMessage = 'Camera error: ' + error.message;
        }
      }

      setCameraState({
        isActive: false,
        isLoading: false,
        error: errorMessage,
        hasPermission: false
      });
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraState({
      isActive: false,
      isLoading: false,
      error: null,
      hasPermission: true
    });
  }, []);

  // Capture photo from video stream
  const capturePhoto = useCallback((): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current || !cameraState.isActive) {
        reject(new Error('Camera not active'));
        return;
      }

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('Unable to create canvas context'));
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to blob then to File
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(file);
        } else {
          reject(new Error('Failed to capture image'));
        }
      }, 'image/jpeg', 0.9);
    });
  }, [cameraState.isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    cameraState,
    startCamera,
    stopCamera,
    capturePhoto
  };
};