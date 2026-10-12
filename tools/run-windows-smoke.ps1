$ErrorActionPreference = 'Stop'

try {
    # Chocolatey exposes gsudo through its PATH shim; its installation directory
    # differs from the standalone/winget installer.
    $gsudoExecutable = (Get-Command gsudo -ErrorAction SilentlyContinue).Source
    if (!$gsudoExecutable) {
        # A newly installed machine PATH may not be inherited by the runner.
        # Use the package binary documented by gsudo's Chocolatey installer.
        $gsudoExecutable = Join-Path $env:ChocolateyInstall 'lib\gsudo\tools\x64\gsudo.exe'
        if (!(Test-Path $gsudoExecutable)) { throw 'Chocolatey gsudo executable was not found' }
    }
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
