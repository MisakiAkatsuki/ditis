Set-Location D:\TimeSheet
git checkout main -q

$branches = @(
    "fix/space-on-filled-cell",
    "fix/rust-security",
    "fix/js-security",
    "fix/data-integrity",
    "fix/ux-bugs",
    "fix/performance"
)

foreach ($b in $branches) {
    Write-Host "=== Merging $b ===" -ForegroundColor Cyan
    $r = git merge $b --no-edit 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "CONFLICT or ERROR:" -ForegroundColor Red
        $r | ForEach-Object { Write-Host $_ }
        git merge --abort 2>$null
        exit 1
    }
    Write-Host "OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Final test ===" -ForegroundColor Cyan
npm run test:run 2>&1 | Where-Object { $_ -match "Test Files|Tests " }
