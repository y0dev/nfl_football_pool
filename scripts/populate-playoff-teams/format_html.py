#!/usr/bin/env python3
"""Format ESPN HTML response to make it readable and extract data structure."""

import sys
import os
from bs4 import BeautifulSoup
import json

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
html_file = os.path.join(project_root, 'espn-response-2025.html')

if not os.path.exists(html_file):
    print(f"Error: {html_file} not found")
    sys.exit(1)

print(f"Reading {html_file}...")
try:
    with open(html_file, 'r', encoding='utf-8', errors='ignore') as f:
        html_content = f.read()
except Exception as e:
    print(f"Error reading file: {e}")
    sys.exit(1)

# Format HTML using BeautifulSoup
print("Formatting HTML...")
soup = BeautifulSoup(html_content, 'html.parser')
formatted_html = soup.prettify()

# Save formatted HTML
formatted_file = os.path.join(project_root, 'espn-response-2025-formatted.html')
with open(formatted_file, 'w', encoding='utf-8') as f:
    f.write(formatted_html)
print(f"Saved formatted HTML to: {formatted_file}")

# Extract and format JSON data from script tags
scripts = soup.find_all('script')
print(f"\nFound {len(scripts)} script tags")

import re
for i, script in enumerate(scripts):
    if script.string and '__espnfitt__' in script.string:
        print(f"\nExtracting data from script {i}...")
        script_text = script.string
        
        # Extract JSON
        json_matches = re.findall(r'window\.__espnfitt__\s*=\s*({.+});?\s*$', script_text, re.DOTALL | re.MULTILINE)
        if json_matches:
            try:
                data = json.loads(json_matches[0])
                
                # Save formatted JSON
                json_file = os.path.join(project_root, 'espn-data-formatted.json')
                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"Saved formatted JSON to: {json_file}")
                
                # Try to extract just the standings portion
                def extract_standings_path(obj, path="", results=None):
                    if results is None:
                        results = []
                    if isinstance(obj, dict):
                        for key, value in obj.items():
                            current_path = f"{path}.{key}" if path else key
                            if 'standings' in key.lower() and isinstance(value, dict):
                                if 'groups' in value or 'entries' in value:
                                    results.append((current_path, value))
                            extract_standings_path(value, current_path, results)
                    elif isinstance(obj, list):
                        for idx, item in enumerate(obj):
                            extract_standings_path(item, f"{path}[{idx}]", results)
                    return results
                
                standings_paths = extract_standings_path(data)
                if standings_paths:
                    path, standings_data = standings_paths[0]
                    standings_file = os.path.join(project_root, 'espn-standings-data.json')
                    with open(standings_file, 'w', encoding='utf-8') as f:
                        json.dump(standings_data, f, indent=2, ensure_ascii=False)
                    print(f"Saved standings data to: {standings_file}")
                    print(f"Path: {path}")
                
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
        
        break

print("\nFormatting complete!")

