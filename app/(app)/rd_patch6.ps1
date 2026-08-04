$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
# Line 2304 (index 2303) has '</>)}' - fix to proper closing
$lines[2303] = '            </>'
$lines[2304] = '          )}'
$lines | Set-Content $f -Encoding UTF8
"Done" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_result6.txt'
