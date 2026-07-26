# test_generalizer.py
import os
from pipeline.ai.query_generalizer import generalize_title

# Optional: If settings.GEMINI_API_KEY isn't picking up from your environment yet, 
# you can temporarily set it here for testing:
# os.environ["GEMINI_API_KEY"] = "your_actual_api_key_here"

test_titles = [
    (
        "Haier AC 1 Ton DC Inverter Split | Model AC HSU -13LF (New Model) / "
        "HSU-12LF | UPS Enabled Self Cleaning 67% Energy Saving Turbo Cooling"
    ),
    (
        "Apple iPhone 15 Pro Max (256 GB) - Natural Titanium with 1 Year Official "
        "Brand Warranty and Free Silicone Case"
    ),
    "Sony WH-1000XM5 Wireless Noise Canceling Headphones Black",
]

print("Starting Gemini Query Generalizer Test...\n")

for i, title in enumerate(test_titles, 1):
    print(f"--- Test Case {i} ---")
    print(f"Original: {title}")
    result = generalize_title(title)
    print(f"Generalized: {result}\n")