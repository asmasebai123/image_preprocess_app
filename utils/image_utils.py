import cv2
import numpy as np
import base64  # Ajout de cet import

def encode_image_to_base64(image):
    """Convert OpenCV image to base64 string"""
    _, buffer = cv2.imencode('.png', image)
    return base64.b64encode(buffer).decode('utf-8')

def decode_base64_to_image(base64_string):
    """Convert base64 string to OpenCV image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    img_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def get_image_info(image):
    """Get basic image information"""
    height, width = image.shape[:2]
    channels = 1 if len(image.shape) == 2 else image.shape[2]
    return {
        'width': width,
        'height': height,
        'channels': channels,
        'dtype': str(image.dtype)
    }

def create_histogram_image(histogram, width=400, height=200):
    """Create a visual representation of histogram"""
    hist_img = np.zeros((height, width, 3), dtype=np.uint8)
    
    if histogram is None or len(histogram) == 0:
        return hist_img
    
    # Normalize histogram
    hist = histogram.astype(np.float32)
    cv2.normalize(hist, hist, 0, height, cv2.NORM_MINMAX)
    
    # Draw histogram
    bin_width = width // len(hist)
    for i in range(len(hist)):
        cv2.rectangle(hist_img,
                     (i * bin_width, height),
                     ((i + 1) * bin_width - 1, height - int(hist[i])),
                     (255, 255, 255),
                     -1)
    
    return hist_img