$ErrorActionPreference = 'Stop'

try {
    # Chocolatey exposes gsudo through its PATH shim; its installation directory
    # differs from the standalone/winget installer.
    $gsudoExecutable = (Get-Command gsudo -ErrorAction Stop).Source
    $output = & $gsudoExecutable --integrity Medium node tools/windows-smoke.mjs 2>&1
    $testExitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host $_ }
    if ($testExitCode -ne 0) {
        $detail = ($output | Select-Object -Last 30 | Out-String).Trim()
        $detail = $detail.Replace('%', '%25').Replace("`r", '%0D').Replace("`n", '%0A')
        Write-Host "::error::$detail"
        exit $testExitCode
    }
} catch {
    $detail = $_.ToString().Replace('%', '%25').Replace("`r", '%0D').Replace("`n", '%0A')
    Write-Host "::error::$detail"
    exit 1
}
