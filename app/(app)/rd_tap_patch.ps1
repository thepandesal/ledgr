$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
$lines[2280] = "                    <Text style={rd.infoValue}>tap to open</Text>"
$lines | Set-Content $f -Encoding UTF8
"Done"
