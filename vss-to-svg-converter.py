#!/usr/bin/env python3
"""
VSS to SVG Converter using Aspose.Diagram
Converts Microsoft Visio stencil files (.vss) to SVG format for Eraser AI import

Requirements:
pip install aspose-diagram

Usage:
python vss-to-svg-converter.py input.vss output.svg
"""
import sys
import os

# Correct import for aspose-diagram package
import asposediagram
asposediagram.startJVM()
from asposediagram.api import Diagram, SaveFileFormat

print(sys.executable)
print("Aspose.Diagram import successful")

def convert_vss_to_svg(input_path, output_path):
    """
    Convert a VSS file to SVG format
    
    Args:
        input_path (str): Path to input VSS file
        output_path (str): Path for output SVG file
    """
    try:
        # Load the Visio stencil file
        print(f"Loading VSS file: {input_path}")
        diagram = Diagram(input_path)
        
        # Save as SVG
        print(f"Converting to SVG: {output_path}")
        diagram.save(output_path, SaveFileFormat.SVG)
        
        print(f"✅ Successfully converted: {input_path} → {output_path}")
        return True
    except Exception as e:
        print(f"❌ Error converting {input_path}: {str(e)}")
        return False

def batch_convert_directory(input_dir, output_dir):
    """
    Convert all VSS files in a directory to SVG files
    
    Args:
        input_dir (str): Directory containing VSS files
        output_dir (str): Directory for output SVG files
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all VSS files
    vss_files = []
    for file in os.listdir(input_dir):
        if file.lower().endswith('.vss'):
            vss_files.append(file)
    
    if not vss_files:
        print(f"No VSS files found in {input_dir}")
        return
    
    print(f"Found {len(vss_files)} VSS files to convert")
    
    success_count = 0
    for vss_file in vss_files:
        input_path = os.path.join(input_dir, vss_file)
        output_file = os.path.splitext(vss_file)[0] + '.svg'
        output_path = os.path.join(output_dir, output_file)
        
        if convert_vss_to_svg(input_path, output_path):
            success_count += 1
    
    print(f"\n📊 Conversion complete: {success_count}/{len(vss_files)} files converted successfully")

if __name__ == "__main__":
    if len(sys.argv) == 3:
        # Single file conversion
        input_file = sys.argv[1]
        output_file = sys.argv[2]
        
        if not os.path.exists(input_file):
            print(f"❌ Input file not found: {input_file}")
            sys.exit(1)
        
        convert_vss_to_svg(input_file, output_file)
        
    elif len(sys.argv) == 4 and sys.argv[1] == '--batch':
        # Batch convert all .vss files in a directory
        input_dir = sys.argv[2]
        output_dir = sys.argv[3]
        
        if not os.path.isdir(input_dir):
            print(f"❌ Input directory not found: {input_dir}")
            sys.exit(1)
        
        batch_convert_directory(input_dir, output_dir)
        
    else:
        print("Usage:")
        print("  python vss-to-svg-converter.py input.vss output.svg")
        print("  python vss-to-svg-converter.py --batch input_dir output_dir")
        sys.exit(1)
