with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the problem area - look for double divider pattern
problem_start = None
for i, line in enumerate(lines):
    if 'cardDividerColor }} />' in line and i+2 < len(lines) and 'cardDividerColor }} />' in lines[i+2]:
        problem_start = i
        print(f"Found double divider at lines {i+1} and {i+3}")
        # Print context
        for j in range(max(0,i-2), min(len(lines), i+20)):
            print(f"{j+1}: {repr(lines[j])}")
        break

if problem_start is None:
    # Try with blank lines between
    for i, line in enumerate(lines):
        if 'cardDividerColor }} />' in line:
            # Check next few lines for another divider
            for k in range(i+1, min(i+5, len(lines))):
                if 'cardDividerColor }} />' in lines[k]:
                    problem_start = i
                    print(f"Found double divider at lines {i+1} and {k+1}")
                    for j in range(max(0,i-2), min(len(lines), k+15)):
                        print(f"{j+1}: {repr(lines[j])}")
                    break
            if problem_start is not None:
                break
