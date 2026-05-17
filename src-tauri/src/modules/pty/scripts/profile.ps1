# notex-shell-integration (profile.ps1)

if (-not $env:__NOTEX_HOOKS_LOADED) {
    $env:__NOTEX_HOOKS_LOADED = 1

    function _notex_precmd {
        $last_status = $? ? 0 : 1
        Write-Host -NoNewline "$([char]27)]133;D;$last_status$([char]27)\"
        
        $hostname = $env:COMPUTERNAME
        $pwd_encoded = [uri]::EscapeDataString($ExecutionContext.SessionState.Path.CurrentLocation.Path)
        Write-Host -NoNewline "$([char]27)]7;file://$hostname$pwd_encoded$([char]27)\"
        Write-Host -NoNewline "$([char]27)]133;A$([char]27)\"
    }

    # Custom Prompt
    function prompt {
        _notex_precmd
        Write-Host -NoNewline "$([char]27)]133;B$([char]27)\"
        
        Write-Host -NoNewline -ForegroundColor Green $env:USERNAME
        Write-Host -NoNewline "@"
        Write-Host -NoNewline -ForegroundColor Green $env:COMPUTERNAME
        Write-Host -NoNewline ":"
        Write-Host -NoNewline -ForegroundColor Blue ($ExecutionContext.SessionState.Path.CurrentLocation.RelativePath -replace "^\.", "~")

        # Git branch
        if (Get-Command git -ErrorAction SilentlyContinue) {
            $branch = git rev-parse --abbrev-ref HEAD 2>$null
            if ($branch) {
                Write-Host -NoNewline " "
                Write-Host -NoNewline -ForegroundColor Cyan "($branch)"
            }
        }

        Write-Host -NoNewline -ForegroundColor Green " > "
        return " "
    }
}
