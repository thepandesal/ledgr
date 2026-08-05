$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\(tabs)\home.tsx'
$lines = Get-Content $f -Encoding UTF8

# Remove savings amount block: lines 740-742 (index 739-741)
# Remove expense amount block: lines 759-763 (index 758-762)
# Do expense first (higher index) to avoid shifting
$lines = $lines[0..757] + $lines[763..($lines.Length - 1)]
# Now savings block is still at original index 739-741
$lines = $lines[0..738] + $lines[742..($lines.Length - 1)]

$lines | Set-Content $f -Encoding UTF8
"Done. Lines: $($lines.Length)"
