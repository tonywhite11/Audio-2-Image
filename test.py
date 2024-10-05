import os

def count_lines_in_directory(directory):
    total_lines = 0
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file != 'test.py':
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        total_lines += sum(1 for line in f)
                except Exception as e:
                    print(f"Error reading file {file_path}: {e}")
    return total_lines

current_directory = os.getcwd()
total_lines = count_lines_in_directory(current_directory)
print(f"Total number of lines in all files (excluding test.py): {total_lines}")
