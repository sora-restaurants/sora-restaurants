# Auto-sync: every 5 seconds, pulls your teammate's pushed changes into this folder (e.g. so `pnpm dev` hot-reloads).
# Your own uncommitted work is kept (autostash). It never pushes. Run with autosync.bat and leave the window open; close it to stop.
param([int]$Seconds = 5)

Set-Location (Split-Path $PSScriptRoot -Parent)
$env:GIT_TERMINAL_PROMPT = "0"
Write-Host "Auto-sync running in $(Get-Location) every $Seconds s. Close this window to stop." -ForegroundColor Cyan
if (-not (git rev-parse --abbrev-ref "@{u}" 2>$null)) { Write-Host "No upstream for this branch yet: push it once with  git push -u origin HEAD  (needs a GitHub remote)." -ForegroundColor Yellow }

while ($true) {
	git fetch --quiet origin 2>$null
	if ($LASTEXITCODE -eq 0) {
		$behind = [int](git rev-list --count "HEAD..@{u}" 2>$null)
		if ($behind -gt 0) {
			# Don't pull in the middle of a merge/rebase someone (or an AI) is resolving.
			if ((Test-Path .git\rebase-merge) -or (Test-Path .git\rebase-apply) -or (Test-Path .git\MERGE_HEAD)) {
				Write-Host "$(Get-Date -Format HH:mm:ss)  waiting: a merge/rebase is in progress" -ForegroundColor Yellow
			} else {
				git pull --rebase --autostash --quiet 2>$null
				if ($LASTEXITCODE -eq 0) {
					Write-Host "$(Get-Date -Format HH:mm:ss)  pulled $behind new change(s)" -ForegroundColor Green
					git log --oneline -n $behind | ForEach-Object { Write-Host "    $_" }
				} else {
					git rebase --abort 2>$null
					Write-Host "$(Get-Date -Format HH:mm:ss)  conflict with your local changes - ask your AI to 'pull and resolve'" -ForegroundColor Red
				}
			}
		}
	}
	Start-Sleep -Seconds $Seconds
}
