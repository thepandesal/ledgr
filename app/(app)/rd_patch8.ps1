$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8

# Fix 1: date color - line 2170 (index 2169)
$lines[2169] = "              <Text style={rd.infoValue}>{recording ? formatDate(recording.transaction_date) : ''}</Text>"

# Fix 2: loan toggle - remove locked condition and isActive guard - line 2191 (index 2190) and 2197 (index 2196)
$lines[2190] = "                    const locked = !isOwner;"
$lines[2196] = "                          if (locked) return;"

$lines | Set-Content $f -Encoding UTF8
"Done" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_result8.txt'
