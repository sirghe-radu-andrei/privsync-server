#!/bin/sh
# init-backup-server.sh
apk update
apk add openssh rsync bash
adduser -D privsync
passwd -l privsync

mkdir -p /srv/privsync/data /srv/privsync/keys /srv/privsync/snapshots
chown -R privsync:privsync /srv/privsync

# Create ssh key directory
mkdir -p /home/privsync/.ssh
chmod 700 /home/privsync/.ssh
chown -R privsync:privsync /home/privsync/.ssh

# Copy privsync-rsync script
cp /mnt/init-scripts/privsync-rsync /usr/local/bin/
chmod +x /usr/local/bin/privsync-rsync

# Enable SSH server
rc-update add sshd
rc-service sshd start