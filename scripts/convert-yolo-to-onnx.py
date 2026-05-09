"""
Script to convert YOLOv8 model to ONNX format for browser inference
Run this script to convert your trained model: python scripts/convert-yolo-to-onnx.py
"""

from ultralytics import YOLO
import sys

# Path to your trained model
model_path = "public/models/label/best.pt"
# Output path for ONNX model
output_path = "public/models/label/best.onnx"

print(f"Loading model from {model_path}...")
model = YOLO(model_path)

print("Exporting to ONNX format...")
model.export(
    format="onnx",
    imgsz=640,  # Input image size
    opset=12,   # ONNX opset version
    simplify=True,  # Simplify the model
    dynamic=False,  # Fixed input size for better browser performance
)

# The export function creates a file with .onnx extension in the same directory
# Let's move it to the desired location
import os
import shutil

onnx_file = model_path.replace(".pt", ".onnx")
if os.path.exists(onnx_file):
    shutil.move(onnx_file, output_path)
    print(f"Model successfully converted and saved to {output_path}")
else:
    print(f"Error: ONNX file not found at {onnx_file}")
    sys.exit(1)

print("\nConversion complete!")
print(f"You can now use the ONNX model at: {output_path}")
