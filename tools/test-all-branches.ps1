$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Set-Location D:\TimeSheet
$current = git rev-parse --abbrev-ref HEAD
$branches = @(
    "fix/rust-security",
    "fix/js-security",
    "fix/data-integrity",
    "fix/ux-bugs",
    "fix/performance",
    "fix/space-on-filled-cell"
)

$results = @()
foreach ($b in $branches) {
    git checkout $b -q 2>$null
    $out = npm run test:run 2>&1 | ForEach-Object { $_.ToString() }
    $testLine = ($out | Where-Object { $_ -match "Tests " } | Select-Object -First 1)
    # extract numbers
    $passMatch = [regex]::Match($testLine, '(\d+) passed')
    $failMatch = [regex]::Match($testLine, '(\d+) failed')
    $passed = if ($passMatch.Success) { $passMatch.Groups[1].Value } else { "?" }
    $failed = if ($failMatch.Success) { $failMatch.Groups[1].Value } else { "0" }
    $status = if ($failed -ne "0") { "FAIL" } else { "PASS" }
    $results += [PSCustomObject]@{ Branch = $b; Status = $status; Passed = $passed; Failed = $failed }
}

git checkout $current -q 2>$null

$results | Format-Table -AutoSize
