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
      console.log('Requesting camera access...');
      
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false
      };
      
      console.log('Using constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        const video = videoRef.current;
        console.log('Setting video srcObject to stream');
        
        video.srcObject = stream;
        
        // Add event listeners for debugging
        video.onloadedmetadata = () => {
          console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
        };
        
        video.oncanplay = () => {
          console.log('Video can start playing');
        };
        
        video.onplaying = () => {
          console.log('Video is now playing');
        };
        
        video.onerror = (e) => {
          console.error('Video element error:', e);
        };
        
        // Ensure video plays and wait for metadata
        const waitForVideo = new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Video loading timeout'));
          }, 5000);
          
          const onLoadedMetadata = () => {
            console.log('Video ready with dimensions:', video.videoWidth, 'x', video.videoHeight);
            clearTimeout(timeoutId);
            resolve(video);
          };
          
          if (video.readyState >= 1) {
            // Metadata already loaded
            onLoadedMetadata();
          } else {
            video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          }
        });
        
        // Start playing
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Video playback started successfully');
            })
            .catch(error => {
              console.error('Video playback failed:', error);
              // Some mobile browsers require user interaction to play video
              console.log('Video play failed - this might be normal on mobile');
            });
        }
        
        // Wait for video to be ready
        try {
          await waitForVideo;
          console.log('Video is fully ready for capture');
        } catch (videoError) {
          console.warn('Video setup warning:', videoError.message);
          // Continue anyway - video might still work
        }
      } else {
        console.error('videoRef.current is null!');
      }

      streamRef.current = stream;
      console.log('Camera stream active:', stream.getVideoTracks().length, 'video tracks');
      console.log('Video track settings:', stream.getVideoTracks()[0]?.getSettings());
      
      // Set state to active even if video element isn't ready yet
      // The video element will pick up the stream when it mounts
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
        console.error('Camera not active for capture');
        reject(new Error('Camera not active'));
        return;
      }

      const video = videoRef.current;
      
      // Check if video has valid dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error('Video dimensions are 0:', video.videoWidth, 'x', video.videoHeight);
        reject(new Error('Video not ready - no dimensions'));
        return;
      }

      console.log('Capturing photo from video:', video.videoWidth, 'x', video.videoHeight);

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        console.error('Unable to create canvas context');
        reject(new Error('Unable to create canvas context'));
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        // Draw the current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        console.log('Successfully drew video frame to canvas');

        // Convert canvas to blob then to File
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('Successfully created blob:', blob.size, 'bytes');
            const file = new File([blob], `capture-${Date.now()}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            console.log('Created file:', file.name, file.size, 'bytes');
            resolve(file);
          } else {
            console.error('Failed to create blob from canvas');
            reject(new Error('Failed to capture image'));
          }
        }, 'image/jpeg', 0.9);
      } catch (drawError) {
        console.error('Error drawing video to canvas:', drawError);
        reject(new Error('Failed to draw video frame'));
      }
    });
  }, [cameraState.isActive]);

  // Assign stream to video element when both are available
  useEffect(() => {
    if (videoRef.current && streamRef.current && cameraState.isActive) {
      const video = videoRef.current;
      const stream = streamRef.current;
      
      console.log('Assigning stream to video element (via effect)');
      video.srcObject = stream;
      
      const playPromise = video.play();
      if (playPromise) {
        playPromise
          .then(() => {
            console.log('Video playback started via effect');
            setTimeout(() => {
              console.log('Video dimensions via effect:', video.videoWidth, 'x', video.videoHeight);
            }, 500);
          })
          .catch(error => {
            console.error('Video playback failed via effect:', error);
          });
      }
    }
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