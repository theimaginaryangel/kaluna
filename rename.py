import os

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content.replace("Kaluna", "Kaluna").replace("kaluna", "kaluna")
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

def main():
    exclude_dirs = {'.git', '.github', 'node_modules', '__pycache__'}
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file.endswith('.py') or file.endswith('.md') or file.endswith('.tf') or file.endswith('.yaml') or file.endswith('.go'):
                filepath = os.path.join(root, file)
                replace_in_file(filepath)

if __name__ == '__main__':
    main()
