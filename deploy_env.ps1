$InstanceId = "i-07f8e42811b59a1c4"
$EnvFile = "c:\App\polymarket-CT-bot\.env"
$JsonFile = "c:\App\polymarket-CT-bot\ssm_input.json"

Write-Host "Reading .env file..."
$Content = Get-Content $EnvFile -Raw
if (-not $Content) {
    Write-Error "Failed to read .env file or file is empty."
    exit 1
}

$Base64 = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Content))

$Cmds = @(
    "echo $Base64 | base64 -d > /home/bot/app/.env",
    "chown bot:bot /home/bot/app/.env",
    "chmod 600 /home/bot/app/.env",
    "ls -l /home/bot/app/.env",
    "export PATH=`$PATH:/usr/local/bin:/root/.bun/bin",
    "sudo -u bot pm2 restart all --update-env",
    "sleep 2",
    "sudo -u bot pm2 list",
    "sudo -u bot pm2 logs --lines 20 --nostream"
)

$Payload = @{
    DocumentName = "AWS-RunShellScript"
    Targets = @(
        @{
            Key = "instanceids"
            Values = @($InstanceId)
        }
    )
    Parameters = @{
        commands = $Cmds
    }
}

Write-Host "Creating JSON input file..."
if (Test-Path $JsonFile) { Remove-Item $JsonFile }
$Payload | ConvertTo-Json -Depth 5 | Out-File -FilePath $JsonFile -Encoding Ascii

Write-Host "Sending SSM command..."
$Output = aws ssm send-command --cli-input-json file://$JsonFile --region ap-northeast-1
Write-Host $Output
