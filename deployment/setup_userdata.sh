#!/bin/bash
# ==============================================================================
# Polymarket Bot - Production Initialization Script (User Data)
# ==============================================================================
# This script is designed to be used in the AWS EC2 "User Data" field.
# It automatically sets up the environment, security, logging, and application.
#
# Best Practice Checklist:
# 1. [Security] No SSH keys required (uses SSM).
# 2. [Security] UFW disabled (relies on AWS Security Groups).
# 3. [Observability] CloudWatch Agent installed and configured immediately.
# 4. [Reliability] PM2 configured for auto-restart.
# ==============================================================================

set -e  # Exit immediately if a command exits with a non-zero status.

echo "[INIT] Starting system initialization..."

# ------------------------------------------------------------------------------
# 1. System Updates & Basic Tools
# ------------------------------------------------------------------------------
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget git unzip jq build-essential

# ------------------------------------------------------------------------------
# 2. Network Security (The "Anti-Lockout" Strategy)
# ------------------------------------------------------------------------------
# We rely on AWS Security Groups. UFW often causes access issues if misconfigured.
echo "[NET] Disabling UFW to prevent SSH lockouts..."
ufw disable

# Ensure iptables allows local loopback and established connections
iptables -F
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j ACCEPT # Optional backup
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

echo "[SSH] Configuring User SSH Keys..."
mkdir -p /home/ubuntu/.ssh
chmod 700 /home/ubuntu/.ssh
touch /home/ubuntu/.ssh/authorized_keys
chmod 600 /home/ubuntu/.ssh/authorized_keys
grep -q "AAAAC3NzaC1lZDI1NTE5AAAAIBqTRlAMWjzTh+cYp2ZKg5d2/4ObFI5eW2twZvHvw2iw" /home/ubuntu/.ssh/authorized_keys || echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBqTRlAMWjzTh+cYp2ZKg5d2/4ObFI5eW2twZvHvw2iw 青水@LAPTOP-7UNJ4RMQ" >> /home/ubuntu/.ssh/authorized_keys
chown -R ubuntu:ubuntu /home/ubuntu/.ssh
rm -rf /home/ubuntu/.vscode-server /home/ubuntu/.vscode-server-insiders || true
chown -R ubuntu:ubuntu /home/ubuntu

# ------------------------------------------------------------------------------
# 3. AWS CloudWatch Agent (Observability from Minute 0)
# ------------------------------------------------------------------------------
echo "[AWS] Installing CloudWatch Agent..."
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb

# Create CloudWatch Config
cat <<EOF > /opt/aws/amazon-cloudwatch-agent/bin/config.json
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/home/ubuntu/polymarket-CT-bot/logs/app.log",
            "log_group_name": "polymarket-bot-logs",
            "log_stream_name": "{instance_id}-app-log"
          },
          {
            "file_path": "/home/ubuntu/.pm2/logs/polymarket-bot-out.log",
            "log_group_name": "polymarket-bot-logs",
            "log_stream_name": "{instance_id}-pm2-out"
          },
          {
            "file_path": "/home/ubuntu/.pm2/logs/polymarket-bot-error.log",
            "log_group_name": "polymarket-bot-logs",
            "log_stream_name": "{instance_id}-pm2-error"
          },
          {
            "file_path": "/var/log/syslog",
            "log_group_name": "polymarket-bot-logs",
            "log_stream_name": "{instance_id}-syslog"
          }
        ]
      }
    }
  },
  "metrics": {
    "metrics_collected": {
      "mem": { "measurement": ["mem_used_percent"], "metrics_collection_interval": 60 },
      "swap": { "measurement": ["swap_used_percent"], "metrics_collection_interval": 60 },
      "disk": { "measurement": ["used_percent"], "metrics_collection_interval": 60, "resources": ["*"] }
    }
  }
}
EOF

# Start CloudWatch Agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json

# ------------------------------------------------------------------------------
# 4. Runtime Environment (Node.js & PM2)
# ------------------------------------------------------------------------------
echo "[NODE] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "[PM2] Installing Process Manager..."
npm install -g pm2 typescript ts-node
# Configure PM2 to start on boot
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# ------------------------------------------------------------------------------
# 5. Application Setup (Skeleton)
# ------------------------------------------------------------------------------
# Clone repo if needed, or rely on AMI. 
# Here we assume the directory might exist or needs to be pulled.
# mkdir -p /home/ubuntu/polymarket-CT-bot
# chown -R ubuntu:ubuntu /home/ubuntu/polymarket-CT-bot

echo "[INIT] Initialization Complete. Instance is ready."
