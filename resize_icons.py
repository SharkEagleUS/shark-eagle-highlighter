from PIL import Image
import os

def resize_icon(input_path, output_path, size):
    """Resize the icon to the specified size and save it to the output path."""
    with Image.open(input_path) as img:
        # Resize the image with high quality
        resized_img = img.resize((size, size), Image.LANCZOS)
        # Save the resized image
        resized_img.save(output_path)
        print(f"Created {output_path} ({size}x{size})")

def main():
    # Path to the original icon
    icon_path = "public/logo.png"
    # Directory where the resized icons will be saved
    output_dir = "public/icon"

    # Sizes to generate
    sizes = [16, 32, 48, 128]

    # Create the output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # Resize the icon for each size
    for size in sizes:
        output_path = os.path.join(output_dir, f"{size}.png")
        resize_icon(icon_path, output_path, size)

    print("All icons have been generated successfully!")

if __name__ == "__main__":
    main()