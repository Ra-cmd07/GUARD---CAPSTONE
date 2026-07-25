"""
Generate placeholder PWA icons for AttendBox
Run: python generate_icons.py
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("⚠️  Pillow library not found. Install it with: pip install Pillow")

def create_icon(size, output_path):
    """Create a simple icon with AttendBox branding"""
    # Create image with blue background
    img = Image.new('RGB', (size, size), color='#1976d2')
    draw = ImageDraw.Draw(img)
    
    # Draw white circle in center (simplified logo)
    margin = size // 6
    draw.ellipse([margin, margin, size-margin, size-margin], fill='white')
    
    # Draw "AB" text in center
    try:
        # Try to use a font, but fall back to default if not available
        font_size = size // 3
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "AB"
    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Center the text
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - size // 20
    
    draw.text((x, y), text, fill='#1976d2', font=font)
    
    # Save icon
    img.save(output_path, 'PNG')
    print(f"✅ Created: {output_path} ({size}x{size})")

def main():
    if not PIL_AVAILABLE:
        print("\n📋 ALTERNATIVE: You can create icons manually:")
        print("1. Create a square image with your logo")
        print("2. Save it in multiple sizes in the 'public' folder:")
        print("   - icon-72x72.png")
        print("   - icon-96x96.png")
        print("   - icon-128x128.png")
        print("   - icon-144x144.png")
        print("   - icon-152x152.png")
        print("   - icon-192x192.png")
        print("   - icon-384x384.png")
        print("   - icon-512x512.png")
        print("\n🌐 Online tools to create icons:")
        print("   - https://www.favicon-generator.org/")
        print("   - https://realfavicongenerator.net/")
        return
    
    # Icon sizes required for PWA
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    
    print("🎨 Generating AttendBox PWA icons...\n")
    
    for size in sizes:
        output_path = f"public/icon-{size}x{size}.png"
        create_icon(size, output_path)
    
    print("\n✅ All icons generated successfully!")
    print("📱 You can now add the app to your phone's home screen.")

if __name__ == "__main__":
    main()
