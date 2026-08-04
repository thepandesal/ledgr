$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
# Line 2183 (index 2182) and 2184 (index 2183) are duplicates - remove index 2182
$lines = $lines[0..2181] + $lines[2183..($lines.Length - 1)]
$lines | Set-Content $f -Encoding UTF8
"Done. Lines: $($lines.Length)" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_result7.txt'
