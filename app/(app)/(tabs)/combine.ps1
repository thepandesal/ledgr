$dir = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\(tabs)\'
$f = $dir + 'home.tsx'

$all = Get-Content $f -Encoding UTF8
$before = $all[0..587]

$sectionHeaderLine = -1
for ($i = 732; $i -lt $all.Length; $i++) {
  if ($all[$i] -match 'function SectionHeader') { $sectionHeaderLine = $i; break }
}

$styleSheetLine = -1
for ($i = $sectionHeaderLine; $i -lt $all.Length; $i++) {
  if ($all[$i] -match 'const s = StyleSheet') { $styleSheetLine = $i; break }
}

$bottomSheets = $all[731..($sectionHeaderLine - 1)]

$mid     = Get-Content ($dir + 'home_mid.txt') -Encoding UTF8
$helpers = Get-Content ($dir + 'home_helpers.txt') -Encoding UTF8
$styles  = Get-Content ($dir + 'home_styles.txt') -Encoding UTF8

$combined = $before + $mid + $bottomSheets + $helpers + $styles
$combined | Set-Content $f -Encoding UTF8

$result = Get-Content $f -Encoding UTF8
"Done. Lines: $($result.Length), SectionHeader was at: $($sectionHeaderLine+1), StyleSheet was at: $($styleSheetLine+1)" | Out-File ($dir + 'combine_result.txt')
