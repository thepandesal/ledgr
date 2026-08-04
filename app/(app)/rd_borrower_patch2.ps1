$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
$lines[2221] = "                  <Text style={[rd.infoValue, !recording?.person_name && !linkedSplitBill && { fontStyle: 'italic' }]}>{linkedSplitBill ? 'has split bill' : (recording?.person_name || 'tap to assign')}</Text>"
$lines | Set-Content $f -Encoding UTF8
"Done"
