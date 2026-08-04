$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
# Remove line 2186 (index 2185) - duplicate View
# Also remove the empty lines 2217-2218 (index 2216-2217) and extra </View> at 2219 (index 2218)
$lines = $lines[0..2184] + $lines[2186..2215] + $lines[2219..($lines.Length - 1)]
$lines | Set-Content $f -Encoding UTF8
"Done. Lines: $($lines.Length)" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_result10.txt'
