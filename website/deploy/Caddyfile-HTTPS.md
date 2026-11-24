# Optional HTTPS setup — Caddy (auto Let's Encrypt)
#
# 1. Free domain banao: https://www.duckdns.org  → subdomain choose karo
#    (jaise medlocker.duckdns.org) — IP mein apne VM ka public IP daalo
# 2. Caddy install:
#    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
#    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
#    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
#    sudo apt update && sudo apt install caddy
# 3. Ye file /etc/caddy/Caddyfile banao (domain edit karo):
#
#    medlocker.duckdns.org {
#      reverse_proxy localhost:3001
#    }
#
# 4. sudo systemctl reload caddy
#
# HTTPS certificate khud ban jayega — bas itna hi.
