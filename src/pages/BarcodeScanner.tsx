import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.tsx';
import { useCamera } from '../hooks/useCamera.ts';
import { analyzeImage, getSuggestedExpirationDate, VisionResult } from '../services/aiVision.ts';
import { foodApi } from '../services/api.ts';

export const BarcodeScanner: React.FC = () => {
  const navigate = useNavigate();
  const { videoRef, cameraState, startCamera, stopCamera, capturePhoto } = useCamera();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    // Start camera when component mounts
    startCamera();

    // Cleanup when component unmounts
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleCapture = async () => {
    try {
      setIsProcessing(true);
      setResult(null);
      
      const imageFile = await capturePhoto();
      const analysisResult = await analyzeImage(imageFile);
      
      setResult(analysisResult);
      setShowResult(true);
      
      // Handle different result types
      if (analysisResult.type === 'barcode') {
        await handleBarcodeDetection(analysisResult.barcode);
      } else if (analysisResult.type === 'receipt') {
        await handleReceiptDetection(analysisResult.items);
      }
    } catch (error) {
      console.error('Error capturing/analyzing image:', error);
      setResult({
        type: 'none',
        message: 'Error processing image. Please try again.'
      });
      setShowResult(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBarcodeDetection = async (barcode: string) => {
    // Don't automatically navigate - let user see the barcode first
    // They can manually proceed to add item if desired
    console.log('Barcode detected:', barcode);
  };

  const handleReceiptDetection = async (items: any[]) => {
    try {
      // Add all items from receipt
      const promises = items.map(item => 
        foodApi.addItem({
          name: item.name,
          description: `From receipt scan`,
          category: item.category,
          expirationDate: getSuggestedExpirationDate(item.category),
          quantity: item.quantity,
          unit: item.unit,
          upcCode: undefined
        })
      );
      
      await Promise.all(promises);
      
      // Navigate back to home to see added items
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Error adding receipt items:', error);
    }
  };

  const resetScan = () => {
    setResult(null);
    setShowResult(false);
  };

  return (
    <Layout title="AI Scan">
      <div className="flex flex-col items-center gap-6">
        {/* Camera Preview */}
        <div className="relative w-full max-w-sm">
          {cameraState.isLoading && (
            <div className="w-full h-64 bg-gray-200 border-2 border-black flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p>Starting camera...</p>
              </div>
            </div>
          )}
          
          {cameraState.error && (
            <div className="w-full h-64 bg-red-50 border-2 border-red-300 flex items-center justify-center p-4">
              <div className="text-center">
                <p className="text-red-600 mb-3">{cameraState.error}</p>
                <button 
                  onClick={startCamera}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          
          {cameraState.isActive && (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover border-2 border-black bg-black"
                playsInline
                muted
                autoPlay
                style={{
                  transform: 'scaleX(-1)', // Mirror the video for better UX
                }}
                onLoadedMetadata={() => {
                  console.log('Video metadata loaded, dimensions:', 
                    videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
                }}
                onError={(e) => {
                  console.error('Video error:', e);
                }}
              />
              
              {/* Debug info overlay */}
              <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">
                {videoRef.current?.videoWidth || 0}x{videoRef.current?.videoHeight || 0}
              </div>
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 border-2 border-green-500 pointer-events-none">
                <div className="absolute inset-4 border-2 border-dashed border-green-500 flex items-center justify-center">
                  <span className="bg-green-500 text-white px-2 py-1 text-xs rounded">
                    Position barcode or receipt here
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Capture Button */}
        {cameraState.isActive && (
          <button
            onClick={handleCapture}
            disabled={isProcessing}
            className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-2xl font-bold transition-colors ${
              isProcessing 
                ? 'bg-gray-300 border-gray-400 text-gray-600 cursor-not-allowed' 
                : 'bg-green-600 border-green-700 text-white hover:bg-green-700'
            }`}
          >
            {isProcessing ? (
              <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full"></div>
            ) : (
              '📷'
            )}
          </button>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="text-center">
            <p className="text-gray-600">Analyzing image with AI...</p>
          </div>
        )}

        {/* Results */}
        {showResult && result && (
          <div className="w-full max-w-sm bg-white border-2 border-black p-4">
            {result.type === 'barcode' && (
              <div className="text-center">
                <div className="text-green-600 text-xl mb-2">✅ Barcode Detected!</div>
                <p className="font-mono text-lg mb-2 bg-gray-100 p-2 rounded">
                  {result.barcode}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Confidence: {Math.round(result.confidence * 100)}%
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/add', { 
                      state: { upcCode: result.barcode }
                    })}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Add Item
                  </button>
                  <button
                    onClick={resetScan}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Scan Again
                  </button>
                </div>
              </div>
            )}
            
            {result.type === 'receipt' && (
              <div className="text-center">
                <div className="text-blue-600 text-xl mb-2">🧾 Receipt Detected!</div>
                <p className="text-sm text-gray-600 mb-3">
                  Found {result.items.length} items (Confidence: {Math.round(result.confidence * 100)}%)
                </p>
                <div className="text-left text-sm mb-3">
                  {result.items.map((item, index) => (
                    <div key={index} className="border-b py-1">
                      {item.quantity} {item.unit} {item.name}
                    </div>
                  ))}
                </div>
                <p className="text-sm">Adding items to pantry...</p>
              </div>
            )}
            
            {result.type === 'none' && (
              <div className="text-center">
                <div className="text-orange-600 text-xl mb-2">❓ Nothing Found</div>
                <p className="text-sm text-gray-600 mb-3">{result.message}</p>
                <button
                  onClick={resetScan}
                  className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-center text-sm text-gray-600 px-4">
          <p className="mb-2">Point camera at:</p>
          <p className="mb-1">• <strong>Barcode</strong> - to add single item</p>
          <p>• <strong>Receipt</strong> - to add multiple items</p>
        </div>
      </div>
    </Layout>
  );
};