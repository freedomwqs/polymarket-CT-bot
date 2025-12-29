$InstanceId = "i-07f8e42811b59a1c4"
$JsonFile = "c:\App\polymarket-CT-bot\ssm_deploy_code.json"

Write-Host "Preparing deployment command..."

$Cmds = @(
    "cd /home/bot/app",
    "git config --global --add safe.directory /home/bot/app",
    "sudo -u bot git fetch origin prod",
    "sudo -u bot git reset --hard origin/prod",
    "sudo -u bot npm install",
    "sudo -u bot npm run build",
    "sudo -u bot pm2 restart all --update-env",
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

Write-Host "Sending SSM command to update code..."
$Output = aws ssm send-command --cli-input-json file://$JsonFile --region ap-northeast-1
Write-Host $Output
Write-Host "Deployment command sent. Check AWS Console for status."
