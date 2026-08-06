import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'app/(app)/split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()
for i, l in enumerate(lines, 1):
    if 2940 <= i <= 2960:
        print(i, l.rstrip()[:130])
